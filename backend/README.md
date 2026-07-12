# RestaurantAI Backend

Express.js REST API for RestaurantAI - A complete restaurant management system.

## Features

- 🔐 **Authentication** - JWT-based admin login
- 📋 **Menu Management** - CRUD operations for food items and categories
- 📦 **Order Management** - Full order lifecycle tracking
- 👨‍🍳 **Kitchen Dashboard** - Real-time order updates
- 👥 **Customer Management** - Customer profiles and order history
- 🎟️ **Coupons** - Discount management
- 📊 **Reports & Analytics** - Sales and performance reports
- 📸 **File Upload** - Image management for menu items

## Project Structure

```
backend/
├── src/
│   ├── config/          # Database & environment config
│   ├── controllers/     # Request handlers
│   ├── middleware/      # Custom middleware (auth, validation, etc)
│   ├── models/          # Database models
│   ├── routes/          # API endpoints
│   ├── services/        # Business logic
│   ├── utils/           # Helper functions
│   ├── app.js          # Express app setup
│   └── server.js       # Server entry point
├── package.json
├── .env.example        # Environment variables template
└── README.md
```

## Installation

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Setup environment variables**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` with your configuration.

3. **Database setup**
   - Create PostgreSQL database
   - Run migrations (when ready)

## Running the Server

**Development mode** (with hot reload)
```bash
npm run dev
```

**Production mode**
```bash
npm start
```

Server will run on `http://localhost:5000` by default.

## API Endpoints (To be implemented)

### Authentication
- `POST /api/auth/login` - Admin login
- `POST /api/auth/logout` - Admin logout
- `POST /api/auth/refresh` - Refresh token

### Menu
- `GET /api/menu` - Get all menu items
- `GET /api/menu/:id` - Get menu item details
- `POST /api/menu` - Add new menu item
- `PUT /api/menu/:id` - Update menu item
- `DELETE /api/menu/:id` - Delete menu item
- `GET /api/menu/category` - Get all categories

### Orders
- `GET /api/orders` - Get all orders
- `GET /api/orders/:id` - Get order details
- `POST /api/orders` - Create new order
- `PUT /api/orders/:id/status` - Update order status
- `DELETE /api/orders/:id` - Cancel order

### Kitchen
- `GET /api/kitchen/orders` - Get kitchen orders
- `PUT /api/kitchen/orders/:id/status` - Update order status in kitchen

### Customers
- `GET /api/customers` - Get all customers
- `GET /api/customers/:id` - Get customer details
- `POST /api/customers` - Create customer
- `PUT /api/customers/:id` - Update customer

### Coupons
- `GET /api/coupons` - Get all coupons
- `POST /api/coupons` - Create coupon
- `PUT /api/coupons/:id` - Update coupon
- `DELETE /api/coupons/:id` - Delete coupon

### Reports
- `GET /api/reports/sales` - Sales report
- `GET /api/reports/analytics` - Analytics data

## Environment Variables

```
PORT=5000
NODE_ENV=development
DB_HOST=localhost
DB_PORT=5432
DB_NAME=restaurantai
DB_USER=postgres
DB_PASSWORD=password
JWT_SECRET=your_jwt_secret_key_here
JWT_EXPIRE=7d
CORS_ORIGIN=http://localhost:5173,http://localhost:3000
```

## Technologies Used

- **Express.js** - Web framework
- **PostgreSQL** - Database
- **JWT** - Authentication
- **bcryptjs** - Password hashing
- **Joi** - Data validation
- **Multer** - File upload
- **CORS** - Cross-origin requests
- **Dotenv** - Environment variables

## Development

### Next Steps
1. Setup PostgreSQL database
2. Create database models
3. Implement authentication routes
4. Implement menu routes
5. Implement order routes
6. Implement kitchen routes
7. Add comprehensive error handling
8. Add request validation
9. Add logging
10. Write tests

## License

MIT

## Support

For issues and questions, please contact the development team.
