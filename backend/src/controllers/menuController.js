// Menu Controller
import { pool } from "../config/database.js";
import { successResponse, errorResponse, asyncHandler } from "../utils/index.js";
import { scheduleRagKnowledgeSync } from "../services/ragService.js";
import { saveMenuImage } from '../services/menuImageService.js';

function validMenuInput(body) {
  return (body.name == null || (typeof body.name==='string' && body.name.trim().length>0 && body.name.length<=255)) &&
    (body.price == null || (Number.isFinite(Number(body.price)) && Number(body.price)>=0 && Number(body.price)<=999999)) &&
    (body.description == null || (typeof body.description==='string' && body.description.length<=10000)) &&
    (body.veg_type == null || ['veg','non-veg'].includes(String(body.veg_type).toLowerCase())) &&
    (body.barcode == null || (typeof body.barcode==='string' && body.barcode.length<=100)) &&
    ['preparation_time','calories'].every(k=>body[k]==null||(Number.isInteger(Number(body[k]))&&Number(body[k])>=0&&Number(body[k])<=100000)) &&
    ['is_available','is_featured','is_spicy','visible_kiosk','visible_website'].every(k=>body[k]==null||typeof body[k]==='boolean') &&
    (body.display_order==null || (Number.isInteger(Number(body.display_order)) && Math.abs(Number(body.display_order))<=100000)) &&
    (body.sync_version==null || /^\d+$/.test(String(body.sync_version)));
}

const getValidCreatedByUserId = async (userId) => {
  if (!userId) return null;

  const result = await pool.query("SELECT id FROM users WHERE id = $1", [userId]);
  return result.rows[0]?.id || null;
};

// Get all menu items
export const getAllMenuItems = asyncHandler(async (req, res) => {
  const { category, search, available, channel } = req.query;
  res.set('Cache-Control','no-cache');

  let query = `
    SELECT m.id, m.name, m.description, m.price, m.veg_type, m.is_available, 
           m.is_featured, m.preparation_time, m.calories, m.is_spicy, m.image_url,
           m.barcode, m.sync_version, m.visible_kiosk, m.visible_website, m.display_order,
           COALESCE(m.image_fallback_id,m.id) AS image_fallback_id,
           m.image_url AS image,
           c.id as category_id, c.name as category_name, c.name AS category
    FROM menu m
    JOIN categories c ON m.category_id = c.id
    WHERE m.deleted_at IS NULL AND c.deleted_at IS NULL
  `;
  const params = [];
  if(channel==='kiosk') query+=' AND m.visible_kiosk=true AND c.is_active=true';
  if(channel==='website') query+=' AND m.visible_website=true AND c.is_active=true';

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

  query += ` ORDER BY c.display_order, m.display_order, m.name`;

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
     WHERE m.id = $1 AND m.deleted_at IS NULL AND c.deleted_at IS NULL`,
    [id]
  );

  if (result.rows.length === 0) {
    return errorResponse(res, "Menu item not found", 404);
  }

  return successResponse(res, result.rows[0], "Menu item retrieved successfully");
});

// Create new menu item
export const createMenuItem = asyncHandler(async (req, res) => {
  if(!validMenuInput(req.body)) return errorResponse(res,'Invalid menu details',400);
  const { name, category_id, description, price, veg_type, is_available, is_featured, preparation_time, calories, is_spicy, barcode } = req.body;
  let image_url;
  try {image_url=await saveMenuImage(pool,req.body.image_url);}catch{return errorResponse(res,'Use a valid JPEG, PNG or WebP image up to 2 MB, or a public HTTPS image URL.',400);}
  const userId = await getValidCreatedByUserId(req.user?.id);

  // Validate required fields
  if (!name || !category_id || price == null || !veg_type) {
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
    return errorResponse(res,'This menu item already exists. Edit the existing item instead.',409);
  }

  const result = await pool.query(
    `INSERT INTO menu (name, category_id, description, price, veg_type, image_url, is_available, is_featured, preparation_time, calories, is_spicy, created_by, barcode,visible_kiosk,visible_website,display_order)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NULLIF($13, ''),$14,$15,$16)
     RETURNING *`,
    [name, category_id, description, price, veg_type, image_url, is_available !== false, is_featured === true, preparation_time || 20, calories, is_spicy === true, userId, barcode?.trim() || null,
      req.body.visible_kiosk!==false,req.body.visible_website!==false,Number(req.body.display_order||0)]
  );

  scheduleRagKnowledgeSync("menu_item_created");
  return successResponse(res, result.rows[0], "Menu item created successfully", 201);
});

// Update menu item
export const updateMenuItem = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if(!validMenuInput(req.body)) return errorResponse(res,'Invalid menu details',400);
  const { name, category_id, description, price, veg_type, is_available, is_featured, preparation_time, calories, is_spicy, barcode } = req.body;
  let image_url;
  try {image_url=await saveMenuImage(pool,req.body.image_url);}catch{return errorResponse(res,'Use a valid JPEG, PNG or WebP image up to 2 MB, or a public HTTPS image URL.',400);}

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
         updated_at = CURRENT_TIMESTAMP,
         visible_kiosk = COALESCE($14,visible_kiosk), visible_website = COALESCE($15,visible_website),
         display_order = COALESCE($16,display_order)
     WHERE id = $13 AND deleted_at IS NULL AND ($17::bigint IS NULL OR sync_version=$17)
     RETURNING *`,
    [name, category_id, description, price, veg_type, image_url, is_available, is_featured, preparation_time, calories, is_spicy, barcode?.trim() || null, id,
      req.body.visible_kiosk,req.body.visible_website,req.body.display_order,req.body.sync_version]
  );
  if(!result.rowCount) return errorResponse(res,'This item changed. Refresh the menu before editing again.',409);

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

  await pool.query("UPDATE menu SET deleted_at=now(),is_available=false,updated_at=now() WHERE id = $1 AND deleted_at IS NULL", [id]);

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
     WHERE m.is_featured = true AND m.is_available = true AND m.deleted_at IS NULL AND c.deleted_at IS NULL AND c.is_active=true
     ORDER BY m.name`
  );

  return successResponse(res, result.rows, "Featured items retrieved successfully");
});

// Kept for backward compatibility
export const getCategories = asyncHandler(async (req, res) => {
  const result = await pool.query(
    "SELECT id, name, description, image_url, display_order, is_active FROM categories WHERE is_active = true AND deleted_at IS NULL ORDER BY display_order ASC"
  );

  return successResponse(res, result.rows, "Categories retrieved successfully");
});
