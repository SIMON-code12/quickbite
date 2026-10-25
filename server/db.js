const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const seedData = require('./seedData');

const isServerless = !!(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.LAMBDA_TASK_ROOT);
const DATA_DIR = isServerless ? '/tmp' : path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'quickbite_db.json');
const SEED_DB_FILE = path.join(__dirname, '..', 'data', 'quickbite_db.json');

class Database {
  constructor() {
    this.data = {
      users: [],
      restaurants: [],
      menuItems: [],
      deliveryPartners: [],
      orders: []
    };
    this.init();
  }

  init() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
    } catch (e) {}

    if (isServerless && !fs.existsSync(DB_FILE) && fs.existsSync(SEED_DB_FILE)) {
      try {
        fs.copyFileSync(SEED_DB_FILE, DB_FILE);
      } catch (e) {}
    }

    if (fs.existsSync(DB_FILE)) {
      try {
        const raw = fs.readFileSync(DB_FILE, 'utf8');
        this.data = JSON.parse(raw);
        return;
      } catch (err) {
        console.error('Failed reading db file, re-seeding:', err.message);
      }
    }
    this.resetToSeed();
  }

  resetToSeed() {
    // Clone seed data and hash passwords
    const salt = bcrypt.genSaltSync(10);
    const users = seedData.users.map(u => ({
      ...u,
      passwordHash: bcrypt.hashSync(u.password, salt),
      password: undefined
    }));

    this.data = {
      users,
      restaurants: JSON.parse(JSON.stringify(seedData.restaurants)),
      menuItems: JSON.parse(JSON.stringify(seedData.menuItems)),
      deliveryPartners: JSON.parse(JSON.stringify(seedData.deliveryPartners)),
      orders: JSON.parse(JSON.stringify(seedData.orders))
    };
    this.save();
  }

  save() {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(this.data, null, 2), 'utf8');
    } catch (err) {
      console.error('Failed saving database to disk:', err.message);
    }
  }

  // --- Users ---
  findUserByEmail(email) {
    if (!email) return null;
    return this.data.users.find(u => u.email.toLowerCase() === email.toLowerCase());
  }

  findUserById(userId) {
    return this.data.users.find(u => u.userId === userId);
  }

  createUser(userData) {
    const salt = bcrypt.genSaltSync(10);
    const newUser = {
      userId: 'usr_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      name: userData.name.trim(),
      email: userData.email.trim().toLowerCase(),
      phone: userData.phone ? userData.phone.trim() : '',
      deliveryAddress: userData.deliveryAddress ? userData.deliveryAddress.trim() : '',
      passwordHash: bcrypt.hashSync(userData.password, salt),
      role: userData.role || 'CUSTOMER',
      active: true,
      restaurantId: userData.restaurantId || null,
      partnerId: userData.partnerId || null,
      createdAt: new Date().toISOString()
    };
    this.data.users.push(newUser);
    this.save();
    return newUser;
  }

  updateUser(userId, updates) {
    const user = this.findUserById(userId);
    if (!user) return null;
    if (updates.name !== undefined) user.name = updates.name.trim();
    if (updates.phone !== undefined) user.phone = updates.phone.trim();
    if (updates.deliveryAddress !== undefined) user.deliveryAddress = updates.deliveryAddress.trim();
    if (updates.active !== undefined) user.active = !!updates.active;
    if (updates.role !== undefined) user.role = updates.role;
    if (updates.password) {
      const salt = bcrypt.genSaltSync(10);
      user.passwordHash = bcrypt.hashSync(updates.password, salt);
    }
    this.save();
    return user;
  }

  // --- Restaurants ---
  getRestaurants(includeInactive = false) {
    if (includeInactive) return this.data.restaurants;
    return this.data.restaurants.filter(r => r.active);
  }

  getRestaurantById(id) {
    return this.data.restaurants.find(r => r.restaurantId === id);
  }

  createRestaurant(payload) {
    const newRest = {
      restaurantId: 'rest_' + Date.now(),
      name: payload.name.trim(),
      address: payload.address.trim(),
      contact: payload.contact.trim(),
      cuisine: payload.cuisine ? payload.cuisine.trim() : 'Multicuisine',
      rating: 5.0,
      deliveryTime: payload.deliveryTime || '25-35 mins',
      minOrder: Number(payload.minOrder) || 100,
      image: payload.image || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=600&auto=format&fit=crop&q=80',
      active: true
    };
    this.data.restaurants.push(newRest);
    this.save();
    return newRest;
  }

  updateRestaurant(restaurantId, updates) {
    const rest = this.getRestaurantById(restaurantId);
    if (!rest) return null;
    if (updates.name !== undefined) rest.name = updates.name.trim();
    if (updates.address !== undefined) rest.address = updates.address.trim();
    if (updates.contact !== undefined) rest.contact = updates.contact.trim();
    if (updates.cuisine !== undefined) rest.cuisine = updates.cuisine.trim();
    if (updates.active !== undefined) rest.active = !!updates.active;
    if (updates.image !== undefined) rest.image = updates.image;
    this.save();
    return rest;
  }

  // --- Menu Items ---
  getMenuItems(restaurantId, includeInactive = false) {
    let items = this.data.menuItems;
    if (restaurantId) {
      items = items.filter(m => m.restaurantId === restaurantId);
    }
    if (!includeInactive) {
      // items returned whether in-stock or out-of-stock, but with availability boolean
      return items;
    }
    return items;
  }

  getMenuItemById(itemId) {
    return this.data.menuItems.find(m => m.itemId === itemId);
  }

  createMenuItem(payload) {
    const newItem = {
      itemId: 'item_' + Date.now(),
      restaurantId: payload.restaurantId,
      name: payload.name.trim(),
      price: Number(payload.price),
      category: payload.category ? payload.category.trim() : 'Specialties',
      availability: payload.availability !== false,
      description: payload.description ? payload.description.trim() : '',
      image: payload.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&auto=format&fit=crop&q=80',
      isVeg: !!payload.isVeg
    };
    this.data.menuItems.push(newItem);
    this.save();
    return newItem;
  }

  updateMenuItem(itemId, updates) {
    const item = this.getMenuItemById(itemId);
    if (!item) return null;
    if (updates.name !== undefined) item.name = updates.name.trim();
    if (updates.price !== undefined) item.price = Number(updates.price);
    if (updates.category !== undefined) item.category = updates.category.trim();
    if (updates.availability !== undefined) item.availability = !!updates.availability;
    if (updates.description !== undefined) item.description = updates.description.trim();
    if (updates.image !== undefined) item.image = updates.image;
    if (updates.isVeg !== undefined) item.isVeg = !!updates.isVeg;
    this.save();
    return item;
  }

  // --- Delivery Partners ---
  getDeliveryPartners(includeInactive = false) {
    if (includeInactive) return this.data.deliveryPartners;
    return this.data.deliveryPartners.filter(dp => dp.active);
  }

  getDeliveryPartnerById(id) {
    return this.data.deliveryPartners.find(dp => dp.partnerId === id);
  }

  createDeliveryPartner(payload) {
    const newDp = {
      partnerId: 'dp_' + Date.now(),
      name: payload.name.trim(),
      phone: payload.phone.trim(),
      vehicleNo: payload.vehicleNo.trim(),
      active: true,
      status: 'AVAILABLE',
      rating: 5.0,
      currentLocation: payload.currentLocation || 'City Center'
    };
    this.data.deliveryPartners.push(newDp);
    this.save();
    return newDp;
  }

  updateDeliveryPartner(partnerId, updates) {
    const dp = this.getDeliveryPartnerById(partnerId);
    if (!dp) return null;
    if (updates.name !== undefined) dp.name = updates.name.trim();
    if (updates.phone !== undefined) dp.phone = updates.phone.trim();
    if (updates.vehicleNo !== undefined) dp.vehicleNo = updates.vehicleNo.trim();
    if (updates.active !== undefined) dp.active = !!updates.active;
    if (updates.status !== undefined) dp.status = updates.status;
    if (updates.currentLocation !== undefined) dp.currentLocation = updates.currentLocation;
    this.save();
    return dp;
  }

  // --- Orders ---
  getOrders(filter = {}) {
    let orders = [...this.data.orders];
    if (filter.customerId) {
      orders = orders.filter(o => o.customerId === filter.customerId);
    }
    if (filter.restaurantId) {
      orders = orders.filter(o => o.restaurantId === filter.restaurantId);
    }
    if (filter.partnerId) {
      orders = orders.filter(o => o.partnerId === filter.partnerId);
    }
    if (filter.status) {
      orders = orders.filter(o => o.status === filter.status);
    }
    // Sort descending by orderDate (most recent first, QB-FR-052)
    return orders.sort((a, b) => new Date(b.orderDate) - new Date(a.orderDate));
  }

  getOrderById(orderId) {
    return this.data.orders.find(o => o.orderId === orderId);
  }

  createOrder(orderPayload) {
    const orderId = 'QB-' + Math.floor(1000 + Math.random() * 9000);
    const paymentId = 'pay_' + Date.now();
    
    // Auto-assign available delivery partner if available
    const availablePartner = this.data.deliveryPartners.find(dp => dp.active && dp.status === 'AVAILABLE') || this.data.deliveryPartners[0];

    const newOrder = {
      orderId,
      customerId: orderPayload.customerId,
      customerName: orderPayload.customerName,
      customerPhone: orderPayload.customerPhone,
      deliveryAddress: orderPayload.deliveryAddress,
      restaurantId: orderPayload.restaurantId,
      restaurantName: orderPayload.restaurantName,
      items: orderPayload.items,
      subtotal: Number(orderPayload.subtotal.toFixed(2)),
      tax: Number(orderPayload.tax.toFixed(2)),
      deliveryFee: Number(orderPayload.deliveryFee.toFixed(2)),
      totalAmount: Number(orderPayload.totalAmount.toFixed(2)),
      status: 'PLACED',
      orderDate: new Date().toISOString(),
      partnerId: availablePartner ? availablePartner.partnerId : null,
      partnerName: availablePartner ? availablePartner.name : null,
      partnerPhone: availablePartner ? availablePartner.phone : null,
      partnerVehicle: availablePartner ? availablePartner.vehicleNo : null,
      partnerLocation: availablePartner ? availablePartner.currentLocation : 'Standby',
      paymentId,
      payment: {
        paymentId,
        orderId,
        amount: Number(orderPayload.totalAmount.toFixed(2)),
        paymentMethod: orderPayload.paymentMethod || 'CARD',
        status: 'COMPLETED',
        transactionDate: new Date().toISOString()
      },
      rating: null
    };

    this.data.orders.unshift(newOrder);
    this.save();
    return newOrder;
  }

  updateOrderStatus(orderId, newStatus, reason = null) {
    const order = this.getOrderById(orderId);
    if (!order) return { error: 'Order not found' };

    // Valid forward transitions according to Figure B.4 and SRS
    const allowedForward = {
      'PLACED': ['CONFIRMED', 'CANCELLED'],
      'CONFIRMED': ['PREPARING', 'CANCELLED'],
      'PREPARING': ['READY_FOR_PICKUP', 'CANCELLED'],
      'READY_FOR_PICKUP': ['PICKED_UP', 'CANCELLED'],
      'PICKED_UP': ['OUT_FOR_DELIVERY'], // Cancel refused after pickup!
      'OUT_FOR_DELIVERY': ['DELIVERED'],
      'DELIVERED': [],
      'CANCELLED': []
    };

    const allowed = allowedForward[order.status] || [];
    if (!allowed.includes(newStatus)) {
      return { 
        error: `Cannot transition order status from '${order.status}' to '${newStatus}'. Permitted transitions: ${allowed.length ? allowed.join(', ') : 'None (Terminal state)'}` 
      };
    }

    order.status = newStatus;
    if (newStatus === 'CANCELLED') {
      order.cancellationReason = reason || 'Cancelled by user/restaurant';
      // Automatic refund for paid order (QB-FR-056, BR-10)
      if (order.payment && order.payment.status === 'COMPLETED') {
        order.payment.status = 'REFUNDED';
        order.payment.refundDate = new Date().toISOString();
        order.payment.refundAmount = order.payment.amount;
      }
    }

    this.save();
    return { success: true, order };
  }

  updatePartnerLocation(partnerId, newLocation) {
    const dp = this.getDeliveryPartnerById(partnerId);
    if (!dp) return null;
    dp.currentLocation = newLocation;

    // Update ongoing orders assigned to this partner
    this.data.orders.forEach(o => {
      if (o.partnerId === partnerId && ['READY_FOR_PICKUP', 'PICKED_UP', 'OUT_FOR_DELIVERY'].includes(o.status)) {
        o.partnerLocation = newLocation;
      }
    });

    this.save();
    return dp;
  }

  addRating(orderId, customerId, stars, comment) {
    const order = this.getOrderById(orderId);
    if (!order) return { error: 'Order not found' };
    if (order.customerId !== customerId) return { error: 'Unauthorized to rate this order' };
    if (order.status !== 'DELIVERED') return { error: 'Only delivered orders can be rated' };
    if (order.rating) return { error: 'Order has already been rated' };

    order.rating = {
      stars: Number(stars),
      comment: comment ? comment.trim() : '',
      ratedAt: new Date().toISOString()
    };

    // Recalculate restaurant rating
    const restOrders = this.data.orders.filter(o => o.restaurantId === order.restaurantId && o.rating && o.rating.stars);
    if (restOrders.length > 0) {
      const avg = restOrders.reduce((sum, o) => sum + o.rating.stars, 0) / restOrders.length;
      const rest = this.getRestaurantById(order.restaurantId);
      if (rest) {
        rest.rating = Number(avg.toFixed(1));
      }
    }

    this.save();
    return { success: true, rating: order.rating };
  }

  // --- Admin Analytics & Reports ---
  getAnalytics() {
    const totalOrders = this.data.orders.length;
    const deliveredOrders = this.data.orders.filter(o => o.status === 'DELIVERED');
    const cancelledOrders = this.data.orders.filter(o => o.status === 'CANCELLED');
    const activeOrders = this.data.orders.filter(o => !['DELIVERED', 'CANCELLED'].includes(o.status));

    const totalRevenue = deliveredOrders.reduce((acc, o) => acc + o.totalAmount, 0);
    const totalRefunded = cancelledOrders.filter(o => o.payment && o.payment.status === 'REFUNDED').reduce((acc, o) => acc + (o.payment.amount || 0), 0);
    const totalCustomers = this.data.users.filter(u => u.role === 'CUSTOMER').length;
    const totalRestaurants = this.data.restaurants.length;
    const totalDeliveryPartners = this.data.deliveryPartners.length;

    // Status breakdown
    const statusCounts = {};
    this.data.orders.forEach(o => {
      statusCounts[o.status] = (statusCounts[o.status] || 0) + 1;
    });

    return {
      totalOrders,
      activeOrdersCount: activeOrders.length,
      deliveredOrdersCount: deliveredOrders.length,
      cancelledOrdersCount: cancelledOrders.length,
      totalRevenue: Number(totalRevenue.toFixed(2)),
      totalRefunded: Number(totalRefunded.toFixed(2)),
      totalCustomers,
      totalRestaurants,
      totalDeliveryPartners,
      statusCounts
    };
  }
}

const db = new Database();
module.exports = db;
