const express = require('express');
const Reservation = require('../models/Reservation');
const Pack = require('../models/Pack');
const router = express.Router();

// Get all reservations with populated data
router.get('/', async (req, res) => {
  try {
    const reservations = await Reservation.find()
      .populate('pack', 'name price features')
      .populate('typePhotographie', 'name description photo')
      .populate('assignedEmployers', 'username fullName')
      .sort({ date: -1, createdAt: -1 });
    res.json(reservations);
  } catch (error) {
    console.error('Error fetching reservations:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get reservation by ID
router.get('/:id', async (req, res) => {
  try {
    const reservation = await Reservation.findById(req.params.id)
      .populate('pack', 'name price features')
      .populate('typePhotographie', 'name description photo')
      .populate('assignedEmployers', 'username fullName');
    
    if (!reservation) {
      return res.status(404).json({ message: 'Reservation not found' });
    }
    
    res.json(reservation);
  } catch (error) {
    console.error('Error fetching reservation:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create new reservation
router.post('/', async (req, res) => {
  try {
    const {
      customerName,
      customerPhone,
      customerEmail,
      date,
      period,
      pack,
      typePhotographie,
      teamPreference,
      assignedEmployers,
      invoice,
      notes
    } = req.body;

    // Get pack details for pricing
    const packDetails = await Pack.findById(pack);
    if (!packDetails) {
      return res.status(400).json({ message: 'Invalid pack selected' });
    }

    // Calculate invoice if not provided
    const calculatedInvoice = {
      packPrice: packDetails.price,
      additionalCharges: invoice?.additionalCharges || 0,
      discount: invoice?.discount || 0,
      totalPrice: packDetails.price + (invoice?.additionalCharges || 0) - (invoice?.discount || 0),
      paidAmount: invoice?.paidAmount || 0,
      remainingAmount: packDetails.price + (invoice?.additionalCharges || 0) - (invoice?.discount || 0) - (invoice?.paidAmount || 0)
    };

    const reservation = new Reservation({
      customerName,
      customerPhone,
      customerEmail,
      date,
      period,
      pack,
      typePhotographie,
      teamPreference,
      assignedEmployers: assignedEmployers || [],
      invoice: invoice || calculatedInvoice,
      notes
    });

    const savedReservation = await reservation.save();
    
    // Populate the saved reservation with related data
    const populatedReservation = await Reservation.findById(savedReservation._id)
      .populate('pack', 'name price features')
      .populate('typePhotographie', 'name description photo')
      .populate('assignedEmployers', 'username fullName');
    
    res.status(201).json(populatedReservation);
  } catch (error) {
    console.error('Error creating reservation:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update reservation
router.put('/:id', async (req, res) => {
  try {
    const updatedReservation = await Reservation.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate('pack', 'name price features')
     .populate('typePhotographie', 'name description photo')
     .populate('assignedEmployers', 'username fullName');
    
    if (!updatedReservation) {
      return res.status(404).json({ message: 'Reservation not found' });
    }
    
    res.json(updatedReservation);
  } catch (error) {
    console.error('Error updating reservation:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update reservation status
router.patch('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    
    const updatedReservation = await Reservation.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true, runValidators: true }
    ).populate('pack', 'name price features')
     .populate('typePhotographie', 'name description photo')
     .populate('assignedEmployers', 'username fullName');
    
    if (!updatedReservation) {
      return res.status(404).json({ message: 'Reservation not found' });
    }
    
    res.json(updatedReservation);
  } catch (error) {
    console.error('Error updating reservation status:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Assign employer to reservation
router.patch('/:id/assign-employer', async (req, res) => {
  try {
    const { employerId } = req.body;
    
    const updatedReservation = await Reservation.findByIdAndUpdate(
      req.params.id,
      { $push: { assignedEmployers: employerId } },
      { new: true, runValidators: true }
    ).populate('pack', 'name price features')
     .populate('typePhotographie', 'name description photo')
     .populate('assignedEmployers', 'username fullName');
    
    if (!updatedReservation) {
      return res.status(404).json({ message: 'Reservation not found' });
    }
    
    res.json(updatedReservation);
  } catch (error) {
    console.error('Error assigning employer:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update invoice details
router.patch('/:id/invoice', async (req, res) => {
  try {
    const { invoice } = req.body;
    
    const updatedReservation = await Reservation.findByIdAndUpdate(
      req.params.id,
      { 
        'invoice.packPrice': invoice.packPrice,
        'invoice.additionalCharges': invoice.additionalCharges || 0,
        'invoice.discount': invoice.discount || 0,
        'invoice.paidAmount': invoice.paidAmount || 0
      },
      { new: true, runValidators: true }
    ).populate('pack', 'name price features')
     .populate('typePhotographie', 'name description photo')
     .populate('assignedEmployers', 'username fullName');
    
    if (!updatedReservation) {
      return res.status(404).json({ message: 'Reservation not found' });
    }
    
    res.json(updatedReservation);
  } catch (error) {
    console.error('Error updating invoice:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete reservation
router.delete('/:id', async (req, res) => {
  try {
    const deletedReservation = await Reservation.findByIdAndDelete(req.params.id);
    
    if (!deletedReservation) {
      return res.status(404).json({ message: 'Reservation not found' });
    }
    
    res.json({ message: 'Reservation deleted successfully' });
  } catch (error) {
    console.error('Error deleting reservation:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get reservations by employer
router.get('/employer/:employerId', async (req, res) => {
  try {
    const reservations = await Reservation.find({ assignedEmployer: req.params.employerId })
      .populate('pack', 'name price features')
      .sort({ date: -1 });
    
    res.json(reservations);
  } catch (error) {
    console.error('Error fetching employer reservations:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get reservations by date range
router.get('/date-range/:startDate/:endDate', async (req, res) => {
  try {
    const { startDate, endDate } = req.params;
    
    const reservations = await Reservation.find({
      date: {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      }
    })
      .populate('pack', 'name price features')
      .populate('assignedEmployers', 'username fullName')
      .sort({ date: 1 });
    
    res.json(reservations);
  } catch (error) {
    console.error('Error fetching reservations by date range:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
