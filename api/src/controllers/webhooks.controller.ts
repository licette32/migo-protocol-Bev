import { Request, Response } from 'express';
import crypto from 'crypto';
import { registerPaymentService } from '../services/payment.service';
import { PaymentMethod } from '../types/payment.types';

export async function handlePomeloWebhook(req: Request, res: Response): Promise<void> {
  const signature = req.headers['x-signature'];
  const timestamp = req.headers['x-timestamp'];
  const endpoint = req.headers['x-endpoint'];

  if (!signature || !timestamp || !endpoint || !req.rawBody) {
    res.status(401).json({ error: 'Missing signature headers or raw body' });
    return;
  }

  const sigStr = Array.isArray(signature) ? signature[0] : signature;
  const tsStr = Array.isArray(timestamp) ? timestamp[0] : timestamp;
  const epStr = Array.isArray(endpoint) ? endpoint[0] : endpoint;

  const payload = tsStr + epStr + req.rawBody.toString('utf8');

  //console.log('PAYLOAD_HEX:', Buffer.from(payload).toString('hex'));
  //console.log('SERVER_PAYLOAD_HEX:', Buffer.from(payload).toString('hex'));
  const expected = crypto
    .createHmac('sha256', process.env.POMELO_API_KEY!)
    .update(payload)
    .digest('hex');

  const sigBuf = Buffer.from(sigStr.padEnd(expected.length, '\0'));
  const expBuf = Buffer.from(expected);
  if (!crypto.timingSafeEqual(sigBuf, expBuf) || sigStr.length !== expected.length) {
    res.status(401).json({ error: 'Invalid signature' });
    return;
  }

  const splitId = req.params.splitId as string;
  const { payerId, method, originalAsset, originalAmount } = req.body as {
    payerId: string;
    method: PaymentMethod;
    originalAsset: string;
    originalAmount: number;
  };

  try {
    await registerPaymentService(splitId, payerId, method, originalAsset, originalAmount);
    res.status(200).json({ received: true });
  } catch (err: any) {
    if (err.message === 'Split not found') {
      res.status(404).json({ error: 'Split not found' });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}
