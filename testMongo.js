const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb+srv://hamzatricks:hamzatricks@cluster0.sjxud.mongodb.net/konica';

console.log('Testing MongoDB connection...');

// Test with a simple connection
mongoose.connect(MONGODB_URI, {
  serverSelectionTimeoutMS: 3000,
  connectTimeoutMS: 3000,
})
.then(() => {
  console.log('✅ SUCCESS: MongoDB connection works!');
  process.exit(0);
})
.catch((error) => {
  console.error('❌ FAILED: Cannot connect to MongoDB');
  console.error('Error:', error.message);
  
  if (error.name === 'MongooseServerSelectionError') {
    console.error('\n🔍 This is likely a MongoDB Atlas IP whitelist issue.');
    console.error('📝 Solution: Add your current IP to MongoDB Atlas whitelist:');
    console.error('1. Go to MongoDB Atlas dashboard');
    console.error('2. Click "Network Access" in left sidebar');
    console.error('3. Click "Add IP Address"');
    console.error('4. Select "Add Current IP Address"');
    console.error('5. Click "Confirm"');
  }
  
  process.exit(1);
});
