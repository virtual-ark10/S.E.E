/**
 * Entity Controller
 * Handles entity CRUD and CSV import
 */
import Entity from '../models/Entity.js';
import { loadDomainConfig } from '../../config/loader.js';
import { parse } from 'csv-parse/sync';
import logger from '../utils/logger.js';

/**
 * GET /admin/entities - Entity list page
 */
export const getEntityList = async (req, res) => {
  try {
    const config = loadDomainConfig();
    const page = parseInt(req.query.page) || 1;
    const limit = 25;
    const skip = (page - 1) * limit;
    const { category, location, search } = req.query;

    const query = {};
    if (category) query.categories = { $regex: category, $options: 'i' };
    if (location) query.location = { $regex: location, $options: 'i' };
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { tags: { $regex: search, $options: 'i' } }
      ];
    }

    const [entities, total] = await Promise.all([
      Entity.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Entity.countDocuments(query)
    ]);

    // Get unique categories and locations for filters
    const [allCategories, allLocations] = await Promise.all([
      Entity.distinct('category'),
      Entity.distinct('location')
    ]);

    res.render('admin/entities', {
      title: `${config.entityPlural || 'Entities'}`,
      entities,
      config,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      filters: { category, location, search },
      allCategories: allCategories.filter(Boolean).sort(),
      allLocations: allLocations.filter(Boolean).sort()
    });
  } catch (error) {
    logger.error('Entity list error:', error);
    res.status(500).render('error', { title: 'Error', error: { message: error.message } });
  }
};

/**
 * GET /admin/entities/import - CSV import page
 */
export const getImportPage = async (req, res) => {
  try {
    const config = loadDomainConfig();
    res.render('admin/entity-import', {
      title: `Import ${config.entityPlural || 'Entities'}`,
      config
    });
  } catch (error) {
    logger.error('Import page error:', error);
    res.status(500).render('error', { title: 'Error', error: { message: error.message } });
  }
};

/**
 * POST /api/entities - Create single entity
 */
export const createEntity = async (req, res) => {
  try {
    const { name, description, location, category, categories, rating, reviewCount, phone, website, address, tags, metadata } = req.body;

    if (!name) return res.status(400).json({ success: false, message: 'Name is required' });

    const parsedCategories = typeof categories === 'string' ? JSON.parse(categories) : (categories || []);
    const parsedTags = typeof tags === 'string' ? JSON.parse(tags) : (tags || []);
    const parsedMetadata = typeof metadata === 'string' ? JSON.parse(metadata) : (metadata || {});

    const entity = new Entity({
      name,
      description: description || '',
      location: location || '',
      category: category || '',
      categories: parsedCategories,
      rating: parseFloat(rating) || 0,
      reviewCount: parseInt(reviewCount) || 0,
      phone: phone || '',
      website: website || '',
      address: address || '',
      tags: parsedTags,
      metadata: parsedMetadata,
      source: 'manual'
    });

    await entity.save();
    res.status(201).json({ success: true, message: 'Entity created', entity: { id: entity._id, name: entity.name, slug: entity.slug } });
  } catch (error) {
    logger.error('Create entity error:', error);
    if (error.code === 11000) return res.status(400).json({ success: false, message: 'An entity with this slug already exists' });
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * PUT /api/entities/:id - Update entity
 */
export const updateEntity = async (req, res) => {
  try {
    const entity = await Entity.findById(req.params.id);
    if (!entity) return res.status(404).json({ success: false, message: 'Entity not found' });

    const { name, description, location, category, categories, rating, reviewCount, phone, website, address, tags, metadata, isActive } = req.body;

    if (name !== undefined) entity.name = name;
    if (description !== undefined) entity.description = description;
    if (location !== undefined) entity.location = location;
    if (category !== undefined) entity.category = category;
    if (categories !== undefined) entity.categories = typeof categories === 'string' ? JSON.parse(categories) : categories;
    if (rating !== undefined) entity.rating = parseFloat(rating) || 0;
    if (reviewCount !== undefined) entity.reviewCount = parseInt(reviewCount) || 0;
    if (phone !== undefined) entity.phone = phone;
    if (website !== undefined) entity.website = website;
    if (address !== undefined) entity.address = address;
    if (tags !== undefined) entity.tags = typeof tags === 'string' ? JSON.parse(tags) : tags;
    if (metadata !== undefined) entity.metadata = typeof metadata === 'string' ? JSON.parse(metadata) : metadata;
    if (isActive !== undefined) entity.isActive = isActive === true || isActive === 'true';

    await entity.save();
    res.json({ success: true, message: 'Entity updated', entity: { id: entity._id, name: entity.name } });
  } catch (error) {
    logger.error('Update entity error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * DELETE /api/entities/:id - Delete entity
 */
export const deleteEntity = async (req, res) => {
  try {
    const result = await Entity.findByIdAndDelete(req.params.id);
    if (!result) return res.status(404).json({ success: false, message: 'Entity not found' });
    res.json({ success: true, message: 'Entity deleted' });
  } catch (error) {
    logger.error('Delete entity error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/entities/import-csv - Import entities from CSV
 */
export const importCSV = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No CSV file uploaded' });

    const csvContent = req.file.buffer.toString('utf-8');
    const records = parse(csvContent, { columns: true, skip_empty_lines: true, trim: true });

    if (records.length === 0) return res.status(400).json({ success: false, message: 'CSV file is empty' });

    let imported = 0;
    let skipped = 0;
    let errors = [];

    for (const record of records) {
      try {
        // Map CSV columns to entity fields (flexible mapping)
        const name = record.name || record.Name || record.title || record.Title || '';
        if (!name) { skipped++; continue; }

        // Check for duplicates by name
        const existing = await Entity.findOne({ name: { $regex: `^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } });
        if (existing) { skipped++; continue; }

        const entity = new Entity({
          name,
          description: record.description || record.Description || '',
          location: record.location || record.Location || record.city || record.City || '',
          category: record.category || record.Category || record.type || record.Type || '',
          categories: (record.categories || record.Categories || '').split(',').map(c => c.trim()).filter(Boolean),
          rating: parseFloat(record.rating || record.Rating) || 0,
          reviewCount: parseInt(record.reviewCount || record.reviews || record.Reviews) || 0,
          phone: record.phone || record.Phone || '',
          website: record.website || record.Website || record.url || record.URL || '',
          address: record.address || record.Address || '',
          tags: (record.tags || record.Tags || '').split(',').map(t => t.trim()).filter(Boolean),
          source: 'csv-import'
        });

        await entity.save();
        imported++;
      } catch (err) {
        errors.push(`Row ${imported + skipped + errors.length + 1}: ${err.message}`);
      }
    }

    res.json({
      success: true,
      message: `Import complete: ${imported} imported, ${skipped} skipped, ${errors.length} errors`,
      imported,
      skipped,
      errors: errors.slice(0, 10) // First 10 errors only
    });
  } catch (error) {
    logger.error('CSV import error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/entities/:id - Get single entity JSON
 */
export const getEntityJSON = async (req, res) => {
  try {
    const entity = await Entity.findById(req.params.id).lean();
    if (!entity) return res.status(404).json({ success: false, message: 'Entity not found' });
    res.json({ success: true, entity });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export default {
  getEntityList, getImportPage,
  createEntity, updateEntity, deleteEntity,
  importCSV, getEntityJSON
};
