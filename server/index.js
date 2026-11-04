const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const express = require('express');
const cors = require('cors');

const db = require('./db');
const authRoutes = require('./routes/auth');
const { requireAuth } = require('./auth');
const aiRoutes = require('./routes/ai');
const uploadRoutes = require('./routes/upload');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/', (req, res) => res.sendFile(path.join(__dirname, '../public/login.html')));
app.get('/app', requireAuth, (req, res) => res.sendFile(path.join(__dirname, '../public/index.html')));
app.get('/index.html', requireAuth, (req, res) => res.sendFile(path.join(__dirname, '../public/index.html')));
app.get('/resume.html', requireAuth, (req, res) => res.sendFile(path.join(__dirname, '../public/resume.html')));

app.use('/api/auth', authRoutes);
app.use('/api', requireAuth);

// ✅ NEW: Chatbot API Endpoint for Resume Assistance
app.post('/api/chat', async (req, res) => {
  const userMessage = req.body.message;

  if (!userMessage) {
    return res.status(400).json({ error: 'Message is required' });
  }

  try {
    const prompt = `
      You are a professional resume writing assistant. Help users generate:
      - Professional summaries
      - Skills sections
      - Bullet points for work experience
      - Education or certification phrasing
      - Project descriptions

      Keep responses concise, polished, and ready to copy-paste into a resume.
      Avoid markdown, lists with bullets — use plain professional language.
      If asked for multiple items, separate with line breaks.

      User asks: ${userMessage}
    `;
    const { generateText } = require('./services/openaiService');
    const text = await generateText(prompt, 'You are a professional resume writing assistant.');
    res.json({ reply: text.trim() });
  } catch (error) {
    console.error('OpenAI API Error:', error.message);
    res.status(error.status || 500).json({ error: error.status === 503 ? error.message : 'Failed to get AI response. Check server logs.' });
  }
});

// ✅ Routes — AFTER middleware
app.use('/api', aiRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/resume', require('./routes/resume'));

const UPLOADS_DIR = process.env.UPLOADS_DIR ||
  path.join(__dirname, '../uploads');

app.use('/uploads', requireAuth, express.static(UPLOADS_DIR));
app.use(express.static(path.join(__dirname, '../public'), { index: false }));

db.initializeDatabase
  .then(() => {
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  })
  .catch(error => {
    console.error('❌ Database initialization failed:', error);
    process.exitCode = 1;
  });
