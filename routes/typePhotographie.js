const express = require('express');
const TypePhotographie = require('../models/TypePhotographie');
const router = express.Router();

// Get all photography types
router.get('/', async (req, res) => {
  try {
    const types = await TypePhotographie.find({ isActive: true }).sort({ name: 1 });
    res.json(types);
  } catch (error) {
    console.error('Error fetching photography types:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get photography type by ID
router.get('/:id', async (req, res) => {
  try {
    const type = await TypePhotographie.findById(req.params.id);
    
    if (!type) {
      return res.status(404).json({ message: 'Photography type not found' });
    }
    
    res.json(type);
  } catch (error) {
    console.error('Error fetching photography type:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create new photography type
router.post('/', async (req, res) => {
  try {
    const { name, description, photo } = req.body;

    const newType = new TypePhotographie({
      name,
      description,
      photo
    });

    const savedType = await newType.save();
    res.status(201).json(savedType);
  } catch (error) {
    console.error('Error creating photography type:', error);
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Photography type name already exists' });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// Update photography type
router.put('/:id', async (req, res) => {
  try {
    const updatedType = await TypePhotographie.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    
    if (!updatedType) {
      return res.status(404).json({ message: 'Photography type not found' });
    }
    
    res.json(updatedType);
  } catch (error) {
    console.error('Error updating photography type:', error);
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Photography type name already exists' });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete photography type (soft delete)
router.delete('/:id', async (req, res) => {
  try {
    const deletedType = await TypePhotographie.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );
    
    if (!deletedType) {
      return res.status(404).json({ message: 'Photography type not found' });
    }
    
    res.json({ message: 'Photography type deleted successfully' });
  } catch (error) {
    console.error('Error deleting photography type:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
