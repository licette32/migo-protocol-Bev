$URL = "http://localhost:3001/webhooks/pomelo/test-split-123"
$TS = "1700000000"
$EP = "/webhooks/pomelo/test-split-123"
$SIG = "0f82e255b0f8089b12191cf4e19f1bb1e88678ac91c3e689448c8470d5e03836"
$BODY = '{"payerId":"u1","method":"card","originalAsset":"ARS","originalAmount":1000}'

Write-Host "=== CHECK 1: missing headers ==="
try { $r = Invoke-WebRequest -Uri $URL -Method POST -ContentType "application/json" -Body $BODY -ErrorAction Stop; Write-Host "HTTP $($r.StatusCode) -- expected 401" } catch { Write-Host "HTTP $($_.Exception.Response.StatusCode.value__) -- expected 401" }

Write-Host ""
Write-Host "=== CHECK 2: bad signature ==="
$h2 = @{ "x-signature" = "badsignature"; "x-timestamp" = $TS; "x-endpoint" = $EP }
try { $r = Invoke-WebRequest -Uri $URL -Method POST -ContentType "application/json" -Headers $h2 -Body $BODY -ErrorAction Stop; Write-Host "HTTP $($r.StatusCode) -- expected 401" } catch { Write-Host "HTTP $($_.Exception.Response.StatusCode.value__) -- expected 401" }

Write-Host ""
Write-Host "=== CHECK 3: valid signature ==="
$h3 = @{ "x-signature" = $SIG; "x-timestamp" = $TS; "x-endpoint" = $EP }
try { $r = Invoke-WebRequest -Uri $URL -Method POST -ContentType "application/json" -Headers $h3 -Body $BODY -ErrorAction Stop; Write-Host "HTTP $($r.StatusCode) -- expected 200"; Write-Host $r.Content } catch { $code = $_.Exception.Response.StatusCode.value__; $stream = $_.Exception.Response.GetResponseStream(); $reader = New-Object System.IO.StreamReader($stream); Write-Host "HTTP $code -- expected 200"; Write-Host $reader.ReadToEnd() }
