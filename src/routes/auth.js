const express = require('express');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const database = require('../config/database');
const { generateToken, validatePassword, validateEmail } = require('../middleware/auth');

const router = express.Router();

// Register endpoint
router.post('/register', async (req, res) => {
  try {
    const { email, username, displayName, password } = req.body;

    // Validation
    if (!email || !username || !displayName || !password) {
      return res.status(400).json({
        error: 'All fields are required',
        code: 'MISSING_FIELDS'
      });
    }

    if (!validateEmail(email)) {
      return res.status(400).json({
        error: 'Invalid email format',
        code: 'INVALID_EMAIL'
      });
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return res.status(400).json({
        error: passwordValidation.message,
        code: 'INVALID_PASSWORD'
      });
    }

    // Check if user already exists
    const db = database.getDb();
    const existingUser = await new Promise((resolve, reject) => {
      db.get(
        'SELECT id FROM users WHERE email = ? OR username = ?',
        [email, username],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (existingUser) {
      return res.status(409).json({
        error: 'User already exists with this email or username',
        code: 'USER_EXISTS'
      });
    }

    // Hash password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Create user
    const userId = uuidv4();
    const avatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=007AFF&color=fff&size=200`;

    await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO users (id, email, username, display_name, password_hash, avatar)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [userId, email, username, displayName, passwordHash, avatar],
        function(err) {
          if (err) reject(err);
          else resolve(this);
        }
      );
    });

    // Generate token
    const user = {
      id: userId,
      email,
      username,
      displayName,
      avatar,
      verified: false
    };

    const token = generateToken(user);

    res.status(201).json({
      success: true,
      data: {
        user,
        token
      },
      message: 'User registered successfully'
    });

  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'SERVER_ERROR'
    });
  }
});

// Login endpoint
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        error: 'Email and password are required',
        code: 'MISSING_CREDENTIALS'
      });
    }

    // Find user
    const db = database.getDb();
    const user = await new Promise((resolve, reject) => {
      db.get(
        'SELECT * FROM users WHERE email = ?',
        [email],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (!user) {
      return res.status(401).json({
        error: 'Invalid email or password',
        code: 'INVALID_CREDENTIALS'
      });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({
        error: 'Invalid email or password',
        code: 'INVALID_CREDENTIALS'
      });
    }

    // Generate token
    const userResponse = {
      id: user.id,
      email: user.email,
      username: user.username,
      displayName: user.display_name,
      avatar: user.avatar,
      verified: user.verified
    };

    const token = generateToken(userResponse);

    res.json({
      success: true,
      data: {
        user: userResponse,
        token
      },
      message: 'Login successful'
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'SERVER_ERROR'
    });
  }
});

// Get current user profile
router.get('/me', require('../middleware/auth').authenticateToken, async (req, res) => {
  try {
    const db = database.getDb();
    const user = await new Promise((resolve, reject) => {
      db.get(
        'SELECT id, email, username, display_name, avatar, verified, created_at FROM users WHERE id = ?',
        [req.user.userId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    res.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        username: user.username,
        displayName: user.display_name,
        avatar: user.avatar,
        verified: user.verified,
        createdAt: user.created_at
      }
    });

  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'SERVER_ERROR'
    });
  }
});

// Update user profile
router.put('/me', require('../middleware/auth').authenticateToken, async (req, res) => {
  try {
    const { displayName, avatar } = req.body;
    const db = database.getDb();

    const updates = [];
    const values = [];

    if (displayName) {
      updates.push('display_name = ?');
      values.push(displayName);
    }

    if (avatar) {
      updates.push('avatar = ?');
      values.push(avatar);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        error: 'No valid fields to update',
        code: 'NO_UPDATES'
      });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(req.user.userId);

    await new Promise((resolve, reject) => {
      db.run(
        `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
        values,
        function(err) {
          if (err) reject(err);
          else resolve(this);
        }
      );
    });

    // Return updated user
    const updatedUser = await new Promise((resolve, reject) => {
      db.get(
        'SELECT id, email, username, display_name, avatar, verified FROM users WHERE id = ?',
        [req.user.userId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    res.json({
      success: true,
      data: {
        id: updatedUser.id,
        email: updatedUser.email,
        username: updatedUser.username,
        displayName: updatedUser.display_name,
        avatar: updatedUser.avatar,
        verified: updatedUser.verified
      },
      message: 'Profile updated successfully'
    });

  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'SERVER_ERROR'
    });
  }
});

module.exports = router;
