import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

function StockComponent() {
  const [symbol, setSymbol] = useState('IBM');
  const [functionType, setFunctionType] = useState('TIME_SERIES_DAILY');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const symbols = [
    'IBM', 'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'META', 'NFLX', 'NVDA', 'reliance.bse'
  ];

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`http://localhost:5000/api/stock?symbol=${symbol}&function=${functionType}`);
      if (!response.ok) throw new Error('Failed to fetch data');
      const json = await response.json();
      // Determine the time series key based on function
      let timeSeriesKey;
      if (functionType === 'TIME_SERIES_DAILY') timeSeriesKey = 'Time Series (Daily)';
      else if (functionType === 'TIME_SERIES_WEEKLY') timeSeriesKey = 'Weekly Time Series';
      else if (functionType === 'TIME_SERIES_MONTHLY') timeSeriesKey = 'Monthly Time Series';
      else timeSeriesKey = 'Time Series (Daily)'; // fallback

      const timeSeries = json[timeSeriesKey];
      if (!timeSeries) throw new Error('No data available');
      const chartData = Object.keys(timeSeries).map(date => ({
        date,
        close: parseFloat(timeSeries[date]['4. close'])
      })).sort((a, b) => new Date(a.date) - new Date(b.date)); // Sort oldest to newest
      setData(chartData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    fetchData();
  };

  return (
    <div style={{
      height: '100%',
      width: '100%',
      backgroundColor: '#0e2d76',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '1rem'
    }}>
      <h1 style={{ color: 'white', marginBottom: '1rem' }}>Stock Market</h1>
      <form onSubmit={handleSubmit} style={{ marginBottom: '2rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
        <label style={{ color: 'white' }}>
          Symbol:
          <select value={symbol} onChange={(e) => setSymbol(e.target.value)} style={{ marginLeft: '0.5rem' }}>
            {symbols.map(sym => <option key={sym} value={sym}>{sym}</option>)}
          </select>
        </label>
        <label style={{ color: 'white' }}>
          Function:
          <select value={functionType} onChange={(e) => setFunctionType(e.target.value)} style={{ marginLeft: '0.5rem' }}>
            <option value="TIME_SERIES_DAILY">Daily</option>
            <option value="TIME_SERIES_WEEKLY">Weekly</option>
            <option value="TIME_SERIES_MONTHLY">Monthly</option>
          </select>
        </label>
        <button type="submit">Fetch Data</button>
      </form>
      {loading && <p style={{ color: 'white' }}>Loading...</p>}
      {error && <p style={{ color: 'red' }}>Error: {error}</p>}
      {data.length > 0 && (
        <div style={{ width: '100%', height: '70%', border: '2px solid white', borderRadius: '10px', padding: '10px', backgroundColor: 'white' }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="date" 
                tickFormatter={(tick) => new Date(tick).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} 
                interval={Math.max(1, Math.floor(data.length / 10))} 
              />
              <YAxis tickCount={5} label={{ value: 'Price (USD)', angle: -90, position: 'insideLeft' }} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="close" stroke="#8884d8" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

export default StockComponent;
