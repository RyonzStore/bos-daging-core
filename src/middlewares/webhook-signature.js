import crypto from 'crypto';

export function verifyMetaSignature(req, res, buf) {
  const appSecret = process.env.META_APP_SECRET;
  if (!appSecret) return;
  const signature = req.headers['x-hub-signature-256'];
  if (!signature) throw new Error('Missing x-hub-signature-256 header');
  const expected = 'sha256=' + crypto.createHmac('sha256', appSecret).update(buf).digest('hex');
  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    throw new Error('Invalid Meta webhook signature');
  }
}
