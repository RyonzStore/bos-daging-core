const crypto = require('crypto');

function verifyMetaSignature(req, res, buf) {
  const signature = req.headers['x-hub-signature-256'];
  const appSecret = process.env.META_APP_SECRET;

  if (!appSecret) return; // Lewati hanya jika belum diset saat dev lokal
  if (!signature) {
    throw new Error('Missing X-Hub-Signature-256 header');
  }

  const expectedHash = 'sha256=' + crypto
    .createHmac('sha256', appSecret)
    .update(buf)
    .digest('hex');

  const sigBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedHash);

  if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
    throw new Error('Invalid Meta Webhook Signature');
  }
}

module.exports = { verifyMetaSignature };