import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from './src/utils/logger.js';
import { loadDomainConfig } from './config/loader.js';

// Load environment variables
dotenv.config();

// ES modules __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 4000;

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// View engine setup (EJS)
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Make config available to all views
app.use((req, res, next) => {
  const config = loadDomainConfig();
  res.locals.platformName = config.platformName || 'S.E.E';
  res.locals.config = config;
  next();
});

// Database connection
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/see');
    logger.info(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    logger.error('Database connection error:', error);
    process.exit(1);
  }
};

// Import routes
import adminRoutes from './src/routes/adminRoutes.js';
import apiRoutes from './src/routes/apiRoutes.js';
import blogRoutes, { sitemapRoute, robotsRoute } from './src/routes/blogRoutes.js';

// Mount routes
app.use('/admin', adminRoutes);
app.use('/api', apiRoutes);
app.use('/blog', blogRoutes);

// Sitemap & Robots (ITEM 1)
app.get('/sitemap.xml', sitemapRoute);
app.get('/robots.txt', robotsRoute);

// Root redirect to admin dashboard
app.get('/', (req, res) => res.redirect('/admin'));

// Test route
app.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'S.E.E server is running!',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).render('404', { title: 'Page Not Found' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Server Error:', {
    message: err?.message,
    stack: err?.stack,
    path: req.path,
    method: req.method
  });

  if (req.path.startsWith('/api/')) {
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }

  res.status(500).render('error', {
    title: 'Server Error',
    error: process.env.NODE_ENV === 'development' ? err : {}
  });
});

// Start server
const startServer = async () => {
  await connectDB();

  // Initialize article scheduler (if enabled)
  if (process.env.ENABLE_ARTICLE_SCHEDULER === 'true') {
    const { initializeScheduler } = await import('./src/core/articleScheduler.js');
    initializeScheduler();
  }

  app.listen(PORT, () => {
    const config = loadDomainConfig();
    logger.info(`🚀 S.E.E server running on port ${PORT}`);
    logger.info(`📱 Environment: ${process.env.NODE_ENV || 'development'}`);
    logger.info(`🏷️  Platform: ${config.platformName}`);
    logger.info(`📝 Admin: http://localhost:${PORT}/admin`);
    logger.info(`📝 Blog: http://localhost:${PORT}/blog`);
    logger.info(`📝 Article Scheduler: ${process.env.ENABLE_ARTICLE_SCHEDULER === 'true' ? 'Enabled' : 'Disabled'}`);
  });
};

startServer().catch((error) => {
  logger.error('Failed to start server:', error);
  process.exit(1);
});

export default app;
