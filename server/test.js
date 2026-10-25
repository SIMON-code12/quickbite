const db = require('./db');

console.log('--- Testing QuickBite Core Logic ---');

// 1. Verify seed data
console.log('Users count:', db.data.users.length);
console.log('Restaurants count:', db.data.restaurants.length);
console.log('Menu items count:', db.data.menuItems.length);
console.log('Delivery partners count:', db.data.deliveryPartners.length);
console.log('Orders count:', db.data.orders.length);

// 2. Test user lookup & role
const admin = db.findUserByEmail('admin@quickbite.com');
console.log('Admin found:', admin ? admin.name : 'FAIL');

const cust = db.findUserByEmail('customer@quickbite.com');
console.log('Customer found:', cust ? cust.name : 'FAIL');

// 3. Test order status transition
const placedOrder = db.createOrder({
  customerId: cust.userId,
  customerName: cust.name,
  customerPhone: cust.phone,
  deliveryAddress: cust.deliveryAddress,
  restaurantId: 'rest_1',
  restaurantName: 'Royal Spice Kitchen',
  items: [{ itemId: 'item_101', name: 'Hyderabadi Chicken Dum Biryani', price: 240, quantity: 1, subtotal: 240 }],
  subtotal: 240,
  tax: 12,
  deliveryFee: 40,
  totalAmount: 292,
  paymentMethod: 'CARD'
});

console.log('Created Order:', placedOrder.orderId, 'Status:', placedOrder.status);

// Transition to CONFIRMED
const step1 = db.updateOrderStatus(placedOrder.orderId, 'CONFIRMED');
console.log('To CONFIRMED:', step1.success ? 'OK' : step1.error);

// Transition to PREPARING
const step2 = db.updateOrderStatus(placedOrder.orderId, 'PREPARING');
console.log('To PREPARING:', step2.success ? 'OK' : step2.error);

// Transition to READY_FOR_PICKUP
const step3 = db.updateOrderStatus(placedOrder.orderId, 'READY_FOR_PICKUP');
console.log('To READY_FOR_PICKUP:', step3.success ? 'OK' : step3.error);

// Transition to PICKED_UP
const step4 = db.updateOrderStatus(placedOrder.orderId, 'PICKED_UP');
console.log('To PICKED_UP:', step4.success ? 'OK' : step4.error);

// Test illegal cancellation after PICKED_UP (QB-FR-054, BR-06)
const illegalCancel = db.updateOrderStatus(placedOrder.orderId, 'CANCELLED');
console.log('Illegal cancel after pickup refused as expected:', !illegalCancel.success ? 'PASS: ' + illegalCancel.error : 'FAIL');

// Complete to OUT_FOR_DELIVERY and DELIVERED
db.updateOrderStatus(placedOrder.orderId, 'OUT_FOR_DELIVERY');
const delivered = db.updateOrderStatus(placedOrder.orderId, 'DELIVERED');
console.log('To DELIVERED:', delivered.success ? 'OK' : delivered.error);

// Rate order
const ratingRes = db.addRating(placedOrder.orderId, cust.userId, 5, 'Superb food!');
console.log('Rating added:', ratingRes.success ? 'OK' : ratingRes.error);

console.log('Analytics summary:', db.getAnalytics());
console.log('--- Test Completed Successfully! ---');
