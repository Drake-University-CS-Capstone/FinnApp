"""
Example service for making outbound API calls.

This demonstrates how to structure external API calls in your Flask app.
"""

import requests
from typing import Dict, Any, Optional


def call_external_api(url: str, method: str = "GET", **kwargs) -> Optional[Dict[str, Any]]:
    """
    Example function that makes an outbound API call.
    
    Args:
        url: The external API URL to call
        method: HTTP method (GET, POST, etc.)
        **kwargs: Additional arguments to pass to requests (headers, data, params, etc.)
    
    Returns:
        JSON response as dict, or None if request fails
    """
    try:
        response = requests.request(method, url, timeout=10, **kwargs)
        response.raise_for_status()  # Raises exception for bad status codes
        return response.json()
    except requests.exceptions.RequestException as e:
        # Log error in production (you'd use logging module)
        print(f"API call failed: {e}")
        return None


# Example: Call a specific external API
def get_weather_data(city: str, api_key: str) -> Optional[Dict[str, Any]]:
    """
    Example: Call a weather API.
    
    In real usage, you'd:
    1. Store API keys in backend/.env
    2. Read them via os.getenv() or from config
    3. Handle errors appropriately
    """
    url = f"https://api.example.com/weather"
    params = {"city": city, "api_key": api_key}
    
    return call_external_api(url, method="GET", params=params)
