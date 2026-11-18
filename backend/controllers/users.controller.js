const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config');

const getJwtSecret = () => process.env.JWT_SECRET;

const setAuthCookie = (res, token) => {
  res.cookie('auth_token', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: false,
    maxAge: 8 * 60 * 60 * 1000,
  });
};

const listUsers = async (req, res) => {
  try {
    const [users] = await db.query(
      'SELECT CAST(id AS CHAR) AS _id, name, email, department, role, createdAt, updatedAt FROM users',
    );
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getUserByEmail = async (req, res) => {
  try {
    const email = req.query.email?.trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ message: 'email is required.' });
    }

    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized.' });
    }

    if (req.user.role !== 'admin' && req.user.email !== email) {
      return res.status(403).json({ message: 'Forbidden.' });
    }

    const [rows] = await db.query(
      'SELECT CAST(id AS CHAR) AS _id, name, email, department, role, createdAt, updatedAt FROM users WHERE email = ?',
      [email],
    );

    if (!rows.length) {
      return res.status(404).json({ message: 'User not found.' });
    }

    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const createUser = async (req, res) => {
  try {
    const name = req.body?.name?.trim();
    const email = req.body?.email?.trim().toLowerCase();
    const password = req.body?.password?.trim();
    const department = req.body?.department?.trim();
    const role = req.body?.role?.trim() || 'employee';

    if (!name || !email || !password || !department) {
      return res.status(400).json({ message: 'All fields are required.' });
    }

    const [existing] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(409).json({ message: 'Email already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const [result] = await db.query(
      'INSERT INTO users (name, email, passwordHash, department, role) VALUES (?, ?, ?, ?, ?)',
      [name, email, passwordHash, department, role],
    );

    const [createdRows] = await db.query(
      'SELECT CAST(id AS CHAR) AS _id, name, email, department, role, createdAt FROM users WHERE id = ?',
      [result.insertId],
    );

    res.status(201).json(createdRows[0]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const loginUser = async (req, res) => {
  try {
    const email = req.body?.email?.trim().toLowerCase();
    const password = req.body?.password?.trim();

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    const [rows] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    const user = rows[0];
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    const matches = await bcrypt.compare(password, user.passwordHash);
    if (!matches) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    const secret = getJwtSecret();
    if (!secret) {
      return res.status(500).json({ message: 'JWT_SECRET is not configured.' });
    }

    const userIdStr = String(user.id);
    const token = jwt.sign(
      {
        _id: userIdStr,
        email: user.email,
        role: user.role,
        name: user.name,
        department: user.department,
      },
      secret,
      { expiresIn: '8h' },
    );

    setAuthCookie(res, token);

    res.json({
      _id: userIdStr,
      name: user.name,
      email: user.email,
      department: user.department,
      role: user.role,
      createdAt: user.createdAt,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getMe = async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Unauthorized.' });
  }

  return res.json({
    _id: req.user._id,
    name: req.user.name,
    email: req.user.email,
    department: req.user.department,
    role: req.user.role,
  });
};

const logoutUser = async (req, res) => {
  res.clearCookie('auth_token', { httpOnly: true, sameSite: 'lax', secure: false });
  res.json({ message: 'Logged out.' });
};

module.exports = {
  listUsers,
  createUser,
  getUserByEmail,
  loginUser,
  getMe,
  logoutUser,
};
