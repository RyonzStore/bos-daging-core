import { openaiClient } from '../config/openai.js';

export class OpenAIService {
  constructor(client = openaiClient) {
    this.client = client;
  }

  /**
   * Menghasilkan balasan percakapan menggunakan konfigurasi spesifik masing-masing AI Employee.
   */
  async generateReply({ model, temperature, maxTokens, messages }) {
    const completion = await this.client.chat.completions.create({
      model,
      temperature,
      max_tokens: maxTokens,
      messages
    });

    const choice = completion.choices?.[0];
    const replyText = choice?.message?.content?.trim();

    if (!replyText) {
      throw new Error('OpenAI mengembalikan respons kosong.');
    }

    return {
      content: replyText,
      totalTokens: completion.usage?.total_tokens ?? 0
    };
  }

  /**
   * Mengekstrak fakta objektif baru dari percakapan tanpa mengarang informasi.
   */
  async extractVerifiedFacts({ existingFacts, recentDialogue }) {
    const systemInstruction = [
      'Anda adalah modul ekstraksi memori faktual untuk perusahaan BOS DAGING.',
      'Tugas Anda menggabungkan fakta lama dengan fakta baru yang EKSPLISIT disebutkan oleh customer dalam percakapan terakhir.',
      'ATURAN KERAS:',
      '1. DILARANG KERAS mengarang, menebak, atau berasumsi informasi yang tidak dikatakan customer.',
      '2. Catat hanya fakta berguna (misal: nama panggilan customer, alamat pengiriman, preferensi potongan daging, jadwal rutin pesanan).',
      '3. Jika tidak ada fakta baru yang eksplisit, kembalikan persis teks fakta lama.',
      '4. Gunakan format poin singkat berbahasa Indonesia.'
    ].join('\n');

    const userPayload = [
      `FAKTA TERSIMPAN SEBELUMNYA:\n${existingFacts || '(Belum ada data)'}`,
      `\nPERCAKAPAN TERBARU:\n${recentDialogue}`
    ].join('\n');

    const completion = await this.client.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.0,
      max_tokens: 400,
      messages: [
        { role: 'system', content: systemInstruction },
        { role: 'user', content: userPayload }
      ]
    });

    return completion.choices?.[0]?.message?.content?.trim() || existingFacts || '';
  }
}