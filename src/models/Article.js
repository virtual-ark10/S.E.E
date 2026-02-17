/**
 * Article Model
 * Based on ZADI's BlogArticle model, minus all coupon/offer-related fields
 */
import mongoose from 'mongoose';

function slugify(input) {
  if (!input) return '';
  return String(input)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

const articleSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 150
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  content: {
    type: String,
    required: true
  },
  excerpt: {
    type: String,
    maxlength: 300,
    default: ''
  },
  featuredImage: {
    type: String,
    default: null
  },

  // Classification
  category: {
    type: String,
    trim: true,
    default: ''
  },
  articleType: {
    type: String,
    enum: ['guide', 'listicle', 'review', 'comparison', 'pillar', 'cluster', 'how-to', 'roundup'],
    default: 'guide'
  },
  location: {
    type: String,
    default: ''
  },

  // Tags & SEO
  tags: [{
    type: String,
    trim: true
  }],
  seoMetaDescription: {
    type: String,
    maxlength: 160,
    default: ''
  },
  seoKeywords: [{
    type: String,
    trim: true
  }],
  primaryKeyword: {
    type: String,
    default: ''
  },

  // Pillar/Cluster content
  isPillarContent: {
    type: Boolean,
    default: false
  },
  pillarContentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Article',
    default: null
  },
  topicCluster: {
    type: String,
    default: null
  },

  // Status
  status: {
    type: String,
    enum: ['draft', 'published', 'archived'],
    default: 'draft'
  },
  isFeatured: {
    type: Boolean,
    default: false
  },

  // Analytics
  viewCount: {
    type: Number,
    default: 0
  },
  publishedAt: {
    type: Date,
    default: null
  },

  // AI Generation metadata
  isAiGenerated: {
    type: Boolean,
    default: false
  },
  aiModel: String,
  aiPromptTokens: Number,
  aiCompletionTokens: Number,

  // Author
  author: {
    type: String,
    default: 'Admin'
  }
}, {
  timestamps: true
});

// Auto-generate slug from title (runs before validation so slug is present)
articleSchema.pre('validate', function(next) {
  if (this.isModified('title') && !this.slug) {
    this.slug = slugify(this.title);
  }
  next();
});

// Instance methods
articleSchema.methods.publish = function() {
  this.status = 'published';
  this.publishedAt = new Date();
  return this.save();
};

articleSchema.methods.archive = function() {
  this.status = 'archived';
  return this.save();
};

articleSchema.methods.incrementViews = function() {
  this.viewCount += 1;
  return this.save();
};

// Indexes
articleSchema.index({ slug: 1 });
articleSchema.index({ status: 1, publishedAt: -1 });
articleSchema.index({ category: 1, status: 1 });
articleSchema.index({ topicCluster: 1 });
articleSchema.index({ isPillarContent: 1, status: 1 });
articleSchema.index({ title: 'text', content: 'text', tags: 'text' });

const Article = mongoose.model('Article', articleSchema);

export default Article;
