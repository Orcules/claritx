import httpx
import json
from datetime import datetime

def fetch_yahoo_data(symbol: str):
    """
    Fetches technical data from Yahoo Finance using raw HTTP requests.
    Calculates SMA and RSI manually to avoid heavy pandas/numpy dependencies.
    """
    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{symbol}?interval=1d&range=1y"
    headers = {'User-Agent': 'Mozilla/5.0'}
    
    try:
        with httpx.Client() as client:
            response = client.get(url, headers=headers, timeout=10.0)
            
        if response.status_code != 200:
             return {"error": f"Yahoo API Error: {response.status_code}"}
             
        data = response.json()
        result = data['chart']['result'][0]
        meta = result['meta']
        indicators = result['indicators']['quote'][0]
        
        closes = indicators['close']
        volumes = indicators['volume']
        
        # Filter out None values
        valid_closes = [c for c in closes if c is not None]
        
        if not valid_closes:
            return {"error": "No price data found"}
            
        current_price = valid_closes[-1]
        
        # Helper for SMA
        def calculate_sma(prices, window):
            if len(prices) < window:
                return None
            return sum(prices[-window:]) / window
            
        # Helper for RSI
        def calculate_rsi(prices, window=14):
            if len(prices) <= window:
                return None
                
            deltas = [prices[i] - prices[i-1] for i in range(1, len(prices))]
            gains = [d if d > 0 else 0 for d in deltas]
            losses = [-d if d < 0 else 0 for d in deltas]
            
            # Simple avg for first step (standard RSI uses exponential, but simple is close enough for this)
            avg_gain = sum(gains[-window:]) / window
            avg_loss = sum(losses[-window:]) / window
            
            if avg_loss == 0:
                return 100
                
            rs = avg_gain / avg_loss
            return 100 - (100 / (1 + rs))

        return {
            "current_price": current_price,
            "sma_20": calculate_sma(valid_closes, 20),
            "sma_50": calculate_sma(valid_closes, 50),
            "sma_200": calculate_sma(valid_closes, 200),
            "rsi": calculate_rsi(valid_closes, 14),
            "volume": volumes[-1] if volumes else 0,
            "high_52w": meta.get('fiftyTwoWeekHigh'),
            "low_52w": meta.get('fiftyTwoWeekLow')
        }

    except Exception as e:
        print(f"Yahoo Data Error: {e}")
        return {"error": str(e)}
