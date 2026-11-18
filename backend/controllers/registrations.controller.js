require('dotenv').config();
const crypto = require('crypto');
const db = require('../config');

const isValidSqlId = (val) => /^\d+$/.test(String(val || '').trim());

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

const formatDateParts = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return { date: '', time: '' };
  }

  const pad = (num) => String(num).padStart(2, '0');
  const datePart = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const timePart = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  return { date: datePart, time: timePart };
};

const mapCheckInRecords = (rows) =>
  rows.map((row) => ({
    _id: String(row.id),
    employeeId: String(row.employeeId),
    employeeName: row.employeeName,
    email: row.email,
    department: row.department,
    activityId: String(row.activityId),
    activityName: row.activityName,
    qrData: row.qrData ?? null,
    qrchecked: Boolean(row.qrchecked),
    status: row.qrchecked ? 'checked-in' : 'pending',
    checkedInAt: row.checkedInAt ? new Date(row.checkedInAt).toISOString() : null,
  }));

const buildQrPayload = (activityId, employeeId) =>
  `serviceday:${activityId}:${employeeId}:${crypto.randomUUID()}`;

const buildQrImageUrl = (qrData) =>
  `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrData)}`;

const listRegistrations = async (req, res) => {
  try {
    const employeeId = req.query.employeeId?.trim();
    if (!employeeId) {
      return res.status(400).json({ message: 'employeeId is required.' });
    }

    if (req.user?.role !== 'admin' && req.user?._id !== employeeId) {
      return res.status(403).json({ message: 'Forbidden.' });
    }

    if (!isValidSqlId(employeeId)) {
      return res.status(400).json({ message: 'employeeId must be a valid id.' });
    }

    const [rows] = await db.query(
      `SELECT CAST(id AS CHAR) AS _id, CAST(employeeId AS CHAR) AS employeeId, CAST(activityId AS CHAR) AS activityId,
              qrData, qrGeneratedAt, CAST(qrchecked AS UNSIGNED) AS qrchecked, checkedInAt, createdAt, updatedAt
       FROM registrations WHERE employeeId = ?`,
      [employeeId],
    );

    const formatted = rows.map((r) => ({ ...r, qrchecked: Boolean(r.qrchecked) }));
    res.json(formatted);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const listRegistrationsWithActivity = async (req, res) => {
  try {
    const employeeId = req.query.employeeId?.trim();
    if (!employeeId) {
      return res.status(400).json({ message: 'employeeId is required.' });
    }

    if (req.user?.role !== 'admin' && req.user?._id !== employeeId) {
      return res.status(403).json({ message: 'Forbidden.' });
    }

    if (!isValidSqlId(employeeId)) {
      return res.status(400).json({ message: 'employeeId must be a valid id.' });
    }

    const [rows] = await db.query(
      `SELECT r.id, r.employeeId, r.createdAt, r.updatedAt,
              a.id AS act_id, a.name, a.serviceType, a.scheduleDate, a.scheduleTime,
              a.location, a.description, a.cutoffDate, a.cutoffTime
       FROM registrations r
       INNER JOIN activities a ON r.activityId = a.id
       WHERE r.employeeId = ?`,
      [employeeId],
    );

    const result = rows.map((row) => ({
      _id: String(row.id),
      employeeId: String(row.employeeId),
      activity: {
        _id: String(row.act_id),
        name: row.name,
        serviceType: row.serviceType,
        scheduleDate: row.scheduleDate,
        scheduleTime: row.scheduleTime,
        location: row.location,
        description: row.description,
        cutoffDate: row.cutoffDate,
        cutoffTime: row.cutoffTime,
      },
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));

    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const listRegistrationsWithEmployee = async (req, res) => {
  try {
    const activityId = req.query.activityId?.trim();
    let sql = `
      SELECT r.id, r.qrData, r.qrchecked, r.checkedInAt, r.createdAt, r.updatedAt,
             u.name AS employeeName, u.email, u.department,
             a.name AS activityName
      FROM registrations r
      INNER JOIN users u ON r.employeeId = u.id
      INNER JOIN activities a ON r.activityId = a.id
    `;
    const params = [];

    if (activityId) {
      if (!isValidSqlId(activityId)) {
        return res.status(400).json({ message: 'activityId must be a valid id.' });
      }
      sql += ' WHERE r.activityId = ?';
      params.push(activityId);
    }

    const [rows] = await db.query(sql, params);

    const result = rows.map((row) => {
      const { date, time } = formatDateParts(row.createdAt || row.updatedAt);
      return {
        _id: String(row.id),
        employeeName: row.employeeName,
        email: row.email,
        department: row.department,
        activity: row.activityName,
        registeredDate: date,
        registeredTime: time,
        qrData: row.qrData ?? null,
        qrchecked: Boolean(row.qrchecked),
        status: row.qrchecked ? 'checked-in' : 'pending',
        checkedInAt: row.checkedInAt ? new Date(row.checkedInAt).toISOString() : null,
      };
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const checkInByQrData = async (req, res) => {
  try {
    const qrData = req.body?.qrData?.trim();
    if (!qrData) {
      return res.status(400).json({ message: 'qrData is required.' });
    }

    const [rows] = await db.query(
      `SELECT r.id, r.employeeId, r.activityId, r.qrData, r.qrchecked, r.checkedInAt,
              u.name AS employeeName, u.email, u.department,
              a.name AS activityName
       FROM registrations r
       INNER JOIN users u ON r.employeeId = u.id
       INNER JOIN activities a ON r.activityId = a.id
       WHERE r.qrData = ?`,
      [qrData],
    );

    const registration = rows[0];
    if (!registration) {
      return res.status(404).json({ message: 'QR code not found.' });
    }

    if (!registration.qrchecked) {
      const now = new Date();
      await db.query('UPDATE registrations SET qrchecked = TRUE, checkedInAt = ? WHERE id = ?', [
        now,
        registration.id,
      ]);
      registration.qrchecked = true;
      registration.checkedInAt = now;
    }

    res.json(mapCheckInRecords([registration])[0]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const generateQrCodesForActivity = async (req, res) => {
  try {
    const activityId = req.body?.activityId?.trim();
    if (!activityId) {
      return res.status(400).json({ message: 'activityId is required.' });
    }

    if (!isValidSqlId(activityId)) {
      return res.status(400).json({ message: 'activityId must be a valid id.' });
    }

    const [actRows] = await db.query('SELECT * FROM activities WHERE id = ?', [activityId]);
    const activity = actRows[0];
    if (!activity) {
      return res.status(404).json({ message: 'Activity not found.' });
    }

    const cutoffDateTime = new Date(`${activity.cutoffDate}T${activity.cutoffTime}`);
    if (!Number.isNaN(cutoffDateTime.getTime()) && cutoffDateTime > new Date()) {
      return res.status(409).json({
        message: `Cannot generate QR codes before cutoff time (${activity.cutoffDate} at ${activity.cutoffTime}).`,
      });
    }

    const [pendingRows] = await db.query(
      'SELECT id, employeeId FROM registrations WHERE activityId = ? AND (qrData IS NULL OR qrData = "")',
      [activityId],
    );

    const now = new Date();
    for (const reg of pendingRows) {
      const qrPayload = buildQrPayload(activityId, reg.employeeId);
      await db.query(
        'UPDATE registrations SET qrData = ?, qrGeneratedAt = ? WHERE id = ? AND (qrData IS NULL OR qrData = "")',
        [qrPayload, now, reg.id],
      );
    }

    const [refreshed] = await db.query(
      `SELECT r.id, r.employeeId, r.activityId, r.qrData, r.qrchecked, r.checkedInAt,
              u.name AS employeeName, u.email, u.department,
              a.name AS activityName
       FROM registrations r
       INNER JOIN users u ON r.employeeId = u.id
       INNER JOIN activities a ON r.activityId = a.id
       WHERE r.activityId = ?`,
      [activityId],
    );

    const records = mapCheckInRecords(refreshed);

    const emailTargets = records.filter((record) => record.email && record.qrData);
    if (emailTargets.length) {
      await Promise.all(
        emailTargets.map((record) =>
          sendEmail({
            action: 'qr',
            to: record.email,
            employeeName: record.employeeName,
            activity: record.activityName,
            activityId,
            serviceType: activity.serviceType,
            scheduleDate: activity.scheduleDate,
            scheduleTime: activity.scheduleTime,
            location: activity.location,
            qrData: record.qrData,
            qrImageUrl: buildQrImageUrl(record.qrData),
          }).catch((err) => {
            console.error(`QR email failed for ${record.email}:`, err);
          }),
        ),
      );
    }

    res.json(records);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const createRegistration = async (req, res) => {
  const conn = await db.getConnection();
  try {
    const employeeId = req.body?.employeeId?.trim();
    const activityId = req.body?.activityId?.trim();

    if (!employeeId || !activityId) {
      return res.status(400).json({ message: 'employeeId and activityId are required.' });
    }

    if (!isValidSqlId(employeeId)) {
      return res.status(400).json({ message: 'employeeId must be a valid id.' });
    }

    if (!isValidSqlId(activityId)) {
      return res.status(400).json({ message: 'activityId must be a valid id.' });
    }

    if (req.user?.role !== 'admin' && req.user?._id !== employeeId) {
      return res.status(403).json({ message: 'Forbidden.' });
    }

    await conn.beginTransaction();

    const [empRows] = await conn.query('SELECT id, name, email FROM users WHERE id = ?', [
      employeeId,
    ]);
    const employee = empRows[0];
    if (!employee) {
      await conn.rollback();
      return res.status(404).json({ message: 'Employee not found.' });
    }

    const [actRows] = await conn.query('SELECT * FROM activities WHERE id = ? FOR UPDATE', [
      activityId,
    ]);
    const activity = actRows[0];
    if (!activity) {
      await conn.rollback();
      return res.status(404).json({ message: 'Activity not found.' });
    }

    if (activity.registered >= activity.totalSlots) {
      await conn.rollback();
      return res.status(409).json({ message: 'No slots available.' });
    }

    const [existingRows] = await conn.query(
      'SELECT id FROM registrations WHERE employeeId = ? AND activityId = ?',
      [employeeId, activityId],
    );
    if (existingRows.length > 0) {
      await conn.rollback();
      return res.status(409).json({ message: 'Registration already exists.' });
    }

    const [insertRes] = await conn.query(
      'INSERT INTO registrations (employeeId, activityId) VALUES (?, ?)',
      [employeeId, activityId],
    );
    await conn.query('UPDATE activities SET registered = registered + 1 WHERE id = ?', [
      activityId,
    ]);

    await conn.commit();

    const [createdRows] = await db.query(
      `SELECT CAST(id AS CHAR) AS _id, CAST(employeeId AS CHAR) AS employeeId, CAST(activityId AS CHAR) AS activityId,
              qrData, qrGeneratedAt, qrchecked, checkedInAt, createdAt, updatedAt
       FROM registrations WHERE id = ?`,
      [insertRes.insertId],
    );

    if (employee.email) {
      try {
        await sendEmail({
          action: 'registration',
          to: employee.email,
          employeeName: employee.name,
          activity: activity.name,
          scheduleDate: activity.scheduleDate,
          scheduleTime: activity.scheduleTime,
          location: activity.location,
          serviceType: activity.serviceType,
        });
      } catch (err) {
        console.error('Registration email failed:', err);
      }
    }

    res.status(201).json({ ...createdRows[0], qrchecked: Boolean(createdRows[0].qrchecked) });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ message: err.message });
  } finally {
    conn.release();
  }
};

const deleteRegistration = async (req, res) => {
  const conn = await db.getConnection();
  try {
    const employeeId = req.query.employeeId?.trim();
    const activityId = req.query.activityId?.trim();

    if (!employeeId || !activityId) {
      return res.status(400).json({ message: 'employeeId and activityId are required.' });
    }

    if (!isValidSqlId(employeeId)) {
      return res.status(400).json({ message: 'employeeId must be a valid id.' });
    }

    if (!isValidSqlId(activityId)) {
      return res.status(400).json({ message: 'activityId must be a valid id.' });
    }

    if (req.user?.role !== 'admin' && req.user?._id !== employeeId) {
      return res.status(403).json({ message: 'Forbidden.' });
    }

    await conn.beginTransaction();

    const [empRows] = await conn.query('SELECT id, name, email FROM users WHERE id = ?', [
      employeeId,
    ]);
    const employee = empRows[0];
    if (!employee) {
      await conn.rollback();
      return res.status(404).json({ message: 'Employee not found.' });
    }

    const [actRows] = await conn.query('SELECT * FROM activities WHERE id = ? FOR UPDATE', [
      activityId,
    ]);
    const activity = actRows[0];
    if (!activity) {
      await conn.rollback();
      return res.status(404).json({ message: 'Activity not found.' });
    }

    const cutoffDateTime = new Date(`${activity.cutoffDate}T${activity.cutoffTime}`);
    if (!Number.isNaN(cutoffDateTime.getTime()) && cutoffDateTime < new Date()) {
      await conn.rollback();
      return res.status(409).json({ message: 'Cancellation cutoff has passed.' });
    }

    const [delRes] = await conn.query(
      'DELETE FROM registrations WHERE employeeId = ? AND activityId = ?',
      [employeeId, activityId],
    );
    if (delRes.affectedRows === 0) {
      await conn.rollback();
      return res.status(404).json({ message: 'Registration not found.' });
    }

    if (activity.registered > 0) {
      await conn.query('UPDATE activities SET registered = registered - 1 WHERE id = ?', [
        activityId,
      ]);
    }

    await conn.commit();

    if (employee.email) {
      try {
        await sendEmail({
          action: 'cancellation',
          to: employee.email,
          employeeName: employee.name,
          activity: activity.name,
          scheduleDate: activity.scheduleDate,
          scheduleTime: activity.scheduleTime,
          location: activity.location,
          serviceType: activity.serviceType,
        });
      } catch (err) {
        console.error('Cancellation email failed:', err);
      }
    }

    res.json({ message: 'Registration deleted.' });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ message: err.message });
  } finally {
    conn.release();
  }
};

module.exports = {
  listRegistrations,
  listRegistrationsWithActivity,
  listRegistrationsWithEmployee,
  generateQrCodesForActivity,
  checkInByQrData,
  createRegistration,
  deleteRegistration,
};
