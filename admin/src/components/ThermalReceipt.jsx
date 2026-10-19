import React from 'react';

export default function ThermalReceipt({ layout = [], paperWidth = '80mm', fontScale = 1, lineSpacing = 1 }) {
  const width = paperWidth === '58mm' ? 58 : 80;
  const base = (width === 58 ? 9.6 : 11.3) * fontScale;
  const widest = Math.max(28, ...layout.filter(row => row.type === 'table').map(row => row.widths.reduce((a, b) => a + b, 0) + 3));
  const font = Math.min(base, (width - (width === 58 ? 14 : 16)) * 3.78 / (widest * .61));
  return <main className="thermal-receipt canonical-receipt" data-paper-width={width}
    style={{ '--thermal-font': `${font}px`, '--thermal-spacing': 1.32 * lineSpacing }}>
    {layout.map((entry, index) => {
      const className = `thermal-line thermal-${entry.style || 'normal'}`;
      if (entry.type === 'rule') return <hr key={index} className="thermal-rule" />;
      if (entry.type === 'spacer') return <div key={index} style={{ height: `${entry.points || 2}pt` }} />;
      if (entry.type === 'table') return <div key={index} className={`${className} thermal-columns`}
        style={{ gridTemplateColumns: `minmax(0, 1fr) ${entry.widths.slice(1).map(width => `${width}ch`).join(' ')}` }}>
        {entry.cells.map((value, column) => <span key={column}>{value}</span>)}
      </div>;
      if (entry.type === 'pair') return <div key={index} className={`${className} thermal-pair`}><span>{entry.left}</span><strong>{entry.right}</strong></div>;
      return <div key={index} className={className} style={{ textAlign: entry.align || 'left' }}>{entry.text}</div>;
    })}
  </main>;
}
