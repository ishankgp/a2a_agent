# PowerShell script to run all A2A services and frontend
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

# Register cleanup on Ctrl+C
[Console]::TreatControlCAsInput = $false
$null = Register-ObjectEvent -InputObject ([System.Console]) -EventName "CancelKeyPress" -Action { Cleanup; exit }

# Start backend services
Write-Host "Starting backend services..." -ForegroundColor Green

$triage = Start-Process python -ArgumentList "-m", "uvicorn", "services.triage.app:app", "--port", "8001", "--reload" -PassThru -WindowStyle Hidden
$processes += $triage
Write-Host "  Triage service on port 8001" -ForegroundColor Cyan

$research = Start-Process python -ArgumentList "-m", "uvicorn", "services.research.app:app", "--port", "8002", "--reload" -PassThru -WindowStyle Hidden
$processes += $research
Write-Host "  Research service on port 8002" -ForegroundColor Cyan

$review = Start-Process python -ArgumentList "-m", "uvicorn", "services.review.app:app", "--port", "8003", "--reload" -PassThru -WindowStyle Hidden
$processes += $review
Write-Host "  Review service on port 8003" -ForegroundColor Cyan

$presentation = Start-Process python -ArgumentList "-m", "uvicorn", "services.presentation.app:app", "--port", "8004", "--reload" -PassThru -WindowStyle Hidden
$processes += $presentation
Write-Host "  Presentation service on port 8004" -ForegroundColor Cyan

# Wait for services to start
Write-Host ""
Write-Host "Waiting for services to initialize..." -ForegroundColor Yellow
Start-Sleep -Seconds 3

# Start frontend
Write-Host "Starting frontend..." -ForegroundColor Green
Set-Location "web"
if (-not (Test-Path "node_modules")) {
    Write-Host "  Installing dependencies..." -ForegroundColor Yellow
    npm install
}
$frontend = Start-Process cmd -ArgumentList "/c", "npm", "run", "dev" -PassThru -WindowStyle Normal
$processes += $frontend
Set-Location $scriptDir
Write-Host "  Frontend starting on http://localhost:5173" -ForegroundColor Cyan

Write-Host ""
$separator = "=" * 60
Write-Host $separator -ForegroundColor Gray
Write-Host "All services are running!" -ForegroundColor Green
Write-Host "  Backend services: http://localhost:8001-8004" -ForegroundColor White
Write-Host "  Frontend: http://localhost:5173" -ForegroundColor White
Write-Host ""
Write-Host "Press Ctrl+C to stop all services" -ForegroundColor Yellow
Write-Host $separator -ForegroundColor Gray

# Keep script running
try {
    while ($true) {
        Start-Sleep -Seconds 1
        # Check if any process has exited unexpectedly
        foreach ($proc in $processes) {
            if ($proc.HasExited -and $proc.ExitCode -ne 0) {
                Write-Host "Process $($proc.Id) exited unexpectedly" -ForegroundColor Red
            }
        }
    }
} catch {
    # Cleanup on exit
    Cleanup
}
