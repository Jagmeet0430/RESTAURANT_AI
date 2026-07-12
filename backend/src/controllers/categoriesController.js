// Categories Controller
import { pool } from "../config/database.js";
import { successResponse, errorResponse, asyncHandler } from "../utils/index.js";

const getValidCreatedByUserId = async (userId) => {
  if (!userId) return null;

  const result = await pool.query("SELECT id FROM users WHERE id = $1", [userId]);
  return result.rows[0]?.id || null;
};

// Get all categories
export const getAllCategories = asyncHandler(async (req, res) => {
  const result = await pool.query(
    `SELECT c.id,
            c.name,
            c.description,
            c.image_url,
            c.display_order,
            c.is_active,
            COUNT(m.id)::int AS item_count
     FROM categories c
     LEFT JOIN menu m ON m.category_id = c.id
     WHERE c.is_active = true
     GROUP BY c.id
     ORDER BY c.display_order ASC, c.name ASC`
  );

  return successResponse(res, result.rows, "Categories retrieved successfully");
});

// Get category by ID
export const getCategoryById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const result = await pool.query(
    `SELECT c.id,
            c.name,
            c.description,
            c.image_url,
            c.display_order,
            c.is_active,
            COUNT(m.id)::int AS item_count
     FROM categories c
     LEFT JOIN menu m ON m.category_id = c.id
     WHERE c.id = $1 AND c.is_active = true
     GROUP BY c.id`,
    [id]
  );

  if (result.rows.length === 0) {
    return errorResponse(res, "Category not found", 404);
  }

  return successResponse(res, result.rows[0], "Category retrieved successfully");
});

// Create new category
export const createCategory = asyncHandler(async (req, res) => {
  const { name, description, image_url, display_order } = req.body;
  const userId = await getValidCreatedByUserId(req.user?.id);

  // Validate required fields
  if (!name) {
    return errorResponse(res, "Category name is required", 400);
  }

  // Check if category already exists
  const existing = await pool.query("SELECT id FROM categories WHERE name = $1", [name]);
  if (existing.rows.length > 0) {
    return errorResponse(res, "Category with this name already exists", 409);
  }

  const result = await pool.query(
    "INSERT INTO categories (name, description, image_url, display_order, created_by, is_active) VALUES ($1, $2, $3, $4, $5, true) RETURNING *",
    [name, description, image_url, display_order || 0, userId]
  );

  return successResponse(res, result.rows[0], "Category created successfully", 201);
});

// Update category
export const updateCategory = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, description, image_url, display_order, is_active } = req.body;

  // Check if category exists
  const existing = await pool.query("SELECT id FROM categories WHERE id = $1", [id]);
  if (existing.rows.length === 0) {
    return errorResponse(res, "Category not found", 404);
  }

  const result = await pool.query(
    "UPDATE categories SET name = COALESCE($1, name), description = COALESCE($2, description), image_url = COALESCE($3, image_url), display_order = COALESCE($4, display_order), is_active = COALESCE($5, is_active), updated_at = CURRENT_TIMESTAMP WHERE id = $6 RETURNING *",
    [name, description, image_url, display_order, is_active, id]
  );

  return successResponse(res, result.rows[0], "Category updated successfully");
});

// Delete category
export const deleteCategory = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Check if category exists
  const existing = await pool.query("SELECT id FROM categories WHERE id = $1", [id]);
  if (existing.rows.length === 0) {
    return errorResponse(res, "Category not found", 404);
  }

  // Check if any menu items belong to this category
  const menuItems = await pool.query("SELECT COUNT(*) FROM menu WHERE category_id = $1", [id]);
  if (parseInt(menuItems.rows[0].count) > 0) {
    return errorResponse(res, "Cannot delete category with existing menu items", 409);
  }

  await pool.query("DELETE FROM categories WHERE id = $1", [id]);

  return successResponse(res, null, "Category deleted successfully");
});
