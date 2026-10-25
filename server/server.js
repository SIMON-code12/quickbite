const express = require('express');
const cors = require('cors');
const path = require('path');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'quickbite_secret_jwt_key_2026';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// --- Auth Middleware ---
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required. Please log in.' });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: 'Session expired or invalid token.' });
    }
    const user = db.findUserById(decoded.userId);
    if (!user || !user.active) {
      return res.status(403).json({ error: 'User account not found or deactivated.' });
    }
    req.user = user;
    next();
  });
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ 
        error: `Forbidden: This action requires one of the following roles: ${roles.join(', ')}` 
      });
    }
    next();
  };
}

// ---------------------------------------------------------------------------
// 4.1 & 4.2 Authentication and Profile Routes
// ---------------------------------------------------------------------------

// SCR-01 & QB-FR-001 - QB-FR-005: Registration
app.post('/api/auth/register', (req, res) => {
  const { name, email, phone, password, deliveryAddress } = req.body;

  const missing = [];
  if (!name || !name.trim()) missing.push('name');
  if (!email || !email.trim()) missing.push('email');
  if (!phone || !phone.trim()) missing.push('phone');
  if (!password || !password.trim()) missing.push('password');

  if (missing.length > 0) {
    return res.status(400).json({ error: `Missing mandatory field(s): ${missing.join(', ')}` });
  }

  // TBD-03 Login validation rules:
  // Email format check
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email.trim())) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }

  // Phone validation (at least 10 digits)
  const phoneClean = phone.replace(/[^0-9]/g, '');
  if (phoneClean.length < 10) {
    return res.status(400).json({ error: 'Phone number must have at least 10 digits.' });
  }

  // Password rules: minimum 6 characters
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
  }

  // Check unique email (QB-FR-004)
  const existing = db.findUserByEmail(email);
  if (existing) {
    return res.status(400).json({ error: 'An account with this email address already exists.' });
  }

  const newUser = db.createUser({
    name,
    email,
    phone,
    deliveryAddress: deliveryAddress || '',
    password,
    role: 'CUSTOMER'
  });

  const token = jwt.sign(
    { userId: newUser.userId, email: newUser.email, role: newUser.role },
    JWT_SECRET,
    { expiresIn: '24h' }
  );

  res.status(201).json({
    message: 'Registration successful! Welcome to QuickBite.',
    token,
    user: {
      userId: newUser.userId,
      name: newUser.name,
      email: newUser.email,
      phone: newUser.phone,
      deliveryAddress: newUser.deliveryAddress,
      role: newUser.role
    }
  });
});

// SCR-02 & QB-FR-006 - QB-FR-009: Login
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;

  // QB-FR-008: Reject empty or mismatch with generic message that does not reveal which was wrong
  if (!email || !password || !email.trim() || !password.trim()) {
    return res.status(400).json({ error: 'Invalid email or password.' });
  }

  const user = db.findUserByEmail(email.trim());
  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  if (!user.active) {
    return res.status(403).json({ error: 'This account has been deactivated. Please contact administrator.' });
  }

  const isMatch = bcrypt.compareSync(password, user.passwordHash);
  if (!isMatch) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  const token = jwt.sign(
    { userId: user.userId, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: '24h' }
  );

  res.json({
    message: 'Login successful.',
    token,
    user: {
      userId: user.userId,
      name: user.name,
      email: user.email,
      phone: user.phone,
      deliveryAddress: user.deliveryAddress,
      role: user.role,
      restaurantId: user.restaurantId || null,
      partnerId: user.partnerId || null
    }
  });
});

// Current User Profile & SCR-04
app.get('/api/auth/me', authenticateToken, (req, res) => {
  const { passwordHash, ...safeUser } = req.user;
  res.json({ user: safeUser });
});

// QB-FR-014 - QB-FR-018: Edit and Save Profile
app.put('/api/auth/profile', authenticateToken, (req, res) => {
  const { name, phone, deliveryAddress } = req.body;
  
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Name cannot be empty.' });
  }

  const updated = db.updateUser(req.user.userId, {
    name,
    phone,
    deliveryAddress
  });

  const { passwordHash, ...safeUser } = updated;
  res.json({ message: 'Profile updated successfully.', user: safeUser });
});

// ---------------------------------------------------------------------------
// 4.3 Restaurant Browsing & Menu Display
// ---------------------------------------------------------------------------

