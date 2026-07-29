const dotenv = require('dotenv');
dotenv.config();

const express = require('express');
const connectDB       = require('./src/config/db');
const { startSLAService } = require('./src/config/slaService');


const app = express();

// ─── CORS Configuration (Production-ready) ──────────────────────────────────
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5000',
  'http://localhost:8080',
  'http://127.0.0.1:8080',
  'https://smart-public-service-crm-rouge.vercel.app',
];

// Helper to check if an origin is allowed
function isOriginAllowed(origin) {
  if (!origin) return true; // Allow non-browser requests (e.g. Postman, curl)
  return allowedOrigins.includes(origin) || /\.vercel\.app$/i.test(origin);
}

// ─── Manual CORS middleware (replaces `cors` package for Express 5 reliability) ─
// Express 5 changed how wildcard OPTIONS and error propagation work,
// so we set CORS headers ourselves for maximum control.
app.use((req, res, next) => {
  const origin = req.headers.origin;

  if (isOriginAllowed(origin)) {
    res.header('Access-Control-Allow-Origin', origin || '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Max-Age', '86400');
  }

  // Respond to preflight immediately — do NOT let it fall through to routes
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }

  next();
});

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

  // Ensure CORS headers are present even on error responses
  const origin = req.headers.origin;
  if (isOriginAllowed(origin)) {
    res.header('Access-Control-Allow-Origin', origin || '*');
    res.header('Access-Control-Allow-Credentials', 'true');
  }

  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

// ─── Start server ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 8080;
const { startWhatsAppBot } = require('./src/config/whatsappBot');

app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);

  // Connect to MongoDB AFTER the server is listening, so Railway sees a
  // healthy port binding even if the DB takes a moment to connect.
  try {
    await connectDB();
  } catch (err) {
    console.error('[Startup] MongoDB connection failed:', err.message);
    // Don't exit — the server stays up so Railway doesn't restart-loop.
    // Routes that need the DB will return errors until it reconnects.
  }

  startSLAService();

  // WhatsApp bot is best-effort — don't let it crash the HTTP server.
  try {
    startWhatsAppBot();
  } catch (err) {
    console.error('[Startup] WhatsApp bot failed to start:', err.message);
  }
});
