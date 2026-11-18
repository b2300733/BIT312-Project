const db = require('../config');

const trimActivityPayload = (payload = {}) => ({
  ...payload,
  name: typeof payload.name === 'string' ? payload.name.trim() : payload.name,
  serviceType:
    typeof payload.serviceType === 'string' ? payload.serviceType.trim() : payload.serviceType,
  scheduleDate:
    typeof payload.scheduleDate === 'string' ? payload.scheduleDate.trim() : payload.scheduleDate,
  scheduleTime:
    typeof payload.scheduleTime === 'string' ? payload.scheduleTime.trim() : payload.scheduleTime,
  location: typeof payload.location === 'string' ? payload.location.trim() : payload.location,
  cutoffDate:
    typeof payload.cutoffDate === 'string' ? payload.cutoffDate.trim() : payload.cutoffDate,
  cutoffTime:
    typeof payload.cutoffTime === 'string' ? payload.cutoffTime.trim() : payload.cutoffTime,
  description:
    typeof payload.description === 'string' ? payload.description.trim() : payload.description,
});

const isCutoffPassed = (activity) => {
  if (!activity?.cutoffDate || !activity?.cutoffTime) {
    return false;
  }

  const cutoffDateTime = new Date(`${activity.cutoffDate}T${activity.cutoffTime}`);
  return Number.isNaN(cutoffDateTime.getTime()) ? false : cutoffDateTime < new Date();
};

const getActivities = async (req, res) => {
  try {
    const [activities] = await db.query(
      'SELECT CAST(id AS CHAR) AS _id, name, serviceType, scheduleDate, scheduleTime, location, registered, totalSlots, cutoffDate, cutoffTime, description, createdAt, updatedAt FROM activities',
    );
    res.json(activities);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const createActivity = async (req, res) => {
  try {
    const data = trimActivityPayload(req.body);
    const totalSlots = Number(data.totalSlots);

    if (
      !data.name ||
      !data.serviceType ||
      !data.scheduleDate ||
      !data.scheduleTime ||
      !data.location ||
      !Number.isFinite(totalSlots) ||
      totalSlots < 1 ||
      !data.cutoffDate ||
      !data.cutoffTime ||
      !data.description
    ) {
      return res
        .status(400)
        .json({ message: 'All activity fields are required and totalSlots must be >= 1.' });
    }

    const [result] = await db.query(
      `INSERT INTO activities 
       (name, serviceType, scheduleDate, scheduleTime, location, registered, totalSlots, cutoffDate, cutoffTime, description) 
       VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?)`,
      [
        data.name,
        data.serviceType,
        data.scheduleDate,
        data.scheduleTime,
        data.location,
        totalSlots,
        data.cutoffDate,
        data.cutoffTime,
        data.description,
      ],
    );

    const [rows] = await db.query(
      'SELECT CAST(id AS CHAR) AS _id, name, serviceType, scheduleDate, scheduleTime, location, registered, totalSlots, cutoffDate, cutoffTime, description, createdAt, updatedAt FROM activities WHERE id = ?',
      [result.insertId],
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

const updateActivity = async (req, res) => {
  try {
    const [existingRows] = await db.query('SELECT * FROM activities WHERE id = ?', [req.params.id]);
    const existingActivity = existingRows[0];
    if (!existingActivity) return res.status(404).json({ message: 'Activity not found' });

    if (isCutoffPassed(existingActivity)) {
      return res.status(409).json({ message: 'Activity cutoff has passed.' });
    }

    const requestedTotalSlots = Number(req.body?.totalSlots);
    if (Number.isFinite(requestedTotalSlots) && requestedTotalSlots < existingActivity.registered) {
      return res.status(409).json({
        message: `Total slots cannot be lower than the number of registered employees (${existingActivity.registered}).`,
      });
    }

    const data = trimActivityPayload(req.body);
    const updatedFields = {
      name: data.name ?? existingActivity.name,
      serviceType: data.serviceType ?? existingActivity.serviceType,
      scheduleDate: data.scheduleDate ?? existingActivity.scheduleDate,
      scheduleTime: data.scheduleTime ?? existingActivity.scheduleTime,
      location: data.location ?? existingActivity.location,
      totalSlots: Number.isFinite(requestedTotalSlots)
        ? requestedTotalSlots
        : existingActivity.totalSlots,
      cutoffDate: data.cutoffDate ?? existingActivity.cutoffDate,
      cutoffTime: data.cutoffTime ?? existingActivity.cutoffTime,
      description: data.description ?? existingActivity.description,
    };

    await db.query(
      `UPDATE activities 
       SET name = ?, serviceType = ?, scheduleDate = ?, scheduleTime = ?, location = ?, totalSlots = ?, cutoffDate = ?, cutoffTime = ?, description = ?
       WHERE id = ?`,
      [
        updatedFields.name,
        updatedFields.serviceType,
        updatedFields.scheduleDate,
        updatedFields.scheduleTime,
        updatedFields.location,
        updatedFields.totalSlots,
        updatedFields.cutoffDate,
        updatedFields.cutoffTime,
        updatedFields.description,
        req.params.id,
      ],
    );

    const [rows] = await db.query(
      'SELECT CAST(id AS CHAR) AS _id, name, serviceType, scheduleDate, scheduleTime, location, registered, totalSlots, cutoffDate, cutoffTime, description, createdAt, updatedAt FROM activities WHERE id = ?',
      [req.params.id],
    );

    res.json(rows[0]);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

const deleteActivity = async (req, res) => {
  try {
    const [existingRows] = await db.query('SELECT * FROM activities WHERE id = ?', [req.params.id]);
    const activity = existingRows[0];
    if (!activity) return res.status(404).json({ message: 'Activity not found' });

    if (isCutoffPassed(activity)) {
      return res.status(409).json({ message: 'Activity cutoff has passed.' });
    }

    const [regCountRows] = await db.query(
      'SELECT COUNT(*) AS count FROM registrations WHERE activityId = ?',
      [req.params.id],
    );
    const deletedCount = regCountRows[0]?.count ?? 0;

    // ON DELETE CASCADE in schema.sql automatically removes linked registrations
    await db.query('DELETE FROM activities WHERE id = ?', [req.params.id]);

    res.json({
      message: 'Activity deleted',
      deletedRegistrations: deletedCount,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  getActivities,
  createActivity,
  updateActivity,
  deleteActivity,
};
