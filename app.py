import re

from flask import Flask, current_app, jsonify, request
from werkzeug.exceptions import HTTPException, RequestEntityTooLarge

from routes.schedule import schedule
from services.memory import log_memory


MAX_UPLOAD_MB = 10
ALLOWED_ORIGINS = {
    "https://schedmaker.vercel.app",
    "https://sked.laupyde.online",
}
VERCEL_PREVIEW_ORIGIN = re.compile(
    r"^https://schedule-maker-[a-z0-9-]+-laurences-projects-e3ac5440\.vercel\.app$"
)


def _origin_is_allowed(origin):
    return bool(
        origin
        and (
            origin in ALLOWED_ORIGINS
            or VERCEL_PREVIEW_ORIGIN.fullmatch(origin)
        )
    )


def create_app():
    app = Flask(__name__)
    app.config["MAX_CONTENT_LENGTH"] = MAX_UPLOAD_MB * 1024 * 1024
    app.register_blueprint(schedule)
    log_memory("app_start", app.logger)

    @app.after_request
    def add_cors_headers(response):
        origin = request.headers.get("Origin")

        if _origin_is_allowed(origin):
            response.headers["Access-Control-Allow-Origin"] = origin
            response.vary.add("Origin")
            if request.method == "OPTIONS":
                response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
                response.headers["Access-Control-Allow-Headers"] = "Content-Type"
                response.headers["Access-Control-Max-Age"] = "600"

        return response

    @app.errorhandler(RequestEntityTooLarge)
    def upload_too_large(_error):
        return jsonify(error=f"File is too large. Maximum upload size is {MAX_UPLOAD_MB} MB."), 413

    @app.errorhandler(Exception)
    def unexpected_error(error):
        if isinstance(error, HTTPException):
            return error
        current_app.logger.exception("Unhandled request error")
        return jsonify(error="The server could not process this request."), 500

    return app

app = create_app()

if __name__ == "__main__":
    app.run(debug=True, port=5000)
