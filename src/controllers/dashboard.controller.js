import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/database.js';
import { WhatsappRoutingRepository } from '../repositories/whatsapp-routing.repository.js';
import { encryptSecret } from '../utils/crypto.js';

const routingRepo = new WhatsappRoutingRepository(prisma);

export async function login(req, res) {
  const { email, password, name } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email dan password wajib diisi.' });

  const totalOwners = await prisma.owner.count();
  if (totalOwners === 0) {
    const passwordHash = await bcrypt.hash(password, 12);
    const owner = await prisma.owner.create({
      data: { email, passwordHash, name: name || 'Syarif' }
    });
    const token = jwt.sign({ id: owner.id, email: owner.email }, process.env.JWT_SECRET, { expiresIn: '24h' });
    return res.json({ token, owner: { id: owner.id, name: owner.name, email: owner.email } });
  }

  const owner = await prisma.owner.findUnique({ where: { email } });
  if (!owner || !(await bcrypt.compare(password, owner.passwordHash))) {
    return res.status(401).json({ error: 'Email atau password salah.' });
  }

  const token = jwt.sign({ id: owner.id, email: owner.email }, process.env.JWT_SECRET, { expiresIn: '24h' });
  res.json({ token, owner: { id: owner.id, name: owner.name, email: owner.email } });
}

export async function listAiEmployees(req, res) {
  const employees = await prisma.aiEmployee.findMany({
    where: { ownerId: req.owner.id },
    include: {
      whatsappNumber: {
        select: { id: true, waPhoneNumberId: true, waDisplayNumber: true, isConnected: true }
      },
      instructions: { orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }] },
      _count: { select: { conversations: true, memories: true } }
    },
    orderBy: { createdAt: 'desc' }
  });
  res.json(employees);
}

export async function createAiEmployee(req, res) {
  try {
    const {
      name,
      identityDescription,
      openaiModel,
      temperature,
      waPhoneNumberId,
      waDisplayNumber,
      rawAccessToken,
      initialInstructionTitle,
      initialInstructionContent
    } = req.body;

    if (!name || !waPhoneNumberId || !waDisplayNumber || !rawAccessToken) {
      return res.status(400).json({ error: 'Nama AI, Phone Number ID, Nomor Tampil, dan Access Token wajib diisi.' });
    }

    const aiEmployee = await prisma.aiEmployee.create({
      data: {
        ownerId: req.owner.id,
        name,
        identityDescription: identityDescription || null,
        openaiModel: openaiModel || 'gpt-4o-mini',
        temperature: temperature !== undefined ? Number(temperature) : 0.3,
        status: 'ACTIVE',
        ...(initialInstructionContent && {
          instructions: {
            create: {
              ownerId: req.owner.id,
              title: initialInstructionTitle || 'Instruksi Utama',
              content: initialInstructionContent,
              priority: 1,
              isActive: true
            }
          }
        })
      }
    });

    await routingRepo.bindNumberToAi({
      aiEmployeeId: aiEmployee.id,
      waPhoneNumberId,
      waDisplayNumber,
      rawAccessToken
    });

    const fullData = await prisma.aiEmployee.findUnique({
      where: { id: aiEmployee.id },
      include: { whatsappNumber: true, instructions: true }
    });

    res.status(201).json(fullData);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}

export async function updateAiEmployee(req, res) {
  const { id } = req.params;
  const { name, identityDescription, status, openaiModel, temperature, rawAccessToken } = req.body;

  const updated = await prisma.aiEmployee.update({
    where: { id },
    data: {
      ...(name && { name }),
      ...(identityDescription !== undefined && { identityDescription }),
      ...(status && { status }),
      ...(openaiModel && { openaiModel }),
      ...(temperature !== undefined && { temperature: Number(temperature) })
    }
  });

  if (rawAccessToken) {
    await prisma.whatsappNumber.updateMany({
      where: { aiEmployeeId: id },
      data: { waAccessTokenEnc: encryptSecret(rawAccessToken) }
    });
  }

  res.json(updated);
}

export async function upsertInstruction(req, res) {
  const { id } = req.params;
  const { instructionId, title, content, priority, isActive } = req.body;

  if (instructionId) {
    const updated = await prisma.aiInstruction.update({
      where: { id: instructionId },
      data: {
        ...(title && { title }),
        ...(content !== undefined && { content }),
        ...(priority !== undefined && { priority: Number(priority) }),
        ...(isActive !== undefined && { isActive })
      }
    });
    return res.json(updated);
  }

  const created = await prisma.aiInstruction.create({
    data: {
      aiEmployeeId: id,
      ownerId: req.owner.id,
      title: title || 'Instruksi Tambahan',
      content,
      priority: priority !== undefined ? Number(priority) : 1,
      isActive: true
    }
  });
  res.status(201).json(created);
}

export async function getConversations(req, res) {
  const { id } = req.params;
  const conversations = await prisma.conversation.findMany({
    where: { aiEmployeeId: id },
    include: {
      customer: true,
      messages: { orderBy: { createdAt: 'asc' }, take: 50 }
    },
    orderBy: { lastMessageAt: 'desc' }
  });
  res.json(conversations);
}

export async function toggleConversationPause(req, res) {
  const { conversationId } = req.params;
  const { isAiPaused } = req.body;
  const updated = await prisma.conversation.update({
    where: { id: conversationId },
    data: { isAiPaused: Boolean(isAiPaused) }
  });
  res.json(updated);
}