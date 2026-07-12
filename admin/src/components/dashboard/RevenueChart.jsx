import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

function RevenueChart() {
  const revenueData = [
    { week: "Week 1", revenue: 12500 },
    { week: "Week 2", revenue: 15800 },
    { week: "Week 3", revenue: 18540 },
    { week: "Week 4", revenue: 16200 },
  ];

  return (
    <div style={{ background: "#fff", padding: "20px", borderRadius: "8px", boxShadow: "0 2px 8px rgba(0,0,0,0.1)", marginBottom: "20px" }}>
      <h3 style={{ marginTop: 0, marginBottom: "20px" }}>Weekly Revenue</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={revenueData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="week" />
          <YAxis />
          <Tooltip formatter={(value) => `₹${value}`} />
          <Legend />
          <Bar dataKey="revenue" fill="#4caf50" radius={[8, 8, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default RevenueChart;
