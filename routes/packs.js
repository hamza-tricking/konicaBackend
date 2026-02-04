const express = require('express');
const Pack = require('../models/Pack');
const router = express.Router();

// Get all packs
router.get('/', async (req, res) => {
  try {
    const packs = await Pack.find({ isActive: true }).sort({ createdAt: -1 });
    res.json(packs);
  } catch (error) {
    console.error('Error fetching packs:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Add new pack
router.post('/', async (req, res) => {
  try {
    const { name, description, price, features, photo } = req.body;
    
    const newPack = new Pack({
      name,
      description,
      price,
      features,
      photo
    });
    
    const savedPack = await newPack.save();
    res.status(201).json(savedPack);
  } catch (error) {
    console.error('Error creating pack:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update pack
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updatedPack = await Pack.findByIdAndUpdate(
      id,
      req.body,
      { new: true, runValidators: true }
    );
    
    if (!updatedPack) {
      return res.status(404).json({ message: 'Pack not found' });
    }
    
    res.json(updatedPack);
  } catch (error) {
    console.error('Error updating pack:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete pack (soft delete)
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const deletedPack = await Pack.findByIdAndUpdate(
      id,
      { isActive: false },
      { new: true }
    );
    
    if (!deletedPack) {
      return res.status(404).json({ message: 'Pack not found' });
    }
    
    res.json({ message: 'Pack deleted successfully' });
  } catch (error) {
    console.error('Error deleting pack:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get pack by ID
router.get('/:id', async (req, res) => {
  try {
    const pack = await Pack.findById(req.params.id);
    
    if (!pack) {
      return res.status(404).json({ message: 'Pack not found' });
    }
    
    res.json(pack);
  } catch (error) {
    console.error('Error fetching pack:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
