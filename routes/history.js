const express = require('express');
const History = require('../models/History');
const { protect, admin } = require('../middleware/auth');
const router = express.Router();

// Get all history entries (admin only)
router.get('/', protect, admin, async (req, res) => {
  try {
    const { page = 1, limit = 50, actionType, entityType, userId } = req.query;
    
    // Build filter
    let filter = {};
    
    if (actionType) {
      filter.actionType = actionType;
    }
    
    if (entityType) {
      filter.entityType = entityType;
    }
    
    if (userId) {
      filter.performedBy = userId;
    }

    const history = await History.find(filter)
      .populate('performedBy', 'username fullName role')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await History.countDocuments(filter);

    res.json({
      history,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    console.error('Error fetching history:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get history for specific entity
router.get('/entity/:entityType/:entityId', protect, async (req, res) => {
  try {
    const { entityType, entityId } = req.params;
    const userRole = req.user.role;

    const history = await History.find({
      entityType,
      entityId,
      $or: [
        { visibleTo: { $in: [userRole] } },
        { performedBy: req.user._id } // المستخدم يرى إجراءاته الخاصة
      ]
    })
      .populate('performedBy', 'username fullName role')
      .sort({ createdAt: -1 });

    res.json(history);
  } catch (error) {
    console.error('Error fetching entity history:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user's own actions
router.get('/my-actions', protect, async (req, res) => {
  try {
    const history = await History.find({
      performedBy: req.user._id
    })
      .populate('performedBy', 'username fullName role')
      .sort({ createdAt: -1 });

    res.json(history);
  } catch (error) {
    console.error('Error fetching user actions:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get history by role visibility
router.get('/visible', protect, async (req, res) => {
  try {
    console.log('📜 History API called - /api/history/visible');
    console.log('👤 User:', req.user);
    console.log('🔑 User Role:', req.user.role);
    
    const { page = 1, limit = 50 } = req.query;
    const userRole = req.user.role;

    console.log('📊 Query params:', { page, limit, userRole });

    const history = await History.find({
      $or: [
        { visibleTo: { $in: [userRole] } },
        { performedBy: req.user._id } // المستخدم يرى إجراءاته الخاصة دائماً
      ]
    })
      .populate('performedBy', 'username fullName role')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await History.countDocuments({
      $or: [
        { visibleTo: { $in: [userRole] } },
        { performedBy: req.user._id }
      ]
    });

    console.log('📋 Found history items:', history.length);
    console.log('📈 Total count:', total);

    res.json({
      history,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    console.error('❌ Error fetching visible history:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
