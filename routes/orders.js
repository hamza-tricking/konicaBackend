const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const Reservation = require('../models/Reservation');
const { protect, admin, employer } = require('../middleware/auth');

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
    const orderData = req.body;
    
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
      ...orderData,
      state: 'pending' // Default state
    });
    
    const savedOrder = await newOrder.save();
    
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
    res.status(500).json({
      success: false,
      message: 'حدث خطأ أثناء إنشاء الطلب'
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

module.exports = router;
