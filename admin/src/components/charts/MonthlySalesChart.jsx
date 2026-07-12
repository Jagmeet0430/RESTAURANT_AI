import React, { useEffect, useState } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import apiClient from "../../services/api";

export default function MonthlySalesChart() {
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
      <h3>Monthly Sales (12 months)</h3>
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="month" />
          <YAxis />
          <Tooltip />
          <Area type="monotone" dataKey="sales" stroke="#F59E0B" fill="#FDE68A" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
