/**
 * Investment Agent API routes.
 * POST /api/v1/agent/analyze  — full portfolio analysis
 * POST /api/v1/agent/chat     — conversational query with history
 * GET  /api/v1/agent/daily-brief — latest saved daily brief
 */
const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { runInvestmentAgent } = require('../agent/investmentAgent');
const { query } = require('../db/sql');

// Simple in-memory rate limiter: 10 requests per user per hour
const rateLimitMap = new Map(); // userId → { count, resetAt }
const RATE_LIMIT = parseInt(process.env.AGENT_RATE_LIMIT_PER_HOUR || '10', 10);
const HOUR_MS = 60 * 60 * 1000;

function checkRateLimit(userId) {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + HOUR_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

// Ensure agent_analyses table exists (idempotent). Called lazily on first request.
let tableReady = false;
async function ensureAgentTable() {
  if (tableReady) return;
  try {
    await query(`
      IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_NAME = 'agent_analyses'
      )
      CREATE TABLE agent_analyses (
        id            INT IDENTITY(1,1) PRIMARY KEY,
        user_id       INT NOT NULL,
        type          NVARCHAR(20) NOT NULL DEFAULT 'full',
        analysis      NVARCHAR(MAX),
        created_at    DATETIME DEFAULT GETUTCDATE()
      )
    `);
    tableReady = true;
  } catch (err) {
    console.error('[agent] Failed to ensure agent_analyses table:', err.message);
  }
}

// ── GET /test-key (temporary diagnostic) ─────────────────────────────────────
router.get('/test-key', authenticate, async (req, res) => {
  const Anthropic = require('@anthropic-ai/sdk');
  const key = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;
  res.json({
    key_prefix: key ? key.substring(0, 20) + '...' : 'NOT SET',
    key_length: key ? key.length : 0,
  });
});

// ── POST /analyze ────────────────────────────────────────────────────────────
router.post('/analyze', authenticate, async (req, res, next) => {
  try {
    await ensureAgentTable();
    const userId = req.user.id;

    if (!checkRateLimit(userId)) {
      return res.status(429).json({ error: 'Rate limit exceeded. Maximum 10 requests per hour.' });
    }

    const { analysis, recommendations, portfolioHealth, conversationHistory } =
      await runInvestmentAgent({ userId });

    // Persist to DB
    try {
      await query(
        `INSERT INTO agent_analyses (user_id, type, analysis) VALUES (@userId, 'full', @analysis)`,
        { userId, analysis: JSON.stringify(analysis) }
      );
    } catch (dbErr) {
      console.error('[agent] Failed to save analysis:', dbErr.message);
    }

    res.json({ analysis, recommendations, portfolioHealth, conversationHistory });
  } catch (err) {
    console.error('[agent /analyze error]', err.status, err.message);
    if (err.status && err.status >= 400) {
      return res.status(502).json({ error: `AI error ${err.status}: ${err.message}` });
    }
    next(err);
  }
});

// ── POST /chat ───────────────────────────────────────────────────────────────
router.post('/chat', authenticate, async (req, res, next) => {
  try {
    await ensureAgentTable();
    const userId = req.user.id;

    if (!checkRateLimit(userId)) {
      return res.status(429).json({ error: 'Rate limit exceeded. Maximum 10 requests per hour.' });
    }

    const { query: userQuery, conversationHistory = [] } = req.body;
    if (!userQuery || !userQuery.trim()) {
      return res.status(400).json({ error: 'query is required' });
    }

    const result = await runInvestmentAgent({ userId, query: userQuery, conversationHistory });

    // Persist chat result
    try {
      await query(
        `INSERT INTO agent_analyses (user_id, type, analysis) VALUES (@userId, 'chat', @analysis)`,
        { userId, analysis: JSON.stringify({ query: userQuery, response: result.analysis }) }
      );
    } catch (dbErr) {
      console.error('[agent] Failed to save chat:', dbErr.message);
    }

    res.json(result);
  } catch (err) {
    console.error('[agent /chat error]', err.status, err.message);
    if (err.status && err.status >= 400) {
      return res.status(502).json({ error: `AI error ${err.status}: ${err.message}` });
    }
    next(err);
  }
});

// ── GET /daily-brief ─────────────────────────────────────────────────────────
router.get('/daily-brief', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const result = await query(
      `SELECT TOP 1 analysis, created_at FROM agent_analyses
       WHERE user_id = @userId AND type = 'daily'
       ORDER BY created_at DESC`,
      { userId }
    );

    if (!result.recordset.length) {
      return res.json({ brief: null, message: 'No daily brief available yet' });
    }

    const row = result.recordset[0];
    let brief;
    try { brief = JSON.parse(row.analysis); }
    catch { brief = row.analysis; }

    res.json({ brief, created_at: row.created_at });
  } catch (err) {
    next(err);
  }
});

// ── GET /last-analysis ───────────────────────────────────────────────────────
router.get('/last-analysis', authenticate, async (req, res, next) => {
  try {
    await ensureAgentTable();
    const userId = req.user.id;
    const result = await query(
      `SELECT TOP 1 id, analysis, created_at FROM agent_analyses
       WHERE user_id = @userId AND type = 'full'
       ORDER BY created_at DESC`,
      { userId }
    );
    if (!result.recordset.length) return res.json(null);
    const row = result.recordset[0];
    let parsed;
    try { parsed = JSON.parse(row.analysis); } catch { parsed = row.analysis; }
    res.json({ analysis: parsed, created_at: row.created_at });
  } catch (err) { next(err); }
});

// ── GET /history ──────────────────────────────────────────────────────────────
router.get('/history', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const limit = Math.min(parseInt(req.query.limit || '10', 10), 50);
    const result = await query(
      `SELECT TOP (@limit) id, type, created_at,
         LEFT(analysis, 500) AS analysis_preview
       FROM agent_analyses
       WHERE user_id = @userId
       ORDER BY created_at DESC`,
      { userId, limit }
    );
    res.json(result.recordset);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