// SCR-05, QB-FR-019 - QB-FR-022: Restaurant List with Search and Filter
app.get('/api/restaurants', (req, res) => {
  const { search, cuisine } = req.query;
  let list = db.getRestaurants(false);

  if (search) {
    const s = search.toLowerCase().trim();
    list = list.filter(r => 
      r.name.toLowerCase().includes(s) || 
      r.cuisine.toLowerCase().includes(s) ||
      r.address.toLowerCase().includes(s)
    );
  }

  if (cuisine && cuisine !== 'ALL') {
    const c = cuisine.toLowerCase().trim();
    list = list.filter(r => r.cuisine.toLowerCase().includes(c));
  }

  res.json({ restaurants: list });
});

// SCR-06, QB-FR-023 - QB-FR-027: Menu Items of a Restaurant
app.get('/api/restaurants/:id', (req, res) => {
  const rest = db.getRestaurantById(req.params.id);
  if (!rest || !rest.active) {
    return res.status(404).json({ error: 'Restaurant not found or inactive.' });
  }

  const menu = db.getMenuItems(req.params.id);
  res.json({ restaurant: rest, menu });
});

// ---------------------------------------------------------------------------
// 4.4 & 4.5 Cart, Order Placement and Payment
// ---------------------------------------------------------------------------

// Simulated External Payment Gateway validation endpoint (CON-02, QB-FR-043)
app.post('/api/payment/validate', authenticateToken, (req, res) => {
  const { amount, paymentMethod, simulateFailure } = req.body;

  if (!amount || amount <= 0) {
    return res.status(400).json({ error: 'Invalid payment amount.' });
  }

  if (simulateFailure) {
    return res.status(402).json({
      success: false,
      error: 'Payment authorization declined by issuing bank (Simulated Gateway Failure).'
    });
  }

  // Generate mock gateway transaction ID
  const gatewayTxId = 'PG_TXN_' + Math.random().toString(36).substring(2, 10).toUpperCase();

  res.json({
    success: true,
    gatewayTxId,
    amount,
    paymentMethod: paymentMethod || 'CARD',
    message: 'Payment verified and authorized.'
  });
});

// SCR-07, QB-FR-037 - QB-FR-048: Place Order
app.post('/api/orders', authenticateToken, requireRole('CUSTOMER'), (req, res) => {
  const { restaurantId, items, deliveryAddress, paymentMethod, simulatePaymentFailure } = req.body;

  // QB-FR-037: Must contain at least one item
  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Cart is empty. Please add at least one menu item.' });
  }

  // Verify restaurant exists and active
  const restaurant = db.getRestaurantById(restaurantId);
  if (!restaurant || !restaurant.active) {
    return res.status(400).json({ error: 'Selected restaurant is currently unavailable.' });
  }

  // QB-FR-035: Single restaurant check
  // QB-FR-039: Verify all items are currently available in db
  let calculatedSubtotal = 0;
  const verifiedItems = [];

  for (const item of items) {
    const dbItem = db.getMenuItemById(item.itemId);
    if (!dbItem) {
      return res.status(400).json({ error: `Item ${item.name || item.itemId} was not found.` });
    }
    if (dbItem.restaurantId !== restaurantId) {
      return res.status(400).json({ error: 'Orders can only contain items from a single restaurant at a time.' });
    }
    if (!dbItem.availability) {
      return res.status(400).json({ error: `Item "${dbItem.name}" is currently sold out and unavailable.` });
    }

    const qty = parseInt(item.quantity, 10);
    // QB-FR-030: reject <= 0 or invalid qty
    if (isNaN(qty) || qty < 1 || qty > 99) {
      return res.status(400).json({ error: `Invalid quantity for ${dbItem.name}. Allowed range is 1-99.` });
    }

    const subtotal = dbItem.price * qty;
    calculatedSubtotal += subtotal;
    verifiedItems.push({
      itemId: dbItem.itemId,
      name: dbItem.name,
      price: dbItem.price,
      quantity: qty,
      subtotal
    });
  }

  // Calculate taxes and delivery fee (TBD-06, BR-04)
  const tax = Number((calculatedSubtotal * 0.05).toFixed(2)); // 5% GST
  const deliveryFee = calculatedSubtotal >= 500 ? 0 : 40.00; // Free delivery over ₹500, else ₹40
  const totalAmount = Number((calculatedSubtotal + tax + deliveryFee).toFixed(2));

  // Payment Gateway step (QB-FR-042, QB-FR-046)
  if (simulatePaymentFailure) {
    return res.status(402).json({ 
      error: 'Payment was declined by payment gateway. Order has not been placed. Please retry with a valid payment method.' 
    });
  }

  const finalAddress = deliveryAddress || req.user.deliveryAddress || 'Address provided at checkout';

  // Save order and payment as single atomic unit (QB-FR-048, QB-NFR-025)
  const createdOrder = db.createOrder({
    customerId: req.user.userId,
    customerName: req.user.name,
    customerPhone: req.user.phone,
    deliveryAddress: finalAddress,
    restaurantId: restaurant.restaurantId,
    restaurantName: restaurant.name,
    items: verifiedItems,
    subtotal: calculatedSubtotal,
    tax,
    deliveryFee,
    totalAmount,
    paymentMethod: paymentMethod || 'CARD'
  });

  res.status(201).json({
    message: 'Order placed and payment authorized successfully!',
    order: createdOrder
  });
});

