const mongoose = require('mongoose');
require('dotenv').config();

async function migrateMultiDayFormat() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb+srv://hamzatricks:hamzatricks@cluster0.sjxud.mongodb.net/konica');
    console.log('Connected to MongoDB');

    const db = mongoose.connection.db;
    const reservationsCol = db.collection('reservations');
    const ordersCol = db.collection('orders');

    function isOldFormat(period) {
      return period && period.startDate !== undefined;
    }

    function expandOldEntry(oldEntry) {
      const entries = [];
      const start = new Date(oldEntry.startDate);
      const end = new Date(oldEntry.endDate);
      const current = new Date(start);
      current.setHours(0, 0, 0, 0);
      const endNormalized = new Date(end);
      endNormalized.setHours(0, 0, 0, 0);

      while (current <= endNormalized) {
        entries.push({
          date: new Date(current),
          period: 'morning',
          description: oldEntry.description || ''
        });
        entries.push({
          date: new Date(current),
          period: 'evening',
          description: oldEntry.description || ''
        });
        current.setDate(current.getDate() + 1);
      }
      return entries;
    }

    function migratePeriods(doc) {
      const oldPeriods = doc.multiDayPeriods || [];
      if (!oldPeriods.some(isOldFormat)) return null; // already new format

      const newPeriods = [];
      for (const entry of oldPeriods) {
        if (isOldFormat(entry)) {
          newPeriods.push(...expandOldEntry(entry));
        } else {
          newPeriods.push(entry);
        }
      }
      return newPeriods;
    }

    // --- Migrate Reservations ---
    const oldReservations = await reservationsCol.find({
      reservationType: 'multi_day',
      'multiDayPeriods.0.startDate': { $exists: true }
    }).toArray();
    console.log(`\nFound ${oldReservations.length} Reservation(s) with old multi-day format`);

    let resUpdated = 0;
    for (const doc of oldReservations) {
      const newPeriods = migratePeriods(doc);
      if (newPeriods) {
        await reservationsCol.updateOne(
          { _id: doc._id },
          { $set: { multiDayPeriods: newPeriods } }
        );
        resUpdated++;
        console.log(`  ✓ Reservation ${doc._id}: ${doc.multiDayPeriods.length} range(s) → ${newPeriods.length} date+period slot(s)`);
      }
    }

    // --- Migrate Orders ---
    const oldOrders = await ordersCol.find({
      reservationType: 'multi_day',
      'multiDayPeriods.0.startDate': { $exists: true }
    }).toArray();
    console.log(`\nFound ${oldOrders.length} Order(s) with old multi-day format`);

    let ordUpdated = 0;
    for (const doc of oldOrders) {
      const newPeriods = migratePeriods(doc);
      if (newPeriods) {
        await ordersCol.updateOne(
          { _id: doc._id },
          { $set: { multiDayPeriods: newPeriods } }
        );
        ordUpdated++;
        console.log(`  ✓ Order ${doc._id}: ${doc.multiDayPeriods.length} range(s) → ${newPeriods.length} date+period slot(s)`);
      }
    }

    // --- Summary ---
    console.log('\n═══════════════════════════════════════');
    console.log('✅ Migration complete');
    console.log(`   Reservations updated: ${resUpdated}`);
    console.log(`   Orders updated:       ${ordUpdated}`);
    console.log('═══════════════════════════════════════\n');

    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  migrateMultiDayFormat();
}

module.exports = migrateMultiDayFormat;
