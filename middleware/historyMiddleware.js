const { logHistory, getVisibleTo, getRequestInfo } = require('../utils/historyLogger');

// دالة للحصول على الموديل المناسب بناءً على نوع الكيان
const getModel = (entityType) => {
  switch (entityType) {
    case 'Reservation':
      return require('../models/Reservation');
    case 'Order':
      return require('../models/Order');
    case 'User':
      return require('../models/User');
    case 'Pack':
      return require('../models/Pack');
    case 'ExtraService':
      return require('../models/ExtraService');
    case 'TypePhotographie':
      return require('../models/TypePhotographie');
    default:
      throw new Error(`Unknown entity type: ${entityType}`);
  }
};

// Middleware لتسجيل تلقائي للإجراءات
const historyMiddleware = (actionType, entityType) => {
  return async (req, res, next) => {
    // حفظ الـ original functions
    const originalSend = res.send;
    const originalJson = res.json;

    let responseData = null;
    let isSuccess = true;
    let originalDoc = null;

    // Fetch original document BEFORE the update for PUT/PATCH requests
    if (req.method === 'PUT' || req.method === 'PATCH' || req.method === 'DELETE') {
      try {
        const entityId = req.params.id;
        if (entityId) {
          const Model = getModel(entityType);
          originalDoc = await Model.findById(entityId);
          console.log('Original document fetched:', originalDoc?._id);
        }
      } catch (error) {
        console.error('Error fetching original document before update/delete:', error);
      }
    }

    // Intercept response
    res.send = function(data) {
      responseData = data;
      if (res.statusCode >= 400) {
        isSuccess = false;
      }
      return originalSend.call(this, data);
    };

    res.json = function(data) {
      responseData = data;
      if (res.statusCode >= 400) {
        isSuccess = false;
      }
      return originalJson.call(this, data);
    };

    // الاستمرار للـ original handler
    res.on('finish', async () => {
      try {
        console.log('=== HISTORY MIDDLEWARE DEBUG ===');
        console.log('Request method:', req.method);
        console.log('Request URL:', req.originalUrl);
        console.log('User exists:', !!req.user);
        console.log('Response status:', res.statusCode);
        console.log('Is success:', isSuccess);
        console.log('==============================');
        
        // التحقق من وجود مستخدم والإجراء المطلوب
        if (req.user && (req.method === 'POST' || req.method === 'PUT' || req.method === 'DELETE' || req.method === 'PATCH')) {
          const entityId = req.params.id || (responseData && responseData._id) || (responseData && responseData.data && responseData.data._id);
          
          console.log('Entity ID found:', entityId);
          
          if (entityId) {
            // الحصول على visibleTo بشكل ديناميكي
            const visibleTo = await getVisibleTo(actionType, entityType, entityId, req.user.role);
            
            const historyData = {
              actionType,
              description: getDescription(actionType, req.method, entityType),
              entityType,
              entityId,
              performedBy: req.user._id,
              role: req.user.role,
              visibleTo,
              status: isSuccess ? 'success' : 'failure',
              ...getRequestInfo(req)
            };

            console.log('History data to be saved:', historyData);

            // إضافة التغييرات إذا كان هناك update
            if (req.method === 'PUT' || req.method === 'PATCH' || req.method === 'DELETE') {
              let afterDoc = req.body;
              
              if (req.method === 'DELETE') {
                // For DELETE requests, there's no after state
                afterDoc = {};
              } else if (entityId && isSuccess) {
                // For PUT and PATCH requests, get the updated document to show complete state
                try {
                  const Model = getModel(entityType);
                  afterDoc = await Model.findById(entityId);
                  console.log('Updated document fetched for comparison:', afterDoc?._id);
                } catch (error) {
                  console.error('Error fetching updated document:', error);
                  // Fall back to request body if fetch fails
                  afterDoc = req.body;
                }
              }
              
              historyData.changes = {
                before: originalDoc || {},
                after: afterDoc || {}
              };
              console.log('Changes captured - before:', originalDoc?._id, 'after type:', typeof afterDoc);
            }

            await logHistory(historyData);
            console.log('History logged successfully');
          } else {
            console.log('No entity ID found, skipping history logging');
          }
        } else {
          console.log('No user or not a relevant method, skipping history logging');
        }
      } catch (error) {
        console.error('History middleware error:', error);
      }
    });

    next();
  };
};

// دالة لإنشاء الوصف التلقائي
const getDescription = (actionType, method, entityType) => {
  const descriptions = {
    'USER_REGISTER': 'تسجيل مستخدم جديد',
    'USER_LOGIN': 'تسجيل دخول المستخدم',
    'USER_UPDATE': 'تحديث بيانات المستخدم',
    'USER_DELETE': 'حذف المستخدم',
    'RESERVATION_CREATE': 'إنشاء حجز جديد',
    'RESERVATION_UPDATE': 'تحديث الحجز',
    'RESERVATION_CANCEL': 'إلغاء الحجز',
    'RESERVATION_COMPLETE': 'إكمال الحجز',
    'ORDER_CREATE': 'إنشاء طلب جديد',
    'ORDER_UPDATE': 'تحديث الطلب',
    'ORDER_ACCEPT': 'قبول الطلب',
    'ORDER_REJECT': 'حذف الطلب',
    'PACK_CREATE': 'إنشاء باقة جديدة',
    'PACK_UPDATE': 'تحديث الباقة',
    'PACK_DELETE': 'حذف الباقة',
    'SERVICE_CREATE': 'إنشاء خدمة جديدة',
    'SERVICE_UPDATE': 'تحديث الخدمة',
    'SERVICE_DELETE': 'حذف الخدمة',
    'PAYMENT_RECEIVED': 'استلام دفعة',
    'INVOICE_UPDATE': 'تحديث الفاتورة'
  };

  return descriptions[actionType] || `${method} ${entityType}`;
};

// دالة يدوية لتسجيل الإجراءات (للاستخدام الخاص)
const logAction = async (data) => {
  try {
    // الحصول على visibleTo بشكل ديناميكي
    const visibleTo = await getVisibleTo(data.actionType, data.entityType, data.entityId, data.role);
    
    const historyData = {
      actionType: data.actionType,
      description: data.description || getDescription(data.actionType, 'CUSTOM', data.entityType),
      entityType: data.entityType,
      entityId: data.entityId,
      performedBy: data.performedBy,
      role: data.role,
      visibleTo,
      status: data.status || 'success',
      changes: data.changes,
      ipAddress: data.ipAddress,
      userAgent: data.userAgent
    };

    await logHistory(historyData);
    return historyData;
  } catch (error) {
    console.error('Manual log action error:', error);
  }
};

module.exports = {
  historyMiddleware,
  getDescription,
  logAction
};
