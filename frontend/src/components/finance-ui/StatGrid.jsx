import React from 'react';

// Responsive auto-fill grid sized so each StatCard stays readable and rows
// collapse gracefully on smaller screens.
export default function StatGrid({ children, min = 180, gap = '0.75rem' }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `repeat(auto-fill, minmax(${min}px, 1fr))`,
      gap,
    }}>
      {children}
    </div>
  );
}
