# AI Integration Guide

Quick steps to run and test the FastAPI prediction service and connect it to the backend and admin frontend.

1) Start the FastAPI AI service

```powershell
cd "ai\AI prediction model"
# (optional) activate virtualenv
.\.venv\Scripts\Activate
pip install -r requirements.txt
uvicorn app:app --reload --host 127.0.0.1 --port 8000
```

2) Start the Node/Express backend

```powershell
cd backend
npm install
# ensure .env has PORT and DB settings; optionally set AI_SERVICE_URL (default http://127.0.0.1:8000)
npm run dev
```

3) Start the Admin frontend

```powershell
cd admin
npm install
npm run dev
```

4) Test the flow

- From the backend machine (or frontend), POST to the backend proxy:

```bash
curl -X POST http://localhost:5000/api/ai/predict \
  -H "Content-Type: application/json" \
  -d '{"month":7,"day":1,"day_of_week":"Tuesday","season":"Monsoon","is_weekend":0,"is_holiday":0,"weather":"Sunny","temperature":30,"customers":120,"online_orders":40,"dine_in_orders":80,"avg_order_value":350,"marketing_spend":1000,"special_event":"No"}'
```

- Or use the admin frontend service:

```js
import { predictSales } from 'src/services/ai';

const payload = { /* fields shown above */ };
const resp = await predictSales(payload);
console.log(resp.predicted_sales);
```

Notes:
- The backend proxy forwards requests to `AI_SERVICE_URL` (env var) or `http://127.0.0.1:8000` by default.
- Ensure the model file exists at `ai/AI prediction model/models/sales_prediction_model.pkl` so predictions are immediate.
