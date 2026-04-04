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

    // Check if there's already a reservation for the same date and period (excluding cancelled ones)
    const existingReservation = await Reservation.findOne({
      date: new Date(date),
      period: period,
      status: { $ne: 'cancelled' } // Exclude cancelled reservations
    });

    if (existingReservation) {
      return res.status(400).json({ 
        message: 'يوجد بالفعل حجز في هذا التاريخ والفترة. الرجاء اختيار تاريخ أو فترة أخرى.' 
      });
    }

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
    const { date, period } = req.body;
    
    // Check if there's already a reservation for the same date and period (excluding current reservation)
    if (date && period) {
      const existingReservation = await Reservation.findOne({
        _id: { $ne: req.params.id }, // Exclude current reservation
        date: new Date(date),
        period: period
      });

      if (existingReservation) {
        return res.status(400).json({ 
          message: 'يوجد بالفعل حجز في هذا التاريخ والفترة. الرجاء اختيار تاريخ أو فترة أخرى.' 
        });
      }
    }

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

// Mark all past reservations as completed
router.post('/mark-past-completed', async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Set to start of day for accurate comparison
    
    // Find all reservations with dates before today and status not already completed
    const pastReservations = await Reservation.find({
      date: { $lt: today },
      status: { $ne: 'completed' },
      status: { $ne: 'cancelled' } // Exclude cancelled reservations
    });

    if (pastReservations.length === 0) {
      return res.json({
        message: 'لا توجد حجوزات ماضية تحتاج للتحديث',
        updatedCount: 0
      });
    }

    // Update all past reservations to completed status
    const updatePromises = pastReservations.map(async (reservation) => {
      // Mark as completed and set payment as fully paid
      return Reservation.findByIdAndUpdate(
        reservation._id,
        { 
          status: 'completed',
          'invoice.paidAmount': reservation.invoice.totalPrice,
          'invoice.remainingAmount': 0
        },
        { new: true }
      );
    });

    await Promise.all(updatePromises);

    res.json({
      message: `تم تحديث ${pastReservations.length} حجز إلى حالة مكتمل`,
      updatedCount: pastReservations.length
    });
  } catch (error) {
    console.error('Error marking past reservations as completed:', error);
    res.status(500).json({ 
      message: 'حدث خطأ أثناء تحديث الحجوزات الماضية',
      error: error.message 
    });
  }
});

// Get reservations for a specific employer
router.get('/employer/:employerId', async (req, res) => {
  try {
    const { employerId } = req.params;
    
    console.log('Fetching reservations for employer:', employerId);
    
    // First, let's see all reservations to debug
    const allReservations = await Reservation.find({})
      .populate('pack', 'name price features')
      .populate('typePhotographie', 'name description photo')
      .populate('assignedEmployers', 'username fullName')
      .sort({ date: -1, createdAt: -1 });
    
    console.log('Total reservations in DB:', allReservations.length);
    console.log('All reservations with assignedEmployers:', allReservations.map(r => ({
      id: r._id,
      customer: r.customerName,
      assignedEmployers: r.assignedEmployers,
      assignedEmployersCount: r.assignedEmployers ? r.assignedEmployers.length : 0
    })));
    
    const reservations = await Reservation.find({
      assignedEmployers: employerId
    })
      .populate('pack', 'name price features')
      .populate('typePhotographie', 'name description photo')
      .populate('assignedEmployers', 'username fullName')
      .sort({ date: -1, createdAt: -1 });
    
    console.log('Found reservations:', reservations.length);
    console.log('Reservations:', reservations.map(r => ({
      id: r._id,
      customer: r.customerName,
      assignedEmployers: r.assignedEmployers
    })));
    
    res.json(reservations);
  } catch (error) {
    console.error('Error fetching employer reservations:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
