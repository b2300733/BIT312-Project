require('dotenv').config();
const db = require('../config/db');

let broadcastInFlight = false;
const reminderInFlight = new Set();

const getApdUrl = () => process.env.AP_Url;

const sendEmail = async (payload) => {
  const apdUrl = getApdUrl();
  if (!apdUrl) {
    throw new Error('APD_Url is not configured.');
  }

  const response = await fetch(apdUrl, {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error('Email request failed.');
  }
};

const buildScheduledFor = (interval) => {
  const daysMap = { '1-week': 7, '3-day': 3, '1-day': 1 };
  const days = daysMap[interval];
  if (!days) {
    return null;
  }

  const scheduledDate = new Date();
  scheduledDate.setDate(scheduledDate.getDate() + days);
  return `${scheduledDate.toLocaleDateString('en-US')} 05:00 PM`;
};

const listReminders = async (req, res) => {
  try {
    const [reminders] = await db.query(
      'SELECT CAST(id AS CHAR) AS _id, activity, type, scheduledFor, status, createdAt, updatedAt FROM reminders ORDER BY createdAt DESC',
    );
    res.json(reminders);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const createReminder = async (req, res) => {
  try {
    const activity = req.body?.activity?.trim();
    const type = req.body?.type?.trim() || req.body?.interval?.trim();
    const scheduledFor = req.body?.scheduledFor?.trim() || buildScheduledFor(type);

    if (!activity || !type || !scheduledFor) {
      return res.status(400).json({ message: 'activity, type, and scheduledFor are required.' });
    }

    const [result] = await db.query(
      'INSERT INTO reminders (activity, type, scheduledFor, status) VALUES (?, ?, ?, ?)',
      [activity, type, scheduledFor, 'pending'],
    );

    const [rows] = await db.query(
      'SELECT CAST(id AS CHAR) AS _id, activity, type, scheduledFor, status, createdAt, updatedAt FROM reminders WHERE id = ?',
      [result.insertId],
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const updateReminderStatus = async (req, res) => {
  try {
    const status = req.body?.status?.trim();
    if (!status || !['sent', 'pending'].includes(status)) {
      return res.status(400).json({ message: 'status must be sent or pending.' });
    }

    const [result] = await db.query('UPDATE reminders SET status = ? WHERE id = ?', [
      status,
      req.params.id,
    ]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Reminder not found.' });
    }

    const [rows] = await db.query(
      'SELECT CAST(id AS CHAR) AS _id, activity, type, scheduledFor, status, createdAt, updatedAt FROM reminders WHERE id = ?',
      [req.params.id],
    );

    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const deleteReminder = async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM reminders WHERE id = ?', [req.params.id]);
    const reminder = rows[0];
    if (!reminder) {
      return res.status(404).json({ message: 'Reminder not found.' });
    }

    if (reminder.status === 'sent') {
      return res.status(409).json({ message: 'Sent reminders cannot be deleted.' });
    }

    const reminderIdStr = String(reminder.id);
    if (reminderInFlight.has(reminderIdStr)) {
      return res.status(409).json({ message: 'Reminder is currently sending. Please wait.' });
    }

    await db.query('DELETE FROM reminders WHERE id = ?', [reminder.id]);
    res.json({ message: 'Reminder deleted.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const sendBroadcast = async (req, res) => {
  try {
    const title = req.body?.title?.trim();
    const message = req.body?.message?.trim();

    if (!title || !message) {
      return res.status(400).json({ message: 'title and message are required.' });
    }

    if (broadcastInFlight) {
      return res.status(429).json({ message: 'Broadcast is already being sent. Please wait.' });
    }

    broadcastInFlight = true;

    const [users] = await db.query('SELECT email FROM users WHERE role = ?', ['employee']);
    const emails = users.map((user) => user.email).filter(Boolean);

    if (!emails.length) {
      broadcastInFlight = false;
      return res.json({ sent: 0 });
    }

    await Promise.all(emails.map((to) => sendEmail({ action: 'broadcast', title, message, to })));

    broadcastInFlight = false;

    res.json({ sent: emails.length });
  } catch (err) {
    broadcastInFlight = false;
    res.status(500).json({ message: err.message });
  }
};

const sendReminderNow = async (req, res) => {
  try {
    const [remRows] = await db.query('SELECT * FROM reminders WHERE id = ?', [req.params.id]);
    const reminder = remRows[0];
    if (!reminder) {
      return res.status(404).json({ message: 'Reminder not found.' });
    }

    if (reminder.status === 'sent') {
      return res.status(409).json({ message: 'Reminder has already been sent.' });
    }

    const reminderIdStr = String(reminder.id);
    if (reminderInFlight.has(reminderIdStr)) {
      return res.status(429).json({ message: 'Reminder is already being sent. Please wait.' });
    }

    reminderInFlight.add(reminderIdStr);

    const [actRows] = await db.query(
      'SELECT id, name, serviceType, scheduleDate, scheduleTime, location FROM activities WHERE name = ? LIMIT 1',
      [reminder.activity],
    );
    const activity = actRows[0];
    if (!activity) {
      reminderInFlight.delete(reminderIdStr);
      return res.status(404).json({ message: 'Activity not found.' });
    }

    const [regRows] = await db.query(
      `SELECT u.email
       FROM registrations r
       INNER JOIN users u ON r.employeeId = u.id
       WHERE r.activityId = ?`,
      [activity.id],
    );

    const emails = regRows.map((row) => row.email).filter(Boolean);

    if (!emails.length) {
      reminderInFlight.delete(reminderIdStr);
      return res.json({ sent: 0 });
    }

    await Promise.all(
      emails.map((to) =>
        sendEmail({
          action: 'reminder',
          activity: reminder.activity,
          scheduleDate: activity.scheduleDate,
          scheduleTime: activity.scheduleTime,
          location: activity.location,
          serviceType: activity.serviceType,
          to,
        }),
      ),
    );

    await db.query('UPDATE reminders SET status = ? WHERE id = ?', ['sent', reminder.id]);

    const [updatedRows] = await db.query(
      'SELECT CAST(id AS CHAR) AS _id, activity, type, scheduledFor, status, createdAt, updatedAt FROM reminders WHERE id = ?',
      [reminder.id],
    );

    reminderInFlight.delete(reminderIdStr);

    res.json({ sent: emails.length, reminder: updatedRows[0] });
  } catch (err) {
    if (req.params?.id) {
      reminderInFlight.delete(String(req.params.id));
    }
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  listReminders,
  createReminder,
  updateReminderStatus,
  deleteReminder,
  sendBroadcast,
  sendReminderNow,
};
