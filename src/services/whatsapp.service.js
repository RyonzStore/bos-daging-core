import axios from 'axios';

export class WhatsAppService {
  constructor() {
    this.apiVersion = process.env.META_GRAPH_VERSION || 'v21.0';
  }

  async sendTextMessage({ waPhoneNumberId, accessToken, recipientWaId, text }) {
    const url = `https://graph.facebook.com/${this.apiVersion}/${waPhoneNumberId}/messages`;
    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: recipientWaId,
      type: 'text',
      text: { preview_url: false, body: text }
    };

    try {
      const response = await axios.post(url, payload, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        timeout: 15000
      });
      return response.data;
    } catch (error) {
      const metaError = error.response?.data || error.message;
      console.error(`[WhatsAppService] Gagal kirim ke ${recipientWaId}:`, JSON.stringify(metaError));
      throw new Error(`Meta API Error: ${JSON.stringify(metaError)}`);
    }
  }

  async markAsRead({ waPhoneNumberId, accessToken, messageId }) {
    const url = `https://graph.facebook.com/${this.apiVersion}/${waPhoneNumberId}/messages`;
    await axios.post(
      url,
      { messaging_product: 'whatsapp', status: 'read', message_id: messageId },
      { headers: { Authorization: `Bearer ${accessToken}` } }
    ).catch(() => {});
  }
}

export default new WhatsAppService();
