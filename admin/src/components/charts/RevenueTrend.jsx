import React, { useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import apiClient from "../../services/api";

export default function RevenueTrend() {
  const [data, setData] = useState([]);

  useEffect(() => {
    apiClient.get("/reports/sales").then((resp) => {
      const monthly = resp.data.data.monthly || [];
      const chart = monthly.map((r) => ({ month: r.month_start, sales: Number(r.sales) }));
      setData(chart);
    }).catch(() => {});
  }, []);

  return (
    <div style={{ width: "100%", height: 300 }}>
      <h3>Revenue Trend (Monthly)</h3>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="month" />
          <YAxis />
          <Tooltip />
          <Line type="monotone" dataKey="sales" stroke="#8B5CF6" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
