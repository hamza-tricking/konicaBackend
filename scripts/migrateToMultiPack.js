const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

async function migrateToMultiPack() {
  try {
    // Connect to MongoDB
    const mongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017/konica';
    await mongoose.connect(mongoURI);
    console.log('Connected to MongoDB:', mongoURI);

    const db = mongoose.connection.db;

    // Migrate Reservations
    const reservations = db.collection('reservations');
    const reservationResult = await reservations.updateMany(
      { pack: { $exists: true }, packs: { $exists: false } },
      [{ $set: { packs: ['$pack'] } }, { $unset: 'pack' }]
    );
    console.log(`Reservations migrated: ${reservationResult.modifiedCount}`);

    // Also handle documents that might have pack as null/undefined
    const reservationResult2 = await reservations.updateMany(
      { pack: { $exists: true, $ne: null }, packs: { $exists: false } },
      { $rename: { pack: 'packs_temp' } }
    );
    // Convert packs_temp to array if it's not already
    if (reservationResult2.modifiedCount > 0) {
      await reservations.updateMany(
        { packs_temp: { $exists: true } },
        [{ $set: { packs: { $cond: { if: { $isArray: '$packs_temp' }, then: '$packs_temp', else: ['$packs_temp'] } } } }, { $unset: 'packs_temp' }]
      );
    }

    // Migrate Orders
    const orders = db.collection('orders');
    const orderResult = await orders.updateMany(
      { pack: { $exists: true }, packs: { $exists: false } },
      [{ $set: { packs: ['$pack'] } }, { $unset: 'pack' }]
    );
    console.log(`Orders migrated: ${orderResult.modifiedCount}`);

    console.log('Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrateToMultiPack();
