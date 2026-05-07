@echo off
set URL=http://localhost:3001/webhooks/pomelo/test-split-123
set TS=1700000000
set EP=/webhooks/pomelo/test-split-123
set SIG=0f82e255b0f8089b12191cf4e19f1bb1e88678ac91c3e689448c8470d5e03836

echo === CHECK 1: missing headers ===
curl.exe -s -o NUL -w "HTTP %{http_code} -- expected 401" -X POST %URL% -H "Content-Type: application/json" -d @api\webhook_body.json
echo.

echo.
echo === CHECK 2: bad signature ===
curl.exe -s -o NUL -w "HTTP %{http_code} -- expected 401" -X POST %URL% -H "Content-Type: application/json" -H "x-signature: badsignature" -H "x-timestamp: %TS%" -H "x-endpoint: %EP%" -d @api\webhook_body.json
echo.

echo.
echo === CHECK 3: valid signature ===
curl.exe -s -w "HTTP %{http_code}" -X POST %URL% -H "Content-Type: application/json" -H "x-signature: %SIG%" -H "x-timestamp: %TS%" -H "x-endpoint: %EP%" -d @api\webhook_body.json
echo.
