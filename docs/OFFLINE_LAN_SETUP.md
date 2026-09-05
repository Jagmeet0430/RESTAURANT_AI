# RestaurantAI Offline LAN Setup

This guide runs one Windows PC as the RestaurantAI server and lets other devices on the same private Wi-Fi or Ethernet network use the admin, POS, kitchen, and customer screens.

## 1. Choose the Server PC

Use the computer that has PostgreSQL and the RestaurantAI backend installed. Keep this machine powered on while the restaurant is using the system.

Recommended:

- Connect the server PC by Ethernet if possible.
- Set the Windows network profile to Private.
- Reserve the server PC's IP address in the router DHCP settings, or set a static IPv4 address on the PC.
- Do not expose the backend or database to the public internet.

## 2. Configure Backend LAN Mode

In `backend/.env`, use:

```env
RESTAURANTAI_MODE=local
PORT=5001
HOST=0.0.0.0
ALLOW_LAN_ORIGINS=true
LAN_CLIENT_PORTS=3000,5173,5174,5175,5500,5501,8080
```

Keep PostgreSQL local to the server PC:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=restaurantai
DB_USER=postgres
DB_PASSWORD=your_local_postgres_password
```

Do not set `DB_HOST` to the LAN IP. Do not open port `5432` in Windows Firewall.

## 3. Start the Backend

From the repository root, run:

```powershell
.\scripts\start-local-server.ps1
```

Or start manually:

```powershell
cd backend
$env:RESTAURANTAI_MODE = "local"
$env:HOST = "0.0.0.0"
$env:PORT = "5001"
$env:ALLOW_LAN_ORIGINS = "true"
npm start
```

The startup log prints:

- Mode
- Host
- Port
- Local URL
- Whether LAN access is enabled
- Detected private IPv4 LAN URLs

You can also run:

```powershell
cd backend
node scripts/checkLanServer.js
```

## 4. Open Windows Firewall for the API

Only open the backend API port on the Private profile:

```powershell
New-NetFirewallRule -DisplayName "RestaurantAI Local API" -Direction Inbound -Protocol TCP -LocalPort 5001 -Action Allow -Profile Private
```

Do not open PostgreSQL port `5432`.

## 5. Find the Server LAN IP

Run this on the server PC:

```powershell
ipconfig
```

Look for the active adapter's IPv4 address, usually like:

- `192.168.x.x`
- `10.x.x.x`
- `172.16.x.x` through `172.31.x.x`

Example backend health URL:

```text
http://192.168.1.25:5001/api/health
```

## 6. Configure Admin/POS/Kitchen Clients

The admin app uses `VITE_API_URL`.

On the machine serving the admin frontend:

```env
VITE_API_URL=http://SERVER-LAN-IP:5001/api
```

Replace `SERVER-LAN-IP` with the real server IP, for example:

```env
VITE_API_URL=http://192.168.1.25:5001/api
```

POS and kitchen screens share the admin API client, so they use the same setting.

If the admin frontend is opened from the same LAN hostname/IP as the server, the fallback also tries `http://that-host:5001/api`.

## 7. Configure the Customer Site

The customer site has a runtime config file:

```js
// frontend/config.js
window.RESTAURANTAI_API_BASE_URL = "http://SERVER-LAN-IP:5001/api";
```

If the customer site is served from the backend at `/customer`, use:

```text
http://SERVER-LAN-IP:5001/customer
```

In that setup, the site can infer the same server host automatically.

## 8. Quick Verification

From another device on the same LAN, open:

```text
http://SERVER-LAN-IP:5001/api/health
```

Expected response:

```json
{
  "success": true,
  "status": "ok",
  "mode": "local",
  "database": "connected",
  "timestamp": "..."
}
```

Then verify:

- Admin login
- Admin profile page
- Menu/category browsing
- Inventory list or summary
- Kitchen orders
- POS product lookup or checkout screen
- Reports pages

## 9. Security Notes

- Keep the Windows network profile set to Private.
- Allow inbound TCP `5001` only on the Private firewall profile.
- Do not open PostgreSQL `5432` to the LAN.
- Keep `JWT_SECRET`, database password, and online API keys out of screenshots and chat messages.
- Do not enable router port forwarding for RestaurantAI.
- For stable client bookmarks, reserve the server PC IP in the router or configure a static IP.

## 10. Offline Operation

In local mode, RestaurantAI should use the local PostgreSQL database and local HTTP API. Online-only services, payment gateways, AI providers, or messaging providers may be unavailable unless those integrations are separately configured and reachable.
