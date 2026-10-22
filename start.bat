@echo off
chcp 65001 > nul
echo ====================================================================
echo  🚀 กำลังเริ่มต้นระบบ TOR Evidence & Handover Report System...
echo ====================================================================
echo.
echo  💻 ลิงก์บนเครื่องคอมพิวเตอร์: http://localhost:5000
echo  📱 ลิงก์บนมือถือ (Wi-Fi เดียวกัน): http://192.168.1.105:5000
echo.
echo ====================================================================

cd /d "%~dp0server"

timeout /t 2 /nobreak > nul
start "" "http://localhost:5000"

npm start
