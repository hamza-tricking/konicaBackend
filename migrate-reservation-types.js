const mongoose = require('mongoose');
const Reservation = require('./models/Reservation');

// Migration script to add reservationType to existing reservations
async function migrateReservationTypes() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/konica', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('Connected to MongoDB');

    // Find all reservations without reservationType
    const reservationsWithoutType = await Reservation.find({
      reservationType: { $exists: false }
    });

    console.log(`Found ${reservationsWithoutType.length} reservations without reservationType`);

    // Update all of them to have reservationType: 'single'
    const updateResult = await Reservation.updateMany(
      { reservationType: { $exists: false } },
      { $set: { reservationType: 'single' } }
    );

    console.log(`Updated ${updateResult.modifiedCount} reservations to have reservationType: 'single'`);

    // Verify the update
    const remainingWithoutType = await Reservation.countDocuments({
      reservationType: { $exists: false }
    });

    console.log(`Remaining reservations without reservationType: ${remainingWithoutType}`);

    if (remainingWithoutType === 0) {
      console.log('✅ Migration completed successfully!');
    } else {
      console.log('⚠️ Migration incomplete - some reservations still missing reservationType');
    }

  } catch (error) {
    console.error('Error during migration:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the migration
if (require.main === module) {
  migrateReservationTypes();
}

module.exports = migrateReservationTypes;
