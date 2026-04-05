const History = require('../models/History');
const User = require('../models/User');
const Reservation = require('../models/Reservation');
const Order = require('../models/Order');
const Pack = require('../models/Pack');

// خدمة بيانات لوحات التحكم
class DashboardService {
  // الحصول على إحصائيات لوحة تحكم الأدمن
  static async getAdminStats() {
    try {
      const [
        totalUsers,
        totalReservations,
        totalOrders,
        totalPacks,
        recentHistory,
        pendingOrders,
        todayReservations
      ] = await Promise.all([
        User.countDocuments(),
        Reservation.countDocuments(),
        Order.countDocuments(),
        Pack.countDocuments({ isActive: true }),
        History.find({ visibleTo: { $in: ['admin'] } })
          .populate('performedBy', 'username fullName')
          .sort({ createdAt: -1 })
          .limit(10),
        Order.countDocuments({ state: 'pending' }),
        Reservation.countDocuments({ 
          date: { 
            $gte: new Date(new Date().setHours(0, 0, 0, 0)),
            $lt: new Date(new Date().setHours(23, 59, 59, 999))
          }
        })
      ]);

      return {
        stats: {
          users: totalUsers,
          reservations: totalReservations,
          orders: totalOrders,
          packs: totalPacks,
          pendingOrders,
          todayReservations
        },
        recentHistory
      };
    } catch (error) {
      console.error('Error getting admin stats:', error);
      throw error;
    }
  }

  // الحصول على إحصائيات لوحة تحكم Sous Admin
  static async getSousAdminStats() {
    try {
      const [
        totalReservations,
        totalOrders,
        recentHistory,
        pendingOrders,
        completedReservations
      ] = await Promise.all([
        Reservation.countDocuments(),
        Order.countDocuments(),
        History.find({ visibleTo: { $in: ['sous admin'] } })
          .populate('performedBy', 'username fullName')
          .sort({ createdAt: -1 })
          .limit(10),
        Order.countDocuments({ state: 'pending' }),
        Reservation.countDocuments({ status: 'completed' })
      ]);

      return {
        stats: {
          reservations: totalReservations,
          orders: totalOrders,
          pendingOrders,
          completedReservations
        },
        recentHistory
      };
    } catch (error) {
      console.error('Error getting sous admin stats:', error);
      throw error;
    }
  }

  // الحصول على إحصائيات لوحة تحكم Employer
  static async getEmployerStats(userId) {
    try {
      const [
        myReservations,
        completedReservations,
        recentHistory,
        todayReservations
      ] = await Promise.all([
        Reservation.countDocuments({ assignedEmployers: userId }),
        Reservation.countDocuments({ 
          assignedEmployers: userId,
          status: 'completed'
        }),
        History.find({ 
          visibleTo: { $in: ['employer'] },
          performedBy: userId
        })
          .populate('performedBy', 'username fullName')
          .sort({ createdAt: -1 })
          .limit(10),
        Reservation.countDocuments({ 
          assignedEmployers: userId,
          date: { 
            $gte: new Date(new Date().setHours(0, 0, 0, 0)),
            $lt: new Date(new Date().setHours(23, 59, 59, 999))
          }
        })
      ]);

      return {
        stats: {
          myReservations,
          completedReservations,
          todayReservations
        },
        recentHistory
      };
    } catch (error) {
      console.error('Error getting employer stats:', error);
      throw error;
    }
  }

  // الحصول على التاريخ حسب الدور
  static async getHistoryByRole(userRole, page = 1, limit = 50) {
    try {
      const history = await History.find({
        visibleTo: { $in: [userRole] }
      })
        .populate('performedBy', 'username fullName role')
        .sort({ createdAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit);

      const total = await History.countDocuments({
        visibleTo: { $in: [userRole] }
      });

      return {
        history,
        totalPages: Math.ceil(total / limit),
        currentPage: page,
        total
      };
    } catch (error) {
      console.error('Error getting history by role:', error);
      throw error;
    }
  }

  // الحصول على إحصائيات الإجراءات
  static async getActionStats(userRole, days = 30) {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const stats = await History.aggregate([
        {
          $match: {
            visibleTo: { $in: [userRole] },
            createdAt: { $gte: startDate }
          }
        },
        {
          $group: {
            _id: '$actionType',
            count: { $sum: 1 },
            lastOccurrence: { $max: '$createdAt' }
          }
        },
        {
          $sort: { count: -1 }
        }
      ]);

      return stats;
    } catch (error) {
      console.error('Error getting action stats:', error);
      throw error;
    }
  }
}

module.exports = DashboardService;
