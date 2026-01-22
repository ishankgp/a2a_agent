# PowerShell script to run all A2A services and orchestrator
$ErrorActionPreference = "Stop"

# Get script directory
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

# Activate virtual environment if it exists
if (-not $env:VIRTUAL_ENV -and (Test-Path ".venv\Scripts\Activate.ps1")) {
    & ".venv\Scripts\Activate.ps1"
}

# Array to store process IDs for cleanup
$processes = @()

# Function to cleanup processes on exit
function Cleanup {
    Write-Host ""
    Write-Host "Cleaning up processes..." -ForegroundColor Yellow
    foreach ($proc in $processes) {
        if ($proc -and -not $proc.HasExited) {
            Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
        }
    }
}

# Start services in background
Write-Host "Starting services..." -ForegroundColor Green

$triage = Start-Process python -ArgumentList "-m", "uvicorn", "services.triage.app:app", "--port", "8001", "--reload" -PassThru -WindowStyle Hidden
$processes += $triage
Write-Host "  Triage service starting on port 8001" -ForegroundColor Cyan

$research = Start-Process python -ArgumentList "-m", "uvicorn", "services.research.app:app", "--port", "8002", "--reload" -PassThru -WindowStyle Hidden
$processes += $research
Write-Host "  Research service starting on port 8002" -ForegroundColor Cyan

$review = Start-Process python -ArgumentList "-m", "uvicorn", "services.review.app:app", "--port", "8003", "--reload" -PassThru -WindowStyle Hidden
$processes += $review
Write-Host "  Review service starting on port 8003" -ForegroundColor Cyan

$presentation = Start-Process python -ArgumentList "-m", "uvicorn", "services.presentation.app:app", "--port", "8004", "--reload" -PassThru -WindowStyle Hidden
$processes += $presentation
Write-Host "  Presentation service starting on port 8004" -ForegroundColor Cyan

# Wait for services to start
Write-Host ""
Write-Host "Waiting for services to initialize..." -ForegroundColor Yellow
Start-Sleep -Seconds 3

# Verify services are running
$servicesReady = $false
$maxAttempts = 10
$attempt = 0

while (-not $servicesReady -and $attempt -lt $maxAttempts) {
    $attempt++
    
    try {
        $null = Invoke-WebRequest -Uri "http://localhost:8001/.well-known/agent-card.json" -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
        $null = Invoke-WebRequest -Uri "http://localhost:8002/.well-known/agent-card.json" -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
        $null = Invoke-WebRequest -Uri "http://localhost:8003/.well-known/agent-card.json" -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
        $null = Invoke-WebRequest -Uri "http://localhost:8004/.well-known/agent-card.json" -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
        $servicesReady = $true
    } catch {
        Start-Sleep -Seconds 1
    }
}

if ($servicesReady) {
    Write-Host "All services are ready!" -ForegroundColor Green
} else {
    Write-Host "Warning: Some services may not be ready, continuing anyway..." -ForegroundColor Yellow
}

# Run orchestrator
Write-Host ""
Write-Host "Running orchestrator..." -ForegroundColor Green
$separator = "=" * 50
Write-Host $separator -ForegroundColor Gray

try {
    python client/orchestrator.py
} catch {
    Write-Host "Error occurred while running orchestrator" -ForegroundColor Red
}

# Cleanup on exit
Cleanup
