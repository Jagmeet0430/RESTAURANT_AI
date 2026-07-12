Frontend (Admin) — Vercel

1. Connect repository to Vercel and set project root to `admin/`.
2. Build command: `npm run build` (or `npm run build --prefix admin`).
3. Output directory: `admin/dist` (Vite default is `dist`).
4. Environment variables (Vercel project settings):
   - `VITE_API_URL` = `https://<your-backend>/api`

Backend (Node/Express) — Render or Railway

1. Create service on Render (Web Service) or Railway.
2. Root: `backend/`.
3. Start command: `npm start` (or `npm run start --prefix backend`). For development use `npm run dev`.
4. Environment variables:
   - `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
   - `JWT_SECRET`, `JWT_EXPIRE` (e.g. `7d`)
   - `AI_SERVICE_URL` (public URL of FastAPI service)
   - `NODE_ENV=production`
5. Expose port as required by host (Render uses `PORT` env variable).

FastAPI (AI service) — Render or Railway

1. Create Python web service using `ai/AI prediction model` folder as repo root or subdirectory.
2. Install dependencies from `requirements.txt` and ensure `models/` path exists.
3. Start command (Render/Railway): `uvicorn app:app --host 0.0.0.0 --port $PORT`
4. Environment variables:
   - `MODEL_PATH` if not default
   - Any DB connection if model needs it

PostgreSQL — Neon or Supabase

1. Create a new database on Neon or Supabase.
2. Create a database user and note connection string.
3. Set backend env vars to match DB credentials.
4. Run database migrations / schema SQL:
   - Use `backend/database/queries.sql` or `database/schema_postgresql.sql` to create tables.

CI / Environment notes

- Use secure secrets for `JWT_SECRET` and DB credentials.
- For production scale, add Redis for caching and rate limiting for AI calls.
- Use background workers / scheduled jobs for low-stock notifications.

Testing locally

- FastAPI (in `ai/AI prediction model`):
```powershell
cd "ai\AI prediction model"
python -m venv .venv
.\.venv\Scripts\Activate
pip install -r requirements.txt
uvicorn app:app --reload --host 127.0.0.1 --port 8000
```

- Backend:
```powershell
cd backend
npm install
npm run dev
```

- Admin frontend:
```powershell
cd admin
npm install
npm run dev
```

Optional: Set up health checks

- Expose `/health` for backend and FastAPI and configure platform health checks to auto-restart failed services.

If you want, I can also add GitHub Actions workflows to build and deploy to Vercel/Render automatically. Let me know which provider you prefer and I will scaffold the CI files.
