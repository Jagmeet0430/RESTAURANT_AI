// Categories Controller
import { pool } from "../config/database.js";
import { successResponse, errorResponse, asyncHandler } from "../utils/index.js";
import { scheduleRagKnowledgeSync } from "../services/ragService.js";
import { saveMenuImage } from '../services/menuImageService.js';

const validCategory = body => (body.name==null||(typeof body.name==='string'&&body.name.trim()&&body.name.length<=100)) &&
  (body.description==null||(typeof body.description==='string'&&body.description.length<=10000)) &&
  (body.display_order==null||(Number.isInteger(Number(body.display_order))&&Math.abs(Number(body.display_order))<=100000)) &&
  (body.is_active==null||typeof body.is_active==='boolean') && (body.sync_version==null||/^\d+$/.test(String(body.sync_version)));

const getValidCreatedByUserId = async (userId) => {
  if (!userId) return null;

  const result = await pool.query("SELECT id FROM users WHERE id = $1", [userId]);
  return result.rows[0]?.id || null;
};

// Get all categories
export const getAllCategories = asyncHandler(async (req, res) => {
  const result = await pool.query(
    `SELECT c.id, c.sync_version,
            c.name,
            c.description,
            c.image_url,
            c.display_order,
            c.is_active,
            COUNT(m.id)::int AS item_count
     FROM categories c
     LEFT JOIN menu m ON m.category_id = c.id AND m.deleted_at IS NULL
     WHERE c.is_active = true AND c.deleted_at IS NULL
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
     WHERE c.id = $1 AND c.is_active = true AND c.deleted_at IS NULL
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
  if(!validCategory(req.body))return errorResponse(res,'Invalid category details',400);
  const { name, description, display_order } = req.body;
  if(typeof name!=='string'||!name.trim()||name.length>100) return errorResponse(res,'Invalid category name',400);
  let image_url;
  try {image_url=await saveMenuImage(pool,req.body.image_url);}catch{return errorResponse(res,'Invalid category image',400);}
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

  scheduleRagKnowledgeSync("category_created");
  return successResponse(res, result.rows[0], "Category created successfully", 201);
});

// Update category
export const updateCategory = asyncHandler(async (req, res) => {
  if(!validCategory(req.body))return errorResponse(res,'Invalid category details',400);
  const { id } = req.params;
  const { name, description, display_order, is_active } = req.body;
  if(name!=null&&(typeof name!=='string'||!name.trim()||name.length>100))return errorResponse(res,'Invalid category name',400);
  let image_url;
  try {image_url=await saveMenuImage(pool,req.body.image_url);}catch{return errorResponse(res,'Invalid category image',400);}

  // Check if category exists
  const existing = await pool.query("SELECT id FROM categories WHERE id = $1", [id]);
  if (existing.rows.length === 0) {
    return errorResponse(res, "Category not found", 404);
  }

  const result = await pool.query(
    "UPDATE categories SET name = COALESCE($1, name), description = COALESCE($2, description), image_url = COALESCE($3, image_url), display_order = COALESCE($4, display_order), is_active = COALESCE($5, is_active), updated_at = CURRENT_TIMESTAMP WHERE id = $6 AND deleted_at IS NULL AND ($7::bigint IS NULL OR sync_version=$7) RETURNING *",
    [name, description, image_url, display_order, is_active, id, req.body.sync_version]
  );
  if(!result.rowCount)return errorResponse(res,'Category changed. Refresh before editing again.',409);

  scheduleRagKnowledgeSync("category_updated");
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
  const menuItems = await pool.query("SELECT COUNT(*) FROM menu WHERE category_id = $1 AND deleted_at IS NULL", [id]);
  if (parseInt(menuItems.rows[0].count) > 0) {
    return errorResponse(res, "Cannot delete category with existing menu items", 409);
  }

  await pool.query("UPDATE categories SET deleted_at=now(),is_active=false,updated_at=now() WHERE id = $1 AND deleted_at IS NULL", [id]);

  scheduleRagKnowledgeSync("category_deleted");
  return successResponse(res, null, "Category deleted successfully");
});
