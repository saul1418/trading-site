@echo off
REM share-demo.bat - arranca el servidor y ngrok en dos ventanas separadas
REM Requisitos: ngrok en PATH y haber corrido "ngrok authtoken <TOKEN>" previamente

:: Abrir una ventana para el servidor Node
start "Server" cmd /k "npm start"

:: Pequeña pausa para que el servidor arranque (opcional)
timeout /t 2 /nobreak >nul

:: Abrir otra ventana para ngrok
start "Ngrok" cmd /k "ngrok http 3000"

echo Script iniciado. Copia la URL Forwarding que muestre ngrok y comparte la ruta /trading_dashboard_pro.html?demo=us
pause