@echo off
set DATABASE_URL=postgresql://postgres:Dhanaa@8220@localhost:5432/dct_crm

echo Starting API server...
start "DCT-API" cmd /k "cd /d C:\Users\jay\Desktop\Projects\Projects\DCT-CRMM\DCT-CRMM\apps\api && npx tsx src/index.ts"

echo Starting Web server...
start "DCT-Web" cmd /k "cd /d C:\Users\jay\Desktop\Projects\Projects\DCT-CRMM\DCT-CRMM\apps\web && npx next dev"

echo Both services starting...
echo   Web:  http://localhost:3000
echo   API:  http://localhost:3001
