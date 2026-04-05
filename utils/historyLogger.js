const History = require('../models/History');

// دالة لتسجيل الأحداث
const logHistory = async (data) => {
  try {
    const historyEntry = new History({
      actionType: data.actionType,
      description: data.description,
      entityType: data.entityType,
      entityId: data.entityId,
      performedBy: data.performedBy,
      role: data.role,
      visibleTo: data.visibleTo || ['admin'],
      changes: data.changes,
      status: data.status || 'success',
      ipAddress: data.ipAddress,
      userAgent: data.userAgent
    });

    await historyEntry.save();
    return historyEntry;
  } catch (error) {
    console.error('Error logging history:', error);
  }
};

// دالة لتحديد من يرى الإجراء
const getVisibleTo = async (actionType, entityType, entityId, userRole) => {
  // Admin يرى كل شيء
  let visibleTo = ['admin'];

  // Sous Admin يرى فقط الحجوزات والطلبات
  if (userRole === 'sous admin' || userRole === 'admin') {
    if (entityType === 'Reservation' || entityType === 'Order') {
      visibleTo.push('sous admin');
    }
  }

  // Employer يرى فقط الحجوزات المسندة إليه
  if (entityType === 'Reservation') {
    try {
      const Reservation = require('../models/Reservation');
      const reservation = await Reservation.findById(entityId).populate('assignedEmployers');
      
      if (reservation && reservation.assignedEmployers) {
        // أضف كل employer مسند لهذا الحجز
        reservation.assignedEmployers.forEach(employer => {
          if (employer._id) {
            visibleTo.push('employer');
          }
        });
      }
    } catch (error) {
      console.error('Error checking reservation assignment:', error);
    }
  }

  return visibleTo;
};

// دالة للحصول على معلومات الطلب
const getRequestInfo = (req) => {
  return {
    ipAddress: req.ip || req.connection.remoteAddress,
    userAgent: req.get('User-Agent')
  };
};

module.exports = {
  logHistory,
  getVisibleTo,
  getRequestInfo
};
