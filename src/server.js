import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import './config/env.js';
import { initSocket } from './config/socket.js';
import { verifyMetaSignature } from './middlewares/webhook-signature.js';
import { verifyWebhook, handleIncomingWebhook } from './controllers/webhook.controller.js';
import {
  login,
  listAiEmployees,
  createAiEmployee,
  updateAiEmployee,
  upsertInstruction,
  getConversations,
  toggleConversationPause
} from './controllers/dashboard.controller.js';
import { requireOwnerAuth } from './middlewares/auth.middleware.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const server = http.createServer(app);
initSocket(server);

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());

app.use(express.json({
  verify: (req, res, buf) => {
    if (req.originalUrl.startsWith('/webhook')) {
      verifyMetaSignature(req, res, buf);
    }
  }
}));

app.use(express.static(path.join(__dirname, '../public')));

// Meta WhatsApp Cloud API Webhooks
app.get('/webhook', verifyWebhook);
app.post('/webhook', handleIncomingWebhook);

// Owner Auth & Dashboard API
app.post('/api/auth/login', login);
app.get('/api/employees', requireOwnerAuth, listAiEmployees);
app.post('/api/employees', requireOwnerAuth, createAiEmployee);
app.put('/api/employees/:id', requireOwnerAuth, updateAiEmployee);
app.post('/api/employees/:id/instructions', requireOwnerAuth, upsertInstruction);
app.get('/api/employees/:id/conversations', requireOwnerAuth, getConversations);
app.patch('/api/conversations/:conversationId/pause', requireOwnerAuth, toggleConversationPause);

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', service: 'BOS DAGING CORE', timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`✅ [BOS DAGING CORE] Server aktif di http://localhost:${PORT}`);
});