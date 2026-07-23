import { pool } from "../config/database.js";
import { asyncHandler } from "../utils/index.js";

const GST_RATE = 0.05;
const MAX_CART_ITEMS = 50;
const MAX_ITEM_QUANTITY = 50;
const COUNTER_CUSTOMER_PHONE = "COUNTER-WALK-IN";

function normalizeStockQuantity(value) {
  const quantity = Number(value || 1);

  if (!Number.isFinite(quantity) || quantity <= 0) {
    const error = new Error("Stock-in quantity must be greater than zero");
    error.statusCode = 400;
    throw error;
  }

  return Number(quantity.toFixed(2));
}

function normalizeItems(items) {
  if (!Array.isArray(items) || items.length === 0) {
    const error = new Error("Sale must contain at least one item");
    error.statusCode = 400;
    throw error;
  }

  if (items.length > MAX_CART_ITEMS) {
    const error = new Error(`Sale can contain at most ${MAX_CART_ITEMS} line items`);
    error.statusCode = 400;
    throw error;
  }

  const merged = new Map();
  for (const item of items) {
    const productId = Number(item.productId || item.product_id || item.id);
    const quantity = Number(item.quantity || item.qty);

    if (!Number.isInteger(productId) || productId < 1) {
      const error = new Error("Invalid product in sale");
      error.statusCode = 400;
      throw error;
    }

    if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_ITEM_QUANTITY) {
      const error = new Error(`Quantity must be between 1 and ${MAX_ITEM_QUANTITY}`);
      error.statusCode = 400;
      throw error;
    }

    merged.set(productId, (merged.get(productId) || 0) + quantity);
  }

  return Array.from(merged, ([productId, quantity]) => ({ productId, quantity }));
}

async function getCounterCustomer(client, payload = {}) {
  const name = String(payload.customerName || payload.customer_name || "Counter Customer").trim() || "Counter Customer";
  const phone = String(payload.customerPhone || payload.customer_phone || COUNTER_CUSTOMER_PHONE).trim() || COUNTER_CUSTOMER_PHONE;

  const result = await client.query(
    `INSERT INTO customers (name, phone, is_active)
     VALUES ($1, $2, TRUE)
     ON CONFLICT (phone)
     DO UPDATE SET
       name = COALESCE(NULLIF(EXCLUDED.name, ''), customers.name),
       updated_at = CURRENT_TIMESTAMP
     RETURNING id, name, phone`,
    [name, phone]
  );

  return result.rows[0];
}

