from flask import Flask

from .health import health_bp
from .users import users_bp
from .plaid import plaid_bp
from .plaid_items import plaid_items_bp
from .accounts import accounts_bp
from .transactions import transactions_bp
# from .external import external_bp  # Uncomment when you want to use it


def register_blueprints(app: Flask) -> None:
    """
    Register all blueprints on the given app.
    """
    app.register_blueprint(health_bp)
    app.register_blueprint(users_bp)
    app.register_blueprint(plaid_bp)
    app.register_blueprint(plaid_items_bp)
    app.register_blueprint(accounts_bp)
    app.register_blueprint(transactions_bp)

    # app.register_blueprint(external_bp)  # Uncomment when you want to use it

