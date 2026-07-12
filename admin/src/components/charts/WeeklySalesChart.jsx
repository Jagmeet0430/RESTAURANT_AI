import React, { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import apiClient from "../../services/api";

export default function WeeklySalesChart() {
  const [data, setData] = useState([]);

  useEffect(() => {
    apiClient.get("/reports/sales").then((resp) => {
      const weekly = resp.data.data.weekly || [];
      const chart = weekly.map((r) => ({ week: r.week_start, sales: Number(r.sales) }));
      setData(chart);
    }).catch(() => {});
  }, []);

  return (
    <div style={{ width: "100%", height: 300 }}>
      <h3>Weekly Sales (12 weeks)</h3>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="week" />
          <YAxis />
          <Tooltip />
          <Bar dataKey="sales" fill="#10B981" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
