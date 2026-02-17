/**
 * Admin Routes
 * Dashboard, articles, entities, settings pages
 */
import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { getDashboard } from '../controllers/dashboardController.js';
import {
  getArticleList, getNewArticleEditor, getEditArticleEditor
} from '../controllers/articleController.js';
import { getEntityList, getImportPage } from '../controllers/entityController.js';
import { getSettings } from '../controllers/settingsController.js';
import { getKeywordsPage } from '../controllers/keywordController.js';

const router = express.Router();

// Dashboard
router.get('/', getDashboard);
router.get('/dashboard', getDashboard);

// Articles
router.get('/articles', getArticleList);
router.get('/articles/new', getNewArticleEditor);
router.get('/articles/edit/:id', getEditArticleEditor);

// Entities
router.get('/entities', getEntityList);
router.get('/entities/import', getImportPage);

// Settings
router.get('/settings', getSettings);

// Keyword Research (Keyword Planner)
router.get('/keywords', getKeywordsPage);

export default router;
