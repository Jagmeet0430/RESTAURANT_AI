import { Chip } from "@mui/material";

function OrderStatusChip({ status, onClick }) {
  const getStatusColor = (value) => {
    switch (value) {
      case "Pending":
        return "warning";
      case "Accepted":
        return "info";
      case "Preparing":
        return "primary";
      case "Ready":
      case "Completed":
      case "Delivered":
        return "success";
      case "Cancelled":
        return "error";
      default:
        return "default";
    }
  };

  return (
    <Chip
      label={status || "Pending"}
      color={getStatusColor(status)}
      variant="outlined"
      size="small"
      onClick={onClick}
      style={{ cursor: onClick ? "pointer" : "default" }}
    />
  );
}

export default OrderStatusChip;
