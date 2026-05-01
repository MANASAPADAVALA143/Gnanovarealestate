# Start both frontend and backend servers
Write-Host "🚀 Starting Gnanova Servers..." -ForegroundColor Green

# Start frontend (Vite) in new window
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot'; npm run dev" -WindowStyle Normal

# Wait 2 seconds
Start-Sleep -Seconds 2

# Start backend (Webhook) in new window  
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot'; npm run webhook" -WindowStyle Normal

Write-Host "✅ Servers starting in new windows!" -ForegroundColor Green
Write-Host "📍 Frontend: http://localhost:3000" -ForegroundColor Cyan
Write-Host "📍 Backend: http://localhost:3001" -ForegroundColor Cyan
Write-Host "" 
Write-Host "⚠️  DO NOT CLOSE the terminal windows!" -ForegroundColor Yellow
