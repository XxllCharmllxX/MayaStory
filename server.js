require('dotenv').config();
const express = require('express');
const path = require('path');
const bcrypt = require('bcrypt');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Test database connection
pool.on('connection', () => {
  console.log('Connected to database');
});

pool.on('error', (err) => {
  console.error('Database connection error:', err);
});

app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // Validation
    if (!username || !password) {
      return res.status(400).json({ ok: false, error: 'Username and password are required' });
    }

    // Get user from database
    const { rows } = await pool.query('SELECT id, password, banned FROM accounts WHERE name = $1', [username]);
    if (rows.length === 0) {
      return res.status(401).json({ ok: false, error: 'Invalid username or password' });
    }

    const user = rows[0];

    // Check if banned
    if (user.banned === 1) {
      return res.status(403).json({ ok: false, error: 'Account is banned' });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ ok: false, error: 'Invalid username or password' });
    }

    res.json({ ok: true, message: 'Login successful', accountId: user.id });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ ok: false, error: `Login failed: ${error.message}` });
  }
});

app.post('/api/register', async (req, res) => {
  try {
    const { username, password, email } = req.body;

    // Validation
    if (!username || !password) {
      return res.status(400).json({ ok: false, error: 'Username and password are required' });
    }

    if (username.length < 3 || username.length > 13) {
      return res.status(400).json({ ok: false, error: 'Username must be 3-13 characters' });
    }

    if (password.length < 6 || password.length > 50) {
      return res.status(400).json({ ok: false, error: 'Password must be 6-50 characters' });
    }

    // Check if username exists
    const { rows: existingRows } = await pool.query('SELECT id FROM accounts WHERE name = $1', [username]);
    if (existingRows.length > 0) {
      return res.status(409).json({ ok: false, error: 'Username already exists' });
    }

    // Hash password
    const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Insert new account
    const { rows: resultRows } = await pool.query(
      'INSERT INTO accounts (name, password, email, birthday, gender, creation, banned, loggedin, tos) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id',
      [username, hashedPassword, email || null, '1990-01-01', 0, new Date(), 0, 0, 1]
    );

    res.json({ ok: true, message: 'Account created successfully', accountId: resultRows[0].id });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ ok: false, error: `Registration failed: ${error.message}` });
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Health check
app.get('/health', (req, res) => {
    res.json({ ok: true, message: 'Server is running' });
});

// Database test
app.get('/test-db', async (req, res) => {
  try {
    // Check if DATABASE_URL is set
    if (!process.env.DATABASE_URL) {
      return res.status(500).json({ ok: false, error: 'DATABASE_URL environment variable not set' });
    }

    const { rows } = await pool.query('SELECT NOW() as current_time');
    res.json({ ok: true, time: rows[0].current_time });
  } catch (error) {
    console.error('Database test error:', error);
    res.status(500).json({ ok: false, error: `Database test failed: ${error.message}` });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`MayaStory web server running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  await pool.end();
  process.exit(0);
});
