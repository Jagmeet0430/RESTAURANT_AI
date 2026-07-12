import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

function SalesChart() {
  const salesData = [
    { day: "Mon", sales: 2400 },
    { day: "Tue", sales: 3200 },
    { day: "Wed", sales: 2800 },
    { day: "Thu", sales: 3900 },
    { day: "Fri", sales: 4100 },
    { day: "Sat", sales: 4800 },
    { day: "Sun", sales: 3500 },
  ];

  return (
    <div style={{ background: "#fff", padding: "20px", borderRadius: "8px", boxShadow: "0 2px 8px rgba(0,0,0,0.1)", marginBottom: "20px" }}>
      <h3 style={{ marginTop: 0, marginBottom: "20px" }}>Daily Sales (Last 7 Days)</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={salesData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="day" />
          <YAxis />
          <Tooltip formatter={(value) => `₹${value}`} />
          <Legend />
          <Line type="monotone" dataKey="sales" stroke="#2196f3" strokeWidth={2} dot={{ fill: "#2196f3", r: 5 }} activeDot={{ r: 7 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default SalesChart;
