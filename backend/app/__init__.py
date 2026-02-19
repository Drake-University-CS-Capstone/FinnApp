from flask import Flask
from dotenv import load_dotenv

from .config import Config
from .extensions import cors
from .routes import register_blueprints


def create_app(config_class: type[Config] = Config) -> Flask:
    """
    Application factory for the Flask backend.
    """
    # Load environment variables from .env in the backend directory
    load_dotenv()

    app = Flask(__name__)
    app.config.from_object(config_class)

    # Initialize extensions
    cors.init_app(app)

    # Register blueprints
    register_blueprints(app)

    return app

