// server/routes/auth.js
const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query, sql } = require('../db/sql');
const { authenticate } = require('../middleware/auth');

// POST /api/v1/auth/register
router.post('/register', async (req, res, next) => {
  try {
    const { email, full_name, password, role = 'regular_user' } = req.body;

    if (!email || !full_name || !password)
      return res.status(400).json({ error: 'email, full_name and password are required' });

    // Check if email taken
    const existing = await query(
      'SELECT id FROM users WHERE email = @email',
      { email }
    );
    if (existing.recordset.length > 0)
      return res.status(409).json({ error: 'Email already registered' });

    const password_hash = await bcrypt.hash(password, 12);

    const result = await query(`
      INSERT INTO users (email, full_name, password_hash, role)
      OUTPUT INSERTED.id, INSERTED.email, INSERTED.full_name, INSERTED.role,
             INSERTED.display_currency, INSERTED.language, INSERTED.created_at
      VALUES (@email, @full_name, @password_hash, @role)
    `, { email, full_name, password_hash, role });

    const user = result.recordset[0];
    const token = signToken(user);

    res.status(201).json({ user, token });
  } catch (err) { next(err); }
});

// POST /api/v1/auth/login
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password)
      return res.status(400).json({ error: 'email and password are required' });

    const result = await query(
      'SELECT * FROM users WHERE email = @email AND is_active = 1',
      { email }
    );

    const user = result.recordset[0];
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const { password_hash, ...safeUser } = user;
    const token = signToken(safeUser);

    res.json({ user: safeUser, token });
  } catch (err) { next(err); }
});

// GET /api/v1/auth/me
router.get('/me', authenticate, async (req, res, next) => {
  try {
    const result = await query(
      `SELECT id, email, full_name, role, planner_id, display_currency, language, ai_data_access, created_at
       FROM users WHERE id = @id`,
      { id: req.user.id }
    );
    if (!result.recordset[0]) return res.status(404).json({ error: 'User not found' });
    res.json(result.recordset[0]);
  } catch (err) { next(err); }
});

// PUT /api/v1/auth/me
router.put('/me', authenticate, async (req, res, next) => {
  try {
    const { full_name, display_currency, language, ai_data_access } = req.body;
    const result = await query(`
      UPDATE users
      SET full_name = ISNULL(@full_name, full_name),
          display_currency = ISNULL(@display_currency, display_currency),
          language = ISNULL(@language, language),
          ai_data_access = ISNULL(@ai_data_access, ai_data_access),
          updated_at = GETUTCDATE()
      OUTPUT INSERTED.id, INSERTED.email, INSERTED.full_name, INSERTED.role,
             INSERTED.display_currency, INSERTED.language, INSERTED.ai_data_access
      WHERE id = @id
    `, { id: req.user.id, full_name, display_currency, language, ai_data_access });

    res.json(result.recordset[0]);
  } catch (err) { next(err); }
});

function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

module.exports = router;
