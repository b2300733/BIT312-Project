const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middleware/auth.middleware');
const {
  listRegistrations,
  listRegistrationsWithActivity,
  listRegistrationsWithEmployee,
  generateQrCodesForActivity,
  checkInByQrData,
  createRegistration,
  deleteRegistration,
} = require('../controllers/registrations.controller');

router.get('/', requireAuth, listRegistrations);
router.get('/with-activity', requireAuth, listRegistrationsWithActivity);
router.get('/with-employee', requireAuth, requireRole('admin'), listRegistrationsWithEmployee);
router.post('/generate-qr', requireAuth, requireRole('admin'), generateQrCodesForActivity);
router.post('/check-in', requireAuth, requireRole('admin'), checkInByQrData);
router.post('/', requireAuth, createRegistration);
router.delete('/', requireAuth, deleteRegistration);

module.exports = router;
