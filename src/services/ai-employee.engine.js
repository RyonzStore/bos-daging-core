import { prisma } from '../config/database.js';
import { WhatsappRoutingRepository } from '../repositories/whatsapp-routing.repository.js';
import { OpenAIService } from './openai.service.js';
import { ContextManager } from './context.manager.js';
import { MemoryManager } from './memory.manager.js';

export class AiEmployeeEngine {
  constructor({
    db = prisma,
    routingRepo = new WhatsappRoutingRepository(db),
    openaiService = new OpenAIService(),
    contextManager = new ContextManager(),
    memoryManager = new MemoryManager({ db, openaiService })
  } = {}) {
    this.db = db;
    this.routingRepo = routingRepo;
    this.openaiService = openaiService;
    this.contextManager = contextManager;
    this.memoryManager = memoryManager;
  }

  /**
   * Titik masuk utama pemrosesan pesan WhatsApp masuk untuk AI Employee terkait.
   */
  async processIncomingWhatsappMessage({
    waPhoneNumberId,
    waMessageId,
    customerWaId,
    customerProfileName,
    messageText
  }) {
    // 1. Cek idempotency (mencegah pemrosesan ganda akibat webhook retry dari Meta)
    if (waMessageId) {
      const existingMessage = await this.db.message.findUnique({
        where: { waMessageId }
      });
      if (existingMessage) {
        return { status: 'DUPLICATE_IGNORED', messageId: existingMessage.id };
      }
    }

    // 2. Resolusi Nomor WhatsApp -> AI Employee
    const resolved = await this.routingRepo.resolveAiByPhoneNumberId(waPhoneNumberId);
    if (!resolved) {
      return { status: 'UNMAPPED_NUMBER' };
    }

    const { aiEmployee, whatsappNumber } = resolved;

    // 3. Upsert profil dasar Customer
    const customer = await this.db.customer.upsert({
      where: { waId: customerWaId },
      update: customerProfileName ? { profileName: customerProfileName } : {},
      create: {
        waId: customerWaId,
        profileName: customerProfileName || null
      }
    });

    // 4. Upsert Sesi Percakapan Terisolasi (aiEmployeeId + customerId)
    const conversation = await this.db.conversation.upsert({
      where: {
        aiEmployeeId_customerId: {
          aiEmployeeId: aiEmployee.id,
          customerId: customer.id
        }
      },
      update: {
        lastMessageAt: new Date()
      },
      create: {
        aiEmployeeId: aiEmployee.id,
        customerId: customer.id,
        lastMessageAt: new Date()
      }
    });

    // 5. Simpan Pesan Masuk (INBOUND) ke Database
    await this.db.message.create({
      data: {
        conversationId: conversation.id,
        waMessageId: waMessageId || null,
        direction: 'INBOUND',
        sender: 'CUSTOMER',
        content: messageText
      }
    });

    // 6. Validasi Status AI Employee & Flag Intervensi Manual Owner
    if (aiEmployee.status !== 'ACTIVE') {
      await this.db.activityLog.create({
        data: {
          aiEmployeeId: aiEmployee.id,
          actorType: 'SYSTEM',
          action: 'SKIPPED_AI_REPLY_INACTIVE',
          metadata: { status: aiEmployee.status, customerWaId }
        }
      });
      return { status: 'AI_NOT_ACTIVE', aiStatus: aiEmployee.status };
    }

    if (conversation.isAiPaused) {
      return { status: 'AI_PAUSED_BY_OWNER', conversationId: conversation.id };
    }

    // 7. Ambil Riwayat Percakapan & Memori Khusus untuk (aiEmployeeId, customerId)
    const recentMessagesDesc = await this.db.message.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: 'desc' },
      take: aiEmployee.historyWindowSize
    });
    const historyMessages = recentMessagesDesc.reverse();

    const aiMemory = await this.memoryManager.getMemory(aiEmployee.id, customer.id);

    // 8. Rakit Konteks & Prompt Terisolasi
    const systemPrompt = this.contextManager.buildSystemPrompt({
      aiEmployee,
      activeInstructions: aiEmployee.instructions,
      customer,
      aiMemory
    });

    const openaiMessages = this.contextManager.compileMessagesPayload({
      systemPrompt,
      historyMessages
    });

    // 9. Eksekusi OpenAI API menggunakan konfigurasi model AI Employee ini
    const aiResponse = await this.openaiService.generateReply({
      model: aiEmployee.openaiModel,
      temperature: aiEmployee.temperature,
      maxTokens: aiEmployee.maxTokens,
      messages: openaiMessages
    });

    // 10. Simpan Balasan AI (OUTBOUND) ke Database
    const outboundMessage = await this.db.message.create({
      data: {
        conversationId: conversation.id,
        direction: 'OUTBOUND',
        sender: 'AI_EMPLOYEE',
        content: aiResponse.content,
        tokenUsage: aiResponse.totalTokens
      }
    });

    await this.db.conversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: new Date() }
    });

    // 11. Konsolidasi Memori Customer secara Terisolasi
    await this.memoryManager.consolidateMemory({
      aiEmployeeId: aiEmployee.id,
      customerId: customer.id,
      latestCustomerText: messageText,
      latestAiReply: aiResponse.content
    });

    // 12. Catat Activity Log
    await this.db.activityLog.create({
      data: {
        aiEmployeeId: aiEmployee.id,
        actorType: 'AI_EMPLOYEE',
        action: 'AI_REPLY_GENERATED',
        metadata: {
          conversationId: conversation.id,
          outboundMessageId: outboundMessage.id,
          model: aiEmployee.openaiModel,
          tokenUsage: aiResponse.totalTokens
        }
      }
    });

    return {
      status: 'REPLIED',
      aiEmployeeId: aiEmployee.id,
      conversationId: conversation.id,
      whatsappConfig: {
        waPhoneNumberId: whatsappNumber.waPhoneNumberId,
        accessToken: whatsappNumber.accessToken,
        recipientWaId: customer.waId
      },
      replyText: aiResponse.content,
      tokenUsage: aiResponse.totalTokens
    };
  }
}