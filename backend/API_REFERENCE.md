// Quick reference for testing API endpoints
// Base URL: http://localhost:5000/api

// ============================================
// AUTHENTICATION ENDPOINTS
// ============================================

// Register new admin user
POST /api/auth/register
{
  "name": "Admin User",
  "email": "admin@restaurantai.com",
  "password": "secure_password",
  "role": "admin"
}

// Admin login
POST /api/auth/login
{
  "email": "admin@restaurantai.com",
  "password": "secure_password"
}
// Response: { token, user: { id, name, email, role } }

// Logout (client-side token deletion)
POST /api/auth/logout

// Verify token
GET /api/auth/verify
Headers: Authorization: Bearer <token>

// Refresh token
POST /api/auth/refresh
Headers: Authorization: Bearer <token>


// ============================================
// CATEGORIES ENDPOINTS
// ============================================

// Get all categories (public)
GET /api/categories

// Get category by ID (public)
GET /api/categories/:id

// Create category (protected)
POST /api/categories
Headers: Authorization: Bearer <token>
{
  "name": "Pizza",
  "description": "Fresh Italian pizzas",
  "image_url": "https://...",
  "display_order": 1
}

// Update category (protected)
PUT /api/categories/:id
Headers: Authorization: Bearer <token>
{
  "name": "Pizza",
  "description": "Updated description",
  "is_active": true
}

// Delete category (protected)
DELETE /api/categories/:id
Headers: Authorization: Bearer <token>


// ============================================
// MENU ENDPOINTS
// ============================================

// Get all menu items (public)
GET /api/menu
Query params: category=1&search=paneer&available=true

// Get menu item by ID (public)
GET /api/menu/:id

// Get featured items (public)
GET /api/menu/featured

// Create menu item (protected)
POST /api/menu
Headers: Authorization: Bearer <token>
{
  "name": "Paneer Tikka Pizza",
  "category_id": 1,
  "description": "Thin crust with paneer tikka",
  "price": 299.00,
  "veg_type": "Veg",
  "image_url": "https://...",
  "is_available": true,
  "is_featured": true,
  "preparation_time": 20,
  "calories": 450,
  "is_spicy": false
}

// Update menu item (protected)
PUT /api/menu/:id
Headers: Authorization: Bearer <token>
{
  "name": "Updated name",
  "price": 329.00,
  "is_available": true
}

// Delete menu item (protected)
DELETE /api/menu/:id
Headers: Authorization: Bearer <token>


// ============================================
// ORDERS ENDPOINTS
// ============================================

// Get all orders (protected)
GET /api/orders
Headers: Authorization: Bearer <token>
Query params: status=Pending&payment_status=Paid&customer_id=1&limit=50&offset=0

// Get order by ID with items (protected)
GET /api/orders/:id
Headers: Authorization: Bearer <token>

// Get orders by status (protected)
GET /api/orders/status/:status
Headers: Authorization: Bearer <token>
Status values: Pending, Accepted, Preparing, Ready, Completed, Cancelled

// Create new order (public)
POST /api/orders
{
  "customer_id": 1,
  "items": [
    {
      "menu_id": 1,
      "quantity": 2,
      "special_instructions": "Extra cheese"
    },
    {
      "menu_id": 5,
      "quantity": 1,
      "special_instructions": "No onions"
    }
  ],
  "special_instructions": "Ring bell at gate",
  "delivery_address": "123 Main St, Apt 4B",
  "payment_method": "Card"
}

// Update order status (protected)
PUT /api/orders/:id
Headers: Authorization: Bearer <token>
{
  "status": "Preparing",
  "payment_status": "Paid"
}


// ============================================
// CUSTOMERS ENDPOINTS
// ============================================

// Get all customers (protected)
GET /api/customers
Headers: Authorization: Bearer <token>
Query params: limit=50&offset=0

// Get customer by ID (protected)
GET /api/customers/:id
Headers: Authorization: Bearer <token>

// Get customer by phone (public)
GET /api/customers/phone/+91-9876543210

// Get customer by email (public)
GET /api/customers/email/customer@email.com

// Create new customer (public)
POST /api/customers
{
  "name": "Rahul Kumar",
  "email": "rahul@email.com",
  "phone": "+91-9876543210",
  "address": "123 MG Road",
  "city": "Bangalore",
  "state": "Karnataka",
  "postal_code": "560034",
  "country": "India"
}

// Update customer (protected)
PUT /api/customers/:id
Headers: Authorization: Bearer <token>
{
  "name": "Updated Name",
  "address": "New Address",
  "city": "Bangalore"
}

// Add loyalty points (protected)
POST /api/customers/:id/loyalty
Headers: Authorization: Bearer <token>
{
  "points": 100
}

// Search customers (public)
GET /api/customers/search?query=rahul


// ============================================
// KITCHEN ENDPOINTS
// ============================================

// Get all active orders (protected)
GET /api/kitchen/orders
Headers: Authorization: Bearer <token>

// Get orders by status (protected)
GET /api/kitchen/orders/status/:status
Headers: Authorization: Bearer <token>
Status values: Pending, Accepted, Preparing, Ready, Completed, Cancelled

// Update order status (protected)
PUT /api/kitchen/orders/:id/status
Headers: Authorization: Bearer <token>
{
  "status": "Ready"
}


// ============================================
// HEALTH CHECK
// ============================================

GET /api/health
Response: { status, timestamp, message, database }


// ============================================
// EXAMPLE USAGE WITH CURL
// ============================================

// 1. Register
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Admin","email":"admin@restaurantai.com","password":"password123","role":"admin"}'

// 2. Login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@restaurantai.com","password":"password123"}'

// 3. Get all menu items
curl http://localhost:5000/api/menu

// 4. Create menu item (requires token)
curl -X POST http://localhost:5000/api/menu \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your_token_here>" \
  -d '{
    "name":"Butter Chicken Pizza",
    "category_id":1,
    "description":"Delicious butter chicken",
    "price":349,
    "veg_type":"Non-Veg",
    "is_available":true
  }'

// 5. Create customer
curl -X POST http://localhost:5000/api/customers \
  -H "Content-Type: application/json" \
  -d '{
    "name":"John Doe",
    "email":"john@email.com",
    "phone":"+91-9876543210",
    "city":"Bangalore"
  }'

// 6. Create order
curl -X POST http://localhost:5000/api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "customer_id":1,
    "items":[{"menu_id":1,"quantity":2}],
    "delivery_address":"123 Main St",
    "payment_method":"Card"
  }'

// 7. Update order status (requires token)
curl -X PUT http://localhost:5000/api/orders/1 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your_token_here>" \
  -d '{"status":"Preparing"}'
