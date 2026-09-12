# RestaurantAI Automatic Two-Laptop Startup

This guide describes the simple restaurant deployment:

- Laptop 1 is the RestaurantAI server and customer ordering station.
- Laptop 2 is an Admin browser client.
- PostgreSQL stays on Laptop 1 only.
- Laptop 2 stores only the RestaurantAI server URL.

## Laptop 1: Server And Customer Kiosk

Install and configure RestaurantAI on Laptop 1. The backend should use:

```text
PORT=5001
HOST=0.0.0.0
RESTAURANTAI_MODE=local
DB_HOST=127.0.0.1
DB_PORT=5432
```

This allows browsers on the LAN to reach RestaurantAI while PostgreSQL remains local to Laptop 1.

### Enable Backend And Kiosk Autostart

Run this on Laptop 1:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\install-kiosk-autostart.ps1
```

At Windows logon, the task runs this sequence:

```text
start RestaurantAI backend
wait for http://127.0.0.1:5001/api/health
launch http://127.0.0.1:5001/customer?kiosk=1
```

The kiosk is not opened before the backend health check passes. Startup logs are written under the RestaurantAI state `logs` folder.

### Disable Backend And Kiosk Autostart

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\remove-kiosk-autostart.ps1
```

### Manual Kiosk Controls

Staff can still use:

```text
Start Customer Kiosk
Close Customer Kiosk
```

These shortcuts use the same kiosk launcher as autostart.

### External Display Setup

Connect the customer-facing screen to Laptop 1.

Press:

```text
Windows + P
```

Choose:

```text
Extend
```

The kiosk launcher prefers a non-primary monitor when Windows reports one. If there is only one display, it falls back to the primary monitor.

### Laptop 1 Troubleshooting

If the kiosk does not open:

- Open `http://127.0.0.1:5001/api/health`.
- Check that RestaurantAI is running.
- Check `logs\server-kiosk-startup.log`.
- Check `logs\backend.log` and `logs\backend-error.log`.
- Confirm the customer screen is connected and Windows display mode is set to Extend.

If the backend does not start:

- Confirm PostgreSQL is running on Laptop 1.
- Confirm port `5001` is not already used by another app.
- Do not open PostgreSQL port `5432` to the LAN.

## Laptop 2: Admin Client

Laptop 2 does not run RestaurantAI backend, migrations, or PostgreSQL.

It only opens the Admin app from Laptop 1:

```text
http://<LAPTOP-1-LAN-IP>:5001/admin
```

### Configure Server URL

Use Laptop 1's stable LAN address:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\configure-admin-client.ps1 -ServerUrl http://192.168.1.50:5001
```

The address above is an example. Prefer a router DHCP reservation for Laptop 1 so the address stays stable.

The config is stored at:

```text
C:\ProgramData\RestaurantAI-AdminClient\config.json
```

Example:

```json
{
  "serverUrl": "http://192.168.1.50:5001"
}
```

### Create Admin Shortcut

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\create-admin-client-shortcut.ps1
```

The desktop shortcut is:

```text
RestaurantAI Admin
```

Double-clicking it checks:

```text
http://<LAPTOP-1-LAN-IP>:5001/api/health
```

If healthy, it opens:

```text
http://<LAPTOP-1-LAN-IP>:5001/admin
```

### Optional Admin Autostart

Admin autostart is off by default. To enable it on Laptop 2:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\install-admin-autostart.ps1
```

To remove it:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\remove-admin-autostart.ps1
```

### Laptop 2 Troubleshooting

If Laptop 1 is off or unreachable, the Admin launcher shows:

```text
RestaurantAI server is unavailable.
Check that the main restaurant laptop is switched on and connected to the same network.
```

Check:

- Laptop 1 is switched on and awake.
- Both laptops are on the same Wi-Fi/LAN.
- Laptop 1 uses `HOST=0.0.0.0`.
- Laptop 1 Windows Firewall allows inbound TCP `5001` on Private networks.
- The Admin client config uses Laptop 1's current LAN IP.
- The URL is not `127.0.0.1` on Laptop 2.

If Laptop 1's IP changed, run `ipconfig` on Laptop 1 and update the Admin client config. The better long-term fix is a router DHCP reservation.

## Offline LAN

Internet is not required for:

- customer kiosk ordering
- Admin login
- Orders
- Kitchen
- Customers
- Bills
- Reports
- PostgreSQL

Keep the router/local Wi-Fi active. Cloud integrations may be unavailable without internet.

## Installer Strategy

Use the main RestaurantAI installer for Laptop 1.

For Laptop 2, use a small Admin Client package containing only:

- `start-admin-client.ps1`
- `configure-admin-client.ps1`
- `create-admin-client-shortcut.ps1`
- `install-admin-autostart.ps1`
- `remove-admin-autostart.ps1`
- documentation

The Admin Client package must not install PostgreSQL, backend services, database migrations, or backend secrets.
