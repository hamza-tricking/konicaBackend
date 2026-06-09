const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const Reservation = require('../models/Reservation');
const { protect, admin, employer } = require('../middleware/auth');
const { historyMiddleware, getDescription } = require('../middleware/historyMiddleware');

// Helper to check if a specific date+period is available (for orders, check against reservations)
const checkSingleSlotAvailability = async (date, period) => {
  const existing = await Reservation.findOne({
    $or: [
      { date: new Date(date), period: period, status: { $ne: 'cancelled' }, reservationType: { $in: ['single', undefined, null] } },
      { reservationType: 'multi_day', 'multiDayPeriods': { $elemMatch: { date: new Date(date), period: period } }, status: { $ne: 'cancelled' } }
    ]
  });
  return !existing;
};

// Date checking function - simplified for specific dates
const checkDateAvailability = async (reservationData) => {
  try {
    const { reservationType, date, period, multiDayPeriods } = reservationData;
    
    if (reservationType === 'multi_day' && multiDayPeriods && multiDayPeriods.length > 0) {
      const conflicts = [];
      for (const slot of multiDayPeriods) {
        const available = await checkSingleSlotAvailability(slot.date, slot.period);
        if (!available) {
          const d = new Date(slot.date);
          conflicts.push({
            date: slot.date,
            period: slot.period,
            message: `${d.toLocaleDateString('en-US')} ${slot.period === 'morning' ? 'صباحاً' : 'مساءً'} - هذا الموعد محجوز بالفعل`
          });
        }
      }
      if (conflicts.length > 0) {
        return { available: false, message: 'توجد تعارضات في المواعيد المحددة', conflicts };
      }
      return { available: true, message: 'جميع المواعيد المحددة متاحة' };
    }
    
    // Single day check
    if (!date || !period) {
      return { available: false, message: 'التاريخ والفترة مطلوبان' };
    }
    const available = await checkSingleSlotAvailability(date, period);
    return {
      available,
      message: available ? 'هذا التاريخ متاح في الفترة المطلوبة' : 'يوجد بالفعل حجز في هذا التاريخ والفترة'
    };
  } catch (error) {
    console.error('Error checking date availability:', error);
    return { available: false, message: 'حدث خطأ أثناء التحقق من توفر التاريخ' };
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
    
    // Prepare order data with proper date conversion
    const preparedOrderData = {
      ...orderData
    };
    
    // Convert multiDayPeriods dates to Date objects if present
    if (preparedOrderData.multiDayPeriods && Array.isArray(preparedOrderData.multiDayPeriods)) {
      preparedOrderData.multiDayPeriods = preparedOrderData.multiDayPeriods.map(slot => ({
        ...slot,
        date: slot.date ? new Date(slot.date) : undefined
      }));
    }
    
    // Create new order
    const newOrder = new Order(preparedOrderData);
    
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
