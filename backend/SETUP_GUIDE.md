# Backend Setup & Deployment Guide

## Prerequisites

### 1. PostgreSQL Installation

**Windows:**
- Download from: https://www.postgresql.org/download/windows/
- During installation, set:
  - Port: 5432
  - Password: (your password, remember it!)
  - Data directory: Default
- After installation, add PostgreSQL to PATH:
  - Add `C:\Program Files\PostgreSQL\15\bin` to System PATH

**Mac:**
```bash
brew install postgresql
brew services start postgresql
```

**Linux:**
```bash
sudo apt-get install postgresql postgresql-contrib
sudo systemctl start postgresql
```

---

## Database Setup

### Option 1: Using psql (Command Line)

```bash
# 1. Connect to PostgreSQL default database
psql -U postgres

# 2. Create database
CREATE DATABASE restaurantai;

# 3. Exit psql
\q

# 4. Run schema
psql -U postgres -d restaurantai -f backend/database/schema_postgresql.sql

# 5. Verify tables created
psql -U postgres -d restaurantai
\dt  -- List tables
```

### Option 2: Using PgAdmin (GUI)

1. Open PgAdmin (installed with PostgreSQL)
2. Right-click "Databases" → Create → Database
3. Name: `restaurantai`
4. Right-click database → Query tool
5. Copy schema_postgresql.sql content and execute

### Option 3: Using Docker (Recommended)

```bash
# Create PostgreSQL container
docker run --name restaurantai-db \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=restaurantai \
  -p 5432:5432 \
  -d postgres:15

# Wait for container to start
sleep 5

# Run schema
psql -U postgres -h localhost -d restaurantai -f backend/database/schema_postgresql.sql
```

---

## Environment Configuration

Create `.env` file in backend directory:

```env
# Server
PORT=5000
NODE_ENV=development

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=restaurantai
DB_USER=postgres
DB_PASSWORD=your_postgres_password

# JWT
JWT_SECRET=your_super_secret_jwt_key_change_this_in_production
JWT_EXPIRE=7d

# CORS
CORS_ORIGIN=http://localhost:5173

# File Upload
MAX_FILE_SIZE=5242880
ALLOWED_EXTENSIONS=jpg,jpeg,png,gif
```

---

## Backend Startup

```bash
# Navigate to backend
cd backend

# Install dependencies
npm install

# Start development server
npm run dev

# Or start production
npm start
```

**Expected output:**
```
╔════════════════════════════════════════╗
║   🍽️  RestaurantAI Backend Server    ║
║                                        ║
║  Server: http://localhost:5000       ║
║  Environment: development             ║
║  Status: ✅ Running                    ║
╚════════════════════════════════════════╝

📡 Testing Database Connection...
✅ PostgreSQL Connection successful at: 2026-06-26 10:30:45
✅ All systems operational!
```

---

## Verify Backend

Test health endpoint:

```bash
curl http://localhost:5000/api/health
```

Expected response:
```json
{
  "status": "OK",
  "timestamp": "2026-06-26T10:30:45.123Z",
  "message": "RestaurantAI Backend is running",
  "database": "PostgreSQL Connected"
}
```

---

## Frontend Startup

```bash
# Navigate to admin frontend
cd admin

# Install dependencies
npm install

# Start development server
npm run dev

# Or build for production
npm run build
```

**Expected output:**
```
VITE v5.0.0  ready in 250 ms

➜  local:   http://localhost:5173/
➜  press h to show help
```

---

## Quick Test: Create Admin User

After backend is running:

```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Admin",
    "email": "admin@restaurantai.com",
    "password": "admin123",
    "role": "admin"
  }'
```

Response:
```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "user": {
      "id": 1,
      "name": "Admin",
      "email": "admin@restaurantai.com",
      "role": "admin"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

---

## Troubleshooting

### Database Connection Failed

**Problem:** `ECONNREFUSED localhost:5432`

**Solutions:**
1. Check PostgreSQL is running:
   - Windows: Services → PostgreSQL
   - Mac: `brew services list`
   - Linux: `sudo systemctl status postgresql`

2. Verify credentials in `.env`

3. Check port not blocked:
   - Windows: `netstat -ano | findstr :5432`
   - Mac/Linux: `lsof -i :5432`

### Port Already in Use

```bash
# Find process on port 5000
# Windows
netstat -ano | findstr :5000

# Mac/Linux
lsof -i :5000

# Kill process
# Windows
taskkill /PID <PID> /F

# Mac/Linux
kill -9 <PID>
```

### JWT Token Errors

1. Token not sent: Include `Authorization: Bearer <token>` header
2. Token expired: Use refresh endpoint to get new token
3. Invalid secret: Check JWT_SECRET matches in .env

### CORS Errors

Ensure `CORS_ORIGIN` in `.env` matches your frontend URL:
- Local dev: `http://localhost:5173`
- Different port: Update value

---

## API Testing Tools

### Using Postman

1. Download from: https://www.postman.com/downloads/
2. Import API collection: See `API_REFERENCE.md`
3. Set environment variable for token after login
4. Test all endpoints

### Using cURL

See examples in `API_REFERENCE.md`

### Using REST Client (VS Code)

Install extension: "REST Client"

Create file `.http` or `.rest`:

```http
### Register
POST http://localhost:5000/api/auth/register
Content-Type: application/json

{
  "name": "Admin",
  "email": "admin@restaurantai.com",
  "password": "admin123"
}

### Login
POST http://localhost:5000/api/auth/login
Content-Type: application/json

{
  "email": "admin@restaurantai.com",
  "password": "admin123"
}

### Get Menu
GET http://localhost:5000/api/menu
```

---

## Production Deployment Checklist

- [ ] Database backed up
- [ ] Environment variables configured
- [ ] JWT secret changed
- [ ] CORS_ORIGIN updated
- [ ] NODE_ENV=production
- [ ] Error logging configured
- [ ] SSL/HTTPS enabled
- [ ] Rate limiting added
- [ ] Input validation enabled
- [ ] Tests passing
