import { prisma } from '../config/database.js';
import { encryptSecret, decryptSecret } from '../utils/crypto.js';

export class WhatsappRoutingRepository {
  constructor(db = prisma) {
    this.db = db;
  }

  /**
   * Menghubungkan 1 Nomor WhatsApp ke 1 AI Employee secara eksklusif.
   */
  async bindNumberToAi({ aiEmployeeId, waPhoneNumberId, waDisplayNumber, rawAccessToken }) {
    const encryptedToken = encryptSecret(rawAccessToken);

    const record = await this.db.whatsappNumber.create({
      data: {
        aiEmployeeId,
        waPhoneNumberId,
        waDisplayNumber,
        waAccessTokenEnc: encryptedToken,
        isConnected: true
      },
      include: {
        aiEmployee: true
      }
    });

    await this.db.activityLog.create({
      data: {
        aiEmployeeId,
        actorType: 'OWNER',
        action: 'WHATSAPP_NUMBER_BOUND',
        metadata: { waPhoneNumberId, waDisplayNumber }
      }
    });

    return record;
  }

  /**
   * Resolusi deterministik dari Phone Number ID Meta ke entitas AI Employee beserta instruksi aktifnya.
   */
  async resolveAiByPhoneNumberId(waPhoneNumberId) {
    const waRecord = await this.db.whatsappNumber.findUnique({
      where: { waPhoneNumberId },
      include: {
        aiEmployee: {
          include: {
            instructions: {
              where: { isActive: true },
              orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }]
            }
          }
        }
      }
    });

    if (!waRecord || !waRecord.isConnected) {
      return null;
    }

    return {
      whatsappNumber: {
        id: waRecord.id,
        waPhoneNumberId: waRecord.waPhoneNumberId,
        waDisplayNumber: waRecord.waDisplayNumber,
        accessToken: decryptSecret(waRecord.waAccessTokenEnc)
      },
      aiEmployee: waRecord.aiEmployee
    };
  }
}