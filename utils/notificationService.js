const { logAction } = require('../middleware/historyMiddleware');

// خدمة الإشعارات
class NotificationService {
  // إرسال إشعار لجميع المستخدمين المعنيين
  static async notifyUsers(historyEntry, notificationType = 'standard') {
    try {
      const notifications = [];
      
      // تحديد المستخدمين المستهدفين بناءً على visibleTo
      for (const role of historyEntry.visibleTo) {
        // هنا يمكن إضافة منطق إرسال الإشعارات الفعلي
        // مثلاً: إرسال بريد إلكتروني، push notification, etc.
        
        const notification = {
          userId: null, // سيتم تحديده لاحقاً
          role,
          message: this.createNotificationMessage(historyEntry),
          type: notificationType,
          timestamp: new Date(),
          read: false
        };
        
        notifications.push(notification);
      }
      
      return notifications;
    } catch (error) {
      console.error('Notification service error:', error);
    }
  }
  
  // إنشاء رسالة الإشعار
  static createNotificationMessage(historyEntry) {
    const messages = {
      'USER_REGISTER': `تم تسجيل مستخدم جديد: ${historyEntry.changes?.after?.username || 'N/A'}`,
      'USER_DELETE': `تم حذف المستخدم: ${historyEntry.changes?.before?.username || 'N/A'}`,
      'RESERVATION_CREATE': `تم إنشاء حجز جديد: ${historyEntry.changes?.after?.customerName || 'N/A'}`,
      'RESERVATION_CANCEL': `تم إلغاء الحجز: ${historyEntry.changes?.before?.customerName || 'N/A'}`,
      'ORDER_CREATE': `تم استلام طلب جديد: ${historyEntry.changes?.after?.customerName || 'N/A'}`,
      'ORDER_ACCEPT': `تم قبول الطلب: ${historyEntry.changes?.after?.customerName || 'N/A'}`,
      'ORDER_REJECT': `تم رفض الطلب: ${historyEntry.changes?.before?.customerName || 'N/A'}`,
      'PACK_CREATE': `تم إنشاء باقة جديدة: ${historyEntry.changes?.after?.name || 'N/A'}`,
      'PACK_DELETE': `تم حذف الباقة: ${historyEntry.changes?.before?.name || 'N/A'}`,
      'SERVICE_CREATE': `تم إنشاء خدمة جديدة: ${historyEntry.changes?.after?.name || 'N/A'}`,
      'SERVICE_DELETE': `تم حذف الخدمة: ${historyEntry.changes?.before?.name || 'N/A'}`,
      'INVOICE_UPDATE': `تم تحديث الفاتورة: ${historyEntry.changes?.after?.customerName || 'N/A'}`
    };
    
    return messages[historyEntry.actionType] || historyEntry.description;
  }
  
  // تسجيل إجراء مع إشعارات
  static async logWithNotification(data) {
    try {
      // تسجيل الإجراء في التاريخ
      const historyEntry = await logAction(data);
      
      // إرسال الإشعارات
      if (historyEntry) {
        await this.notifyUsers(historyEntry);
      }
      
      return historyEntry;
    } catch (error) {
      console.error('Log with notification error:', error);
    }
  }
  
  // الحصول على الإشعارات غير المقروءة لمستخدم معين
  static async getUnreadNotifications(userId, userRole) {
    try {
      // هنا يمكن إضافة منطق جلب الإشعارات من قاعدة البيانات
      // حالياً سنعيد بيانات وهمية للتوضيح
      
      return {
        notifications: [],
        count: 0
      };
    } catch (error) {
      console.error('Get unread notifications error:', error);
      return { notifications: [], count: 0 };
    }
  }
  
  // تحديث حالة الإشعار إلى مقروء
  static async markAsRead(notificationId, userId) {
    try {
      // هنا يمكن إضافة منطق تحديث حالة الإشعار
      return true;
    } catch (error) {
      console.error('Mark as read error:', error);
      return false;
    }
  }
}

module.exports = NotificationService;
