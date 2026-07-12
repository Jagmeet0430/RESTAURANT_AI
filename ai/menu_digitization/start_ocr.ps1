$env:FLAGS_use_mkldnn = "0"
$env:FLAGS_use_onednn = "0"
$env:FLAGS_enable_pir_api = "0"
$env:OMP_NUM_THREADS = "1"

Set-Location "C:\Users\Gopesh\Desktop\RestaurantAI\ai\menu_digitization"
.
\.venv\Scripts\python.exe -m uvicorn api.app:app --host 127.0.0.1 --port 8003
