// Menu Controller
import { pool } from "../config/database.js";
import { successResponse, errorResponse, asyncHandler } from "../utils/index.js";
import { scheduleRagKnowledgeSync } from "../services/ragService.js";

const getValidCreatedByUserId = async (userId) => {
  if (!userId) return null;

  const result = await pool.query("SELECT id FROM users WHERE id = $1", [userId]);
  return result.rows[0]?.id || null;
};

// Get all menu items
export const getAllMenuItems = asyncHandler(async (req, res) => {
  const { category, search, available } = req.query;

  let query = `
    SELECT m.id, m.name, m.description, m.price, m.veg_type, m.is_available, 
           m.is_featured, m.preparation_time, m.calories, m.is_spicy, m.image_url,
           m.barcode,
           m.image_url AS image,
           c.id as category_id, c.name as category_name, c.name AS category
    FROM menu m
    JOIN categories c ON m.category_id = c.id
    WHERE 1=1
  `;
  const params = [];

  if (category) {
    query += ` AND m.category_id = $${params.length + 1}`;
    params.push(category);
  }

  if (search) {
    query += ` AND m.name ILIKE $${params.length + 1}`;
    params.push(`%${search}%`);
  }

  if (available === "true") {
    query += ` AND m.is_available = true`;
  } else if (available === "false") {
    query += ` AND m.is_available = false`;
  }

  query += ` ORDER BY c.display_order, m.name`;

  const result = await pool.query(query, params);
  return successResponse(res, result.rows, "Menu items retrieved successfully");
});

// Get menu item by ID
export const getMenuItemById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const result = await pool.query(
    `SELECT m.id, m.name, m.description, m.price, m.veg_type, m.is_available, 
            m.is_featured, m.preparation_time, m.calories, m.is_spicy, m.image_url,
            m.barcode,
            c.id as category_id, c.name as category_name
     FROM menu m
     JOIN categories c ON m.category_id = c.id
     WHERE m.id = $1`,
    [id]
  );

  if (result.rows.length === 0) {
    return errorResponse(res, "Menu item not found", 404);
  }

  return successResponse(res, result.rows[0], "Menu item retrieved successfully");
});

// Create new menu item
export const createMenuItem = asyncHandler(async (req, res) => {
  const { name, category_id, description, price, veg_type, image_url, is_available, is_featured, preparation_time, calories, is_spicy, barcode } = req.body;
  const userId = await getValidCreatedByUserId(req.user?.id);

  // Validate required fields
  if (!name || !category_id || !price || !veg_type) {
    return errorResponse(res, "Name, category_id, price, and veg_type are required", 400);
  }

  // Validate category exists
  const category = await pool.query("SELECT id FROM categories WHERE id = $1", [category_id]);
  if (category.rows.length === 0) {
    return errorResponse(res, "Category not found", 404);
  }

  const existing = await pool.query(
    "SELECT id FROM menu WHERE category_id = $1 AND LOWER(TRIM(name)) = LOWER(TRIM($2)) LIMIT 1",
    [category_id, name]
  );

  if (existing.rows.length > 0) {
    const result = await pool.query(
      `UPDATE menu
       SET description = COALESCE($1, description),
           price = $2,
           veg_type = $3,
           image_url = COALESCE($4, image_url),
           is_available = COALESCE($5, is_available),
           is_featured = COALESCE($6, is_featured),
           preparation_time = COALESCE($7, preparation_time),
           calories = COALESCE($8, calories),
           is_spicy = COALESCE($9, is_spicy),
           barcode = COALESCE(NULLIF($10, ''), barcode),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $11
       RETURNING id, name, category_id, description, price, veg_type, image_url, is_available, is_featured, preparation_time, calories, is_spicy, barcode`,
      [
        description,
        price,
        veg_type,
        image_url,
        is_available !== false,
        is_featured === true,
        preparation_time || 20,
        calories,
        is_spicy === true,
        barcode?.trim() || null,
        existing.rows[0].id,
      ]
    );

    scheduleRagKnowledgeSync("menu_item_upserted");
    return successResponse(res, result.rows[0], "Menu item updated successfully");
  }

  const result = await pool.query(
    `INSERT INTO menu (name, category_id, description, price, veg_type, image_url, is_available, is_featured, preparation_time, calories, is_spicy, created_by, barcode)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NULLIF($13, ''))
     RETURNING id, name, category_id, description, price, veg_type, image_url, is_available, is_featured, preparation_time, calories, is_spicy, barcode`,
    [name, category_id, description, price, veg_type, image_url, is_available !== false, is_featured === true, preparation_time || 20, calories, is_spicy === true, userId, barcode?.trim() || null]
  );

  scheduleRagKnowledgeSync("menu_item_created");
  return successResponse(res, result.rows[0], "Menu item created successfully", 201);
});

