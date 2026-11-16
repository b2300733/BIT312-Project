const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middleware/auth.middleware');
const {
  getActivities,
  createActivity,
  updateActivity,
  deleteActivity,
} = require('../controllers/activities.controller');

// Get all activities
router.get('/', requireAuth, getActivities);

// Create a new activity
router.post('/', requireAuth, requireRole('admin'), createActivity);

// Update an activity
router.put('/:id', requireAuth, requireRole('admin'), updateActivity);

// Delete an activity
router.delete('/:id', requireAuth, requireRole('admin'), deleteActivity);

module.exports = router;
