import crypto from 'crypto';

const BODY = '{"payerId":"u1","method":"card","originalAsset":"ARS","originalAmount":1000}';
const TS = '1700000000';
const EP = '/webhooks/pomelo/test-split-123';
const KEY = process.env.POMELO_API_KEY || 'test-key';

const payload = TS + EP + BODY;
const sig = crypto.createHmac('sha256', KEY).update(payload).digest('hex');

console.log('POMELO_API_KEY present:', !!process.env.POMELO_API_KEY);
console.log('SIG:', sig);
