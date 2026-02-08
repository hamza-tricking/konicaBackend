const express = require('express');
const router = express.Router();
const ExtraService = require('../models/ExtraService');

// GET /api/extra-services - Get all active extra services
router.get('/', async (req, res) => {
  try {
    const extraServices = await ExtraService.find({ isActive: true }).sort({ createdAt: -1 });
    res.json(extraServices);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching extra services', error: error.message });
  }
});

// GET /api/extra-services/all - Get all extra services (including inactive)
router.get('/all', async (req, res) => {
  try {
    const extraServices = await ExtraService.find().sort({ createdAt: -1 });
    res.json(extraServices);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching extra services', error: error.message });
  }
});

// GET /api/extra-services/:id - Get a single extra service by ID
router.get('/:id', async (req, res) => {
  try {
    const extraService = await ExtraService.findById(req.params.id);
    if (!extraService) {
      return res.status(404).json({ message: 'Extra service not found' });
    }
    res.json(extraService);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching extra service', error: error.message });
  }
});

// POST /api/extra-services - Create a new extra service
router.post('/', async (req, res) => {
  try {
    const { name, description, photo } = req.body;

    if (!name) {
      return res.status(400).json({ message: 'Service name is required' });
    }

    const extraService = new ExtraService({
      name: name.trim(),
      description: description ? description.trim() : '',
      photo: photo || null
    });

    const savedExtraService = await extraService.save();
    res.status(201).json(savedExtraService);
  } catch (error) {
    res.status(500).json({ message: 'Error creating extra service', error: error.message });
  }
});

// PUT /api/extra-services/:id - Update an extra service
router.put('/:id', async (req, res) => {
  try {
    const { name, description, photo } = req.body;

    const extraService = await ExtraService.findById(req.params.id);
    if (!extraService) {
      return res.status(404).json({ message: 'Extra service not found' });
    }

    if (name) extraService.name = name.trim();
    if (description !== undefined) extraService.description = description.trim();
    if (photo !== undefined) extraService.photo = photo;

    const updatedExtraService = await extraService.save();
    res.json(updatedExtraService);
  } catch (error) {
    res.status(500).json({ message: 'Error updating extra service', error: error.message });
  }
});

// DELETE /api/extra-services/:id - Soft delete an extra service
router.delete('/:id', async (req, res) => {
  try {
    const extraService = await ExtraService.findById(req.params.id);
    if (!extraService) {
      return res.status(404).json({ message: 'Extra service not found' });
    }

    extraService.isActive = false;
    await extraService.save();

    res.json({ message: 'Extra service deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting extra service', error: error.message });
  }
});

module.exports = router;