async function ensureCounterSaleSchema(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS counter_sales (
      id SERIAL PRIMARY KEY,
      bill_number VARCHAR(100) UNIQUE NOT NULL,
      customer_name VARCHAR(150),
      customer_phone VARCHAR(30),
      payment_method VARCHAR(40) NOT NULL DEFAULT 'Cash',
      subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0,
      gst_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
      total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS counter_sale_items (
      id SERIAL PRIMARY KEY,
      sale_id INTEGER NOT NULL REFERENCES counter_sales(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(id),
      quantity INTEGER NOT NULL,
      unit_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
      line_total NUMERIC(12, 2) NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await client.query("CREATE INDEX IF NOT EXISTS idx_counter_sale_items_sale ON counter_sale_items(sale_id)");
  await client.query("CREATE INDEX IF NOT EXISTS idx_counter_sale_items_product ON counter_sale_items(product_id)");
}

async function calculateSale(client, items) {
  const normalizedItems = normalizeItems(items);
  const productIds = normalizedItems.map((item) => item.productId);

  const productResult = await client.query(
    `SELECT id, barcode, name, selling_price, quantity, unit, is_active
     FROM products
     WHERE id = ANY($1::int[])
     FOR UPDATE`,
    [productIds]
  );

  const productById = new Map(productResult.rows.map((item) => [Number(item.id), item]));
  const verifiedItems = [];
  let subtotal = 0;

  for (const item of normalizedItems) {
    const product = productById.get(item.productId);

    if (!product) {
      const error = new Error(`Product ${item.productId} not found`);
      error.statusCode = 400;
      throw error;
    }

    const availableQuantity = Number(product.quantity || 0);

    if (product.is_active === false || availableQuantity <= 0) {
      const error = new Error(`${product.name} is out of stock`);
      error.statusCode = 409;
      throw error;
    }

    if (item.quantity > availableQuantity) {
      const error = new Error(`Only ${availableQuantity} units of ${product.name} are available`);
      error.statusCode = 409;
      throw error;
    }

    const unitPrice = Number(product.selling_price || 0);
    const totalPrice = Number((unitPrice * item.quantity).toFixed(2));
    subtotal += totalPrice;
    verifiedItems.push({
      product_id: Number(product.id),
      barcode: product.barcode,
      name: product.name,
      quantity: item.quantity,
      quantity_before: availableQuantity,
      quantity_after: Number((availableQuantity - item.quantity).toFixed(2)),
      unit: product.unit,
      unit_price: unitPrice,
      total_price: totalPrice,
    });
  }

  subtotal = Number(subtotal.toFixed(2));
  const tax = Number((subtotal * GST_RATE).toFixed(2));
  const discount = 0;
  const deliveryCharge = 0;
  const total = Number((subtotal + tax + deliveryCharge - discount).toFixed(2));

  return { verifiedItems, subtotal, tax, discount, deliveryCharge, total };
}

export const lookupBarcodeProduct = asyncHandler(async (req, res) => {
  try {
    const barcode = String(req.params.barcode || "").trim();

    if (!barcode) {
      return res.status(400).json({
        success: false,
        message: "Barcode is required",
      });
    }

    const result = await pool.query(
      `SELECT
         id,
         barcode,
         name,
         brand,
         category,
         unit,
         purchase_price,
         selling_price,
         quantity,
         minimum_stock,
         image_url,
         is_active
       FROM products
       WHERE TRIM(barcode) = $1
         AND is_active = TRUE
       LIMIT 1`,
      [barcode]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        productExists: false,
        message: `No product found for barcode ${barcode}`,
      });
    }

    const product = result.rows[0];
    const quantity = Number(product.quantity || 0);
    const mappedProduct = {
      id: product.id,
      barcode: product.barcode,
      name: product.name,
      brand: product.brand,
      category: product.category,
      unit: product.unit,
      purchasePrice: Number(product.purchase_price || 0),
      sellingPrice: Number(product.selling_price || 0),
      quantity,
      minimumStock: Number(product.minimum_stock || 0),
      imageUrl: product.image_url,
      out_of_stock: quantity <= 0,
      stock_status:
        quantity <= 0
          ? "Out of stock"
          : quantity <= Number(product.minimum_stock || 0)
            ? "Low stock"
            : "In stock",
    };

    return res.json({
      success: true,
      productExists: true,
      message: mappedProduct.out_of_stock ? "Product is out of stock" : "Product ready to add",
      data: mappedProduct,
      product: mappedProduct,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Unable to scan product",
    });
  }
});

export const createCounterSale = asyncHandler(async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await ensureCounterSaleSchema(client);

    const customer = await getCounterCustomer(client, req.body);
    const sale = await calculateSale(client, req.body.items);
    const paymentMethod = String(req.body.paymentMethod || req.body.payment_method || "Cash").trim() || "Cash";
    const billNumber = `POS-${Date.now()}`;
    const createdAt = new Date().toISOString();

    const saleResult = await client.query(
      `
        INSERT INTO counter_sales (
          bill_number,
          customer_name,
          customer_phone,
          payment_method,
          subtotal,
          gst_amount,
          total_amount
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id, bill_number, created_at
      `,
      [
        billNumber,
        customer.name,
        customer.phone,
        paymentMethod,
        sale.subtotal,
        sale.tax,
        sale.total,
      ]
    );

    const counterSale = saleResult.rows[0];

    for (const item of sale.verifiedItems) {
      await client.query(
        `
          INSERT INTO counter_sale_items (
            sale_id,
            product_id,
            quantity,
            unit_price,
            line_total
          )
          VALUES ($1, $2, $3, $4, $5)
        `,
        [
          counterSale.id,
          item.product_id,
          item.quantity,
          item.unit_price,
          item.total_price,
        ]
      );

      await client.query(
        `UPDATE products
         SET quantity = $1,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [item.quantity_after, item.product_id]
      );

      await client.query(
        `INSERT INTO inventory_transactions (
           product_id,
           transaction_type,
           quantity,
           quantity_before,
           quantity_after,
           reference_number,
           notes,
           created_by
         )
         VALUES ($1, 'SALE', $2, $3, $4, $5, $6, $7)`,
        [
          item.product_id,
          item.quantity,
          item.quantity_before,
          item.quantity_after,
          billNumber,
          `Counter sale via ${paymentMethod}`,
          req.user?.id || null,
        ]
      );
    }

    const bill = {
      bill_number: billNumber,
      created_at: createdAt,
      payment_method: paymentMethod,
      customer_name: customer.name,
      customer_phone: customer.phone,
      line_items: sale.verifiedItems.map((item) => ({
        product_id: item.product_id,
        barcode: item.barcode,
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
        unit_price: item.unit_price,
        total_price: item.total_price,
      })),
      subtotal: sale.subtotal,
      tax: sale.tax,
      discount: sale.discount,
      delivery_charge: sale.deliveryCharge,
      total_amount: sale.total,
    };

    await client.query("COMMIT");

    return res.status(201).json({
      success: true,
      message: "Counter sale completed and bill generated",
      data: {
        sale: counterSale,
        customer,
        bill,
        inventory_movements: sale.verifiedItems.map((item) => ({
          product_id: item.product_id,
          barcode: item.barcode,
          name: item.name,
          quantity: item.quantity,
          remaining_quantity: item.quantity_after,
          transaction_type: "SALE",
        })),
      },
      billNumber,
      subtotal: sale.subtotal,
      gstAmount: sale.tax,
      totalAmount: sale.total,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Unable to complete counter sale",
      data: error.outOfStockItems ? { out_of_stock_items: error.outOfStockItems } : undefined,
    });
  } finally {
    client.release();
  }
});

export const createStockInScan = asyncHandler(async (req, res) => {
  const client = await pool.connect();

  try {
    const barcode = String(req.body.barcode || "").trim();
    const receivedQuantity = normalizeStockQuantity(req.body.quantity);

    if (!barcode) {
      return res.status(400).json({
        success: false,
        message: "Barcode is required",
      });
    }

    await client.query("BEGIN");
    const productResult = await client.query(
      `SELECT id, barcode, name, quantity, unit, minimum_stock
       FROM products
       WHERE TRIM(barcode) = $1
         AND is_active = TRUE
       FOR UPDATE`,
      [barcode]
    );

    if (productResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        success: false,
        productExists: false,
        message: `No product found for barcode ${barcode}`,
      });
    }

    const product = productResult.rows[0];
    const quantityBefore = Number(product.quantity || 0);
    const quantityAfter = Number((quantityBefore + receivedQuantity).toFixed(2));

    const updatedProduct = await client.query(
      `UPDATE products
       SET quantity = $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING id, barcode, name, quantity, unit, minimum_stock`,
      [quantityAfter, product.id]
    );

    await client.query(
      `INSERT INTO inventory_transactions
         (product_id, transaction_type, quantity, quantity_before, quantity_after, notes, created_by)
       VALUES ($1, 'STOCK_IN', $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        product.id,
        receivedQuantity,
        quantityBefore,
        quantityAfter,
        req.body.notes || `Stock-in scan for ${product.name}`,
        req.user?.id || null,
      ]
    );

    await client.query("COMMIT");

    return res.status(201).json({
      success: true,
      message: `${product.name} stock increased by ${receivedQuantity}`,
      data: {
        product: {
          ...updatedProduct.rows[0],
          out_of_stock: false,
          stock_status: "In stock",
        },
        stockMovement: {
          quantityReceived: receivedQuantity,
          quantityBefore,
          quantityAfter,
        },
      },
    });
  } catch (error) {
    await client.query("ROLLBACK");
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Unable to record stock-in scan",
    });
  } finally {
    client.release();
  }
});
