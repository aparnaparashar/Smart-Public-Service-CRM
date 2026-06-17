const dotenv = require('dotenv');
dotenv.config();

const express = require('express');
const cors    = require('cors');
const connectDB       = require('./src/config/db');
const { startSLAService } = require('./src/config/slaService');


connectDB();

const app = express();

// ─── CORS Configuration (Production-ready) ──────────────────────────────────
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:5000',
      'https://smart-public-service-nfeiuagsj-aparnas-projects-d613b5c2.vercel.app',
      'https://smart-public-service-crm-puce.vercel.app',
      process.env.FRONTEND_URL,
      ...(process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim()) : []),
    ].filter(Boolean);

    const allowedOriginPatterns = [
      /^https:\/\/.*\.vercel\.app$/,
      /^https:\/\/.*\.netlify\.app$/,
      /^https?:\/\/localhost(?::\d+)?$/,
    ];

    const isAllowed = !origin ||
      allowedOrigins.includes(origin) ||
      allowedOriginPatterns.some((pattern) => pattern.test(origin));

    if (isAllowed) {
      callback(null, true);
    } else {
      console.error(`[CORS] Rejected origin: ${origin}. Allowed origins: ${allowedOrigins.join(', ')}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
};

app.options('*', cors(corsOptions));
app.use(cors(corsOptions));
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ limit: '20mb', extended: true }));

// ─── Request timeout middleware (prevent hanging requests) ──────────────────
app.use((req, res, next) => {
  req.setTimeout(30000); // 30 seconds
  res.setTimeout(30000);
  next();
});

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({ message: 'PS-CRM API is running!' });
});

// ─── Health check with DB status ────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK',
    backend: 'running',
    timestamp: new Date().toISOString()
  });
});

// ─── Routes ───────────────────────────────────────────────────────────────────
const authRoutes       = require('./src/routes/authRoutes');
const complaintRoutes  = require('./src/routes/complaintRoutes');
const dashboardRoutes  = require('./src/routes/dashboardRoutes');
const feedbackRoutes   = require('./src/routes/feedbackRoutes');
const chatbotRoutes = require('./src/routes/chatbotRoutes');
const heatmapRoutes = require('./src/routes/heatmapRoutes');

app.use('/api/auth',       authRoutes);
app.use('/api/complaints', complaintRoutes);
app.use('/api/dashboard',  dashboardRoutes);
app.use('/api/feedback',   feedbackRoutes);
app.use('/api/chatbot', chatbotRoutes);
app.use('/api/heatmap', heatmapRoutes);

// ─── Error handling middleware ─────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[Error]', err.message);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

// ─── Start server ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
const { startWhatsAppBot } = require('./src/config/whatsappBot');

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  startSLAService();
  startWhatsAppBot();  // WhatsApp bot enabled with QR code
});
