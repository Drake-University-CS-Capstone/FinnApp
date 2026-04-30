from flask import Blueprint, request, jsonify
import requests
import os

stock_bp = Blueprint('stock', __name__, url_prefix='/api')

@stock_bp.route('/stock', methods=['GET'])
def get_stock_data():
    symbol = request.args.get('symbol', 'IBM')
    function = request.args.get('function', 'TIME_SERIES_DAILY')

    api_key = os.getenv('ALPHA_VANTAGE_API_KEY')
    if not api_key:
        return jsonify({'error': 'API key not configured'}), 500

    url = f'https://www.alphavantage.co/query?function={function}&symbol={symbol}&apikey={api_key}'

    try:
        response = requests.get(url)
        response.raise_for_status()
        data = response.json()
        return jsonify(data)
    except requests.RequestException as e:
        return jsonify({'error': str(e)}), 500