// ---------------------------------------------------------------------------
// 4.6 Order Tracking, Cancellation and Rating
// ---------------------------------------------------------------------------

// SCR-08: List Orders (Filtered by Role)
app.get('/api/orders', authenticateToken, (req, res) => {
  let filter = {};

  if (req.user.role === 'CUSTOMER') {
    // QB-FR-058: Customer sees only their own orders
    filter.customerId = req.user.userId;
  } else if (req.user.role === 'RESTAURANT') {
    // QB-FR-059: Restaurant sees only its orders
    filter.restaurantId = req.user.restaurantId;
  } else if (req.user.role === 'DELIVERY_PARTNER') {
    // QB-FR-073: Delivery partner sees assigned or ready orders
    filter.partnerId = req.user.partnerId;
  }
  // ADMIN sees all orders

  const orders = db.getOrders(filter);
  res.json({ orders });
});

// Single Order Details
app.get('/api/orders/:id', authenticateToken, (req, res) => {
  const order = db.getOrderById(req.params.id);
  if (!order) {
    return res.status(404).json({ error: 'Order not found.' });
  }

  // Role ownership check
  if (req.user.role === 'CUSTOMER' && order.customerId !== req.user.userId) {
    return res.status(403).json({ error: 'Access denied to this order.' });
  }
  if (req.user.role === 'RESTAURANT' && order.restaurantId !== req.user.restaurantId) {
    return res.status(403).json({ error: 'Access denied to this order.' });
  }

  res.json({ order });
});

