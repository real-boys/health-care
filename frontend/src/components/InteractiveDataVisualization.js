import React, { useState, useCallback } from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6'];

const claimsData = [
  { month: 'Jan', approved: 120, rejected: 30, pending: 45 },
  { month: 'Feb', approved: 145, rejected: 25, pending: 38 },
  { month: 'Mar', approved: 160, rejected: 40, pending: 52 },
  { month: 'Apr', approved: 135, rejected: 20, pending: 30 },
  { month: 'May', approved: 180, rejected: 35, pending: 60 },
  { month: 'Jun', approved: 200, rejected: 28, pending: 42 },
];

const costTrendData = [
  { month: 'Jan', cost: 42000 },
  { month: 'Feb', cost: 38000 },
  { month: 'Mar', cost: 51000 },
  { month: 'Apr', cost: 47000 },
  { month: 'May', cost: 63000 },
  { month: 'Jun', cost: 58000 },
];

const claimTypeData = [
  { name: 'Medical', value: 40 },
  { name: 'Dental', value: 20 },
  { name: 'Vision', value: 15 },
  { name: 'Mental Health', value: 15 },
  { name: 'Pharmacy', value: 10 },
];

const drillDownData = {
  Jan: [
    { week: 'W1', approved: 28, rejected: 8 },
    { week: 'W2', approved: 32, rejected: 7 },
    { week: 'W3', approved: 30, rejected: 9 },
    { week: 'W4', approved: 30, rejected: 6 },
  ],
  Feb: [
    { week: 'W1', approved: 35, rejected: 6 },
    { week: 'W2', approved: 38, rejected: 7 },
    { week: 'W3', approved: 36, rejected: 6 },
    { week: 'W4', approved: 36, rejected: 6 },
  ],
  Mar: [
    { week: 'W1', approved: 38, rejected: 10 },
    { week: 'W2', approved: 42, rejected: 11 },
    { week: 'W3', approved: 40, rejected: 9 },
    { week: 'W4', approved: 40, rejected: 10 },
  ],
};

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div role="tooltip" className="bg-slate-800 border border-slate-700 rounded-xl p-3 shadow-xl">
        <p className="text-slate-300 font-semibold mb-1">{label}</p>
        {payload.map((entry, i) => (
          <p key={i} style={{ color: entry.color }} className="text-sm">
            {entry.name}: <span className="font-bold">{entry.value}</span>
          </p>
        ))}
      </div>
    );
  }
  return null;
};

const exportCSV = (data, filename) => {
  if (!data || data.length === 0) return;
  const headers = Object.keys(data[0]).join(',');
  const rows = data.map(row => Object.values(row).join(','));
  const csv = [headers, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

const InteractiveDataVisualization = () => {
  const [activeChart, setActiveChart] = useState('bar');
  const [drillDown, setDrillDown] = useState(null);

  const handleBarClick = useCallback(data => {
    if (data && data.activeLabel && drillDownData[data.activeLabel]) {
      setDrillDown(data.activeLabel);
    }
  }, []);

  const currentExportData = drillDown ? drillDownData[drillDown] : claimsData;
  const exportFilename = drillDown ? `claims-${drillDown}` : 'claims-overview';

  return (
    <div className="p-6 space-y-6" role="main" aria-label="Interactive Data Visualization">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white">Data Visualization</h1>
          <p className="text-slate-400 text-sm mt-1">
            Interactive healthcare analytics — click bars to drill down
          </p>
        </div>
        <button
          onClick={() => exportCSV(currentExportData, exportFilename)}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-400"
          aria-label="Export current chart data as CSV"
        >
          Export CSV
        </button>
      </div>

      {/* Chart type selector */}
      <div
        role="tablist"
        aria-label="Chart type"
        className="flex gap-2 bg-slate-900 p-1 rounded-xl w-fit"
      >
        {['bar', 'line', 'pie'].map(type => (
          <button
            key={type}
            role="tab"
            aria-selected={activeChart === type}
            onClick={() => {
              setActiveChart(type);
              setDrillDown(null);
            }}
            className={`px-4 py-2 rounded-lg text-sm font-semibold capitalize transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-400 ${
              activeChart === type
                ? 'bg-indigo-600 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {type}
          </button>
        ))}
      </div>

      {/* Drill-down breadcrumb */}
      {drillDown && (
        <div className="flex items-center gap-2 text-sm">
          <button
            onClick={() => setDrillDown(null)}
            className="text-indigo-400 hover:text-indigo-300 underline focus:outline-none focus:ring-2 focus:ring-indigo-400 rounded"
            aria-label="Back to overview"
          >
            Overview
          </button>
          <span className="text-slate-500">›</span>
          <span className="text-slate-300 font-semibold">{drillDown} (weekly breakdown)</span>
        </div>
      )}

      {/* Main chart */}
      <div
        className="bg-slate-900 rounded-2xl p-6 border border-slate-800"
        aria-label={`${activeChart} chart showing ${drillDown ? `${drillDown} weekly breakdown` : 'monthly claims overview'}`}
      >
        <h2 className="text-white font-bold mb-4">
          {drillDown ? `${drillDown} — Weekly Breakdown` : 'Monthly Claims Overview'}
        </h2>
        <ResponsiveContainer width="100%" height={320}>
          {activeChart === 'bar' ? (
            <BarChart
              data={drillDown ? drillDownData[drillDown] : claimsData}
              onClick={!drillDown ? handleBarClick : undefined}
              style={{ cursor: drillDown ? 'default' : 'pointer' }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey={drillDown ? 'week' : 'month'} stroke="#64748b" />
              <YAxis stroke="#64748b" />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Bar dataKey="approved" fill="#6366f1" name="Approved" radius={[4, 4, 0, 0]} />
              <Bar dataKey="rejected" fill="#ec4899" name="Rejected" radius={[4, 4, 0, 0]} />
              {!drillDown && (
                <Bar dataKey="pending" fill="#f59e0b" name="Pending" radius={[4, 4, 0, 0]} />
              )}
            </BarChart>
          ) : activeChart === 'line' ? (
            <LineChart data={costTrendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="month" stroke="#64748b" />
              <YAxis stroke="#64748b" tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Line
                type="monotone"
                dataKey="cost"
                stroke="#6366f1"
                strokeWidth={2}
                dot={{ fill: '#6366f1', r: 4 }}
                name="Total Cost ($)"
              />
            </LineChart>
          ) : (
            <PieChart>
              <Pie
                data={claimTypeData}
                cx="50%"
                cy="50%"
                outerRadius={120}
                dataKey="value"
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              >
                {claimTypeData.map((entry, index) => (
                  <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend />
            </PieChart>
          )}
        </ResponsiveContainer>
        {activeChart === 'bar' && !drillDown && (
          <p className="text-slate-500 text-xs mt-2 text-center">
            Click a bar group to drill down into weekly data
          </p>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Claims', value: '940', color: 'text-indigo-400' },
          { label: 'Approval Rate', value: '78%', color: 'text-green-400' },
          { label: 'Avg Cost', value: '$49.8k', color: 'text-yellow-400' },
          { label: 'Pending', value: '267', color: 'text-orange-400' },
        ].map(card => (
          <div
            key={card.label}
            className="bg-slate-900 border border-slate-800 rounded-xl p-4"
            role="region"
            aria-label={card.label}
          >
            <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">
              {card.label}
            </p>
            <p className={`text-2xl font-black mt-1 ${card.color}`}>{card.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default InteractiveDataVisualization;
