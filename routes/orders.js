const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const Reservation = require('../models/Reservation');
const { protect, admin, employer } = require('../middleware/auth');
const { historyMiddleware, getDescription } = require('../middleware/historyMiddleware');

// Date checking function - updated for multi-day support
const checkDateAvailability = async (reservationData) => {
  try {
    const { reservationType, date, period, multiDayPeriods } = reservationData;
    
    console.log('=== CHECK ORDERS AVAILABILITY ===');
    console.log('Reservation Type:', reservationType);
    console.log('Date:', date);
    console.log('Period:', period);
    console.log('Multi-day Periods:', multiDayPeriods);
    console.log('===============================');
    
    if (reservationType === 'single') {
      // Single day reservation check (original logic)
      const reservations = await Reservation.find({
        date: new Date(date),
        $or: [
          { reservationType: 'single' },
          { reservationType: { $exists: false } } // Include old reservations without reservationType
        ]
      });

      const periodReservations = reservations.filter(res => res.period === period);
      
      if (periodReservations.length > 0) {
        const otherPeriod = period === 'morning' ? 'evening' : 'morning';
        const otherPeriodReservations = reservations.filter(res => res.period === otherPeriod);
        
        if (otherPeriodReservations.length === 0) {
          return {
            available: false,
            message: `هذا التاريخ محجوز في فترة ${period === 'morning' ? 'الصباح' : 'المساء'}، ولكنه متاح في فترة ${otherPeriod === 'morning' ? 'الصباح' : 'المساء'}`
          };
        } else {
          return {
            available: false,
            message: 'هذا اليوم محجوز بالكامل (فترة الصباح والمساء)'
          };
        }
      }
      
      // Check multi-day reservations that might overlap
      const conflictingMultiDay = await Reservation.find({
        reservationType: 'multi_day',
        'multiDayPeriods.startDate': { $lte: new Date(date) },
        'multiDayPeriods.endDate': { $gte: new Date(date) }
      });

      for (const multiDay of conflictingMultiDay) {
        for (const periodRange of multiDay.multiDayPeriods) {
          const periodStart = new Date(periodRange.startDate);
          const periodEnd = new Date(periodRange.endDate);
          const checkDate = new Date(date);
          
          if (checkDate >= periodStart && checkDate <= periodEnd) {
            // Check if there's a period conflict
            let hasPeriodConflict = false;
            
            // If the multi-day period spans both morning and evening, any single period conflicts
            if (periodRange.startPeriod !== periodRange.endPeriod) {
              hasPeriodConflict = true;
            } else {
              // If the multi-day period is single (morning OR evening), check for exact match
              hasPeriodConflict = (period === periodRange.startPeriod);
            }
            
            if (hasPeriodConflict) {
              return {
                available: false,
                message: `هذا التاريخ محجوز ضمن حجز متعدد الأيام (${periodRange.startDate.toLocaleDateString('ar-SA')} - ${periodRange.endDate.toLocaleDateString('ar-SA')})`
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
          date: { $gte: requestedStart, $lte: requestedEnd }
        });
        
        for (const single of singleDayConflicts) {
          const singleDate = new Date(single.date);
          
          // Check if the single date falls within the multi-day period range
          if (singleDate >= requestedStart && singleDate <= requestedEnd) {
            // Now check if there's a period conflict
            let hasPeriodConflict = false;
            
            // If the multi-day period spans both morning and evening, any single period conflicts
            if (requestedPeriod.startPeriod !== requestedPeriod.endPeriod) {
              hasPeriodConflict = true;
            } else {
              // If the multi-day period is single (morning OR evening), check for exact match
              hasPeriodConflict = (single.period === requestedPeriod.startPeriod);
            }
            
            if (hasPeriodConflict) {
              conflicts.push({
                type: 'single',
                date: single.date,
                period: single.period,
                message: `يتعارض مع حجز يوم واحد في ${single.date.toLocaleDateString('ar-SA')} ${single.period === 'morning' ? 'صباحاً' : 'مساءً'}`
              });
            }
          }
        }
        
        // Check multi-day reservations
        const multiDayConflicts = await Reservation.find({
          reservationType: 'multi_day',
          'multiDayPeriods.startDate': { $lte: requestedEnd },
          'multiDayPeriods.endDate': { $gte: requestedStart }
        });
        
        for (const existingMultiDay of multiDayConflicts) {
          for (const existingPeriod of existingMultiDay.multiDayPeriods) {
            const existingStart = new Date(existingPeriod.startDate);
            const existingEnd = new Date(existingPeriod.endDate);
            
            // Check if date ranges overlap
            if (requestedStart <= existingEnd && requestedEnd >= existingStart) {
              // Check if periods overlap
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
                  message: `يتعارض مع حجز متعدد الأيام (${existingPeriod.startDate.toLocaleDateString('ar-SA')} - ${existingPeriod.endDate.toLocaleDateString('ar-SA')})`
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
    console.error('Error checking date availability:', error);
    return {
      available: false,
      message: 'حدث خطأ أثناء التحقق من توفر التاريخ'
    };
  }
};

// Public route to check date availability
router.get('/check-availability', async (req, res) => {
  try {
    const { date, period, reservationType, multiDayPeriods } = req.query;
    
    // Support both old and new formats
    if (date && period && !reservationType) {
      // Old format - single day
      const availability = await checkDateAvailability({
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
      
      const availability = await checkDateAvailability(reservationData);
      
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

// Public route to submit new order
router.post('/', async (req, res) => {
  try {
    console.log('=== ORDER POST REQUEST RECEIVED ===');
    console.log('Request method:', req.method);
    console.log('Request URL:', req.originalUrl);
    console.log('Request headers:', req.headers);
    
    const orderData = req.body;
    
    console.log('=== ORDER SUBMISSION DEBUG ===');
    console.log('Order data received:', JSON.stringify(orderData, null, 2));
    console.log('User from request:', req.user);
    console.log('Pack ID:', orderData.pack);
    console.log('TypePhotographie ID:', orderData.typePhotographie);
    console.log('Reservation Type:', orderData.reservationType);
    console.log('Date:', orderData.date);
    console.log('Multi-day Periods:', orderData.multiDayPeriods);
    console.log('Additional Items:', orderData.additionalItems);
    console.log('Invoice:', orderData.invoice);
    console.log('============================');
    
    // Check date availability first
    const reservationCheckData = {
      reservationType: orderData.reservationType || 'single'
    };
    
    if (orderData.reservationType === 'single') {
      reservationCheckData.date = orderData.date;
      reservationCheckData.period = orderData.period;
    } else if (orderData.reservationType === 'multi_day') {
      reservationCheckData.multiDayPeriods = orderData.multiDayPeriods;
    }
    
    const availability = await checkDateAvailability(reservationCheckData);
    
    if (!availability.available) {
      return res.status(400).json({
        success: false,
        message: availability.message,
        conflicts: availability.conflicts
      });
    }
    
    // Create new order
    const newOrder = new Order({
      ...orderData
      // Remove explicit state setting to use model default ('accepted')
    });
    
    const savedOrder = await newOrder.save();
    console.log('Order saved successfully:', savedOrder._id);
    
    // Create history entry manually since this is a public route
    try {
      const { logHistory } = require('../utils/historyLogger');
      const historyEntry = await logHistory({
        actionType: 'ORDER_CREATE',
        description: 'إنشاء طلب جديد',
        entityType: 'Order',
        entityId: savedOrder._id,
        performedBy: undefined, // Use undefined instead of null for optional field
        role: 'public',
        visibleTo: ['admin', 'sous admin'], // Admin and sous admin can see orders
        status: 'success',
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.get('User-Agent')
      });
      
      console.log('History entry created successfully:', historyEntry._id);
    } catch (historyError) {
      console.error('Error creating history entry:', historyError);
    }
    
    // Populate related data for response
    await savedOrder.populate('pack');
    await savedOrder.populate('typePhotographie');
    
    res.status(201).json({
      success: true,
      message: 'تم إرسال الطلب بنجاح',
      data: savedOrder
    });
  } catch (error) {
    console.error('Error creating order:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    console.error('Order data received:', req.body);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ أثناء إنشاء الطلب',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Admin route to get all orders (protected)
router.get('/', protect, employer, async (req, res) => {
  try {
    const orders = await Order.find()
      .populate('pack')
      .populate('typePhotographie')
      .sort({ createdAt: -1 });
    
    res.json({
      success: true,
      data: orders
    });
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ أثناء جلب الطلبات'
    });
  }
});

// Admin route to get single order by ID (protected)
router.get('/:id', protect, employer, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('pack')
      .populate('typePhotographie');
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'الطلب غير موجود'
      });
    }
    
    res.json({
      success: true,
      data: order
    });
  } catch (error) {
    console.error('Error fetching order:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ أثناء جلب الطلب'
    });
  }
});

// Admin route to update order state (protected)
router.put('/:id/state', protect, employer, async (req, res) => {
  try {
    const { state } = req.body;
    
    if (!['pending', 'accepted', 'rejected'].includes(state)) {
      return res.status(400).json({
        success: false,
        message: 'الحالة يجب أن تكون إحدى: pending, accepted, rejected'
      });
    }
    
    // Determine action type based on state
    let actionType;
    if (state === 'accepted') {
      actionType = 'ORDER_ACCEPT';
    } else if (state === 'rejected') {
      actionType = 'ORDER_REJECT';
    } else {
      actionType = 'ORDER_UPDATE';
    }
    
    // Get original order for history before updating
    const originalOrder = await Order.findById(req.params.id);
    
    const updatedOrder = await Order.findByIdAndUpdate(
      req.params.id,
      { state },
      { new: true }
    ).populate('pack').populate('typePhotographie');
    
    if (!updatedOrder) {
      return res.status(404).json({
        success: false,
        message: 'الطلب غير موجود'
      });
    }
    
    // Create history entry manually with correct action type
    try {
      const { logHistory } = require('../utils/historyLogger');
      const historyEntry = await logHistory({
        actionType,
        description: getDescription(actionType, 'PUT', 'Order'),
        entityType: 'Order',
        entityId: updatedOrder._id,
        performedBy: req.user._id,
        role: req.user.role,
        visibleTo: ['admin', 'sous admin'],
        status: 'success',
        changes: {
          before: originalOrder || {},
          after: updatedOrder
        },
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.get('User-Agent')
      });
      
      console.log('History entry created successfully:', historyEntry._id);
    } catch (historyError) {
      console.error('Error creating history entry:', historyError);
    }
    
    res.json({
      success: true,
      message: 'تم تحديث حالة الطلب بنجاح',
      data: updatedOrder
    });
  } catch (error) {
    console.error('Error updating order state:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ أثناء تحديث حالة الطلب'
    });
  }
});

// Admin route to delete order (protected)
router.delete('/:id', protect, admin, async (req, res) => {
  try {
    // Get the order before deleting for history
    const order = await Order.findById(req.params.id);
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'الطلب غير موجود'
      });
    }
    
    // Now delete the order
    await Order.findByIdAndDelete(req.params.id);
    
    // Create history entry manually
    try {
      const { logHistory } = require('../utils/historyLogger');
      const historyEntry = await logHistory({
        actionType: 'ORDER_DELETE',
        description: getDescription('ORDER_DELETE', 'DELETE', 'Order'),
        entityType: 'Order',
        entityId: order._id,
        performedBy: req.user._id,
        role: req.user.role,
        visibleTo: ['admin', 'sous admin'],
        status: 'success',
        changes: {
          before: order,
          after: {}
        },
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.get('User-Agent')
      });
      
      console.log('History entry created successfully:', historyEntry._id);
    } catch (historyError) {
      console.error('Error creating history entry:', historyError);
    }
    
    res.json({
      success: true,
      message: 'تم حذف الطلب بنجاح'
    });
  } catch (error) {
    console.error('Error deleting order:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ أثناء حذف الطلب'
    });
  }
});

module.exports = router;
