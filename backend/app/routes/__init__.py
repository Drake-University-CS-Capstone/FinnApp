from flask import Flask

from .health import health_bp
from .users import users_bp
from .plaid import plaid_bp
from .stock import stock_bp
# from .external import external_bp  # Uncomment when you want to use it


def register_blueprints(app: Flask) -> None:
    """
    Register all blueprints on the given app.
    """
    app.register_blueprint(health_bp)
    app.register_blueprint(users_bp)
    app.register_blueprint(plaid_bp)
    app.register_blueprint(stock_bp)

    # app.register_blueprint(external_bp)  # Uncomment when you want to use it

