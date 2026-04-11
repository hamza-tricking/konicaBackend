const express = require('express');
const Reservation = require('../models/Reservation');
const Pack = require('../models/Pack');
const { historyMiddleware } = require('../middleware/historyMiddleware');
const { protect, employer } = require('../middleware/auth');
const router = express.Router();

// Log all incoming requests
router.use((req, res, next) => {
  console.log(`=== ${req.method} ${req.originalUrl} ===`);
  console.log('Headers:', req.headers);
  console.log('Body:', req.body);
  next();
});

// Date checking function for reservations - updated for multi-day support
const checkReservationAvailability = async (reservationData) => {
  try {
    const { reservationType, date, period, multiDayPeriods } = reservationData;
    
    console.log('=== CHECK RESERVATION AVAILABILITY ===');
    console.log('Reservation Type:', reservationType);
    console.log('Date:', date);
    console.log('Period:', period);
    console.log('Multi-day Periods:', multiDayPeriods);
    console.log('=======================================');
    
    if (reservationType === 'single') {
      // Single day reservation check
      const existingReservation = await Reservation.findOne({
        date: new Date(date),
        period: period,
        status: { $ne: 'cancelled' },
        $or: [
          { reservationType: 'single' },
          { reservationType: { $exists: false } } // Include old reservations without reservationType
        ]
      });

      if (existingReservation) {
        return {
          available: false,
          message: 'يوجد بالفعل حجز في هذا التاريخ والفترة'
        };
      }
      
      // Check multi-day reservations that might overlap
      const conflictingMultiDay = await Reservation.find({
        reservationType: 'multi_day',
        'multiDayPeriods.startDate': { $lte: new Date(date) },
        'multiDayPeriods.endDate': { $gte: new Date(date) },
        status: { $ne: 'cancelled' }
      });

      console.log('Found conflicting multi-day reservations:', conflictingMultiDay.length);

      for (const multiDay of conflictingMultiDay) {
        console.log('Checking multi-day reservation:', multiDay._id);
        for (const periodRange of multiDay.multiDayPeriods) {
          const periodStart = new Date(periodRange.startDate);
          const periodEnd = new Date(periodRange.endDate);
          const checkDate = new Date(date);
          
          console.log('Period Range:', {
            start: periodStart.toISOString().split('T')[0],
            end: periodEnd.toISOString().split('T')[0],
            startPeriod: periodRange.startPeriod,
            endPeriod: periodRange.endPeriod
          });
          console.log('Check Date:', checkDate.toISOString().split('T')[0]);
          
          if (checkDate >= periodStart && checkDate <= periodEnd) {
            console.log('Date is within range!');
            // Check if there's a period conflict
            let hasPeriodConflict = false;
            
            // If the multi-day period spans both morning and evening, any single period conflicts
            if (periodRange.startPeriod !== periodRange.endPeriod) {
              console.log('Multi-day spans both periods, any single period conflicts');
              hasPeriodConflict = true;
            } else {
              // If the multi-day period is single (morning OR evening), check for exact match
              console.log('Multi-day is single period, checking exact match');
              hasPeriodConflict = (period === periodRange.startPeriod);
              console.log('Period match:', period, '===', periodRange.startPeriod, '=', hasPeriodConflict);
            }
            
            if (hasPeriodConflict) {
              console.log('CONFLICT FOUND!');
              return {
                available: false,
                message: `هذا التاريخ محجوز ضمن حجز متعدد الأيام (${periodRange.startDate.toLocaleDateString('en-US')} - ${periodRange.endDate.toLocaleDateString('en-US')})`
              };
            }
          }
        }
      }
      
      return {
        available: true,
        message: 'هذا التاريخ متاح في الفترة المطلوبة'
      };
      
    } else if (reservationType === 'multi_day') {
      // Multi-day reservation check
      const conflicts = [];
      
      for (const requestedPeriod of multiDayPeriods) {
        const requestedStart = new Date(requestedPeriod.startDate);
        const requestedEnd = new Date(requestedPeriod.endDate);
        
        // Check single day reservations
        const singleDayConflicts = await Reservation.find({
          $or: [
            { reservationType: 'single' },
            { reservationType: { $exists: false } } // Include old reservations without reservationType
          ],
          date: { $gte: requestedStart, $lte: requestedEnd },
          status: { $ne: 'cancelled' }
        });
        
        console.log('Found single day conflicts:', singleDayConflicts.length);
        
        for (const single of singleDayConflicts) {
          const singleDate = new Date(single.date);
          
          console.log('Checking single reservation:', {
            date: singleDate.toISOString().split('T')[0],
            period: single.period
          });
          console.log('Requested period range:', {
            start: requestedStart.toISOString().split('T')[0],
            end: requestedEnd.toISOString().split('T')[0],
            startPeriod: requestedPeriod.startPeriod,
            endPeriod: requestedPeriod.endPeriod
          });
          
          // Check if the single date falls within the multi-day period range
          if (singleDate >= requestedStart && singleDate <= requestedEnd) {
            console.log('Single date is within multi-day range!');
            // Now check if there's a period conflict
            let hasPeriodConflict = false;
            
            // If the multi-day period spans both morning and evening, any single period conflicts
            if (requestedPeriod.startPeriod !== requestedPeriod.endPeriod) {
              console.log('Requested period spans both, any single period conflicts');
              hasPeriodConflict = true;
            } else {
              // If the multi-day period is single (morning OR evening), check for exact match
              console.log('Requested period is single, checking exact match');
              hasPeriodConflict = (single.period === requestedPeriod.startPeriod);
              console.log('Period match:', single.period, '===', requestedPeriod.startPeriod, '=', hasPeriodConflict);
            }
            
            if (hasPeriodConflict) {
              console.log('SINGLE CONFLICT FOUND!');
              conflicts.push({
                type: 'single',
                date: single.date,
                period: single.period,
                message: `يتعارض مع حجز يوم واحد في ${single.date.toLocaleDateString('en-US')} ${single.period === 'morning' ? 'صباحاً' : 'مساءً'}`
              });
            }
          }
        }
        
        // Check multi-day reservations
        const multiDayConflicts = await Reservation.find({
          reservationType: 'multi_day',
          'multiDayPeriods.startDate': { $lte: requestedEnd },
          'multiDayPeriods.endDate': { $gte: requestedStart },
          status: { $ne: 'cancelled' }
        });
        
        for (const existingMultiDay of multiDayConflicts) {
          for (const existingPeriod of existingMultiDay.multiDayPeriods) {
            const existingStart = new Date(existingPeriod.startDate);
            const existingEnd = new Date(existingPeriod.endDate);
            
            if (requestedStart <= existingEnd && requestedEnd >= existingStart) {
              const periodOverlap = 
                (requestedPeriod.startPeriod === existingPeriod.startPeriod) ||
                (requestedPeriod.endPeriod === existingPeriod.endPeriod) ||
                (requestedPeriod.startPeriod === existingPeriod.endPeriod) ||
                (requestedPeriod.endPeriod === existingPeriod.startPeriod);
                
              if (periodOverlap) {
                conflicts.push({
                  type: 'multi_day',
                  startDate: existingPeriod.startDate,
                  endDate: existingPeriod.endDate,
                  message: `يتعارض مع حجز متعدد الأيام (${existingPeriod.startDate.toLocaleDateString('en-US')} - ${existingPeriod.endDate.toLocaleDateString('en-US')})`
                });
              }
            }
          }
        }
      }
      
      if (conflicts.length > 0) {
        return {
          available: false,
          message: 'توجد تعارضات في الفترات المطلوبة',
          conflicts: conflicts
        };
      }
      
      return {
        available: true,
        message: 'الفترات المطلوبة متاحة للحجز'
      };
    }
    
    return {
      available: false,
      message: 'نوع الحجز غير صالح'
    };
  } catch (error) {
    console.error('Error checking reservation availability:', error);
    return {
      available: false,
      message: 'حدث خطأ أثناء التحقق من توفر التاريخ'
    };
  }
};

