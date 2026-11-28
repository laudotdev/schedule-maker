import logging


def current_rss_mb():
    """Read current Linux RSS from procfs without a new dependency."""
    try:
        with open('/proc/self/status', encoding='ascii') as status:
            for line in status:
                if line.startswith('VmRSS:'):
                    return round(int(line.split()[1]) / 1024, 1)
    except (OSError, ValueError):
        pass
    return None


def log_memory(stage, logger=None, **fields):
    logger = logger or logging.getLogger(__name__)
    rss = current_rss_mb()
    details = ' '.join(f'{key}={value}' for key, value in fields.items())
    logger.info('memory stage=%s rss_mb=%s %s', stage, rss if rss is not None else 'unavailable', details)
