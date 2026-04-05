const express = require('express');
const { protect } = require('../middleware/auth');
const NotificationService = require('../utils/notificationService');
const router = express.Router();

// Get unread notifications for current user
router.get('/unread', protect, async (req, res) => {
  try {
    console.log('🔔 Notifications API called - /api/notifications/unread');
    console.log('👤 User:', req.user);
    console.log('🔑 User Role:', req.user.role);
    
    const result = await NotificationService.getUnreadNotifications(req.user._id, req.user.role);
    console.log('📋 Unread notifications result:', result);
    
    res.json(result);
  } catch (error) {
    console.error('❌ Error fetching notifications:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Mark notification as read
router.patch('/:id/read', protect, async (req, res) => {
  try {
    console.log('📝 Mark notification as read called:', req.params.id);
    console.log('👤 User:', req.user);
    
    const success = await NotificationService.markAsRead(req.params.id, req.user._id);
    
    if (success) {
      console.log('✅ Notification marked as read successfully');
      res.json({ message: 'Notification marked as read' });
    } else {
      console.log('❌ Notification not found');
      res.status(404).json({ message: 'Notification not found' });
    }
  } catch (error) {
    console.error('❌ Error marking notification as read:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get notification count
router.get('/count', protect, async (req, res) => {
  try {
    console.log('🔢 Notification count API called - /api/notifications/count');
    console.log('👤 User:', req.user);
    console.log('🔑 User Role:', req.user.role);
    
    const result = await NotificationService.getUnreadNotifications(req.user._id, req.user.role);
    console.log('📊 Unread count:', result.count);
    
    res.json({ count: result.count });
  } catch (error) {
    console.error('❌ Error fetching notification count:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Manual log action with notification (for special cases)
router.post('/log-action', protect, async (req, res) => {
  try {
    const { actionType, entityType, entityId, description, visibleTo, changes } = req.body;
    
    const historyEntry = await NotificationService.logWithNotification({
      actionType,
      entityType,
      entityId,
      description,
      performedBy: req.user._id,
      role: req.user.role,
      visibleTo: visibleTo || ['admin'],
      changes,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    res.json(historyEntry);
  } catch (error) {
    console.error('Error logging action:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
