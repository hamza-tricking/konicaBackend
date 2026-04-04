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

  // Wedding Information
  location: {
    type: String,
    trim: true,
    maxlength: [200, 'Location cannot exceed 200 characters']
  },
  groomName: {
    type: String,
    trim: true,
    maxlength: [100, 'Groom name cannot exceed 100 characters']
  },
  brideName: {
    type: String,
    trim: true,
    maxlength: [100, 'Bride name cannot exceed 100 characters']
  },
  hallName: {
    type: String,
    trim: true,
    maxlength: [200, 'Hall name cannot exceed 200 characters']
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

  // Assigned Employers (Multiple)
  assignedEmployers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],

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

  // Additional Items
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
reservationSchema.index({ assignedEmployers: 1 });
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
  // Ensure all invoice fields exist
  if (!this.invoice) {
    this.invoice = {};
  }
  
  // Set defaults
  this.invoice.additionalCharges = this.invoice.additionalCharges || 0;
  this.invoice.discount = this.invoice.discount || 0;
  this.invoice.paidAmount = this.invoice.paidAmount || 0;
  
  // Calculate additional items total
  const additionalItemsTotal = this.additionalItems.reduce((total, item) => {
    return total + (item.price * item.quantity);
  }, 0);
  
  // Calculate total price
  this.invoice.totalPrice = this.invoice.packPrice + this.invoice.additionalCharges + additionalItemsTotal - this.invoice.discount;
  this.invoice.remainingAmount = this.invoice.totalPrice - this.invoice.paidAmount;
  
  console.log('Reservation total calculation:', {
    packPrice: this.invoice.packPrice,
    additionalCharges: this.invoice.additionalCharges,
    discount: this.invoice.discount,
    additionalItemsTotal,
    totalPrice: this.invoice.totalPrice,
    paidAmount: this.invoice.paidAmount,
    remainingAmount: this.invoice.remainingAmount
  });
  
  next();
});

// Pre-update middleware to handle updates
reservationSchema.pre(['updateOne', 'updateMany', 'findOneAndUpdate'], function(next) {
  const update = this.getUpdate();
  
  if (update.invoice) {
    // Ensure all invoice fields exist in the update
    update.invoice.additionalCharges = update.invoice.additionalCharges || 0;
    update.invoice.discount = update.invoice.discount || 0;
    update.invoice.paidAmount = update.invoice.paidAmount || 0;
    
    // Get the current document to calculate additional items
    this.model.findOne(this.getQuery()).then((doc) => {
      if (doc) {
        const additionalItemsTotal = (doc.additionalItems || []).reduce((total, item) => {
          return total + (item.price * item.quantity);
        }, 0);
        
        // Calculate total price
        update.invoice.totalPrice = update.invoice.packPrice + update.invoice.additionalCharges + additionalItemsTotal - update.invoice.discount;
        update.invoice.remainingAmount = update.invoice.totalPrice - update.invoice.paidAmount;
        
        console.log('Reservation update total calculation:', {
          packPrice: update.invoice.packPrice,
          additionalCharges: update.invoice.additionalCharges,
          discount: update.invoice.discount,
          additionalItemsTotal,
          totalPrice: update.invoice.totalPrice,
          paidAmount: update.invoice.paidAmount,
          remainingAmount: update.invoice.remainingAmount
        });
      }
      
      next();
    }).catch(next);
  } else {
    next();
  }
});

module.exports = mongoose.model('Reservation', reservationSchema);
