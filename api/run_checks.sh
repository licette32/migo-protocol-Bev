#!/usr/bin/env bash

URL="http://localhost:3001/webhooks/pomelo/test-split-123"
TS="1700000000"
EP="/webhooks/pomelo/test-split-123"

cat > /tmp/webhook_body.json << 'EOF'
{"payerId":"u1","method":"card","originalAsset":"ARS","originalAmount":1000}
EOF

BODY=$(cat /tmp/webhook_body.json)

# Compute HMAC
SIG=$(node -e "
const crypto = require('crypto');
const key = process.env.POMELO_API_KEY || 'test-key';
const body = require('fs').readFileSync('/tmp/webhook_body.json','utf8').trim();
const payload = '${TS}' + '${EP}' + body;
process.stdout.write(crypto.createHmac('sha256', key).update(payload).digest('hex'));
")

echo "Computed SIG: $SIG"
echo ""

echo "=== CHECK 1: missing headers ==="
CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$URL" \
  -H "Content-Type: application/json" \
  --data-binary @/tmp/webhook_body.json)
echo "HTTP $CODE — expected 401"

echo ""
echo "=== CHECK 2: bad signature ==="
CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$URL" \
  -H "Content-Type: application/json" \
  -H "x-signature: badsignature" \
  -H "x-timestamp: $TS" \
  -H "x-endpoint: $EP" \
  --data-binary @/tmp/webhook_body.json)
echo "HTTP $CODE — expected 401"

echo ""
echo "=== CHECK 3: valid signature ==="
RESP=$(curl -s -X POST "$URL" \
  -H "Content-Type: application/json" \
  -H "x-signature: $SIG" \
  -H "x-timestamp: $TS" \
  -H "x-endpoint: $EP" \
  --data-binary @/tmp/webhook_body.json \
  -w "\nHTTP_CODE:%{http_code}")
echo "$RESP"
echo "expected: 200 {\"received\":true}"
