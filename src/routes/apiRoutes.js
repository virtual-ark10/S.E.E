/**
 * API Routes
 * RESTful API endpoints for articles, entities, settings, and AI generation
 */
import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  createArticle, updateArticle, deleteArticle,
  publishArticle, archiveArticle,
  generateArticleAPI, uploadFeaturedImage,
  getSchedulerStatusAPI, triggerArchival
} from '../controllers/articleController.js';
import {
  createEntity, updateEntity, deleteEntity,
  importCSV, getEntityJSON
} from '../controllers/entityController.js';
import {
  updateGeneralSettings, updateCTASettings,
  updatePromptSettings, updateCategorySettings, getConfigJSON
} from '../controllers/settingsController.js';
import { getKeywordIdeasAPI, getKeywordPlannerStatusAPI } from '../controllers/keywordController.js';
import { loadDomainConfig } from '../../config/loader.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// ---- Image upload middleware ----
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../uploads/images'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const imageUpload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp|svg/;
    const extOk = allowed.test(path.extname(file.originalname).toLowerCase());
    const mimeOk = allowed.test(file.mimetype);
    cb(null, extOk && mimeOk);
  }
});

// ---- CSV upload middleware ----
const csvUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, ext === '.csv');
  }
});

// ---- API Key middleware (optional - for external API calls) ----
const validateApiKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key'] || req.query.apiKey;
  const validKey = process.env.ARTICLE_API_KEY;
  if (!validKey) return next(); // Skip if no key configured
  if (!apiKey || apiKey !== validKey) {
    return res.status(401).json({ success: false, message: 'Invalid API key' });
  }
  next();
};

// ==========================================
// Article API
// ==========================================
router.post('/articles', createArticle);
router.put('/articles/:id', updateArticle);
router.delete('/articles/:id', deleteArticle);
router.post('/articles/:id/publish', publishArticle);
router.post('/articles/:id/archive', archiveArticle);
router.post('/articles/generate', validateApiKey, generateArticleAPI);
router.post('/articles/upload-image', imageUpload.single('image'), uploadFeaturedImage);
router.get('/articles/scheduler-status', getSchedulerStatusAPI);
router.post('/articles/archive-old', validateApiKey, triggerArchival);

// ==========================================
// Entity API
// ==========================================
router.post('/entities', createEntity);
router.put('/entities/:id', updateEntity);
router.delete('/entities/:id', deleteEntity);
router.get('/entities/:id', getEntityJSON);
router.post('/entities/import-csv', csvUpload.single('csv'), importCSV);

// ==========================================
// Settings API
// ==========================================
router.post('/settings/general', updateGeneralSettings);
router.post('/settings/cta', updateCTASettings);
router.post('/settings/prompts', updatePromptSettings);
router.post('/settings/categories', updateCategorySettings);
router.get('/settings/config', getConfigJSON);

// ==========================================
// Keyword Planner API
// ==========================================
router.get('/keywords/status', getKeywordPlannerStatusAPI);
router.post('/keywords/ideas', getKeywordIdeasAPI);

export default router;
