const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const Reservation = require('../models/Reservation');
const { protect, admin, employer } = require('../middleware/auth');
const { historyMiddleware } = require('../middleware/historyMiddleware');

// Date checking function
const checkDateAvailability = async (date, period) => {
  try {
    // Find all reservations for the given date
    const reservations = await Reservation.find({
      date: new Date(date)
    });

    // Check if there are any reservations for the requested period
    const periodReservations = reservations.filter(res => res.period === period);
    
    if (periodReservations.length > 0) {
      // Check if there's a reservation in the other period
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
    
    return {
      available: true,
      message: 'هذا التاريخ متاح في الفترة المطلوبة'
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
    const { date, period } = req.query;
    
    if (!date || !period) {
      return res.status(400).json({
        success: false,
        message: 'التاريخ والفترة مطلوبان'
      });
    }
    
    const availability = await checkDateAvailability(date, period);
    
    res.json({
      success: true,
      ...availability
    });
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
    console.log('Date:', orderData.date);
    console.log('Additional Items:', orderData.additionalItems);
    console.log('Invoice:', orderData.invoice);
    console.log('============================');
    
    // Check date availability first
    const availability = await checkDateAvailability(orderData.date, orderData.period);
    
    if (!availability.available) {
      return res.status(400).json({
        success: false,
        message: availability.message
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
router.put('/:id/state', protect, employer, historyMiddleware('ORDER_UPDATE', 'Order'), async (req, res) => {
  try {
    const { state } = req.body;
    
    if (!['pending', 'accepted', 'rejected'].includes(state)) {
      return res.status(400).json({
        success: false,
        message: 'الحالة يجب أن تكون إحدى: pending, accepted, rejected'
      });
    }
    
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
router.delete('/:id', protect, admin, historyMiddleware('ORDER_REJECT', 'Order'), async (req, res) => {
  try {
    const order = await Order.findByIdAndDelete(req.params.id);
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'الطلب غير موجود'
      });
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
