// src/controllers/dashboard.controller.js
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../config/database');
const { encrypt } = require('../utils/crypto');

// Login Owner (Inisialisasi otomatis jika belum ada akun Owner pertama)
exports.login = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email dan password wajib diisi.' });

  const ownerCount = await prisma.owner.count();
  if (ownerCount === 0) {
    const passwordHash = await bcrypt.hash(password, 12);
    const newOwner = await prisma.owner.create({
      data: { email, passwordHash, name: 'Owner BOS DAGING' }
    });
    const token = jwt.sign({ id: newOwner.id, email: newOwner.email }, process.env.JWT_SECRET, { expiresIn: '24h' });
    return res.json({ token, owner: { id: newOwner.id, email: newOwner.email, name: newOwner.name } });
  }

  const owner = await prisma.owner.findUnique({ where: { email } });
  if (!owner || !(await bcrypt.compare(password, owner.passwordHash))) {
    return res.status(401).json({ error: 'Kredensial salah.' });
  }

  const token = jwt.sign({ id: owner.id, email: owner.email }, process.env.JWT_SECRET, { expiresIn: '24h' });
  res.json({ token, owner: { id: owner.id, email: owner.email, name: owner.name } });
};

// Ambil seluruh AI Employee beserta Channel WhatsApp-nya
exports.listAiEmployees = async (req, res) => {
  const employees = await prisma.aiEmployee.findMany({
    include: { whatsappChannel: { select: { id: true, phoneNumberId: true, displayPhone: true, isActive: true } } },
    orderBy: { createdAt: 'desc' }
  });
  res.json(employees);
};

// Buat AI Employee + Hubungkan ke Nomor WhatsApp (1-to-1)
exports.createAiEmployee = async (req, res) => {
  const { name, persona, systemInstruction, phoneNumberId, displayPhone, accessToken } = req.body;
  if (!name || !systemInstruction || !phoneNumberId || !accessToken) {
    return res.status(400).json({ error: 'Nama, instruksi sistem, Phone Number ID, dan Access Token wajib diisi.' });
  }

  const encryptedAccessToken = encrypt(accessToken);

  const created = await prisma.aiEmployee.create({
    data: {
      name,
      persona: persona || '',
      systemInstruction,
      whatsappChannel: {
        create: {
          phoneNumberId,
          displayPhone: displayPhone || phoneNumberId,
          encryptedAccessToken,
          isActive: true
        }
      }
    },
    include: { whatsappChannel: true }
  });

  res.status(201).json(created);
};

// Update Instruksi AI tanpa menyentuh source code
exports.updateAiInstruction = async (req, res) => {
  const { id } = req.params;
  const { name, persona, systemInstruction, accessToken, isActive } = req.body;

  const updated = await prisma.aiEmployee.update({
    where: { id },
    data: {
      ...(name && { name }),
      ...(persona !== undefined && { persona }),
      ...(systemInstruction && { systemInstruction })
    }
  });

  if (accessToken || isActive !== undefined) {
    await prisma.whatsappChannel.updateMany({
      where: { aiEmployeeId: id },
      data: {
        ...(accessToken && { encryptedAccessToken: encrypt(accessToken) }),
        ...(isActive !== undefined && { isActive })
      }
    });
  }

  res.json(updated);
};

// Ambil riwayat percakapan pelanggan terisolasi per AI Employee
exports.getConversations = async (req, res) => {
  const { id } = req.params;
  const sessions = await prisma.customerSession.findMany({
    where: { aiEmployeeId: id },
    include: { messages: { orderBy: { createdAt: 'asc' }, take: 50 } },
    orderBy: { updatedAt: 'desc' }
  });
  res.json(sessions);
};