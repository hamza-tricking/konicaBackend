const mongoose = require('mongoose');

const packSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Pack name is required'],
    trim: true,
    maxlength: [100, 'Pack name cannot exceed 100 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  price: {
    type: Number,
    required: [true, 'Pack price is required'],
    min: [0, 'Price cannot be negative']
  },
  features: {
    type: [String],
    required: [true, 'Pack features are required'],
    validate: {
      validator: function(features) {
        return features.length > 0;
      },
      message: 'At least one feature is required'
    }
  },
  photo: {
    type: String,
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Index for better query performance
packSchema.index({ name: 1 });
packSchema.index({ price: 1 });
packSchema.index({ isActive: 1 });

module.exports = mongoose.model('Pack', packSchema);
