const mongoose = require('mongoose');

const reservationSchema = new mongoose.Schema({
  // Customer Information
  customerName: {
    type: String,
    required: [true, 'Customer name is required'],
    trim: true,
    maxlength: [100, 'Customer name cannot exceed 100 characters']
  },
  customerPhone: {
    type: String,
    required: [true, 'Customer phone is required'],
    trim: true,
    maxlength: [20, 'Phone number cannot exceed 20 characters']
  },
  customerEmail: {
    type: String,
    trim: true,
    maxlength: [100, 'Email cannot exceed 100 characters'],
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },

  // Reservation Details
  date: {
    type: Date,
    required: [true, 'Reservation date is required']
  },
  period: {
    type: String,
    required: [true, 'Reservation period is required'],
    enum: {
      values: ['morning', 'evening'],
      message: 'Period must be morning or evening'
    }
  },

  // Related Pack
  pack: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Pack',
    required: [true, 'Pack is required']
  },

  // Photography Type
  typePhotographie: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TypePhotographie',
    required: [true, 'Photography type is required']
  },

  // Assigned Team
  teamPreference: {
    type: String,
    required: [true, 'Team preference is required'],
    enum: {
      values: ['females', 'males', 'any'],
      message: 'Team preference must be females, males, or any'
    }
  },

  // Assigned Employer
  assignedEmployer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  // Invoice Details
  invoice: {
    packPrice: {
      type: Number,
      required: [true, 'Pack price is required'],
      min: [0, 'Price cannot be negative']
    },
    additionalCharges: {
      type: Number,
      default: 0,
      min: [0, 'Additional charges cannot be negative']
    },
    discount: {
      type: Number,
      default: 0,
      min: [0, 'Discount cannot be negative']
    },
    totalPrice: {
      type: Number,
      required: [true, 'Total price is required'],
      min: [0, 'Total price cannot be negative']
    },
    paidAmount: {
      type: Number,
      default: 0,
      min: [0, 'Paid amount cannot be negative']
    },
    remainingAmount: {
      type: Number,
      default: 0,
      min: [0, 'Remaining amount cannot be negative']
    }
  },

  // Status and Notes
  status: {
    type: String,
    required: [true, 'Status is required'],
    enum: {
      values: ['pending', 'confirmed', 'completed', 'cancelled'],
      message: 'Status must be pending, confirmed, completed, or cancelled'
    },
    default: 'pending'
  },
  notes: {
    type: String,
    trim: true,
    maxlength: [500, 'Notes cannot exceed 500 characters']
  },

  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes for better query performance
reservationSchema.index({ date: 1 });
reservationSchema.index({ status: 1 });
reservationSchema.index({ assignedEmployer: 1 });
reservationSchema.index({ pack: 1 });
reservationSchema.index({ customerPhone: 1 });

// Virtual for formatted date
reservationSchema.virtual('formattedDate').get(function() {
  return this.date.toISOString().split('T')[0];
});

// Virtual for period in Arabic
reservationSchema.virtual('periodArabic').get(function() {
  const periods = {
    morning: 'صباح',
    evening: 'مساء'
  };
  return periods[this.period] || this.period;
});

// Virtual for team preference in Arabic
reservationSchema.virtual('teamPreferenceArabic').get(function() {
  const teams = {
    females: 'فريق نسائي',
    males: 'فريق رجالي',
    any: 'لا يهم'
  };
  return teams[this.teamPreference] || this.teamPreference;
});

// Virtual for status in Arabic
reservationSchema.virtual('statusArabic').get(function() {
  const statuses = {
    pending: 'في الانتظار',
    confirmed: 'مؤكد',
    completed: 'مكتمل',
    cancelled: 'ملغي'
  };
  return statuses[this.status] || this.status;
});

// Pre-save middleware to calculate total price
reservationSchema.pre('save', function(next) {
  if (this.isModified('invoice.packPrice') || this.isModified('invoice.additionalCharges') || this.isModified('invoice.discount')) {
    this.invoice.totalPrice = this.invoice.packPrice + this.invoice.additionalCharges - this.invoice.discount;
    this.invoice.remainingAmount = this.invoice.totalPrice - this.invoice.paidAmount;
  }
  next();
});

module.exports = mongoose.model('Reservation', reservationSchema);
