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

# Determine Python path
if (Test-Path ".venv\Scripts\python.exe") {
    $pythonPath = Resolve-Path ".venv\Scripts\python.exe"
}
else {
    $pythonPath = "python"
}

Write-Host "Using Python: $pythonPath" -ForegroundColor Cyan

$unifiedBackend = Start-Process $pythonPath -ArgumentList "-m", "uvicorn", "services.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload" -PassThru
$processes += $unifiedBackend
Write-Host "  Unified Backend service on port 8000" -ForegroundColor Cyan

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
Write-Host "  Backend services: http://localhost:8000" -ForegroundColor White
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
}
catch {
    # Cleanup on exit
    Cleanup
}
