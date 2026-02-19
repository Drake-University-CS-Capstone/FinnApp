import os


class Config:
    """
    Minimal configuration for the Flask app.

    No database is configured. Add values here as needed
    (e.g. SECRET_KEY, feature flags, API keys).
    """

    SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-key-change-me")
