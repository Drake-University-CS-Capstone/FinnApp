import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// ── Tokens (matching Dashboard) ───────────────────────────────────────────────
const T = {
  bg:         '#0d1424',
  surface:    'rgba(255,255,255,0.03)',
  surfaceHov: 'rgba(99,102,241,0.08)',
  border:     'rgba(99,102,241,0.2)',
  borderHov:  'rgba(99,102,241,0.4)',
  text:       '#e2e8f0',
  muted:      '#94a3b8',
  accent:     '#a5b4fc',
  accentBg:   'rgba(99,102,241,0.15)',
  accentBord: 'rgba(99,102,241,0.4)',
  green:      '#86efac',
  greenBg:    'rgba(134,239,172,0.1)',
  red:        '#fca5a5',
  redBg:      'rgba(252,165,165,0.1)',
  sans:       "'DM Sans', system-ui, sans-serif",
  display:    "'Playfair Display', Georgia, serif",
};

function StockComponent() {
  const [symbol, setSymbol] = useState('IBM');
  const [functionType, setFunctionType] = useState('TIME_SERIES_DAILY');
  const [timeRange, setTimeRange] = useState('1M');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const symbols = [
    'IBM', 'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'META', 'NFLX', 'NVDA', 'reliance.bse'
  ];

  const timeRangeOptions = [
    { value: '3D', label: 'Past 3 Days' },
    { value: '1W', label: 'Past Week' },
    { value: '1M', label: 'Past Month' },
    { value: '3M', label: 'Past 3 Months' },
    { value: '6M', label: 'Past 6 Months' },
    { value: 'YTD', label: 'Year to Date' },
    { value: '1Y', label: 'Past Year' },
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
      let chartData = Object.keys(timeSeries).map(date => ({
        date,
        close: parseFloat(timeSeries[date]['4. close'])
      })).sort((a, b) => new Date(a.date) - new Date(b.date)); // Sort oldest to newest

      // Filter based on timeRange
      const now = new Date();
      let cutoffDate;
      switch (timeRange) {
        case '3D':
          cutoffDate = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
          break;
        case '1W':
          cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '1M':
          cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case '3M':
          cutoffDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
        case '6M':
          cutoffDate = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
          break;
        case 'YTD':
          cutoffDate = new Date(now.getFullYear(), 0, 1);
          break;
        case '1Y':
          cutoffDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
          break;
        default:
          cutoffDate = new Date(0);
      }
      const filteredData = chartData.filter(d => new Date(d.date) >= cutoffDate);
      setData(filteredData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [symbol, functionType, timeRange]);

  const handleSubmit = (e) => {
    e.preventDefault();
    fetchData();
  };

  return (
    <div style={{
      height: '100%',
      width: '100%',
      backgroundColor: T.bg,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '1rem'
    }}>
      <h1 style={{ color: T.text, marginBottom: '1rem', fontFamily: T.display }}>Stock Market</h1>
      <form onSubmit={handleSubmit} style={{ marginBottom: '2rem', display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <label style={{ color: T.text, fontSize: '0.82rem', fontWeight: 500 }}>
          Symbol:
          <select value={symbol} onChange={(e) => setSymbol(e.target.value)} style={{
            marginLeft: '0.5rem',
            padding: '0.3rem 0.7rem',
            borderRadius: '8px',
            border: `1px solid ${T.border}`,
            background: T.surface,
            color: T.text,
            fontSize: '0.82rem',
            fontFamily: T.sans,
            cursor: 'pointer',
            transition: 'border-color 0.15s',
          }}
            onMouseEnter={(e) => e.target.style.borderColor = T.borderHov}
            onMouseLeave={(e) => e.target.style.borderColor = T.border}
          >
            {symbols.map(sym => <option key={sym} value={sym} style={{ background: T.bg, color: T.text }}>{sym}</option>)}
          </select>
        </label>
        <label style={{ color: T.text, fontSize: '0.82rem', fontWeight: 500 }}>
          Function:
          <select value={functionType} onChange={(e) => setFunctionType(e.target.value)} style={{
            marginLeft: '0.5rem',
            padding: '0.3rem 0.7rem',
            borderRadius: '8px',
            border: `1px solid ${T.border}`,
            background: T.surface,
            color: T.text,
            fontSize: '0.82rem',
            fontFamily: T.sans,
            cursor: 'pointer',
            transition: 'border-color 0.15s',
          }}
            onMouseEnter={(e) => e.target.style.borderColor = T.borderHov}
            onMouseLeave={(e) => e.target.style.borderColor = T.border}
          >
            <option value="TIME_SERIES_DAILY" style={{ background: T.bg, color: T.text }}>Daily</option>
            <option value="TIME_SERIES_WEEKLY" style={{ background: T.bg, color: T.text }}>Weekly</option>
            <option value="TIME_SERIES_MONTHLY" style={{ background: T.bg, color: T.text }}>Monthly</option>
          </select>
        </label>
        <label style={{ color: T.text, fontSize: '0.82rem', fontWeight: 500 }}>
          Time Range:
          <select value={timeRange} onChange={(e) => setTimeRange(e.target.value)} style={{
            marginLeft: '0.5rem',
            padding: '0.3rem 0.7rem',
            borderRadius: '8px',
            border: `1px solid ${T.border}`,
            background: T.surface,
            color: T.text,
            fontSize: '0.82rem',
            fontFamily: T.sans,
            cursor: 'pointer',
            transition: 'border-color 0.15s',
          }}
            onMouseEnter={(e) => e.target.style.borderColor = T.borderHov}
            onMouseLeave={(e) => e.target.style.borderColor = T.border}
          >
            {timeRangeOptions.map(opt => <option key={opt.value} value={opt.value} style={{ background: T.bg, color: T.text }}>{opt.label}</option>)}
          </select>
        </label>
{/*        <button
        style={{
          padding: '0.3rem 1rem',
          borderRadius: '8px',
          border: `1px solid ${T.accentBord}`,        //This is code for a button that is now rendered obselete
          background: T.accentBg,
          color: T.accent,
          fontSize: '0.82rem',
          fontWeight: 500,
          fontFamily: T.sans,
          cursor: 'pointer',
          transition: 'all 0.15s',
          }}
          onMouseEnter={(e) => {
            e.target.style.background = T.surfaceHov;
            e.target.style.borderColor = T.borderHov;
          }}
          onMouseLeave={(e) => {
            e.target.style.background = T.accentBg;
            e.target.style.borderColor = T.accentBord;
          }}>
        Fetch Data</button> */}
      </form>
      {loading && <p style={{ color: T.muted }}>Loading...</p>}
      {error && <p style={{ color: T.red }}>Error: {error}</p>}
      {data.length > 0 && (
        <div style={{
          width: '100%',
          height: '70%',
          border: `1px solid ${T.border}`,
          borderRadius: '12px',
          padding: '10px',
          backgroundColor: T.surface
        }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
              <XAxis 
                dataKey="date" 
                tickFormatter={(tick) => new Date(tick).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} 
                interval={Math.max(1, Math.floor(data.length / 10))}
                tick={{ fill: T.text, fontSize: 12 }}
              />
              <YAxis
                tickCount={5}
                label={{ value: 'Price (USD)', angle: -90, position: 'insideLeft', fill: T.text }}
                tick={{ fill: T.text, fontSize: 12 }}
              />
              <Tooltip contentStyle={{ backgroundColor: T.surface, border: `1px solid ${T.border}`, color: T.text }} />
              <Legend wrapperStyle={{ color: T.text }} />
              <Line type="monotone" dataKey="close" stroke={T.accent} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

export default StockComponent;
