const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

// Direct MongoDB URI
const MONGODB_URI = 'mongodb+srv://hamzatricks:hamzatricks@cluster0.sjxud.mongodb.net/konica';
const PORT = process.env.PORT || 5000;

// Connect to database
const connectDB = async () => {
  try {
    console.log('🔄 Attempting to connect to MongoDB...');
    
    // Add connection options with timeout
    const conn = await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000, // 5 seconds timeout
      connectTimeoutMS: 5000, // 5 seconds timeout
    });
    
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error('❌ Database connection error:', error.message);
    
    // More specific error handling
    if (error.name === 'MongooseServerSelectionError') {
      console.error('🔍 Possible causes:');
      console.error('  - Network connectivity issues');
      console.error('  - MongoDB Atlas IP whitelist');
      console.error('  - Invalid connection string');
      console.error('  - Firewall blocking connection');
    }
    
    process.exit(1);
  }
};

connectDB();

const app = express();

// Middleware
app.use(cors({
  origin: [
    'http://localhost:3000', 
    'http://127.0.0.1:3000', 
    'https://dmtart.pro/konica',
    'https://konica-beta.vercel.app',
    'https://konica-1geua1bvw-hamza-trickings-projects.vercel.app'
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));
app.use(express.json());

// Basic route
app.get('/', (req, res) => {
  res.json({ message: 'Konica Backend API is running...' });
});

// API routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/packs', require('./routes/packs'));
app.use('/api/reservations', require('./routes/reservations'));
app.use('/api/type-photographie', require('./routes/typePhotographie'));
app.use('/api/extra-services', require('./routes/extraServices'));

app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
});
