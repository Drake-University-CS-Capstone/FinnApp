import requests
from flask import Blueprint, request, jsonify

stock_bp = Blueprint('stock', __name__)

@stock_bp.route('/api/stock', methods=['GET'])
def get_stock_data():
    symbol = request.args.get('symbol', 'reliance.bse')
    function = request.args.get('function', 'TIME_SERIES_DAILY')

    url = f'https://www.alphavantage.co/query?function={function}&symbol={symbol}&apikey={env.API_KEY}'

    try:
        response = requests.get(url)
        response.raise_for_status()
        data = response.json()
        return jsonify(data)
    except requests.RequestException as e:
        return jsonify({'error': str(e)}), 500