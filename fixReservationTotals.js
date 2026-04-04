const mongoose = require('mongoose');
const Reservation = require('./models/Reservation');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/konica', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function fixReservationTotals() {
  try {
    console.log('Starting to fix reservation totals...');
    
    // Find all reservations with incorrect totals
    const reservations = await Reservation.find({
      $or: [
        { 'invoice.totalPrice': 0 },
        { 'invoice.totalPrice': { $exists: false } }
      ]
    });
    
    console.log(`Found ${reservations.length} reservations to fix`);
    
    for (const reservation of reservations) {
      // Calculate additional items total
      const additionalItemsTotal = reservation.additionalItems.reduce((total, item) => {
        return total + (item.price * item.quantity);
      }, 0);
      
      // Calculate correct total
      const correctTotal = reservation.invoice.packPrice + 
                        (reservation.invoice.additionalCharges || 0) + 
                        additionalItemsTotal - 
                        (reservation.invoice.discount || 0);
      
      // Update the reservation
      await Reservation.findByIdAndUpdate(reservation._id, {
        'invoice.totalPrice': correctTotal,
        'invoice.remainingAmount': correctTotal - (reservation.invoice.paidAmount || 0)
      });
      
      console.log(`Fixed reservation ${reservation._id}: ${reservation.customerName} - Total: ${correctTotal}`);
    }
    
    console.log('Finished fixing reservation totals');
    process.exit(0);
  } catch (error) {
    console.error('Error fixing reservation totals:', error);
    process.exit(1);
  }
}

fixReservationTotals();
