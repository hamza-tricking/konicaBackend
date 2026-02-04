const mongoose = require('mongoose');

const typePhotographieSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Photography type name is required'],
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters'],
    unique: true
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  photo: {
    type: String,
    trim: true,
    maxlength: [1000, 'Photo URL cannot exceed 1000 characters']
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Indexes for better query performance
typePhotographieSchema.index({ name: 1 });
typePhotographieSchema.index({ isActive: 1 });

// Virtual for formatted name
typePhotographieSchema.virtual('formattedName').get(function() {
  return this.name.charAt(0).toUpperCase() + this.name.slice(1).toLowerCase();
});

module.exports = mongoose.model('TypePhotographie', typePhotographieSchema);
