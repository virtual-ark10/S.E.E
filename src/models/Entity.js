/**
 * Entity Model
 * Generic entity schema with flexible metadata
 * Adapts to any vertical via domain config fieldMappings
 */
import mongoose from 'mongoose';

const entitySchema = new mongoose.Schema({
  // Core fields (always present)
  name: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  slug: {
    type: String,
    unique: true,
    trim: true
  },
  description: {
    type: String,
    default: ''
  },
  location: {
    type: String,
    default: '',
    index: true
  },
  
  // Classification
  category: {
    type: String,
    default: '',
    index: true
  },
  categories: [{
    type: String,
    trim: true
  }],
  
  // Ratings
  rating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  reviewCount: {
    type: Number,
    default: 0
  },
  
  // Contact & web
  phone: String,
  website: String,
  address: String,
  
  // Media
  thumbnail: String,
  images: [String],
  
  // Flexible metadata (any key/value pairs)
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  
  // Tags for search
  tags: [{
    type: String,
    trim: true
  }],
  
  // Status
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Auto-generate slug from name
entitySchema.pre('save', function(next) {
  if (!this.slug && this.name) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/--+/g, '-')
      .trim();
  }
  next();
});

// Indexes
entitySchema.index({ name: 'text', description: 'text', location: 'text' });
entitySchema.index({ category: 1, location: 1 });
entitySchema.index({ isActive: 1 });

const Entity = mongoose.model('Entity', entitySchema);

export default Entity;
