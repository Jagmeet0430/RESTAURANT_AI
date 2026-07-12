import React, { useEffect, useState } from "react";
import { Line } from "react-chartjs-2";
import apiClient from "../../services/api";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

export default function PredictionVsActual() {
  const [chartData, setChartData] = useState(null);

  useEffect(() => {
    apiClient.get("/reports/sales").then((resp) => {
      const preds = resp.data.data.predictions || [];
      const labels = preds.map((p) => p.date);
      const actual = preds.map((p) => p.actual || 0);
      const predicted = preds.map((p) => p.predicted || 0);

      setChartData({
        labels,
        datasets: [
          { label: "Actual", data: actual, borderColor: "#2563EB", backgroundColor: "rgba(37,99,235,0.2)" },
          { label: "Predicted", data: predicted, borderColor: "#EF4444", backgroundColor: "rgba(239,68,68,0.2)" },
        ],
      });
    }).catch(() => {});
  }, []);

  if (!chartData) return <div style={{ height: 300 }}>Loading prediction vs actual...</div>;

  return (
    <div style={{ width: "100%", height: 300 }}>
      <h3>AI Prediction vs Actual (Last 7 days)</h3>
      <Line data={chartData} options={{ responsive: true, maintainAspectRatio: false }} />
    </div>
  );
}
