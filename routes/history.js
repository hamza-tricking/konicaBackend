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

    // Manually populate nested fields in changes
    for (let item of history) {
      if (item.changes) {
        // Populate before state
        if (item.changes.before && item.changes.before.pack) {
          // Check if it's an ObjectId (object) or string that needs population
          if (typeof item.changes.before.pack === 'object' || typeof item.changes.before.pack === 'string') {
            try {
              const Pack = require('../models/Pack');
              const packDoc = await Pack.findById(item.changes.before.pack);
              if (packDoc) {
                item.changes.before.pack = packDoc;
              }
            } catch (error) {
              console.error('Error populating before pack:', error);
            }
          }
        }
        
        if (item.changes.before && item.changes.before.typePhotographie) {
          try {
            const TypePhotographie = require('../models/TypePhotographie');
            const typeDoc = await TypePhotographie.findById(item.changes.before.typePhotographie);
            if (typeDoc) {
              item.changes.before.typePhotographie = typeDoc;
            }
          } catch (error) {
            console.error('Error populating before typePhotographie:', error);
          }
        }
        
        // Populate after state
        if (item.changes.after && item.changes.after.pack) {
          try {
            const Pack = require('../models/Pack');
            const packDoc = await Pack.findById(item.changes.after.pack);
            if (packDoc) {
              item.changes.after.pack = packDoc;
            }
          } catch (error) {
            console.error('Error populating after pack:', error);
          }
        }
        
        if (item.changes.after && item.changes.after.typePhotographie) {
          try {
            const TypePhotographie = require('../models/TypePhotographie');
            const typeDoc = await TypePhotographie.findById(item.changes.after.typePhotographie);
            if (typeDoc) {
              item.changes.after.typePhotographie = typeDoc;
            }
          } catch (error) {
            console.error('Error populating after typePhotographie:', error);
          }
        }
        
        // Populate assigned employers arrays
        if (item.changes.before && item.changes.before.assignedEmployers && Array.isArray(item.changes.before.assignedEmployers)) {
          try {
            const User = require('../models/User');
            const employers = await User.find({
              '_id': { $in: item.changes.before.assignedEmployers }
            }).select('username fullName');
            item.changes.before.assignedEmployers = employers;
          } catch (error) {
            console.error('Error populating before assignedEmployers:', error);
          }
        }
        
        if (item.changes.after && item.changes.after.assignedEmployers && Array.isArray(item.changes.after.assignedEmployers)) {
          try {
            const User = require('../models/User');
            const employers = await User.find({
              '_id': { $in: item.changes.after.assignedEmployers }
            }).select('username fullName');
            item.changes.after.assignedEmployers = employers;
          } catch (error) {
            console.error('Error populating after assignedEmployers:', error);
          }
        }
      }
    }

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