// Check availability endpoint for reservations
router.get('/check-availability', async (req, res) => {
  try {
    const { date, period, reservationType, multiDayPeriods } = req.query;
    
    // Support both old and new formats
    if (date && period && !reservationType) {
      // Old format - single day
      const availability = await checkReservationAvailability({
        reservationType: 'single',
        date,
        period
      });
      
      res.json({
        success: true,
        ...availability
      });
    } else if (reservationType) {
      // New format - support both types
      const reservationData = {
        reservationType
      };
      
      if (reservationType === 'single') {
        if (!date || !period) {
          return res.status(400).json({
            success: false,
            message: 'التاريخ والفترة مطلوبان للحجوزات الفردية'
          });
        }
        reservationData.date = date;
        reservationData.period = period;
      } else if (reservationType === 'multi_day') {
        if (!multiDayPeriods) {
          return res.status(400).json({
            success: false,
            message: 'الفترات المتعددة مطلوبة للحجوزات متعددة الأيام'
          });
        }
        try {
          reservationData.multiDayPeriods = JSON.parse(multiDayPeriods);
        } catch (e) {
          return res.status(400).json({
            success: false,
            message: 'صيغة الفترات المتعددة غير صالحة'
          });
        }
      }
      
      const availability = await checkReservationAvailability(reservationData);
      
      res.json({
        success: true,
        ...availability
      });
    } else {
      return res.status(400).json({
        success: false,
        message: 'بيانات غير كافية للتحقق من التوفر'
      });
    }
  } catch (error) {
    console.error('Error in check-availability:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في الخادم'
    });
  }
});

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
    console.log('=== RESERVATION POST REQUEST RECEIVED ===');
    console.log('Request method:', req.method);
    console.log('Request URL:', req.originalUrl);
    console.log('User from request:', req.user);
    
    const {
      customerName,
      customerPhone,
      customerEmail,
      date,
      period,
      reservationType = 'single',
      multiDayPeriods,
      pack,
      typePhotographie,
      teamPreference,
      assignedEmployers,
      invoice,
      notes
    } = req.body;

    // Check availability first
    const reservationCheckData = {
      reservationType
    };
    
    if (reservationType === 'single') {
      reservationCheckData.date = date;
      reservationCheckData.period = period;
    } else if (reservationType === 'multi_day') {
      reservationCheckData.multiDayPeriods = multiDayPeriods;
    }
    
    const availability = await checkReservationAvailability(reservationCheckData);
    
    if (!availability.available) {
      return res.status(400).json({
        success: false,
        message: availability.message,
        conflicts: availability.conflicts
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

    const reservationData = {
      customerName,
      customerPhone,
      customerEmail,
      pack,
      typePhotographie,
      teamPreference,
      assignedEmployers: assignedEmployers || [],
      invoice: invoice || calculatedInvoice,
      notes,
      reservationType
    };

    // Add date/period or multiDayPeriods based on type
    if (reservationType === 'single') {
      reservationData.date = date;
      reservationData.period = period;
    } else if (reservationType === 'multi_day') {
      reservationData.multiDayPeriods = multiDayPeriods;
    }

    // Prepare reservation data with proper date conversion
    const preparedReservationData = {
      ...reservationData
    };
    
    // Convert multiDayPeriods dates to Date objects if present
    if (preparedReservationData.multiDayPeriods && Array.isArray(preparedReservationData.multiDayPeriods)) {
      preparedReservationData.multiDayPeriods = preparedReservationData.multiDayPeriods.map(period => ({
        ...period,
        startDate: period.startDate ? new Date(period.startDate) : undefined,
        endDate: period.endDate ? new Date(period.endDate) : undefined
      }));
    }
    
    const reservation = new Reservation(preparedReservationData);

    const savedReservation = await reservation.save();
    console.log('Reservation saved successfully:', savedReservation._id);
    
    // Create history entry manually since this is a public route
    try {
      const { logHistory } = require('../utils/historyLogger');
      const historyEntry = await logHistory({
        actionType: 'RESERVATION_CREATE',
        description: 'إنشاء حجز جديد',
        entityType: 'Reservation',
        entityId: savedReservation._id,
        performedBy: undefined, // Use undefined instead of null for optional field
        role: 'public',
        visibleTo: ['admin', 'sous admin'], // Admin and sous admin can see reservations
        status: 'success',
        changes: {
          before: {}, // No before state for creation
          after: savedReservation // Include the created reservation details
        },
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.get('User-Agent')
      });
      
      console.log('History entry created successfully:', historyEntry._id);
    } catch (historyError) {
      console.error('Error creating history entry:', historyError);
    }
    
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
router.put('/:id', protect, employer, historyMiddleware('RESERVATION_UPDATE', 'Reservation'), async (req, res) => {
  console.log('=== PUT REQUEST RECEIVED ===');
  console.log('Method:', req.method);
  console.log('URL:', req.originalUrl);
  console.log('Params:', req.params);
  
  try {
    console.log('=== UPDATING RESERVATION ===');
    console.log('Reservation ID:', req.params.id);
    console.log('Request body:', JSON.stringify(req.body, null, 2));
    
    const { date, period, reservationType, multiDayPeriods } = req.body;
    
    console.log('Extracted fields:');
    console.log('- date:', date);
    console.log('- period:', period);
    console.log('- reservationType:', reservationType);
    console.log('- multiDayPeriods:', multiDayPeriods);
    
    // Check for conflicts based on reservation type
    if (reservationType === 'single' && date && period) {
      // Check single-day reservation conflicts
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
    } else if (reservationType === 'multi_day' && multiDayPeriods && multiDayPeriods.length > 0) {
      // Check multi-day reservation conflicts
      for (const period of multiDayPeriods) {
        const startDate = new Date(period.startDate);
        const endDate = new Date(period.endDate);
        
        const conflictingReservation = await Reservation.findOne({
          _id: { $ne: req.params.id },
          reservationType: 'multi_day',
          'multiDayPeriods': {
            $elemMatch: {
              $or: [
                { 
                  startDate: { $lte: endDate },
                  endDate: { $gte: startDate }
                }
              ]
            }
          }
        });

        if (conflictingReservation) {
          return res.status(400).json({ 
            message: 'يوجد بالفعل حجز في هذه الفترة. الرجاء اختيار فترة أخرى.' 
          });
        }
      }
    }

    // Update reservation with proper validation
    const updateData = { ...req.body };
    
    // Handle multiDayPeriods validation
    if (reservationType === 'multi_day' && multiDayPeriods) {
      updateData.multiDayPeriods = multiDayPeriods;
    } else if (reservationType === 'single') {
      updateData.multiDayPeriods = undefined; // Clear multi-day periods for single reservations
    }

    console.log('About to update reservation with data:', JSON.stringify(updateData, null, 2));
    
    console.log('Attempting to update reservation...');
    
    const updatedReservation = await Reservation.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).populate('pack', 'name price features')
     .populate('typePhotographie', 'name description photo')
     .populate('assignedEmployers', 'username fullName');
    
    console.log('Update completed, checking result...');
    
    console.log('Update completed successfully');
    
    if (!updatedReservation) {
      return res.status(404).json({ message: 'Reservation not found' });
    }
    
    res.json(updatedReservation);
  } catch (error) {
    console.error('=== ERROR UPDATING RESERVATION ===');
    console.error('Error details:', error);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    console.error('Validation errors:', error.errors);
    
    // Send detailed error in development
    if (process.env.NODE_ENV === 'development') {
      res.status(500).json({ 
        message: 'Server error', 
        details: error.message,
        stack: error.stack 
      });
    } else {
      res.status(500).json({ message: 'Server error' });
    }
  }
});

// Update reservation status
router.patch('/:id/status', protect, employer, historyMiddleware('RESERVATION_UPDATE', 'Reservation'), async (req, res) => {
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
router.patch('/:id/assign-employer', protect, employer, historyMiddleware('RESERVATION_UPDATE', 'Reservation'), async (req, res) => {
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
router.patch('/:id/invoice', protect, employer, historyMiddleware('INVOICE_UPDATE', 'Reservation'), async (req, res) => {
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
router.delete('/:id', protect, employer, historyMiddleware('RESERVATION_CANCEL', 'Reservation'), async (req, res) => {
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
