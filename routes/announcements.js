const express = require('express');
const db = require('../config/database');
const auth = require('../middleware/auth');
const router = express.Router();

// Get all announcements
router.get('/', async (req, res) => {
  const { category, page = 1, limit = 10 } = req.query;
  
  try {
    let query = `
      SELECT a.*, adm.username as author 
      FROM announcements a 
      LEFT JOIN admins adm ON a.admin_id = adm.id
    `;
    let countQuery = 'SELECT COUNT(*) as total FROM announcements';
    let queryParams = [];
    let countParams = [];
    let paramCount = 0;
    
    if (category) {
      query += ` WHERE a.category = $${++paramCount}`;
      countQuery += ` WHERE category = $1`;
      queryParams.push(category);
      countParams.push(category);
    }
    
    query += ` ORDER BY a.created_at DESC LIMIT $${++paramCount} OFFSET $${++paramCount}`;
    const offset = (page - 1) * limit;
    queryParams.push(parseInt(limit), offset);
    
    // Get total count
    const countResult = await db.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(total / limit);
    
    // Get paginated results
    const result = await db.query(query, queryParams);
    
    res.json({
      announcements: result.rows,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalItems: total,
        itemsPerPage: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Get announcements error:', error);
    res.status(500).json({ message: 'Database error', error: error.message });
  }
});

// Get single announcement
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  
  try {
    const result = await db.query(
      `SELECT a.*, adm.username as author 
       FROM announcements a 
       LEFT JOIN admins adm ON a.admin_id = adm.id 
       WHERE a.id = $1`,
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Announcement not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get announcement error:', error);
    res.status(500).json({ message: 'Database error', error: error.message });
  }
});

// Create announcement (Admin only)
router.post('/', auth, async (req, res) => {
  const { title, content, category } = req.body;
  
  if (!title || !content || !category) {
    return res.status(400).json({ message: 'Title, content, and category are required' });
  }
  
  try {
    const result = await db.query(
      'INSERT INTO announcements (title, content, category, admin_id) VALUES ($1, $2, $3, $4) RETURNING *',
      [title, content, category, req.admin.id]
    );
    
    // Get the complete announcement with author info
    const announcementResult = await db.query(
      `SELECT a.*, adm.username as author 
       FROM announcements a 
       LEFT JOIN admins adm ON a.admin_id = adm.id 
       WHERE a.id = $1`,
      [result.rows[0].id]
    );
    
    res.status(201).json(announcementResult.rows[0]);
  } catch (error) {
    console.error('Create announcement error:', error);
    res.status(500).json({ message: 'Database error', error: error.message });
  }
});

// Update announcement (Admin only)
router.put('/:id', auth, async (req, res) => {
  const { id } = req.params;
  const { title, content, category } = req.body;
  
  try {
    // First check if announcement exists
    const checkResult = await db.query(
      'SELECT * FROM announcements WHERE id = $1',
      [id]
    );
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ message: 'Announcement not found' });
    }
    
    // Update announcement
    await db.query(
      'UPDATE announcements SET title = $1, content = $2, category = $3 WHERE id = $4',
      [title, content, category, id]
    );
    
    // Get updated announcement
    const result = await db.query(
      `SELECT a.*, adm.username as author 
       FROM announcements a 
       LEFT JOIN admins adm ON a.admin_id = adm.id 
       WHERE a.id = $1`,
      [id]
    );
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update announcement error:', error);
    res.status(500).json({ message: 'Database error', error: error.message });
  }
});

// Delete announcement (Admin only)
router.delete('/:id', auth, async (req, res) => {
  const { id } = req.params;
  
  try {
    const result = await db.query(
      'DELETE FROM announcements WHERE id = $1 RETURNING *',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Announcement not found' });
    }
    
    res.json({ message: 'Announcement deleted successfully' });
  } catch (error) {
    console.error('Delete announcement error:', error);
    res.status(500).json({ message: 'Database error', error: error.message });
  }
});

module.exports = router;