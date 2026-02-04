const mongoose = require('mongoose');
const User = require('./models/User');

// Direct MongoDB URI (same as in .env)
const MONGODB_URI = 'mongodb+srv://hamzatricks:hamzatricks@cluster0.sjxud.mongodb.net/konica';

console.log('Starting admin creation script...');
console.log('MongoDB URI:', MONGODB_URI.substring(0, 20) + '...');

const createAdmin = async () => {
  try {
    // Connect to database
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    // Check if admin already exists
    console.log('Checking for existing admin...');
    const adminExists = await User.findOne({ role: 'admin' });
    if (adminExists) {
      console.log('Admin user already exists:', adminExists.username);
      process.exit(0);
    }

    // Create admin user
    console.log('Creating admin user...');
    const admin = await User.create({
      username: 'konicaadmin',
      password: 'adminkonica',
      role: 'admin'
    });

    console.log('✅ Admin user created successfully!');
    console.log('Username:', admin.username);
    console.log('Role:', admin.role);
    console.log('ID:', admin._id);

    // Disconnect from database
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error creating admin:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
};

createAdmin();
