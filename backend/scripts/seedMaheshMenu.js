import { pool } from "../src/config/database.js";

const DEFAULT_DESCRIPTION = "From MAHESH menu board.";
const DEFAULT_PREPARATION_TIME = 20;

const categories = [
  {
    name: "South Indian",
    description: "Traditional South Indian dishes",
    display_order: 20,
  },
  {
    name: "Indian Snacks",
    description: "Classic Indian snacks and plates",
    display_order: 21,
  },
  {
    name: "Hot Beverages",
    description: "Tea, coffee, and warm beverages",
    display_order: 22,
  },
  {
    name: "Chilled Beverages",
    description: "Fresh juices, lassi, and cold drinks",
    display_order: 23,
  },
  {
    name: "Milk Shakes",
    description: "Milk shakes with plain and ice cream variants",
    display_order: 24,
  },
  {
    name: "Mocktails",
    description: "Refreshing non-alcoholic mocktails",
    display_order: 25,
  },
  {
    name: "Delectable Desserts",
    description: "Sweets, softies, falooda, and desserts",
    display_order: 26,
  },
];

const menuItems = [
  { category: "South Indian", name: "Plain Dosa", price: 80 },
  { category: "South Indian", name: "Masala Dosa", price: 100 },
  { category: "South Indian", name: "Paneer Dosa", price: 120 },
  { category: "South Indian", name: "Onion Dosa", price: 120 },
  { category: "South Indian", name: "Uttapam", price: 150 },
  { category: "South Indian", name: "Sambhar Vada", price: 70 },

  { category: "Hot Beverages", name: "Tea", price: 10 },
  { category: "Hot Beverages", name: "Tea Milk", price: 20 },
  { category: "Hot Beverages", name: "Hot Coffee", price: 50 },
  { category: "Hot Beverages", name: "Green Tea", price: 40 },

  { category: "Chilled Beverages", name: "Carrot (Gajar) Juice", price: 50 },
  { category: "Chilled Beverages", name: "Pineapple Juice", price: 50 },
  { category: "Chilled Beverages", name: "Orange Juice", price: 50 },
  { category: "Chilled Beverages", name: "Mixed Fruit Juice", price: 50 },
  { category: "Chilled Beverages", name: "Mosambi Juice", price: 50 },
  { category: "Chilled Beverages", name: "Sweet Lime", price: 80 },
  { category: "Chilled Beverages", name: "Masala Lassi", price: 40 },
  { category: "Chilled Beverages", name: "Cold Drink", price: 30 },

  { category: "Milk Shakes", name: "Milk Badam (Plain)", price: 60, description: "Plain milk shake." },
  { category: "Milk Shakes", name: "Milk Badam (With Ice Cream)", price: 90, description: "Milk shake with ice cream." },
  { category: "Milk Shakes", name: "Strawberry Milk Shake (Plain)", price: 70, description: "Plain milk shake." },
  { category: "Milk Shakes", name: "Strawberry Milk Shake (With Ice Cream)", price: 90, description: "Milk shake with ice cream." },
  { category: "Milk Shakes", name: "Bubblegum Milk Shake (Plain)", price: 70, description: "Plain milk shake." },
  { category: "Milk Shakes", name: "Bubblegum Milk Shake (With Ice Cream)", price: 90, description: "Milk shake with ice cream." },
  { category: "Milk Shakes", name: "Butterscotch Milk Shake (Plain)", price: 70, description: "Plain milk shake." },
  { category: "Milk Shakes", name: "Butterscotch Milk Shake (With Ice Cream)", price: 90, description: "Milk shake with ice cream." },
  { category: "Milk Shakes", name: "Chocolate Milk Shake (Plain)", price: 70, description: "Plain milk shake." },
  { category: "Milk Shakes", name: "Chocolate Milk Shake (With Ice Cream)", price: 90, description: "Milk shake with ice cream." },
  { category: "Milk Shakes", name: "Banana Milk Shake (Plain)", price: 70, description: "Plain milk shake." },
  { category: "Milk Shakes", name: "Banana Milk Shake (With Ice Cream)", price: 90, description: "Milk shake with ice cream." },
  { category: "Milk Shakes", name: "Mango Milk Shake (Plain)", price: 70, description: "Plain milk shake." },
  { category: "Milk Shakes", name: "Mango Milk Shake (With Ice Cream)", price: 90, description: "Milk shake with ice cream." },
  { category: "Milk Shakes", name: "Cold Coffee Frappe (Plain)", price: 70, description: "Plain frappe." },
  { category: "Milk Shakes", name: "Cold Coffee Frappe (With Ice Cream)", price: 90, description: "Frappe with ice cream." },
  { category: "Milk Shakes", name: "Frappe Choco (Plain)", price: 70, description: "Plain frappe." },
  { category: "Milk Shakes", name: "Frappe Choco (With Ice Cream)", price: 90, description: "Frappe with ice cream." },
  { category: "Milk Shakes", name: "Frappe Caramel (Plain)", price: 70, description: "Plain frappe." },
  { category: "Milk Shakes", name: "Frappe Caramel (With Ice Cream)", price: 90, description: "Frappe with ice cream." },

  { category: "Mocktails", name: "Mint Mojito", price: 70 },
  { category: "Mocktails", name: "Blue Curacao", price: 70 },
  { category: "Mocktails", name: "Blue Ice Tea", price: 70 },
  { category: "Mocktails", name: "Spicy Mango Punch", price: 70 },
  { category: "Mocktails", name: "Guava Punch", price: 70 },
  { category: "Mocktails", name: "Split Guava Punch", price: 70 },

  { category: "Indian Snacks", name: "Dhokla Plain Plate", price: 20 },
  { category: "Indian Snacks", name: "Dry Fruit Dhokla Plate", price: 30 },
  { category: "Indian Snacks", name: "Sandwich Dhokla", price: 30 },
  { category: "Indian Snacks", name: "Khandvi Plate", price: 50 },
  { category: "Indian Snacks", name: "Chhole Kulcha Plate", price: 50 },
  { category: "Indian Snacks", name: "Stuffed Paneer Kulcha Plate (250 gm)", price: 120 },
  { category: "Indian Snacks", name: "Stuffed Bread Pakoda (Per Piece)", price: 20 },
  { category: "Indian Snacks", name: "Chhole Bhature Plate (Half)", price: 40, description: "Half serving." },
  { category: "Indian Snacks", name: "Chhole Bhature Plate (Full)", price: 60, description: "Full serving." },
  { category: "Indian Snacks", name: "Samosa with Chutney (Half)", price: 15, description: "Half serving." },
  { category: "Indian Snacks", name: "Samosa with Chutney (Full)", price: 30, description: "Full serving." },
  { category: "Indian Snacks", name: "Samosa with Channa (Half)", price: 30, description: "Half serving." },
  { category: "Indian Snacks", name: "Samosa with Channa (Full)", price: 50, description: "Full serving." },
  { category: "Indian Snacks", name: "Tikki with Chutney (Half)", price: 30, description: "Half serving." },
  { category: "Indian Snacks", name: "Tikki with Chutney (Full)", price: 50, description: "Full serving." },
  { category: "Indian Snacks", name: "Tikki with Channa (Half)", price: 60, description: "Half serving." },
  { category: "Indian Snacks", name: "Tikki with Channa (Full)", price: 90, description: "Full serving." },
  { category: "Indian Snacks", name: "Bedmi Puri", price: 60 },
  { category: "Indian Snacks", name: "Extra Puri", price: 20 },
  { category: "Indian Snacks", name: "Pav Bhaji", price: 60 },
  { category: "Indian Snacks", name: "Extra Pav", price: 15 },
  { category: "Indian Snacks", name: "Channa Plate (Extra)", price: 30 },
  { category: "Indian Snacks", name: "Pav Plate (Extra)", price: 30 },
  { category: "Indian Snacks", name: "Sambhar Plate (Extra)", price: 30 },

  { category: "Delectable Desserts", name: "Moong-dal Halwa (Per Plate)", price: 60 },
  { category: "Delectable Desserts", name: "Chenna Sandwich Roll", price: 30 },
  { category: "Delectable Desserts", name: "Chenna Malai Roll", price: 35 },
  { category: "Delectable Desserts", name: "Jalebi", price: 350, description: "Per kg" },
  { category: "Delectable Desserts", name: "Imarti", price: 40 },
  { category: "Delectable Desserts", name: "Hot Gulab Jamun Plate", price: 40 },
  { category: "Delectable Desserts", name: "Sponge Rasgulla (2 Piece)", price: 45 },
  { category: "Delectable Desserts", name: "Rasmalai Plate", price: 50 },
  { category: "Delectable Desserts", name: "Rasmalai Glass (Angoori)", price: 40 },
  { category: "Delectable Desserts", name: "Vanilla Softy Ice Cream Cone", price: 40 },
  { category: "Delectable Desserts", name: "Butter Scotch Ice Cream Cone", price: 50 },
  { category: "Delectable Desserts", name: "Vanilla Softy Cup", price: 40 },
  { category: "Delectable Desserts", name: "Strawberry Softy Cup", price: 50 },
  { category: "Delectable Desserts", name: "Mix Flavour Softy Cup", price: 50 },
  { category: "Delectable Desserts", name: "Falooda Kulfi", price: 70 },
  { category: "Delectable Desserts", name: "Fruit Falooda", price: 70 },
];

