const express = require('express');
const db = require('../config/database');
const auth = require('../middleware/auth');
const router = express.Router();

// Get all events
router.get('/', async (req, res) => {
  const { month, year } = req.query;
  
  try {
    let query = `
      SELECT e.*, adm.username as author 
      FROM events e 
      LEFT JOIN admins adm ON e.admin_id = adm.id
    `;
    let queryParams = [];
    let paramCount = 0;
    
    if (month && year) {
      query += ` WHERE EXTRACT(MONTH FROM e.event_date) = $${++paramCount} AND EXTRACT(YEAR FROM e.event_date) = $${++paramCount}`;
      queryParams.push(month, year);
    }
    
    query += ' ORDER BY e.event_date ASC, e.event_time ASC';
    
    const result = await db.query(query, queryParams);
    res.json(result.rows);
  } catch (error) {
    console.error('Get events error:', error);
    res.status(500).json({ message: 'Database error', error: error.message });
  }
});

// Get events for a specific date
router.get('/date/:date', async (req, res) => {
  const { date } = req.params;
  
  try {
    const result = await db.query(
      `SELECT e.*, adm.username as author 
       FROM events e 
       LEFT JOIN admins adm ON e.admin_id = adm.id 
       WHERE e.event_date = $1 
       ORDER BY e.event_time ASC`,
      [date]
    );
    
    res.json(result.rows);
  } catch (error) {
    console.error('Get events by date error:', error);
    res.status(500).json({ message: 'Database error', error: error.message });
  }
});

// Create event (Admin only)
router.post('/', auth, async (req, res) => {
  const { title, description, event_date, event_time, location } = req.body;
  
  if (!title || !event_date) {
    return res.status(400).json({ message: 'Title and date are required' });
  }
  
  try {
    const result = await db.query(
      'INSERT INTO events (title, description, event_date, event_time, location, admin_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [title, description, event_date, event_time, location, req.admin.id]
    );
    
    // Get the complete event with author info
    const eventResult = await db.query(
      `SELECT e.*, adm.username as author 
       FROM events e 
       LEFT JOIN admins adm ON e.admin_id = adm.id 
       WHERE e.id = $1`,
      [result.rows[0].id]
    );
    
    res.status(201).json(eventResult.rows[0]);
  } catch (error) {
    console.error('Create event error:', error);
    res.status(500).json({ message: 'Database error', error: error.message });
  }
});

// Update event (Admin only)
router.put('/:id', auth, async (req, res) => {
  const { id } = req.params;
  const { title, description, event_date, event_time, location } = req.body;
  
  try {
    // Check if event exists
    const checkResult = await db.query(
      'SELECT * FROM events WHERE id = $1',
      [id]
    );
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ message: 'Event not found' });
    }
    
    // Update event
    await db.query(
      'UPDATE events SET title = $1, description = $2, event_date = $3, event_time = $4, location = $5 WHERE id = $6',
      [title, description, event_date, event_time, location, id]
    );
    
    // Get updated event
    const result = await db.query(
      `SELECT e.*, adm.username as author 
       FROM events e 
       LEFT JOIN admins adm ON e.admin_id = adm.id 
       WHERE e.id = $1`,
      [id]
    );
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update event error:', error);
    res.status(500).json({ message: 'Database error', error: error.message });
  }
});

// Delete event (Admin only)
router.delete('/:id', auth, async (req, res) => {
  const { id } = req.params;
  
  try {
    const result = await db.query(
      'DELETE FROM events WHERE id = $1 RETURNING *',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Event not found' });
    }
    
    res.json({ message: 'Event deleted successfully' });
  } catch (error) {
    console.error('Delete event error:', error);
    res.status(500).json({ message: 'Database error', error: error.message });
  }
});

module.exports = router;