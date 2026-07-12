# PostgreSQL Database Setup Guide

## Quick Start

### 1. Create Database
```bash
createdb restaurantai
```

### 2. Run Schema
```bash
psql -U postgres -d restaurantai -f backend/database/schema_postgresql.sql
```

### 3. Verify Installation
```bash
psql -U postgres -d restaurantai
\dt -- Lists all tables
\d orders -- Describes orders table
```

---

## Database Schema Overview

### Tables

| Table | Purpose | Records | Relationships |
|-------|---------|---------|--------------|
| **users** | Admin staff | Multiple | Primary: Many orders, categories, menus |
| **categories** | Food categories | 7 default | Parent: Menu items |
| **menu** | Food items | 14 default | Child: Categories, Parent: Order items |
| **customers** | Customers | Many | Parent: Orders, reviews |
| **orders** | Orders | Many | Child: Customers, Parent: Order items, reviews |
| **order_items** | Order details | Many | Child: Orders & Menu |
| **coupons** | Discount codes | Many | Referenced: Orders |
| **reviews** | Customer reviews | Many | Child: Customers, Orders, Menu |

### Relationships

```
┌─────────────┐
│   USERS     │
└─────────────┘
      │
      ├──> Creates Categories
      ├──> Creates Menu Items
      ├──> Creates Coupons
      └──> Assigned to Orders

┌──────────────┐
│ CATEGORIES   │
└──────────────┘
      │
      └──> Has Many MENU Items

┌──────────────┐
│    MENU      │
└──────────────┘
      │
      └──> Has Many ORDER_ITEMS

┌──────────────┐
│  CUSTOMERS   │
└──────────────┘
      │
      ├──> Has Many ORDERS
      └──> Has Many REVIEWS

┌──────────────┐
│   ORDERS     │
└──────────────┘
      │
      ├──> Has Many ORDER_ITEMS
      ├──> Has Many REVIEWS
      └──> Uses COUPONS
```

---

## Data Types

- **SERIAL** - Auto-incrementing integer (PRIMARY KEY)
- **VARCHAR(n)** - Text with max length
- **TEXT** - Large text fields
- **DECIMAL(10, 2)** - Money values (10 digits, 2 decimals)
- **BOOLEAN** - True/False
- **TIMESTAMP** - Date and time
- **INT** - Integer numbers

---

## Indexes

Indexes created for performance:
- `users.email`
- `categories.name`
- `menu.category_id`, `menu.veg_type`, `menu.is_available`
- `customers.email`, `customers.phone`
- `orders.customer_id`, `orders.status`, `orders.payment_status`, `orders.created_at`
- `order_items.order_id`, `order_items.menu_id`
- `coupons.code`, `coupons.is_active`, `coupons.expiry_date`
- `reviews.order_id`, `reviews.customer_id`, `reviews.menu_id`

---

## Sample Data Included

**Users:**
- admin@restaurantai.com (Admin role)
- kitchen@restaurantai.com (Kitchen staff role)

**Categories:** 7 categories (Pizza, Burger, Chinese, South Indian, North Indian, Drinks, Desserts)

**Menu Items:** 14 items across all categories with pricing

**Customers:** 5 sample customers with full addresses

**Coupons:** 3 active coupons with different discount types

---

## Connection String

For Node.js (using pg package):
```javascript
const pool = new Pool({
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME
});
```

---

## Backup & Restore

**Backup:**
```bash
pg_dump -U postgres restaurantai > backup.sql
```

**Restore:**
```bash
psql -U postgres -d restaurantai -f backup.sql
```

---

## Common Queries

**Get all menu items:**
```sql
SELECT m.id, m.name, m.price, c.name as category 
FROM menu m 
JOIN categories c ON m.category_id = c.id;
```

**Get customer orders:**
```sql
SELECT o.order_number, o.total_amount, o.status 
FROM orders o 
WHERE o.customer_id = 1;
```

**Get order details:**
```sql
SELECT oi.quantity, m.name, m.price, oi.total_price 
FROM order_items oi 
JOIN menu m ON oi.menu_id = m.id 
WHERE oi.order_id = 1;
```

---

## Troubleshooting

**Connection refused?**
- Check if PostgreSQL is running: `pg_isready`
- Verify credentials in .env file

**Permission denied?**
- Run psql as postgres: `sudo -u postgres psql`

**Table already exists?**
- Schema includes `IF NOT EXISTS` clauses, safe to run multiple times
- Or drop tables first: `DROP TABLE ... CASCADE;`

---

## Next Steps

1. ✅ Database created
2. ✅ Tables created with relationships
3. ✅ Indexes created for performance
4. ✅ Sample data inserted
5. ⏳ Connect backend to database
6. ⏳ Create database queries/services
7. ⏳ Implement API endpoints
