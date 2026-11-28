from flask import Flask, jsonify, request
from werkzeug.exceptions import RequestEntityTooLarge

from routes.schedule import schedule


MAX_UPLOAD_MB = 10
ALLOWED_ORIGINS = {
        "https://schedmaker.vercel.app",
        "https://sked.laupyde.online",
    }


def create_app():
    app = Flask(__name__)
    app.config["MAX_CONTENT_LENGTH"] = MAX_UPLOAD_MB * 1024 * 1024
    app.register_blueprint(schedule)

    @app.after_request
    def add_cors_headers(response):
        origin = request.headers.get("Origin")

        if origin in ALLOWED_ORIGINS:
            response.headers["Access-Control-Allow-Origin"] = origin
            response.headers["Vary"] = "Origin"
        
        return response

    @app.errorhandler(RequestEntityTooLarge)
    def upload_too_large(_error):
        return jsonify(error=f"File is too large. Maximum upload size is {MAX_UPLOAD_MB} MB."), 413

    return app

app = create_app()

if __name__ == "__main__":
    app.run(debug=True, port=5000)