const seedMaheshMenu = async () => {
  const client = await pool.connect();
  const categoryIds = new Map();
  let inserted = 0;
  let updated = 0;

  try {
    await client.query("BEGIN");

    for (const category of categories) {
      const result = await client.query(
        `INSERT INTO categories (name, description, display_order, is_active, created_by)
         VALUES ($1, $2, $3, true, NULL)
         ON CONFLICT (name) DO UPDATE
         SET description = EXCLUDED.description,
             display_order = EXCLUDED.display_order,
             is_active = true,
             updated_at = CURRENT_TIMESTAMP
         RETURNING id`,
        [category.name, category.description, category.display_order]
      );

      categoryIds.set(category.name, result.rows[0].id);
    }

    for (const item of menuItems) {
      const categoryId = categoryIds.get(item.category);
      const description = item.description || DEFAULT_DESCRIPTION;

      const updateResult = await client.query(
        `UPDATE menu
         SET description = $3,
             price = $4,
             veg_type = 'Veg',
             image_url = NULL,
             is_available = true,
             is_featured = false,
             preparation_time = $5,
             calories = NULL,
             is_spicy = false,
             updated_at = CURRENT_TIMESTAMP
         WHERE category_id = $1 AND LOWER(name) = LOWER($2)
         RETURNING id`,
        [categoryId, item.name, description, item.price, DEFAULT_PREPARATION_TIME]
      );

      if (updateResult.rowCount > 0) {
        updated += 1;
        continue;
      }

      await client.query(
        `INSERT INTO menu (
           category_id,
           name,
           description,
           price,
           veg_type,
           image_url,
           is_available,
           is_featured,
           preparation_time,
           calories,
           is_spicy,
           created_by
         )
         VALUES ($1, $2, $3, $4, 'Veg', NULL, true, false, $5, NULL, false, NULL)`,
        [categoryId, item.name, description, item.price, DEFAULT_PREPARATION_TIME]
      );

      inserted += 1;
    }

    await client.query("COMMIT");

    console.log(`Seeded MAHESH menu: ${inserted} inserted, ${updated} updated.`);
    console.log(`Categories ensured: ${categories.length}. Menu rows processed: ${menuItems.length}.`);
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Failed to seed MAHESH menu:", error.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
};

seedMaheshMenu();
