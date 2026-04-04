const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  // Customer Information (same as reservation)
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
    validate: {
      validator: function(v) {
        // Support Moroccan and international phone formats
        return /^(\+212|0)?[6-7]\d{8}$/.test(v) || /^\+?\d{10,15}$/.test(v);
      },
      message: 'Please enter a valid phone number'
    }
  },
  customerEmail: {
    type: String,
    trim: true,
    maxlength: [100, 'Email cannot exceed 100 characters'],
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },

  // Wedding Information (same as reservation)
  location: {
    type: String,
    trim: true,
    minlength: [3, 'Location must be at least 3 characters'],
    maxlength: [200, 'Location cannot exceed 200 characters']
  },
  groomName: {
    type: String,
    trim: true,
    minlength: [2, 'Groom name must be at least 2 characters'],
    maxlength: [100, 'Groom name cannot exceed 100 characters'],
    match: [/^[\u0600-\u06FFa-zA-Z\s]+$/, 'Groom name can only contain letters and spaces']
  },
  brideName: {
    type: String,
    trim: true,
    minlength: [2, 'Bride name must be at least 2 characters'],
    maxlength: [100, 'Bride name cannot exceed 100 characters'],
    match: [/^[\u0600-\u06FFa-zA-Z\s]+$/, 'Bride name can only contain letters and spaces']
  },
  hallName: {
    type: String,
    trim: true,
    minlength: [3, 'Hall name must be at least 3 characters'],
    maxlength: [200, 'Hall name cannot exceed 200 characters']
  },

  // Reservation Details (same as reservation)
  date: {
    type: Date,
    required: [true, 'Order date is required'],
    validate: {
      validator: function(v) {
        // Date must be today or in the future
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return v >= today;
      },
      message: 'Order date must be today or in the future'
    }
  },
  period: {
    type: String,
    required: [true, 'Order period is required'],
    enum: {
      values: ['morning', 'evening'],
      message: 'Period must be morning or evening'
    }
  },

  // Related Pack (same as reservation)
  pack: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Pack',
    required: [true, 'Pack is required']
  },

  // Photography Type (same as reservation)
  typePhotographie: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TypePhotographie',
    required: [true, 'Photography type is required']
  },

  // Team Preference (same as reservation)
  teamPreference: {
    type: String,
    required: [true, 'Team preference is required'],
    enum: {
      values: ['females', 'males', 'any'],
      message: 'Team preference must be females, males, or any'
    }
  },

  // Additional Items (same as reservation)
  additionalItems: [{
    name: {
      type: String,
      required: [true, 'Additional item name is required'],
      trim: true,
      maxlength: [100, 'Additional item name cannot exceed 100 characters']
    },
    price: {
      type: Number,
      required: [true, 'Additional item price is required'],
      min: [0, 'Additional item price cannot be negative']
    },
    quantity: {
      type: Number,
      required: [true, 'Additional item quantity is required'],
      min: [1, 'Additional item quantity must be at least 1']
    }
  }],

  // Invoice Details (same as reservation)
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

  // Order-specific fields
  messageOfClient: [{
    type: String,
    trim: true,
    maxlength: [500, 'Message cannot exceed 500 characters']
  }],
  
  state: {
    type: String,
    enum: {
      values: ['pending', 'accepted', 'rejected'],
      message: 'State must be pending, accepted, or rejected'
    },
    default: 'pending'
  },

  // Notes (same as reservation)
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
orderSchema.index({ date: 1 });
orderSchema.index({ state: 1 });
orderSchema.index({ pack: 1 });
orderSchema.index({ customerPhone: 1 });

// Virtual for formatted date
orderSchema.virtual('formattedDate').get(function() {
  return this.date.toISOString().split('T')[0];
});

// Virtual for period in Arabic
orderSchema.virtual('periodArabic').get(function() {
  const periods = {
    morning: 'صباح',
    evening: 'مساء'
  };
  return periods[this.period] || this.period;
});

// Virtual for team preference in Arabic
orderSchema.virtual('teamPreferenceArabic').get(function() {
  const teams = {
    females: 'فريق نسائي',
    males: 'فريق رجالي',
    any: 'لا يهم'
  };
  return teams[this.teamPreference] || this.teamPreference;
});

// Virtual for state in Arabic
orderSchema.virtual('stateArabic').get(function() {
  const states = {
    pending: 'في الانتظار',
    accepted: 'مقبول',
    rejected: 'مرفوض'
  };
  return states[this.state] || this.state;
});

// Pre-save middleware to calculate total price
orderSchema.pre('save', function(next) {
  if (this.isModified('invoice.packPrice') || this.isModified('invoice.additionalCharges') || this.isModified('invoice.discount') || this.isModified('additionalItems')) {
    // Calculate additional items total
    const additionalItemsTotal = this.additionalItems.reduce((total, item) => {
      return total + (item.price * item.quantity);
    }, 0);
    
    this.invoice.totalPrice = this.invoice.packPrice + this.invoice.additionalCharges + additionalItemsTotal - this.invoice.discount;
    this.invoice.remainingAmount = this.invoice.totalPrice - this.invoice.paidAmount;
  }
  next();
});

module.exports = mongoose.model('Order', orderSchema);