// src/index.js
require('dotenv').config();
const http = require('http');
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const { initSocket } = require('./config/socket');
const { verifyMetaSignature } = require('./middlewares/webhook-signature');
const webhookController = require('./controllers/webhook.controller');
const dashboardController = require('./controllers/dashboard.controller');
const { requireOwnerAuth } = require('./middlewares/auth.middleware');

const app = express();
const server = http.createServer(app);
initSocket(server);

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());

// Raw body capture khusus untuk validasi HMAC signature Meta Webhook
app.use(express.json({
  verify: (req, res, buf) => {
    if (req.originalUrl.startsWith('/webhook')) {
      verifyMetaSignature(req, res, buf);
    }
  }
}));

// Static Dashboard Owner
app.use(express.static(path.join(__dirname, '../public')));

// Routes Webhook WhatsApp Cloud API
app.get('/webhook', webhookController.verifyWebhook);
app.post('/webhook', webhookController.handleIncomingWebhook);

// Routes Auth & Dashboard REST API
app.post('/api/auth/login', dashboardController.login);
app.get('/api/employees', requireOwnerAuth, dashboardController.listAiEmployees);
app.post('/api/employees', requireOwnerAuth, dashboardController.createAiEmployee);
app.put('/api/employees/:id', requireOwnerAuth, dashboardController.updateAiInstruction);
app.get('/api/employees/:id/conversations', requireOwnerAuth, dashboardController.getConversations);

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'BOS DAGING CORE', timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`[BOS DAGING CORE] Server berjalan di http://localhost:${PORT}`);
});