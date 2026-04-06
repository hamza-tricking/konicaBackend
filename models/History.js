const mongoose = require('mongoose');

const historySchema = new mongoose.Schema({
  // معلومات الإجراء الأساسية
  actionType: {
    type: String,
    required: true,
    enum: [
      'USER_REGISTER', 'USER_LOGIN', 'USER_UPDATE', 'USER_DELETE',
      'RESERVATION_CREATE', 'RESERVATION_UPDATE', 'RESERVATION_CANCEL', 'RESERVATION_COMPLETE',
      'ORDER_CREATE', 'ORDER_UPDATE', 'ORDER_ACCEPT', 'ORDER_REJECT', 'ORDER_DELETE',
      'PACK_CREATE', 'PACK_UPDATE', 'PACK_DELETE',
      'PAYMENT_RECEIVED', 'INVOICE_UPDATE'
    ]
  },

  // وصف الإجراء
  description: {
    type: String,
    required: true,
    maxlength: 300
  },

  // الكيان المتأثر
  entityType: {
    type: String,
    required: true,
    enum: ['User', 'Reservation', 'Order', 'Pack', 'System']
  },

  entityId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },

  // من قام بالإجراء
  performedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false // Make optional for public requests
  },

  role: {
    type: String,
    required: true,
    enum: ['admin', 'sous admin', 'employer', 'customer', 'public']
  },

  // من يرى هذا الإجراء
  visibleTo: [{
    type: String,
    enum: ['admin', 'sous admin', 'employer'],
    default: ['admin']
  }],

  // التغييرات (قبل وبعد)
  changes: {
    before: mongoose.Schema.Types.Mixed,
    after: mongoose.Schema.Types.Mixed
  },

  // حالة الإجراء
  status: {
    type: String,
    enum: ['success', 'failure'],
    default: 'success'
  },

  // معلومات إضافية
  ipAddress: String,
  userAgent: String,

  // الوقت
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: true
});

// فهارس للبحث السريع
historySchema.index({ actionType: 1, createdAt: -1 });
historySchema.index({ performedBy: 1, createdAt: -1 });
historySchema.index({ visibleTo: 1, createdAt: -1 });
historySchema.index({ entityType: 1, entityId: 1, createdAt: -1 });

module.exports = mongoose.model('History', historySchema);
