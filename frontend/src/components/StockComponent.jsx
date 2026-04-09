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
      })).reverse(); // Reverse to show chronological order
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
    <div style={{ padding: "2rem" }}>
      <h1>Stock Market</h1>
      <form onSubmit={handleSubmit} style={{ marginBottom: '2rem' }}>
        <label>
          Symbol:
          <select value={symbol} onChange={(e) => setSymbol(e.target.value)}>
            {symbols.map(sym => <option key={sym} value={sym}>{sym}</option>)}
          </select>
        </label>
        <label style={{ marginLeft: '1rem' }}>
          Function:
          <select value={functionType} onChange={(e) => setFunctionType(e.target.value)}>
            <option value="TIME_SERIES_DAILY">Daily</option>
            <option value="TIME_SERIES_WEEKLY">Weekly</option>
            <option value="TIME_SERIES_MONTHLY">Monthly</option>
          </select>
        </label>
        <button type="submit" style={{ marginLeft: '1rem' }}>Fetch Data</button>
      </form>
      {loading && <p>Loading...</p>}
      {error && <p>Error: {error}</p>}
      {data.length > 0 && (
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="close" stroke="#8884d8" />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

export default StockComponent;
