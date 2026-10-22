# TOR Evidence & Handover Report System Startup Script
$Host.UI.RawUI.WindowTitle = "TOR Evidence & Handover Report System"
Write-Host "====================================================================" -ForegroundColor Cyan
Write-Host " 🚀 กำลังเริ่มต้นระบบ TOR Evidence & Handover Report System..." -ForegroundColor Green
Write-Host "====================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host " 💻 ลิงก์บนเครื่องคอมพิวเตอร์: http://localhost:5000" -ForegroundColor Yellow
Write-Host " 📱 ลิงก์บนมือถือ (Wi-Fi เดียวกัน): http://192.168.1.105:5000" -ForegroundColor Yellow
Write-Host ""
Write-Host "====================================================================" -ForegroundColor Cyan

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location "$scriptDir\server"

Start-Sleep -Seconds 1
Start-Process "http://localhost:5000"

npm start