// QB-FR-053 - QB-FR-056: Cancel Order (Customer or Restaurant)
app.post('/api/orders/:id/cancel', authenticateToken, (req, res) => {
  const order = db.getOrderById(req.params.id);
  if (!order) {
    return res.status(404).json({ error: 'Order not found.' });
  }

  // Authorization check
  if (req.user.role === 'CUSTOMER' && order.customerId !== req.user.userId) {
    return res.status(403).json({ error: 'Unauthorized to cancel this order.' });
  }

  // Cancellation permitted only BEFORE pickup (QB-FR-053, QB-FR-054, BR-06)
  const uncancelableStates = ['PICKED_UP', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'];
  if (uncancelableStates.includes(order.status)) {
    return res.status(400).json({ 
      error: `Cancellation refused: Order is already '${order.status}'. Orders cannot be cancelled once picked up or completed.` 
    });
  }

  const reason = req.body.reason || (req.user.role === 'CUSTOMER' ? 'Cancelled by customer' : 'Rejected by restaurant');
  const result = db.updateOrderStatus(req.params.id, 'CANCELLED', reason);

  if (result.error) {
    return res.status(400).json({ error: result.error });
  }

  res.json({
    message: 'Order cancelled successfully. Refund of ₹' + result.order.totalAmount.toFixed(2) + ' initiated to original payment source.',
    order: result.order
  });
});

// QB-FR-057: Rate Order
app.post('/api/orders/:id/rate', authenticateToken, requireRole('CUSTOMER'), (req, res) => {
  const { stars, comment } = req.body;
  if (!stars || stars < 1 || stars > 5) {
    return res.status(400).json({ error: 'Rating must be between 1 and 5 stars.' });
  }

  const result = db.addRating(req.params.id, req.user.userId, stars, comment);
  if (result.error) {
    return res.status(400).json({ error: result.error });
  }

  res.json({ message: 'Thank you for your rating!', rating: result.rating });
});

// ---------------------------------------------------------------------------
// 4.7 Restaurant Order & Menu Management
// ---------------------------------------------------------------------------

// Restaurant updates order status (Accept -> Confirmed, Preparing, Ready for Pickup)
app.post('/api/restaurant/orders/:id/status', authenticateToken, requireRole('RESTAURANT', 'ADMIN'), (req, res) => {
  const { status, reason } = req.body;
  const order = db.getOrderById(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found.' });

  if (req.user.role === 'RESTAURANT' && order.restaurantId !== req.user.restaurantId) {
    return res.status(403).json({ error: 'Cannot modify orders for another restaurant.' });
  }

  const result = db.updateOrderStatus(req.params.id, status, reason);
  if (result.error) {
    return res.status(400).json({ error: result.error });
  }

  res.json({ message: `Order status updated to ${status}.`, order: result.order });
});

// SCR-10: Restaurant Menu CRUD
app.post('/api/menu-items', authenticateToken, requireRole('RESTAURANT', 'ADMIN'), (req, res) => {
  const { name, price, category, availability, description, image, isVeg } = req.body;

  // QB-FR-065: Validation
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Item name cannot be empty.' });
  }
  const numericPrice = Number(price);
  if (isNaN(numericPrice) || numericPrice <= 0) {
    return res.status(400).json({ error: 'Price must be a positive numeric value.' });
  }

  const restaurantId = req.user.role === 'RESTAURANT' ? req.user.restaurantId : req.body.restaurantId;
  if (!restaurantId) {
    return res.status(400).json({ error: 'Restaurant ID required.' });
  }

  const newItem = db.createMenuItem({
    restaurantId,
    name,
    price: numericPrice,
    category,
    availability: availability !== false,
    description,
    image,
    isVeg
  });

  res.status(201).json({ message: 'Menu item created successfully.', item: newItem });
});

app.put('/api/menu-items/:id', authenticateToken, requireRole('RESTAURANT', 'ADMIN'), (req, res) => {
  const item = db.getMenuItemById(req.params.id);
  if (!item) return res.status(404).json({ error: 'Menu item not found.' });

  if (req.user.role === 'RESTAURANT' && item.restaurantId !== req.user.restaurantId) {
    return res.status(403).json({ error: 'Unauthorized to edit this menu item.' });
  }

  if (req.body.price !== undefined) {
    const p = Number(req.body.price);
    if (isNaN(p) || p <= 0) {
      return res.status(400).json({ error: 'Price must be a positive numeric value.' });
    }
  }

  const updated = db.updateMenuItem(req.params.id, req.body);
  res.json({ message: 'Menu item updated.', item: updated });
});

// ---------------------------------------------------------------------------
// 4.8 Delivery Partner Operations
// ---------------------------------------------------------------------------

// Partner updates delivery status (Accept, Picked Up, Out for Delivery, Delivered)
app.post('/api/delivery/orders/:id/status', authenticateToken, requireRole('DELIVERY_PARTNER', 'ADMIN'), (req, res) => {
  const { status } = req.body;
  const order = db.getOrderById(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found.' });

  // If partner is accepting an unassigned or assigned order
  if (req.user.role === 'DELIVERY_PARTNER') {
    if (!order.partnerId) {
      order.partnerId = req.user.partnerId;
      const dp = db.getDeliveryPartnerById(req.user.partnerId);
      if (dp) {
        order.partnerName = dp.name;
        order.partnerPhone = dp.phone;
        order.partnerVehicle = dp.vehicleNo;
      }
    } else if (order.partnerId !== req.user.partnerId) {
      return res.status(403).json({ error: 'This order is assigned to another delivery partner.' });
    }
  }

  const result = db.updateOrderStatus(req.params.id, status);
  if (result.error) {
    return res.status(400).json({ error: result.error });
  }

  res.json({ message: `Delivery status updated to ${status}.`, order: result.order });
});

// QB-FR-072: Update Partner Location (status/checkpoints)
app.post('/api/delivery/location', authenticateToken, requireRole('DELIVERY_PARTNER', 'ADMIN'), (req, res) => {
  const { location } = req.body;
  if (!location || !location.trim()) {
    return res.status(400).json({ error: 'Location text cannot be empty.' });
  }

  const partnerId = req.user.role === 'DELIVERY_PARTNER' ? req.user.partnerId : req.body.partnerId;
  const dp = db.updatePartnerLocation(partnerId, location.trim());
  if (!dp) return res.status(404).json({ error: 'Delivery partner not found.' });

  res.json({ message: 'Location updated successfully.', partner: dp });
});

// ---------------------------------------------------------------------------
// 4.9 Administration & Reporting
// ---------------------------------------------------------------------------

// SCR-12: Admin Dashboard Analytics
app.get('/api/admin/analytics', authenticateToken, requireRole('ADMIN'), (req, res) => {
  const stats = db.getAnalytics();
  res.json({ stats });
});

// SCR-13: Manage Users
app.get('/api/admin/users', authenticateToken, requireRole('ADMIN'), (req, res) => {
  const safeUsers = db.data.users.map(({ passwordHash, ...u }) => u);
  res.json({ users: safeUsers });
});

app.put('/api/admin/users/:id', authenticateToken, requireRole('ADMIN'), (req, res) => {
  const updated = db.updateUser(req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: 'User not found.' });
  const { passwordHash, ...safeUser } = updated;
  res.json({ message: 'User updated successfully.', user: safeUser });
});

// SCR-13: Manage Restaurants
app.get('/api/admin/restaurants', authenticateToken, requireRole('ADMIN'), (req, res) => {
  res.json({ restaurants: db.getRestaurants(true) });
});

app.post('/api/admin/restaurants', authenticateToken, requireRole('ADMIN'), (req, res) => {
  const { name, address, contact, cuisine, minOrder } = req.body;
  if (!name || !address || !contact) {
    return res.status(400).json({ error: 'Name, address and contact are required.' });
  }
  const created = db.createRestaurant(req.body);
  res.status(201).json({ message: 'Restaurant added successfully.', restaurant: created });
});

app.put('/api/admin/restaurants/:id', authenticateToken, requireRole('ADMIN'), (req, res) => {
  const updated = db.updateRestaurant(req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: 'Restaurant not found.' });
  res.json({ message: 'Restaurant updated.', restaurant: updated });
});