// Update menu item
export const updateMenuItem = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, category_id, description, price, veg_type, image_url, is_available, is_featured, preparation_time, calories, is_spicy, barcode } = req.body;

  // Check if menu item exists
  const existing = await pool.query("SELECT id FROM menu WHERE id = $1", [id]);
  if (existing.rows.length === 0) {
    return errorResponse(res, "Menu item not found", 404);
  }

  // Validate category if provided
  if (category_id) {
    const category = await pool.query("SELECT id FROM categories WHERE id = $1", [category_id]);
    if (category.rows.length === 0) {
      return errorResponse(res, "Category not found", 404);
    }
  }

  const result = await pool.query(
    `UPDATE menu 
     SET name = COALESCE($1, name),
         category_id = COALESCE($2, category_id),
         description = COALESCE($3, description),
         price = COALESCE($4, price),
         veg_type = COALESCE($5, veg_type),
         image_url = COALESCE($6, image_url),
         is_available = COALESCE($7, is_available),
         is_featured = COALESCE($8, is_featured),
         preparation_time = COALESCE($9, preparation_time),
         calories = COALESCE($10, calories),
         is_spicy = COALESCE($11, is_spicy),
         barcode = COALESCE(NULLIF($12, ''), barcode),
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $13
     RETURNING id, name, category_id, description, price, veg_type, image_url, is_available, is_featured, preparation_time, calories, is_spicy, barcode`,
    [name, category_id, description, price, veg_type, image_url, is_available, is_featured, preparation_time, calories, is_spicy, barcode?.trim() || null, id]
  );

  scheduleRagKnowledgeSync("menu_item_updated");
  return successResponse(res, result.rows[0], "Menu item updated successfully");
});

// Delete menu item
export const deleteMenuItem = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Check if menu item exists
  const existing = await pool.query("SELECT id FROM menu WHERE id = $1", [id]);
  if (existing.rows.length === 0) {
    return errorResponse(res, "Menu item not found", 404);
  }

  // Check if item is in any active orders
  const inOrders = await pool.query(
    `SELECT COUNT(*) FROM order_items oi 
     JOIN orders o ON oi.order_id = o.id 
     WHERE oi.menu_id = $1 AND o.status NOT IN ('Completed', 'Cancelled')`,
    [id]
  );

  if (parseInt(inOrders.rows[0].count) > 0) {
    return errorResponse(res, "Cannot delete menu item with active orders", 409);
  }

  await pool.query("DELETE FROM menu WHERE id = $1", [id]);

  scheduleRagKnowledgeSync("menu_item_deleted");
  return successResponse(res, null, "Menu item deleted successfully");
});

// Get featured menu items
export const getFeaturedItems = asyncHandler(async (req, res) => {
  const result = await pool.query(
    `SELECT m.id, m.name, m.description, m.price, m.veg_type, m.is_available, 
            m.is_featured, m.preparation_time, m.calories, m.is_spicy, m.image_url,
            m.barcode,
            c.id as category_id, c.name as category_name
     FROM menu m
     JOIN categories c ON m.category_id = c.id
     WHERE m.is_featured = true AND m.is_available = true
     ORDER BY m.name`
  );

  return successResponse(res, result.rows, "Featured items retrieved successfully");
});

// Kept for backward compatibility
export const getCategories = asyncHandler(async (req, res) => {
  const result = await pool.query(
    "SELECT id, name, description, image_url, display_order, is_active FROM categories WHERE is_active = true ORDER BY display_order ASC"
  );

  return successResponse(res, result.rows, "Categories retrieved successfully");
});
