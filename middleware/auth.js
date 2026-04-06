const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  let token;

  console.log('=== AUTH DEBUG ===');
  console.log('Request URL:', req.originalUrl);
  console.log('Request method:', req.method);
  console.log('Authorization header:', req.headers.authorization);
  console.log('All headers:', Object.keys(req.headers));
  console.log('==================');

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      // Get token from header
      token = req.headers.authorization.split(' ')[1];

      // Verify token with fallback JWT_SECRET
      const jwtSecret = process.env.JWT_SECRET || 'konica_jwt_secret_2024_hamza_tricks_secure_key_!@#$%^&*()';
      console.log('Using JWT_SECRET:', jwtSecret ? '✅ Available' : '❌ Not available');
      
      const decoded = jwt.verify(token, jwtSecret);

      // Get user from the token
      req.user = await User.findById(decoded.id).select('-password');

      next();
    } catch (error) {
      console.error('JWT verification error:', error.message);
      console.error('Token that failed:', token);
      res.status(401).json({ message: 'Not authorized, token failed' });
    }
  } else {
    console.log('No token found or wrong format');
    console.log('Authorization header exists:', !!req.headers.authorization);
    if (req.headers.authorization) {
      console.log('Authorization header starts with Bearer:', req.headers.authorization.startsWith('Bearer'));
    }
  }

  if (!token) {
    console.log('Sending 401 - No token');
    res.status(401).json({ message: 'Not authorized, no token' });
  }
};

// Admin middleware
const admin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ message: 'Not authorized as admin' });
  }
};

// Employer middleware
const employer = (req, res, next) => {
  if (req.user && (req.user.role === 'admin' || req.user.role === 'employer' || req.user.role === 'sous admin')) {
    next();
  } else {
    res.status(403).json({ message: 'Not authorized as employer' });
  }
};

module.exports = { protect, admin, employer };
