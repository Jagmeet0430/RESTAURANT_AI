$root = "C:\Users\Gopesh\Desktop\RestaurantAI"
$backendEnvPath = Join-Path $root "backend\.env"
$backendPort = 5001

if (Test-Path $backendEnvPath) {
    $portLine = Get-Content $backendEnvPath | Where-Object { $_ -match "^PORT=\d+$" } | Select-Object -First 1
    if ($portLine -match "^PORT=(\d+)$") {
        $backendPort = [int]$Matches[1]
    }
}

function Test-Port {
    param([int]$Port)
    $connection = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    return $null -ne $connection
}

function Start-ServiceWindow {
    param(
        [string]$Title,
        [string]$Path,
        [string]$Command,
        [int]$Port
    )

    if (Test-Port $Port) {
        Write-Host "$Title already running on port $Port" -ForegroundColor Yellow
    }
    else {
        Write-Host "Starting $Title on port $Port..." -ForegroundColor Green
        Start-Process powershell -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-Command", "cd '$Path'; `$host.UI.RawUI.WindowTitle='$Title'; $Command"
        Start-Sleep -Seconds 3
    }
}

Write-Host ""
Write-Host "Starting RestaurantAI Full Project..." -ForegroundColor Cyan
Write-Host ""

Start-ServiceWindow -Title "RestaurantAI Backend" -Path "$root\backend" -Port $backendPort -Command "npm run dev"
Start-ServiceWindow -Title "RestaurantAI RAG Chatbot" -Path "$root\ai\Rag_chatbot" -Port 8001 -Command ".\.venv\Scripts\python.exe -m uvicorn app:app --app-dir '$root\ai\Rag_chatbot' --host 127.0.0.1 --port 8001"
Start-ServiceWindow -Title "RestaurantAI Voice Recommendation" -Path "$root\ai\voice_recommendation" -Port 8002 -Command ".\.venv\Scripts\python.exe -m uvicorn app_api:app --app-dir '$root\ai\voice_recommendation' --host 127.0.0.1 --port 8002"
Start-ServiceWindow -Title "RestaurantAI Menu OCR" -Path "$root\ai\menu_digitization" -Port 8003 -Command "`$env:FLAGS_use_mkldnn='0'; `$env:FLAGS_use_onednn='0'; `$env:FLAGS_enable_pir_api='0'; .\.venv\Scripts\python.exe -m uvicorn api.app:app --app-dir '$root\ai\menu_digitization' --host 127.0.0.1 --port 8003"
Start-ServiceWindow -Title "RestaurantAI Admin Panel" -Path "$root\admin" -Port 5173 -Command "npm run dev"

Write-Host ""
Write-Host "RestaurantAI startup completed." -ForegroundColor Cyan
Write-Host ""
Write-Host "Backend: http://127.0.0.1:$backendPort" -ForegroundColor White
Write-Host "RAG:     http://127.0.0.1:8001" -ForegroundColor White
Write-Host "Voice:   http://127.0.0.1:8002" -ForegroundColor White
Write-Host "OCR:     http://127.0.0.1:8003" -ForegroundColor White
Write-Host "Admin:   http://localhost:5173" -ForegroundColor White
Write-Host ""
