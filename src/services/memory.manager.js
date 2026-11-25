import { prisma } from '../config/database.js';

export class MemoryManager {
  constructor({ db = prisma, openaiService }) {
    this.db = db;
    this.openaiService = openaiService;
  }

  /**
   * Mengambil memori terisolasi untuk pasangan (aiEmployeeId, customerId).
   */
  async getMemory(aiEmployeeId, customerId) {
    return this.db.aiMemory.findUnique({
      where: {
        aiEmployeeId_customerId: {
          aiEmployeeId,
          customerId
        }
      }
    });
  }

  /**
   * Mengevaluasi percakapan terbaru dan memperbarui memori customer secara terisolasi.
   */
  async consolidateMemory({ aiEmployeeId, customerId, latestCustomerText, latestAiReply }) {
    const existingMemory = await this.getMemory(aiEmployeeId, customerId);
    const existingFacts = existingMemory?.factsSummary ?? '';

    const recentDialogue = `Customer: ${latestCustomerText}\nAI: ${latestAiReply}`;

    const updatedFacts = await this.openaiService.extractVerifiedFacts({
      existingFacts,
      recentDialogue
    });

    if (!updatedFacts || updatedFacts === existingFacts) {
      return existingMemory;
    }

    return this.db.aiMemory.upsert({
      where: {
        aiEmployeeId_customerId: {
          aiEmployeeId,
          customerId
        }
      },
      update: {
        factsSummary: updatedFacts
      },
      create: {
        aiEmployeeId,
        customerId,
        factsSummary: updatedFacts
      }
    });
  }
}