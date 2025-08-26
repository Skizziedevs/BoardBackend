const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/database');
const router = express.Router();

// Admin login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    // Check if admin exists
    const result = await db.query(
      'SELECT * FROM admins WHERE username = $1',
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const admin = result.rows[0];

    // Check password
    const isMatch = await bcrypt.compare(password, admin.password_hash);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Create token
    const token = jwt.sign(
      { id: admin.id, username: admin.username },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.json({
      token,
      admin: {
        id: admin.id,
        username: admin.username
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create initial admin (for setup)
router.post('/setup', async (req, res) => {
  const { username, password } = req.body;

  try {
    // Hash password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Insert admin
    const result = await db.query(
      'INSERT INTO admins (username, password_hash) VALUES ($1, $2) RETURNING id',
      [username, hashedPassword]
    );

    res.status(201).json({ message: 'Admin created successfully' });
  } catch (error) {
    console.error('Setup error:', error);
    
    if (error.code === '23505') { // Unique violation
      return res.status(400).json({ message: 'Username already exists' });
    }
    
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;