const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middleware/auth.middleware');
const {
  listUsers,
  createUser,
  getUserByEmail,
  loginUser,
  getMe,
  logoutUser,
} = require('../controllers/users.controller');

router.post('/login', loginUser);
router.post('/logout', requireAuth, logoutUser);
router.get('/me', requireAuth, getMe);
router.get('/', requireAuth, requireRole('admin'), listUsers);
router.get('/by-email', requireAuth, getUserByEmail);
router.post('/', requireAuth, requireRole('admin'), createUser);

module.exports = router;
