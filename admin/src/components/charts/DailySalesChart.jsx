import React, { useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import apiClient from "../../services/api";

export default function DailySalesChart() {
  const [data, setData] = useState([]);

  useEffect(() => {
    apiClient.get("/reports/sales").then((resp) => {
      const daily = resp.data.data.daily || [];
      const chart = daily.map((r) => ({ date: r.date, sales: Number(r.sales) }));
      setData(chart);
    }).catch(() => {});
  }, []);

  return (
    <div style={{ width: "100%", height: 300 }}>
      <h3>Daily Sales (30 days)</h3>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis />
          <Tooltip />
          <Line type="monotone" dataKey="sales" stroke="#2563EB" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
