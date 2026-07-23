import { pool } from "../config/database.js";

async function queryWith(client, sql, params = []) {
  return client.query(sql, params);
}

export async function ensureBarcodeStockSchema(client = pool) {
  await queryWith(client, "ALTER TABLE menu ADD COLUMN IF NOT EXISTS barcode VARCHAR(100)");
  await queryWith(
    client,
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_menu_barcode_unique ON menu(barcode) WHERE barcode IS NOT NULL AND barcode <> ''"
  );

  await queryWith(client, `
    CREATE TABLE IF NOT EXISTS inventory (
      id SERIAL PRIMARY KEY,
      ingredient_name VARCHAR(150),
      quantity NUMERIC(12, 2) NOT NULL DEFAULT 0,
      unit VARCHAR(30) NOT NULL DEFAULT 'pcs',
      minimum_level NUMERIC(12, 2) NOT NULL DEFAULT 0,
      cost_per_unit NUMERIC(12, 2) DEFAULT 0,
      expiry_date DATE,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await queryWith(client, `
    ALTER TABLE inventory
      ADD COLUMN IF NOT EXISTS ingredient_name VARCHAR(150),
      ADD COLUMN IF NOT EXISTS quantity NUMERIC(12, 2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS unit VARCHAR(30) NOT NULL DEFAULT 'pcs',
      ADD COLUMN IF NOT EXISTS minimum_level NUMERIC(12, 2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS cost_per_unit NUMERIC(12, 2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS expiry_date DATE,
      ADD COLUMN IF NOT EXISTS supplier_id INTEGER,
      ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE,
      ADD COLUMN IF NOT EXISTS menu_id INTEGER,
      ADD COLUMN IF NOT EXISTS barcode VARCHAR(100),
      ADD COLUMN IF NOT EXISTS stock_per_sale NUMERIC(12, 2) NOT NULL DEFAULT 1,
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  `);

  await queryWith(client, `
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'inventory' AND column_name = 'menu_item_id'
      ) THEN
        ALTER TABLE inventory ALTER COLUMN menu_item_id DROP NOT NULL;
      END IF;
    END $$;
  `);

  await queryWith(client, `
    CREATE TABLE IF NOT EXISTS inventory_transactions (
      id SERIAL PRIMARY KEY,
      inventory_id INTEGER NOT NULL REFERENCES inventory(id) ON DELETE CASCADE,
      transaction_type VARCHAR(20) NOT NULL,
      quantity NUMERIC(12, 2) NOT NULL,
      reference_type VARCHAR(50),
      reference_id INTEGER,
      notes TEXT,
      created_by INTEGER,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await queryWith(client, "CREATE INDEX IF NOT EXISTS idx_inventory_menu ON inventory(menu_id)");
  await queryWith(client, "CREATE INDEX IF NOT EXISTS idx_inventory_barcode ON inventory(barcode)");
}

function statusForInventory(row) {
  if (!row?.inventory_id) return "Untracked";

  const quantity = Number(row.stock_quantity || 0);
  const minimumLevel = Number(row.minimum_level || 0);

  if (quantity <= 0) return "Out of stock";
  if (quantity <= minimumLevel) return "Low stock";
  return "In stock";
}

export async function findProductByBarcode(client, barcode) {
  await ensureBarcodeStockSchema(client);

  const code = String(barcode || "").trim();
  if (!code) {
    const error = new Error("Barcode is required");
    error.statusCode = 400;
    throw error;
  }

  const result = await queryWith(
    client,
    `WITH matched_menu AS (
       SELECT m.id
       FROM menu m
       WHERE m.barcode = $1 OR m.id::text = $1
       LIMIT 1
     ),
     matched_inventory AS (
       SELECT i.menu_id
       FROM inventory i
       WHERE i.barcode = $1
         AND i.menu_id IS NOT NULL
         AND COALESCE(i.is_active, TRUE) = TRUE
       LIMIT 1
     ),
     selected_menu AS (
       SELECT id FROM matched_menu
       UNION
       SELECT menu_id AS id FROM matched_inventory
       LIMIT 1
     )
     SELECT
       m.id,
       m.name,
       m.description,
       m.price,
       m.barcode,
       m.is_available,
       c.name AS category_name,
       i.id AS inventory_id,
       i.quantity AS stock_quantity,
       i.minimum_level,
       i.unit,
       i.stock_per_sale,
       COALESCE(i.barcode, m.barcode) AS scan_code
     FROM selected_menu sm
     JOIN menu m ON m.id = sm.id
     JOIN categories c ON c.id = m.category_id
     LEFT JOIN LATERAL (
       SELECT *
       FROM inventory inventory_row
       WHERE COALESCE(inventory_row.is_active, TRUE) = TRUE
         AND (
           inventory_row.menu_id = m.id
           OR inventory_row.barcode = $1
         )
       ORDER BY CASE WHEN inventory_row.menu_id = m.id THEN 0 ELSE 1 END, inventory_row.id
       LIMIT 1
     ) i ON TRUE`,
    [code]
  );

  const product = result.rows[0];
  if (!product) {
    const error = new Error(`No product found for barcode ${code}`);
    error.statusCode = 404;
    throw error;
  }

  const status = statusForInventory(product);
  const outOfStock = status === "Out of stock" || product.is_available === false;

  return {
    ...product,
    price: Number(product.price),
    stock_quantity: product.stock_quantity === null || product.stock_quantity === undefined ? null : Number(product.stock_quantity),
    minimum_level: product.minimum_level === null || product.minimum_level === undefined ? null : Number(product.minimum_level),
    stock_per_sale: Number(product.stock_per_sale || 1),
    stock_status: outOfStock ? "Out of stock" : status,
    out_of_stock: outOfStock,
  };
}

export async function deductInventoryForOrder(client, orderId, { createdBy = null } = {}) {
  await ensureBarcodeStockSchema(client);

  const itemsResult = await queryWith(
    client,
    `SELECT oi.menu_id, oi.quantity, m.name
     FROM order_items oi
     JOIN menu m ON m.id = oi.menu_id
     WHERE oi.order_id = $1
     ORDER BY oi.id ASC`,
    [orderId]
  );

  const movements = [];
  const outOfStockItems = [];

  for (const item of itemsResult.rows) {
    const inventoryResult = await queryWith(
      client,
      `SELECT id, quantity, minimum_level, stock_per_sale
       FROM inventory
       WHERE menu_id = $1
         AND COALESCE(is_active, TRUE) = TRUE
       ORDER BY id
       LIMIT 1
       FOR UPDATE`,
      [item.menu_id]
    );

    if (inventoryResult.rowCount === 0) {
      continue;
    }

    const inventory = inventoryResult.rows[0];
    const stockPerSale = Number(inventory.stock_per_sale || 1);
    const consumedQuantity = Number((Number(item.quantity) * stockPerSale).toFixed(2));
    const currentQuantity = Number(inventory.quantity || 0);

    if (currentQuantity < consumedQuantity) {
      outOfStockItems.push({
        menu_id: Number(item.menu_id),
        name: item.name,
        available_quantity: currentQuantity,
        required_quantity: consumedQuantity,
      });
      continue;
    }

    const nextQuantity = Number((currentQuantity - consumedQuantity).toFixed(2));

    await queryWith(
      client,
      `UPDATE inventory
       SET quantity = $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [nextQuantity, inventory.id]
    );

    await queryWith(
      client,
      `INSERT INTO inventory_transactions
         (inventory_id, transaction_type, quantity, reference_type, reference_id, notes, created_by)
       VALUES ($1, 'STOCK_OUT', $2, 'ORDER', $3, $4, $5)`,
      [
        inventory.id,
        consumedQuantity,
        orderId,
        `Auto deducted for order ${orderId}`,
        createdBy,
      ]
    );

    if (nextQuantity <= 0) {
      await queryWith(
        client,
        `UPDATE menu
         SET is_available = FALSE,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [item.menu_id]
      );
    }

    movements.push({
      inventory_id: Number(inventory.id),
      menu_id: Number(item.menu_id),
      name: item.name,
      quantity: consumedQuantity,
      remaining_quantity: nextQuantity,
      stock_status: nextQuantity <= 0 ? "Out of stock" : "In stock",
    });
  }

  if (outOfStockItems.length > 0) {
    for (const item of outOfStockItems) {
      if (item.available_quantity <= 0) {
        await queryWith(
          client,
          `UPDATE menu
           SET is_available = FALSE,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $1`,
          [item.menu_id]
        );
      }
    }

    const error = new Error(
      `Insufficient stock for ${outOfStockItems.map((item) => item.name).join(", ")}`
    );
    error.statusCode = 409;
    error.outOfStockItems = outOfStockItems;
    throw error;
  }

  return movements;
}
