const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middleware/auth.middleware');
const {
  listReminders,
  createReminder,
  updateReminderStatus,
  deleteReminder,
  sendBroadcast,
  sendReminderNow,
} = require('../controllers/reminders.controller');

router.get('/', requireAuth, requireRole('admin'), listReminders);
router.post('/', requireAuth, requireRole('admin'), createReminder);
router.post('/broadcast', requireAuth, requireRole('admin'), sendBroadcast);
router.post('/:id/send', requireAuth, requireRole('admin'), sendReminderNow);
router.put('/:id', requireAuth, requireRole('admin'), updateReminderStatus);
router.delete('/:id', requireAuth, requireRole('admin'), deleteReminder);

module.exports = router;
