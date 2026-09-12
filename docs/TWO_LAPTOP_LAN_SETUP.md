# RestaurantAI Two-Laptop LAN Setup

This guide is for a local restaurant setup where one Windows laptop runs the RestaurantAI server and database, and a second laptop uses the Admin, Orders, Kitchen, Customers, Bills, and Reports screens over the same Wi-Fi/LAN.

## Architecture

- Laptop 1 runs RestaurantAI backend on `0.0.0.0:5001`.
- Laptop 1 runs PostgreSQL locally on `127.0.0.1:5432`.
- Laptop 2 opens the Admin app through the backend on Laptop 1.
- Laptop 2 must not run its own RestaurantAI PostgreSQL database.
- Do not expose PostgreSQL port `5432` to the LAN.

Example URLs:

```text
Laptop 1 kiosk:
http://127.0.0.1:5001/customer?kiosk=1

Laptop 2 Admin:
http://<LAPTOP-1-LAN-IP>:5001/admin

Laptop 2 Orders:
http://<LAPTOP-1-LAN-IP>:5001/admin/orders

Laptop 2 Kitchen:
http://<LAPTOP-1-LAN-IP>:5001/admin/kitchen
```

## Laptop 1 Setup

Run RestaurantAI in LAN mode from the installed app or repository setup.

The backend environment should use:

```text
PORT=5001
HOST=0.0.0.0
RESTAURANTAI_MODE=local
DB_HOST=127.0.0.1
DB_PORT=5432
```

`HOST=0.0.0.0` lets other LAN devices reach the RestaurantAI backend. `DB_HOST=127.0.0.1` keeps PostgreSQL local to Laptop 1.

Start the server:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\start-restaurantai.ps1
```

The script prints local and LAN URLs when LAN mode is enabled.

## Laptop 2 Setup

Laptop 2 only needs a browser and access to the same Wi-Fi/LAN. Open:

```text
http://<LAPTOP-1-LAN-IP>:5001/admin
```

Do not install or configure PostgreSQL on Laptop 2 for normal restaurant operation.

## Stable Address

Use a stable address for Laptop 1 so Laptop 2 staff do not need a new URL every day.

Preferred option:

- Reserve Laptop 1's IP address in the router DHCP settings.
- Example: reserve `192.168.1.50` for Laptop 1.
- Then use `http://192.168.1.50:5001/admin` on Laptop 2.

Alternative options:

- Use the router's local hostname support if it is reliable.
- Use a manually assigned static IPv4 only if you know the router subnet, gateway, and DNS settings.

Do not automatically change Windows network settings unless the restaurant owner/operator understands the network.

## Windows Firewall

Allow inbound TCP `5001` on Laptop 1 for Private networks only:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\configure-firewall.ps1 -Action Add -Port 5001
```

The firewall helper refuses to create a rule for PostgreSQL port `5432`.

Windows must mark the restaurant Wi-Fi as a Private network. Public network profiles may block Laptop 2.

## Backend Startup

RestaurantAI includes startup task support:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\install-startup-task.ps1 -Action Install
```

The startup task runs `scripts\start-restaurantai.ps1` after Windows boots. The start script checks its PID metadata and exits if the RestaurantAI backend is already running, so it does not intentionally create duplicate backend instances.

Remove the startup task:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\install-startup-task.ps1 -Action Remove
```

## Offline LAN Operation

Internet is not required for the core local workflow:

- Customer kiosk
- Admin login
- Orders
- Kitchen
- Customers
- Bills
- Reports
- PostgreSQL

Keep the Wi-Fi router/local network running even if the internet is disconnected.

Cloud-dependent integrations such as online payment gateways, WhatsApp, OCR, AI, or external notification services may be unavailable without internet, depending on configuration.

## Live Updates

Admin Orders and Kitchen use local polling while their pages are open:

- Active tab: every 3 seconds.
- Hidden tab: every 15 seconds.
- A new request is not started while the previous request is still pending.
- Existing rows stay visible if Laptop 2 briefly loses connection.
- When the backend returns, data refreshes automatically without requiring login again unless the token is actually expired or invalid.

## Troubleshooting

### Laptop 2 Cannot Open Admin

Check Laptop 1:

```text
http://127.0.0.1:5001/api/health
http://127.0.0.1:5001/api/ready
```

Then from Laptop 2:

```text
http://<LAPTOP-1-LAN-IP>:5001/api/health
http://<LAPTOP-1-LAN-IP>:5001/admin
```

If Laptop 2 cannot reach Laptop 1:

- Confirm both laptops are on the same Wi-Fi/LAN.
- Confirm Laptop 1 has `HOST=0.0.0.0`.
- Confirm Windows Firewall allows TCP `5001` on Private networks.
- Confirm the Wi-Fi network profile is Private.
- Confirm the URL uses Laptop 1's IP address, not Laptop 2's.

### Server Unavailable Message

If Admin Orders or Kitchen shows `Restaurant server unavailable. Reconnecting...`, leave the page open. It will retry automatically.

If it does not recover:

- Check that Laptop 1 is awake.
- Restart RestaurantAI on Laptop 1.
- Check `logs\backend.log` and `logs\backend-error.log`.
- Open `http://<LAPTOP-1-LAN-IP>:5001/api/ready`.

### IP Address Changed

If Laptop 2 used to work and now fails, Laptop 1 may have received a new IP address.

On Laptop 1:

```powershell
ipconfig
```

Find the Wi-Fi IPv4 address and update Laptop 2's URL. For a permanent fix, add a DHCP reservation in the router.

### Admin Login Returns To Login

Use:

```text
http://<LAPTOP-1-LAN-IP>:5001/admin/login
```

The Admin app should call the backend on the same host:

```text
http://<LAPTOP-1-LAN-IP>:5001/api/auth/login
http://<LAPTOP-1-LAN-IP>:5001/api/auth/profile
```

Do not use `127.0.0.1` from Laptop 2. On Laptop 2, `127.0.0.1` means Laptop 2 itself.
