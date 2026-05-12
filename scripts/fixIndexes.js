const mongoose = require('mongoose');
require('dotenv').config();

async function fixIndexes() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/konica');
    console.log('Connected to MongoDB');

    const db = mongoose.connection.db;
    const collection = db.collection('typephotographies');

    // Check if the unique index exists
    const indexes = await collection.indexInformation();
    const uniqueNameIndex = indexes.find(index => index.name === 'name_1');

    if (uniqueNameIndex) {
      console.log('Found unique index on name field, dropping it...');
      await collection.dropIndex('name_1');
      console.log('Unique index dropped successfully');
    } else {
      console.log('No unique index found on name field');
    }

    // List all current indexes
    const updatedIndexes = await collection.indexInformation();
    console.log('Current indexes:', updatedIndexes);

    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

fixIndexes();
