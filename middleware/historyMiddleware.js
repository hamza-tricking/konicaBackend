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

// دالة للتحقق من وجود تغييرات حقيقية
const hasRealChanges = (before, after) => {
  if (!before || !after) return true;
  
  console.log('=== COMPARING DOCUMENTS ===');
  console.log('Before:', before._id, 'Populated fields:', {
    pack: before.pack,
    typePhotographie: before.typePhotographie,
    assignedEmployers: before.assignedEmployers
  });
  console.log('After:', after._id, 'Populated fields:', {
    pack: after.pack,
    typePhotographie: after.typePhotographie,
    assignedEmployers: after.assignedEmployers
  });
  
  // Technical fields to ignore
  const technicalFields = ['_id', '__v', 'createdAt', 'updatedAt'];
  
  // Get all keys from both objects
  const beforeObj = before.toObject ? before.toObject() : before;
  const afterObj = after.toObject ? after.toObject() : after;
  const allKeys = new Set([...Object.keys(beforeObj), ...Object.keys(afterObj)]);
  
  for (const key of allKeys) {
    // Skip technical fields
    if (technicalFields.includes(key)) continue;
    
    const beforeValue = beforeObj[key];
    const afterValue = afterObj[key];
    
    // Handle nested objects
    if (typeof beforeValue === 'object' && typeof afterValue === 'object' && 
        beforeValue !== null && afterValue !== null && 
        !Array.isArray(beforeValue) && !Array.isArray(afterValue)) {
      
      // Recursively check nested objects
      if (hasRealChanges(beforeValue, afterValue)) {
        return true;
      }
    } else {
      // For populated references, compare by _id if available, otherwise by value
      let beforeComparable = beforeValue;
      let afterComparable = afterValue;
      
      // Handle populated objects
      if (beforeValue && typeof beforeValue === 'object' && beforeValue._id) {
        beforeComparable = beforeValue._id;
      }
      if (afterValue && typeof afterValue === 'object' && afterValue._id) {
        afterComparable = afterValue._id;
      }
      
      // Compare values
      const beforeStr = JSON.stringify(beforeComparable);
      const afterStr = JSON.stringify(afterComparable);
      
      if (beforeStr !== afterStr) {
        console.log(`Change detected in field '${key}':`, {
          before: beforeComparable,
          after: afterComparable,
          beforeType: typeof beforeComparable,
          afterType: typeof afterComparable
        });
        return true;
      }
    }
  }
  
  console.log('No real changes detected');
  return false;
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
          let query = Model.findById(entityId);
          
          // Populate related fields based on entity type
          if (entityType === 'Reservation') {
            query = query.populate('pack', 'name price features')
                      .populate('typePhotographie', 'name description photo')
                      .populate('assignedEmployers', 'username fullName');
          } else if (entityType === 'Order') {
            query = query.populate('pack', 'name price features')
                      .populate('typePhotographie', 'name description photo');
          } else if (entityType === 'User') {
            query = query.select('-password'); // Exclude password
          }
          
          originalDoc = await query;
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
              let shouldLogHistory = true;
              
              if (req.method === 'DELETE') {
                // For DELETE requests, there's no after state
                afterDoc = {};
              } else if (entityId && isSuccess) {
                // For PUT and PATCH requests, get the updated document to show complete state
                try {
                  const Model = getModel(entityType);
                  let query = Model.findById(entityId);
                  
                  // Populate related fields based on entity type
                  if (entityType === 'Reservation') {
                    query = query.populate('pack', 'name price features')
                              .populate('typePhotographie', 'name description photo')
                              .populate('assignedEmployers', 'username fullName');
                  } else if (entityType === 'Order') {
                    query = query.populate('pack', 'name price features')
                              .populate('typePhotographie', 'name description photo');
                  } else if (entityType === 'User') {
                    query = query.select('-password'); // Exclude password
                  }
                  
                  afterDoc = await query;
                  console.log('Updated document fetched for comparison:', afterDoc?._id);
                } catch (error) {
                  console.error('Error fetching updated document:', error);
                  // Fall back to request body if fetch fails
                  afterDoc = req.body;
                }
              }
              
              // Check if there are real changes (only for PUT/PATCH)
              if ((req.method === 'PUT' || req.method === 'PATCH') && originalDoc && afterDoc) {
                shouldLogHistory = hasRealChanges(originalDoc, afterDoc);
              }
              
              if (shouldLogHistory) {
                historyData.changes = {
                  before: originalDoc || {},
                  after: afterDoc || {}
                };
                console.log('Changes captured - before:', originalDoc?._id, 'after type:', typeof afterDoc);
                
                await logHistory(historyData);
                console.log('History logged successfully');
              } else {
                console.log('Skipping history logging - no real changes detected');
              }
            } else {
              // For POST requests, always log history
              await logHistory(historyData);
              console.log('History logged successfully for POST request');
            }
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
    'RESERVATION_CANCEL': 'حذف الحجز',
    'RESERVATION_COMPLETE': 'إكمال الحجز',
    'ORDER_CREATE': 'إنشاء طلب جديد',
    'ORDER_UPDATE': 'تحديث الطلب',
    'ORDER_ACCEPT': 'قبول الطلب',
    'ORDER_REJECT': 'رفض الطلب',
    'ORDER_DELETE': 'حذف الطلب',
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