// SCR-13: Manage Delivery Partners
app.get('/api/admin/partners', authenticateToken, requireRole('ADMIN'), (req, res) => {
  res.json({ partners: db.getDeliveryPartners(true) });
});

app.post('/api/admin/partners', authenticateToken, requireRole('ADMIN'), (req, res) => {
  const { name, phone, vehicleNo } = req.body;
  if (!name || !phone || !vehicleNo) {
    return res.status(400).json({ error: 'Name, phone and vehicle number are required.' });
  }
  const created = db.createDeliveryPartner(req.body);
  res.status(201).json({ message: 'Delivery partner registered.', partner: created });
});

app.put('/api/admin/partners/:id', authenticateToken, requireRole('ADMIN'), (req, res) => {
  const updated = db.updateDeliveryPartner(req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: 'Partner not found.' });
  res.json({ message: 'Delivery partner updated.', partner: updated });
});

// SCR-14: Admin Orders & Reports
app.get('/api/admin/orders', authenticateToken, requireRole('ADMIN'), (req, res) => {
  const { date, status, restaurantId } = req.query;
  let orders = db.getOrders();

  if (status && status !== 'ALL') {
    orders = orders.filter(o => o.status === status);
  }
  if (restaurantId && restaurantId !== 'ALL') {
    orders = orders.filter(o => o.restaurantId === restaurantId);
  }
  if (date) {
    orders = orders.filter(o => o.orderDate.startsWith(date));
  }

  res.json({ orders });
});

// QB-NFR-035: Reset database to known test dataset
app.post('/api/admin/reset-db', authenticateToken, requireRole('ADMIN'), (req, res) => {
  db.resetToSeed();
  res.json({ message: 'Database successfully reset to initial test data.' });
});

// SPA Fallback: Serve index.html for all frontend routes
app.use((req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Start Server only when executed directly (allows Vercel serverless exports)
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🚀 QuickBite Server running at http://localhost:${PORT}`);
  });
}

module.exports = app;

