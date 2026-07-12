// Kitchen Controller
// Handles kitchen order operations

export const getKitchenOrders = async (req, res) => {
  // TODO: Fetch active kitchen orders
  res.json({ message: "Get kitchen orders" });
};

export const updateKitchenOrderStatus = async (req, res) => {
  // TODO: Update order status (Live → Preparing → Ready → Completed)
  res.json({ message: "Update kitchen order status" });
};

export const getOrdersByStatus = async (req, res) => {
  // TODO: Get orders filtered by status
  res.json({ message: "Get orders by status" });
};
