import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Chip } from "@mui/material";

function RecentOrders() {
  const orders = [
    { id: "#1001", customer: "Rahul", status: "Preparing", amount: "₹540" },
    { id: "#1002", customer: "Aman", status: "Ready", amount: "₹320" },
    { id: "#1003", customer: "Priya", status: "Completed", amount: "₹780" },
    { id: "#1004", customer: "Neha", status: "Preparing", amount: "₹450" },
    { id: "#1005", customer: "Arjun", status: "Ready", amount: "₹620" },
  ];

  const getStatusColor = (status) => {
    switch (status) {
      case "Preparing":
        return "warning";
      case "Ready":
        return "info";
      case "Completed":
        return "success";
      default:
        return "default";
    }
  };

  return (
    <TableContainer component={Paper} style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.1)" }}>
      <Table>
        <TableHead>
          <TableRow style={{ background: "#f5f5f5" }}>
            <TableCell style={{ fontWeight: "bold" }}>Order ID</TableCell>
            <TableCell style={{ fontWeight: "bold" }}>Customer</TableCell>
            <TableCell style={{ fontWeight: "bold" }}>Status</TableCell>
            <TableCell style={{ fontWeight: "bold" }}>Amount</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {orders.map((order) => (
            <TableRow key={order.id} hover>
              <TableCell>{order.id}</TableCell>
              <TableCell>{order.customer}</TableCell>
              <TableCell>
                <Chip label={order.status} color={getStatusColor(order.status)} variant="outlined" size="small" />
              </TableCell>
              <TableCell>{order.amount}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

export default RecentOrders;
