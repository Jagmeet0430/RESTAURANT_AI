import { pool } from "../config/database.js";
import { asyncHandler } from "../utils/index.js";
import { ensureBarcodeStockSchema } from "../services/inventoryStockService.js";

const ensureInventorySchema = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS suppliers (
      id SERIAL PRIMARY KEY,
      name VARCHAR(150) NOT NULL,
      contact_person VARCHAR(120),
      phone VARCHAR(20),
      email VARCHAR(150),
      address TEXT,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    ALTER TABLE suppliers
      ADD COLUMN IF NOT EXISTS contact_person VARCHAR(120),
      ADD COLUMN IF NOT EXISTS phone VARCHAR(20),
      ADD COLUMN IF NOT EXISTS email VARCHAR(150),
      ADD COLUMN IF NOT EXISTS address TEXT,
      ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE,
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS inventory (
      id SERIAL PRIMARY KEY,
      ingredient_name VARCHAR(150) NOT NULL,
      quantity NUMERIC(12, 2) NOT NULL DEFAULT 0,
      unit VARCHAR(30) NOT NULL,
      minimum_level NUMERIC(12, 2) NOT NULL DEFAULT 0,
      cost_per_unit NUMERIC(12, 2) DEFAULT 0,
      expiry_date DATE,
      supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await ensureBarcodeStockSchema();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS inventory_transactions (
      id SERIAL PRIMARY KEY,
      inventory_id INTEGER NOT NULL REFERENCES inventory(id) ON DELETE CASCADE,
      transaction_type VARCHAR(20) NOT NULL
        CHECK (transaction_type IN ('STOCK_IN', 'STOCK_OUT', 'ADJUSTMENT', 'WASTE')),
      quantity NUMERIC(12, 2) NOT NULL,
      reference_type VARCHAR(50),
      reference_id INTEGER,
      notes TEXT,
      created_by INTEGER,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query("CREATE INDEX IF NOT EXISTS idx_inventory_supplier ON inventory(supplier_id)");
  await pool.query("CREATE INDEX IF NOT EXISTS idx_inventory_expiry ON inventory(expiry_date)");
};

const ensureProductInventorySchema = async (client = pool) => {
  await ensureBarcodeStockSchema(client);

  await client.query(`
    CREATE TABLE IF NOT EXISTS suppliers (
      id SERIAL PRIMARY KEY,
      name VARCHAR(150) NOT NULL,
      contact_person VARCHAR(120),
      phone VARCHAR(20),
      email VARCHAR(150),
      address TEXT,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await client.query(`
    ALTER TABLE suppliers
      ADD COLUMN IF NOT EXISTS contact_person VARCHAR(120),
      ADD COLUMN IF NOT EXISTS phone VARCHAR(20),
      ADD COLUMN IF NOT EXISTS email VARCHAR(150),
      ADD COLUMN IF NOT EXISTS address TEXT,
      ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE,
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS products (
      id SERIAL PRIMARY KEY,
      barcode VARCHAR(50) UNIQUE NOT NULL,
      name VARCHAR(150) NOT NULL,
      category VARCHAR(100),
      brand VARCHAR(120),
      description TEXT,
      unit VARCHAR(30) NOT NULL DEFAULT 'piece',
      purchase_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
      selling_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
      quantity NUMERIC(12, 2) NOT NULL DEFAULT 0,
      minimum_stock NUMERIC(12, 2) NOT NULL DEFAULT 5,
      supplier_id INTEGER,
      supplier_name VARCHAR(150),
      batch_number VARCHAR(100),
      expiry_date DATE,
      image_url VARCHAR(500),
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await client.query(`
    ALTER TABLE products
      ADD COLUMN IF NOT EXISTS brand VARCHAR(120),
      ADD COLUMN IF NOT EXISTS description TEXT,
      ADD COLUMN IF NOT EXISTS supplier_name VARCHAR(150),
      ADD COLUMN IF NOT EXISTS batch_number VARCHAR(100),
      ADD COLUMN IF NOT EXISTS expiry_date DATE,
      ADD COLUMN IF NOT EXISTS image_url VARCHAR(500),
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS inventory_transactions (
      id SERIAL PRIMARY KEY,
      inventory_id INTEGER REFERENCES inventory(id) ON DELETE CASCADE,
      product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
      transaction_type VARCHAR(30) NOT NULL,
      quantity NUMERIC(12, 2) NOT NULL,
      quantity_before NUMERIC(12, 2),
      quantity_after NUMERIC(12, 2),
      reference_type VARCHAR(50),
      reference_id INTEGER,
      reference_number VARCHAR(100),
      notes TEXT,
      created_by INTEGER,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await client.query(`
    ALTER TABLE inventory_transactions
      ADD COLUMN IF NOT EXISTS inventory_id INTEGER REFERENCES inventory(id) ON DELETE CASCADE,
      ADD COLUMN IF NOT EXISTS product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
      ADD COLUMN IF NOT EXISTS quantity_before NUMERIC(12, 2),
      ADD COLUMN IF NOT EXISTS quantity_after NUMERIC(12, 2),
      ADD COLUMN IF NOT EXISTS reference_type VARCHAR(50),
      ADD COLUMN IF NOT EXISTS reference_id INTEGER,
      ADD COLUMN IF NOT EXISTS reference_number VARCHAR(100),
      ADD COLUMN IF NOT EXISTS created_by INTEGER,
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  `);

  await client.query(`
    ALTER TABLE inventory_transactions
      ALTER COLUMN inventory_id DROP NOT NULL,
      ALTER COLUMN quantity_before SET DEFAULT 0,
      ALTER COLUMN quantity_after SET DEFAULT 0
  `);

  await client.query(`
    UPDATE inventory_transactions
    SET
      quantity_before = COALESCE(quantity_before, 0),
      quantity_after = COALESCE(quantity_after, 0)
    WHERE quantity_before IS NULL
       OR quantity_after IS NULL
  `);

  await client.query(`
    ALTER TABLE inventory_transactions
      ALTER COLUMN quantity_before SET NOT NULL,
      ALTER COLUMN quantity_after SET NOT NULL
  `);

  await client.query(`
    DO $$
    DECLARE
      constraint_name TEXT;
    BEGIN
      LOCK TABLE inventory_transactions IN ACCESS EXCLUSIVE MODE;

      FOR constraint_name IN
        SELECT con.conname
        FROM pg_constraint con
        JOIN pg_class rel ON rel.oid = con.conrelid
        JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
        WHERE rel.relname = 'inventory_transactions'
          AND nsp.nspname = current_schema()
          AND con.contype = 'c'
          AND pg_get_constraintdef(con.oid) ILIKE '%transaction_type%'
      LOOP
        EXECUTE format('ALTER TABLE inventory_transactions DROP CONSTRAINT IF EXISTS %I', constraint_name);
      END LOOP;

      ALTER TABLE inventory_transactions
        ADD CONSTRAINT inventory_transactions_transaction_type_check
        CHECK (
          transaction_type IN (
            'STOCK_IN',
            'STOCK_OUT',
            'SALE',
            'RETURN',
            'ADJUSTMENT',
            'WASTE',
            'WASTAGE'
          )
        );
    EXCEPTION
      WHEN duplicate_object THEN
        NULL;
    END $$;
  `);

  await client.query("CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode)");
  await client.query("CREATE INDEX IF NOT EXISTS idx_transactions_product ON inventory_transactions(product_id)");
};

const liveProductInventorySelect = `
  SELECT
    CONCAT('product-', p.id) AS id,
    'product' AS source_type,
    p.id AS source_id,
    NULL::INTEGER AS inventory_id,
    p.id AS product_id,
    p.name AS ingredient_name,
    p.quantity,
    p.unit,
    p.minimum_stock AS minimum_level,
    p.purchase_price AS cost_per_unit,
    p.expiry_date,
    p.supplier_id,
    NULL::INTEGER AS menu_id,
    p.barcode,
    1::NUMERIC AS stock_per_sale,
    p.category AS menu_name,
    p.selling_price AS menu_price,
    p.is_active AS menu_available,
    COALESCE(s.name, p.supplier_name) AS supplier_name,
    s.phone AS supplier_phone,
    CASE
      WHEN p.quantity <= 0 THEN 'Out of stock'
      WHEN p.quantity <= p.minimum_stock THEN 'Low stock'
      WHEN p.expiry_date IS NOT NULL AND p.expiry_date < CURRENT_DATE THEN 'Expired'
      WHEN p.expiry_date IS NOT NULL AND p.expiry_date <= CURRENT_DATE + INTERVAL '3 days'
        THEN 'Expiring soon'
      ELSE 'Healthy'
    END AS status
  FROM products p
  LEFT JOIN suppliers s ON s.id = p.supplier_id
  WHERE p.is_active = TRUE
`;

const normalizeNumber = (value, fallback = 0) => {
  if (value === "" || value === null || value === undefined) return fallback;
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
};

const normalizeBarcode = (value) => String(value ?? "").trim();

const parseInventoryRecordRef = (value) => {
  const recordRef = String(value || "").trim();
  const prefixedRef = recordRef.match(/^(ingredient|product)[-:](\d+)$/);

  if (prefixedRef) {
    return {
      source: prefixedRef[1],
      id: Number(prefixedRef[2]),
    };
  }

  const legacyId = Number(recordRef);
  if (Number.isInteger(legacyId) && legacyId > 0) {
    return {
      source: "ingredient",
      id: legacyId,
    };
  }

  return {
    source: "",
    id: 0,
  };
};

const syncMenuAvailabilityFromInventory = async (client, item) => {
  if (!item?.menu_id) return;

  await client.query(
    `UPDATE menu
     SET is_available = $1,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $2`,
    [Number(item.quantity || 0) > 0, item.menu_id]
  );
};

/**
 * GET /api/inventory/barcode/:barcode
 * Find a product before receiving stock.
 */
export const getProductByBarcode = asyncHandler(async (req, res) => {
  await ensureProductInventorySchema();

  const barcode = normalizeBarcode(req.params.barcode);

  if (!barcode) {
    return res.status(400).json({
      success: false,
      message: "Barcode is required",
    });
  }

  const result = await pool.query(
    `
      SELECT
        p.id,
        p.barcode,
        p.name,
        p.category,
        p.brand,
        p.description,
        p.unit,
        p.purchase_price,
        p.selling_price,
        p.quantity,
        p.minimum_stock,
        p.supplier_id,
        COALESCE(s.name, p.supplier_name) AS supplier_name,
        p.image_url,
        p.is_active
      FROM products p
      LEFT JOIN suppliers s ON s.id = p.supplier_id
      WHERE TRIM(p.barcode) = $1
        AND p.is_active = TRUE
      LIMIT 1
    `,
    [barcode]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({
      success: false,
      productExists: false,
      barcode,
      message: `No product found for barcode ${barcode}`,
    });
  }

  const product = result.rows[0];

  return res.status(200).json({
    success: true,
    productExists: true,
    product: {
      id: product.id,
      barcode: product.barcode,
      name: product.name,
      brand: product.brand,
      category: product.category,
      description: product.description,
      unit: product.unit,
      purchasePrice: Number(product.purchase_price || 0),
      sellingPrice: Number(product.selling_price || 0),
      quantity: Number(product.quantity || 0),
      minimumStock: Number(product.minimum_stock || 0),
      supplierId: product.supplier_id,
      supplierName: product.supplier_name,
      imageUrl: product.image_url,
      isActive: product.is_active,
    },
  });
});

export const findProductByBarcode = getProductByBarcode;

/**
 * POST /api/inventory/receive
 *
 * Existing barcode:
 *   increases stock.
 *
 * New barcode:
 *   creates the product and adds opening stock.
 */
export const receiveStock = async (req, res, next) => {
  const {
    barcode: rawBarcode,
    quantity: rawQuantity,
    name,
    category,
    unit = "piece",
    purchasePrice = 0,
    sellingPrice = 0,
    minimumStock = 5,
    supplierId = null,
    referenceNumber = null,
    expiryDate = null,
    notes = null,
  } = req.body;

  const barcode = normalizeBarcode(rawBarcode);
  const quantity = Number(rawQuantity);

  if (!barcode) {
    return res.status(400).json({
      success: false,
      message: "Barcode is required",
    });
  }

  if (!Number.isFinite(quantity) || quantity <= 0) {
    return res.status(400).json({
      success: false,
      message: "Quantity must be greater than zero",
    });
  }

  const client = await pool.connect();
  let transactionStarted = false;

  try {
    await client.query("BEGIN");
    transactionStarted = true;
    await ensureProductInventorySchema(client);

    const existingProduct = await client.query(
      `
        SELECT *
        FROM products
        WHERE TRIM(barcode) = $1
        FOR UPDATE
      `,
      [barcode]
    );

    let product;
    let created = false;
    let quantityBefore = 0;

    if (existingProduct.rows.length > 0) {
      quantityBefore = Number(existingProduct.rows[0].quantity);

      const updatedProduct = await client.query(
        `
          UPDATE products
          SET
            quantity = quantity + $1,
            purchase_price = CASE
              WHEN $2::NUMERIC > 0 THEN $2
              ELSE purchase_price
            END,
            expiry_date = COALESCE($4, expiry_date),
            updated_at = CURRENT_TIMESTAMP
          WHERE TRIM(barcode) = $3
          RETURNING *
        `,
        [quantity, Number(purchasePrice), barcode, expiryDate || null]
      );

      product = updatedProduct.rows[0];
    } else {
      const normalizedName = String(name || "").trim();
      const normalizedCategory = String(category || "").trim();
      const normalizedUnit = String(unit || "").trim();
      const normalizedPurchasePrice = Number(purchasePrice);
      const normalizedSellingPrice = Number(sellingPrice);
      const normalizedMinimumStock = Number(minimumStock);
      const normalizedSupplierId = Number(supplierId);
      const missingFields = [];

      if (!normalizedName) missingFields.push("Product name");
      if (!normalizedCategory) missingFields.push("Category");
      if (!normalizedUnit) missingFields.push("Unit");
      if (!Number.isFinite(normalizedPurchasePrice) || normalizedPurchasePrice <= 0) {
        missingFields.push("Purchase price");
      }
      if (!Number.isFinite(normalizedSellingPrice) || normalizedSellingPrice <= 0) {
        missingFields.push("Selling price");
      }
      if (!Number.isFinite(normalizedSupplierId) || normalizedSupplierId <= 0) {
        missingFields.push("Supplier");
      }

      if (missingFields.length > 0) {
        await client.query("ROLLBACK");
        transactionStarted = false;

        return res.status(409).json({
          success: false,
          productExists: false,
          requiresRegistration: true,
          barcode,
          missingFields,
          message: `Complete product details required: ${missingFields.join(", ")}`,
        });
      }

      const supplierResult = await client.query(
        "SELECT id FROM suppliers WHERE id = $1 AND is_active = TRUE LIMIT 1",
        [normalizedSupplierId]
      );

      if (supplierResult.rowCount === 0) {
        await client.query("ROLLBACK");
        transactionStarted = false;

        return res.status(400).json({
          success: false,
          productExists: false,
          requiresRegistration: true,
          barcode,
          message: "Select a valid supplier for this product",
        });
      }

      const insertedProduct = await client.query(
        `
          INSERT INTO products (
            barcode,
            name,
            category,
            unit,
            purchase_price,
          selling_price,
          quantity,
          minimum_stock,
          supplier_id,
          expiry_date
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          RETURNING *
        `,
        [
          barcode,
          normalizedName,
          normalizedCategory,
          normalizedUnit,
          normalizedPurchasePrice,
          normalizedSellingPrice,
          quantity,
          Number.isFinite(normalizedMinimumStock) && normalizedMinimumStock > 0
            ? normalizedMinimumStock
            : 5,
          normalizedSupplierId,
          expiryDate || null,
        ]
      );

      product = insertedProduct.rows[0];
      created = true;
    }

    const quantityAfter = Number(product.quantity);

    await client.query(
      `
        INSERT INTO inventory_transactions (
          product_id,
          transaction_type,
          quantity,
          quantity_before,
          quantity_after,
          reference_number,
          notes
        )
        VALUES ($1, 'STOCK_IN', $2, $3, $4, $5, $6)
      `,
      [
        product.id,
        quantity,
        quantityBefore,
        quantityAfter,
        referenceNumber,
        notes,
      ]
    );

    await client.query("COMMIT");
    transactionStarted = false;

    return res.status(created ? 201 : 200).json({
      success: true,
      created,
      message: created
        ? "New product created and stock received"
        : "Existing product stock updated",
      product,
      stockMovement: {
        quantityReceived: quantity,
        quantityBefore,
        quantityAfter,
      },
    });
  } catch (error) {
    if (transactionStarted) {
      await client.query("ROLLBACK");
    }

    if (error.code === "23505") {
      return res.status(409).json({
        success: false,
        message: "This barcode is already registered",
      });
    }

    next(error);
  } finally {
    client.release();
  }
};

export const registerAndReceiveProduct = async (req, res, next) => {
  const client = await pool.connect();
  let transactionStarted = false;

  try {
    const {
      barcode,
      name,
      category,
      brand,
      description,
      unit = "piece",
      purchasePrice = 0,
      sellingPrice = 0,
      quantity,
      minimumStock = 5,
      supplierName,
      batchNumber,
      expiryDate,
      imageUrl,
    } = req.body;

    const cleanBarcode = normalizeBarcode(barcode);
    const cleanName = String(name || "").trim();
    const cleanCategory = String(category || "").trim();
    const cleanUnit = String(unit || "").trim();
    const cleanSupplierName = String(supplierName || "").trim();
    const stockQuantity = Number(quantity);
    const numericPurchasePrice = Number(purchasePrice);
    const numericSellingPrice = Number(sellingPrice);
    const numericMinimumStock = Number(minimumStock);
    const missingFields = [];

    if (!cleanBarcode) missingFields.push("Barcode");
    if (!cleanName) missingFields.push("Product name");
    if (!cleanCategory) missingFields.push("Category");
    if (!cleanUnit) missingFields.push("Unit");
    if (!Number.isFinite(numericPurchasePrice) || numericPurchasePrice <= 0) {
      missingFields.push("Purchase price");
    }
    if (!Number.isFinite(numericSellingPrice) || numericSellingPrice <= 0) {
      missingFields.push("Selling price");
    }
    if (!Number.isFinite(stockQuantity) || stockQuantity <= 0) {
      missingFields.push("Opening quantity");
    }
    if (!cleanSupplierName) missingFields.push("Supplier");

    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Complete product details required: ${missingFields.join(", ")}`,
        missingFields,
      });
    }

    await client.query("BEGIN");
    transactionStarted = true;
    await ensureProductInventorySchema(client);

    const duplicate = await client.query(
      `
        SELECT id
        FROM products
        WHERE TRIM(barcode) = $1
        LIMIT 1
      `,
      [cleanBarcode]
    );

    if (duplicate.rows.length > 0) {
      await client.query("ROLLBACK");
      transactionStarted = false;

      return res.status(409).json({
        success: false,
        message: "This barcode is already registered",
      });
    }

    let supplierId = null;
    const existingSupplier = await client.query(
      `
        SELECT id
        FROM suppliers
        WHERE LOWER(name) = LOWER($1)
          AND is_active = TRUE
        LIMIT 1
      `,
      [cleanSupplierName]
    );

    if (existingSupplier.rowCount > 0) {
      supplierId = existingSupplier.rows[0].id;
    } else {
      const supplierResult = await client.query(
        `
          INSERT INTO suppliers (name)
          VALUES ($1)
          RETURNING id
        `,
        [cleanSupplierName]
      );
      supplierId = supplierResult.rows[0].id;
    }

    const productResult = await client.query(
      `
        INSERT INTO products (
          barcode,
          name,
          category,
          brand,
          description,
          unit,
          purchase_price,
          selling_price,
          quantity,
          minimum_stock,
          supplier_id,
          supplier_name,
          batch_number,
          expiry_date,
          image_url
        )
        VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9, $10, $11, $12, $13, $14, $15
        )
        RETURNING *
      `,
      [
        cleanBarcode,
        cleanName,
        cleanCategory,
        String(brand || "").trim() || null,
        String(description || "").trim() || null,
        cleanUnit,
        numericPurchasePrice,
        numericSellingPrice,
        stockQuantity,
        Number.isFinite(numericMinimumStock) && numericMinimumStock > 0
          ? numericMinimumStock
          : 5,
        supplierId,
        cleanSupplierName,
        String(batchNumber || "").trim() || null,
        expiryDate || null,
        String(imageUrl || "").trim() || null,
      ]
    );

    const product = productResult.rows[0];
    const registrationNote = `Initial registration${
      batchNumber ? `, batch ${batchNumber}` : ""
    }${expiryDate ? `, expiry ${expiryDate}` : ""}`;

    await client.query(
      `
        INSERT INTO inventory_transactions (
          product_id,
          transaction_type,
          quantity,
          quantity_before,
          quantity_after,
          reference_number,
          notes
        )
        VALUES ($1, 'STOCK_IN', $2, 0, $2, $3, $4)
      `,
      [
        product.id,
        stockQuantity,
        String(batchNumber || "").trim() || null,
        registrationNote,
      ]
    );

    await client.query("COMMIT");
    transactionStarted = false;

    return res.status(201).json({
      success: true,
      message: "Product registered and stock received",
      product,
    });
  } catch (error) {
    if (transactionStarted) {
      await client.query("ROLLBACK");
    }

    if (error.code === "23505") {
      return res.status(409).json({
        success: false,
        message: "This barcode is already registered",
      });
    }

    next(error);
  } finally {
    client.release();
  }
};

export const getInventoryItems = asyncHandler(async (req, res) => {
  await ensureInventorySchema();
  await ensureProductInventorySchema();

  const result = await pool.query(`
    ${liveProductInventorySelect}
    ORDER BY ingredient_name ASC
  `);

  return res.status(200).json({
    success: true,
    count: result.rows.length,
    data: result.rows,
  });
});

export const getInventorySummary = asyncHandler(async (req, res) => {
  await ensureInventorySchema();
  await ensureProductInventorySchema();

  const result = await pool.query(`
    WITH stock_rows AS (
      SELECT quantity, minimum_stock AS minimum_level, expiry_date
      FROM products
      WHERE is_active = TRUE
    )
    SELECT
      COUNT(*)::INTEGER AS total_ingredients,
      COUNT(*) FILTER (
        WHERE quantity <= minimum_level
      )::INTEGER AS low_stock,
      COUNT(*) FILTER (
        WHERE quantity <= 0
      )::INTEGER AS out_of_stock,
      COUNT(*) FILTER (
        WHERE expiry_date IS NOT NULL
        AND expiry_date <= CURRENT_DATE + INTERVAL '3 days'
      )::INTEGER AS expiry_alerts,
      (
        SELECT COUNT(*)::INTEGER
        FROM suppliers
        WHERE is_active = TRUE
      ) AS total_suppliers
    FROM stock_rows
  `);

  return res.status(200).json({
    success: true,
    data: result.rows[0],
  });
});

export const createInventoryItem = asyncHandler(async (req, res) => {
  await ensureInventorySchema();

  const {
    ingredient_name,
    quantity,
    unit,
    minimum_level,
    cost_per_unit,
    expiry_date,
    supplier_id,
    menu_id,
    barcode,
    stock_per_sale,
  } = req.body;

  if (!ingredient_name || !unit) {
    return res.status(400).json({
      success: false,
      message: "Ingredient name and unit are required",
    });
  }

  const result = await pool.query(
    `
      INSERT INTO inventory
        (ingredient_name, quantity, unit, minimum_level, cost_per_unit, expiry_date, supplier_id, menu_id, barcode, stock_per_sale)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NULLIF($9, ''), $10)
      RETURNING *
    `,
    [
      ingredient_name.trim(),
      normalizeNumber(quantity),
      unit.trim(),
      normalizeNumber(minimum_level),
      normalizeNumber(cost_per_unit),
      expiry_date || null,
      supplier_id || null,
      menu_id || null,
      barcode?.trim() || null,
      normalizeNumber(stock_per_sale, 1) || 1,
    ]
  );

  if (menu_id && barcode?.trim()) {
    await pool.query(
      `UPDATE menu
       SET barcode = COALESCE(NULLIF($1, ''), barcode),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [barcode.trim(), menu_id]
    );
  }

  await syncMenuAvailabilityFromInventory(pool, result.rows[0]);

  return res.status(201).json({
    success: true,
    message: "Inventory item created successfully",
    data: result.rows[0],
  });
});

export const updateInventoryItem = asyncHandler(async (req, res) => {
  await ensureInventorySchema();
  await ensureProductInventorySchema();

  const recordRef = parseInventoryRecordRef(req.params.id);
  const {
    ingredient_name,
    quantity,
    unit,
    minimum_level,
    cost_per_unit,
    expiry_date,
    supplier_id,
    menu_id,
    barcode,
    stock_per_sale,
  } = req.body;

  if (!recordRef.id) {
    return res.status(400).json({
      success: false,
      message: "Invalid inventory item",
    });
  }

  if (recordRef.source === "product") {
    const result = await pool.query(
      `
        UPDATE products
        SET
          name = COALESCE($1, name),
          quantity = COALESCE($2, quantity),
          unit = COALESCE($3, unit),
          minimum_stock = COALESCE($4, minimum_stock),
          purchase_price = COALESCE($5, purchase_price),
          expiry_date = $6,
          supplier_id = $7,
          barcode = COALESCE(NULLIF($8, ''), barcode),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $9 AND is_active = TRUE
        RETURNING *
      `,
      [
        ingredient_name?.trim() || null,
        quantity !== undefined ? normalizeNumber(quantity) : null,
        unit?.trim() || null,
        minimum_level !== undefined ? normalizeNumber(minimum_level) : null,
        cost_per_unit !== undefined ? normalizeNumber(cost_per_unit) : null,
        expiry_date || null,
        supplier_id || null,
        barcode?.trim() || null,
        recordRef.id,
      ]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Inventory item not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Inventory item updated",
      data: result.rows[0],
    });
  }

  const result = await pool.query(
    `
      UPDATE inventory
      SET
        ingredient_name = COALESCE($1, ingredient_name),
        quantity = COALESCE($2, quantity),
        unit = COALESCE($3, unit),
        minimum_level = COALESCE($4, minimum_level),
        cost_per_unit = COALESCE($5, cost_per_unit),
        expiry_date = $6,
        supplier_id = $7,
        menu_id = COALESCE($8, menu_id),
        barcode = COALESCE(NULLIF($9, ''), barcode),
        stock_per_sale = COALESCE($10, stock_per_sale),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $11 AND is_active = TRUE
      RETURNING *
    `,
    [
      ingredient_name?.trim() || null,
      quantity !== undefined ? normalizeNumber(quantity) : null,
      unit?.trim() || null,
      minimum_level !== undefined ? normalizeNumber(minimum_level) : null,
      cost_per_unit !== undefined ? normalizeNumber(cost_per_unit) : null,
      expiry_date || null,
      supplier_id || null,
      menu_id || null,
      barcode?.trim() || null,
      stock_per_sale !== undefined ? normalizeNumber(stock_per_sale, 1) || 1 : null,
      recordRef.id,
    ]
  );

  if (result.rowCount === 0) {
    return res.status(404).json({
      success: false,
      message: "Inventory item not found",
    });
  }

  if (result.rows[0].menu_id && result.rows[0].barcode) {
    await pool.query(
      `UPDATE menu
       SET barcode = COALESCE(NULLIF($1, ''), barcode),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [result.rows[0].barcode, result.rows[0].menu_id]
    );
  }

  await syncMenuAvailabilityFromInventory(pool, result.rows[0]);

  return res.status(200).json({
    success: true,
    message: "Inventory item updated",
    data: result.rows[0],
  });
});

export const deleteInventoryItem = asyncHandler(async (req, res) => {
  await ensureInventorySchema();
  await ensureProductInventorySchema();

  const recordRef = parseInventoryRecordRef(req.params.id);

  if (!recordRef.id) {
    return res.status(400).json({
      success: false,
      message: "Invalid inventory item",
    });
  }

  if (recordRef.source === "product") {
    const result = await pool.query(
      `
        UPDATE products
        SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND is_active = TRUE
        RETURNING id
      `,
      [recordRef.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Inventory item not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Inventory item deleted",
    });
  }

  const result = await pool.query(
    `
      UPDATE inventory
      SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND is_active = TRUE
      RETURNING id
    `,
    [recordRef.id]
  );

  if (result.rowCount === 0) {
    return res.status(404).json({
      success: false,
      message: "Inventory item not found",
    });
  }

  return res.status(200).json({
    success: true,
    message: "Inventory item deleted",
  });
});

export const recordInventoryTransaction = asyncHandler(async (req, res) => {
  await ensureInventorySchema();
  await ensureProductInventorySchema();

  const recordRef = parseInventoryRecordRef(req.params.id);
  const { transaction_type, quantity, notes } = req.body;
  const transactionQuantity = normalizeNumber(quantity);

  if (!recordRef.id) {
    return res.status(400).json({
      success: false,
      message: "Invalid inventory item",
    });
  }

  if (!["STOCK_IN", "STOCK_OUT", "ADJUSTMENT", "WASTE"].includes(transaction_type)) {
    return res.status(400).json({
      success: false,
      message: "Invalid transaction type",
    });
  }

  if (transactionQuantity <= 0) {
    return res.status(400).json({
      success: false,
      message: "Quantity must be greater than zero",
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    if (recordRef.source === "product") {
      const productResult = await client.query(
        "SELECT id, quantity FROM products WHERE id = $1 AND is_active = TRUE FOR UPDATE",
        [recordRef.id]
      );

      if (productResult.rowCount === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({
          success: false,
          message: "Inventory item not found",
        });
      }

      const currentQuantity = Number(productResult.rows[0].quantity || 0);
      const signedQuantity = ["STOCK_OUT", "WASTE"].includes(transaction_type)
        ? -transactionQuantity
        : transactionQuantity;
      const nextQuantity = Math.max(0, currentQuantity + signedQuantity);

      const transactionResult = await client.query(
        `
          INSERT INTO inventory_transactions
            (product_id, transaction_type, quantity, quantity_before, quantity_after, notes, created_by)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING *
        `,
        [
          recordRef.id,
          transaction_type,
          transactionQuantity,
          currentQuantity,
          nextQuantity,
          notes || null,
          req.user?.id || null,
        ]
      );

      const updatedProductResult = await client.query(
        `
          UPDATE products
          SET quantity = $1, updated_at = CURRENT_TIMESTAMP
          WHERE id = $2
          RETURNING *
        `,
        [nextQuantity, recordRef.id]
      );

      await client.query("COMMIT");

      return res.status(201).json({
        success: true,
        message: "Inventory transaction recorded",
        data: {
          transaction: transactionResult.rows[0],
          item: updatedProductResult.rows[0],
        },
      });
    }

    const itemResult = await client.query(
      "SELECT id, quantity FROM inventory WHERE id = $1 AND is_active = TRUE FOR UPDATE",
      [recordRef.id]
    );

    if (itemResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        success: false,
        message: "Inventory item not found",
      });
    }

    const currentQuantity = Number(itemResult.rows[0].quantity || 0);
    const signedQuantity = ["STOCK_OUT", "WASTE"].includes(transaction_type)
      ? -transactionQuantity
      : transactionQuantity;
    const nextQuantity = Math.max(0, currentQuantity + signedQuantity);

    const transactionResult = await client.query(
      `
        INSERT INTO inventory_transactions
          (inventory_id, transaction_type, quantity, notes, created_by)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `,
      [recordRef.id, transaction_type, transactionQuantity, notes || null, req.user?.id || null]
    );

    const updatedItemResult = await client.query(
      `
        UPDATE inventory
        SET quantity = $1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
        RETURNING *
      `,
      [nextQuantity, recordRef.id]
    );

    await syncMenuAvailabilityFromInventory(client, updatedItemResult.rows[0]);

    await client.query("COMMIT");

    return res.status(201).json({
      success: true,
      message: "Inventory transaction recorded",
      data: {
        transaction: transactionResult.rows[0],
        item: updatedItemResult.rows[0],
      },
    });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
});

export const getInventoryTransactions = asyncHandler(async (req, res) => {
  await ensureInventorySchema();
  await ensureProductInventorySchema();

  const result = await pool.query(`
    SELECT
      t.id,
      t.inventory_id,
      t.product_id,
      CASE
        WHEN t.product_id IS NOT NULL THEN CONCAT('product-', t.product_id)
        ELSE CONCAT('ingredient-', t.inventory_id)
      END AS stock_item_id,
      p.name AS ingredient_name,
      t.transaction_type,
      t.quantity,
      t.quantity_before,
      t.quantity_after,
      t.notes,
      t.created_at
    FROM inventory_transactions t
    JOIN products p ON p.id = t.product_id
    ORDER BY t.created_at DESC
    LIMIT 50
  `);

  return res.status(200).json({
    success: true,
    count: result.rows.length,
    data: result.rows,
  });
});
