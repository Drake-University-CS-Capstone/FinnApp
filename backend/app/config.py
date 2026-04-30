import os

class Config:
    """
    Configuration for the Flask app. Getting secrets from the environment variables.
    """

    SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-key-change-me")
    JWT_SECRET = os.getenv("JWT_SECRET", "dev-jwt-secret-change-me")
    MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
    MONGO_DB_NAME = os.getenv("MONGO_DB_NAME", "Capstone")
    JWT_EXPIRES_MIN = int(os.getenv("JWT_EXPIRES_MIN", "1440")) # 24 hours
    PLAID_CLIENT_ID = os.getenv("PLAID_CLIENT_ID")
    PLAID_SECRET = os.getenv("PLAID_SECRET")
    PLAID_ENV = os.getenv("PLAID_ENV")
    PLAID_PRODUCTS = os.getenv("PLAID_PRODUCTS")
    PLAID_COUNTRY_CODES = os.getenv("PLAID_COUNTRY_CODES")
    PLAID_REDIRECT_URI = os.getenv("PLAID_REDIRECT_URI")
    ALPHA_VANTAGE_API_KEY = os.getenv("ALPHA_VANTAGE_API_KEY")