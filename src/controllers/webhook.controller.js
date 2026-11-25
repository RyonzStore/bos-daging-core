import { AiEmployeeEngine } from '../services/ai-employee.engine.js';
import { WhatsAppService } from '../services/whatsapp.service.js';
import { getIO } from '../config/socket.js';

const engine = new AiEmployeeEngine();
const waService = new WhatsAppService();

export function verifyWebhook(req, res) {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.META_VERIFY_TOKEN) {
    console.log('[Webhook] Verifikasi Meta Cloud API berhasil.');
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
}

export async function handleIncomingWebhook(req, res) {
  res.sendStatus(200);

  try {
    const body = req.body;
    if (body?.object !== 'whatsapp_business_account') return;

    const io = getIO();

    for (const entry of body.entry || []) {
      for (const change of entry.changes || []) {
        const value = change.value;
        if (!value?.messages || value.messages.length === 0) continue;

        const waPhoneNumberId = value.metadata?.phone_number_id;
        const message = value.messages[0];
        const contact = value.contacts?.[0];

        if (message.type !== 'text' || !message.text?.body) continue;

        const customerWaId = message.from;
        const customerProfileName = contact?.profile?.name || customerWaId;
        const messageText = message.text.body.trim();

        io?.emit('chat:incoming', {
          waPhoneNumberId,
          customerWaId,
          customerProfileName,
          text: messageText,
          timestamp: new Date().toISOString()
        });

        const result = await engine.processIncomingWhatsappMessage({
          waPhoneNumberId,
          waMessageId: message.id,
          customerWaId,
          customerProfileName,
          messageText
        });

        if (result.status === 'REPLIED') {
          await waService.sendTextMessage({
            waPhoneNumberId: result.whatsappConfig.waPhoneNumberId,
            accessToken: result.whatsappConfig.accessToken,
            recipientWaId: result.whatsappConfig.recipientWaId,
            text: result.replyText
          });

          io?.emit('chat:outgoing', {
            aiEmployeeId: result.aiEmployeeId,
            conversationId: result.conversationId,
            customerWaId,
            text: result.replyText,
            tokenUsage: result.tokenUsage,
            timestamp: new Date().toISOString()
          });
        } else {
          console.log('[Webhook] Status pemrosesan:', result);
        }
      }
    }
  } catch (error) {
    console.error('[Webhook] Error:', error.message);
  }
}