const express = require('express');
const { protect } = require('../middleware/auth');
const DashboardService = require('../utils/dashboardService');
const router = express.Router();

// Get dashboard stats based on user role
router.get('/stats', protect, async (req, res) => {
  try {
    let stats;
    
    switch (req.user.role) {
      case 'admin':
        stats = await DashboardService.getAdminStats();
        break;
      case 'sous admin':
        stats = await DashboardService.getSousAdminStats();
        break;
      case 'employer':
        stats = await DashboardService.getEmployerStats(req.user._id);
        break;
      default:
        return res.status(403).json({ message: 'Access denied' });
    }
    
    res.json(stats);
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get history for current user's role
router.get('/history', protect, async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    
    const history = await DashboardService.getHistoryByRole(
      req.user.role,
      parseInt(page),
      parseInt(limit)
    );
    
    res.json(history);
  } catch (error) {
    console.error('Error fetching dashboard history:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get action statistics
router.get('/action-stats', protect, async (req, res) => {
  try {
    const { days = 30 } = req.query;
    
    const stats = await DashboardService.getActionStats(
      req.user.role,
      parseInt(days)
    );
    
    res.json(stats);
  } catch (error) {
    console.error('Error fetching action stats:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get recent activity for dashboard
router.get('/recent-activity', protect, async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    
    const History = require('../models/History');
    const recentActivity = await History.find({
      visibleTo: { $in: [req.user.role] }
    })
      .populate('performedBy', 'username fullName role')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));
    
    res.json(recentActivity);
  } catch (error) {
    console.error('Error fetching recent activity:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
