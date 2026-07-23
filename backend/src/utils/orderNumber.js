export async function generateOrderNumber(client) {
  const result = await client.query("SELECT COUNT(*) AS count FROM orders");
  const count = Number(result.rows[0]?.count || 0) + 1;
  return `ORD-${Date.now()}-${count}`;
}
