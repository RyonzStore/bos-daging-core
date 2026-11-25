const prisma = require('../config/database');
const routingRepo = require('../repositories/whatsapp-routing.repository');
const aiEmployeeEngine = require('../services/ai-employee.engine');
const whatsappService = require('../services/whatsapp.service');
const { getIO } = require('../config/socket');

// GET /webhook - Verifikasi Endpoint Meta
exports.verifyWebhook = (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.META_VERIFY_TOKEN) {
    console.log('[Webhook] Verifikasi Meta berhasil.');
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
};

// POST /webhook - Penerimaan Pesan Pelanggan
exports.handleIncomingWebhook = async (req, res) => {
  // Balas 200 OK segera agar Meta tidak melakukan retry berulang
  res.sendStatus(200);

  try {
    const body = req.body;
    if (body.object !== 'whatsapp_business_account') return;

    for (const entry of body.entry || []) {
      for (const change of entry.changes || []) {
        const value = change.value;
        if (!value?.messages || value.messages.length === 0) continue;

        const phoneNumberId = value.metadata?.phone_number_id;
        const message = value.messages[0];
        const contact = value.contacts?.[0];
        const customerWaId = message.from;
        const messageId = message.id;

        if (message.type !== 'text') continue;
        const incomingText = message.text?.body?.trim();
        if (!incomingText) continue;

        // 1. Idempotency Check (Cegah duplikasi proses)
        const alreadyProcessed = await prisma.processedWebhook.findUnique({
          where: { messageId }
        });
        if (alreadyProcessed) continue;

        await prisma.processedWebhook.create({ data: { messageId } });

        // 2. Routing AI Employee berdasarkan phone_number_id
        const channel = await routingRepo.findByPhoneNumberId(phoneNumberId);
        if (!channel || !channel.isActive || !channel.aiEmployee) {
          console.warn(`[Webhook] Tidak ada AI Employee aktif untuk phone_number_id: ${phoneNumberId}`);
          continue;
        }

        const aiEmployee = channel.aiEmployee;

        // Tandai pesan terbaca di WhatsApp pelanggan
        await whatsappService.markAsRead({
          phoneNumberId,
          encryptedAccessToken: channel.encryptedAccessToken,
          messageId
        });

        // Broadcast pesan masuk ke Dashboard Owner secara real-time
        const io = getIO();
        io?.emit('chat:incoming', {
          aiEmployeeId: aiEmployee.id,
          aiEmployeeName: aiEmployee.name,
          customerWaId,
          customerName: contact?.profile?.name || customerWaId,
          text: incomingText,
          timestamp: new Date().toISOString()
        });

        // 3. Jalankan AI Employee Engine (Terisolasi per AI Employee & Customer)
        const aiReply = await aiEmployeeEngine.processMessage({
          aiEmployeeId: aiEmployee.id,
          customerWaId,
          customerName: contact?.profile?.name || 'Pelanggan',
          messageText: incomingText
        });

        // 4. Kirim balasan AI ke WhatsApp Pelanggan
        await whatsappService.sendTextMessage({
          phoneNumberId,
          encryptedAccessToken: channel.encryptedAccessToken,
          to: customerWaId,
          text: aiReply
        });

        // Broadcast balasan AI ke Dashboard Owner
        io?.emit('chat:outgoing', {
          aiEmployeeId: aiEmployee.id,
          customerWaId,
          text: aiReply,
          timestamp: new Date().toISOString()
        });
      }
    }
  } catch (error) {
    console.error('[Webhook] Error memproses pesan masuk:', error);
  }
};