// Main Application Logic for QuickBite Food Delivery System

const App = {
  state: {
    user: null,
    currentView: 'home',
    viewParams: {},
    cart: {
      restaurantId: null,
      restaurantName: null,
      items: []
    },
    ordersPollingTimer: null
  },

  init() {
    this.loadCart();
    this.restoreSession();
    this.setupGlobalEvents();
    this.render();
  },

  // --- Cart Management ---
  loadCart() {
    try {
      const saved = localStorage.getItem('qb_cart');
      if (saved) {
        this.state.cart = JSON.parse(saved);
      }
    } catch (e) {
      this.state.cart = { restaurantId: null, restaurantName: null, items: [] };
    }
  },

  saveCart() {
    localStorage.setItem('qb_cart', JSON.stringify(this.state.cart));
    this.updateCartBadge();
  },

  addToCart(item, restaurant, qty = 1) {
    if (!item.availability) {
      this.showToast(`"${item.name}" is currently unavailable.`, 'error');
      return;
    }

    // QB-FR-035: Check single restaurant
    if (this.state.cart.restaurantId && this.state.cart.restaurantId !== restaurant.restaurantId && this.state.cart.items.length > 0) {
      const confirmReset = confirm(
        `Your cart contains items from "${this.state.cart.restaurantName}". Would you like to clear your cart and start a new order from "${restaurant.name}"?`
      );
      if (!confirmReset) return;
      this.state.cart.items = [];
    }

    this.state.cart.restaurantId = restaurant.restaurantId;
    this.state.cart.restaurantName = restaurant.name;

    const existingIndex = this.state.cart.items.findIndex(i => i.itemId === item.itemId);
    if (existingIndex > -1) {
      this.state.cart.items[existingIndex].quantity += qty;
    } else {
      this.state.cart.items.push({
        itemId: item.itemId,
        name: item.name,
        price: item.price,
        isVeg: item.isVeg,
        quantity: qty
      });
    }

    this.saveCart();
    this.showToast(`Added ${item.name} to cart.`, 'success');
  },

  updateCartQty(itemId, delta) {
    const item = this.state.cart.items.find(i => i.itemId === itemId);
    if (!item) return;

    item.quantity += delta;
    if (item.quantity <= 0) {
      this.state.cart.items = this.state.cart.items.filter(i => i.itemId !== itemId);
    }

    if (this.state.cart.items.length === 0) {
      this.state.cart.restaurantId = null;
      this.state.cart.restaurantName = null;
    }

    this.saveCart();
    if (this.state.currentView === 'cart') {
      this.render();
    }
  },

  removeCartItem(itemId) {
    this.state.cart.items = this.state.cart.items.filter(i => i.itemId !== itemId);
    if (this.state.cart.items.length === 0) {
      this.state.cart.restaurantId = null;
      this.state.cart.restaurantName = null;
    }
    this.saveCart();
    if (this.state.currentView === 'cart') {
      this.render();
    }
  },

  clearCart() {
    this.state.cart = { restaurantId: null, restaurantName: null, items: [] };
    this.saveCart();
  },

  calculateCartTotals() {
    const subtotal = this.state.cart.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const tax = Number((subtotal * 0.05).toFixed(2));
    const deliveryFee = subtotal > 0 ? (subtotal >= 500 ? 0 : 40.00) : 0;
    const grandTotal = Number((subtotal + tax + deliveryFee).toFixed(2));
    return { subtotal, tax, deliveryFee, grandTotal };
  },

  updateCartBadge() {
    const badge = document.getElementById('nav-cart-badge');
    const totalCount = this.state.cart.items.reduce((sum, i) => sum + i.quantity, 0);
    if (badge) {
      badge.textContent = totalCount;
      badge.style.display = totalCount > 0 ? 'flex' : 'none';
    }
  },

  // --- Session & Auth ---
  restoreSession() {
    const user = API.getUser();
    if (user && API.getToken()) {
      this.state.user = user;
    }
  },

  async login(email, password) {
    try {
      const res = await API.login(email, password);
      API.setToken(res.token);
      API.setUser(res.user);
      this.state.user = res.user;
      this.showToast(`Logged in as ${res.user.name} (${res.user.role})`, 'success');

      // Navigate to default view for role
      if (res.user.role === 'ADMIN') {
        this.navigate('admin-dashboard');
      } else if (res.user.role === 'RESTAURANT') {
        this.navigate('restaurant-orders');
      } else if (res.user.role === 'DELIVERY_PARTNER') {
        this.navigate('delivery-portal');
      } else {
        this.navigate('home');
      }
    } catch (err) {
      this.showToast(err.message || 'Login failed', 'error');
      throw err;
    }
  },

  logout() {
    API.setToken(null);
    API.setUser(null);
    this.state.user = null;
    this.showToast('You have been logged out.', 'info');
    this.navigate('home');
  },

  // Quick Demo Role Switcher for instant testing
  async switchRoleDemo(roleKey) {
    const accounts = {
      customer: { email: 'customer@quickbite.com', pass: 'password123' },
      restaurant: { email: 'spice@quickbite.com', pass: 'spice123' },
      delivery: { email: 'alex@quickbite.com', pass: 'alex123' },
      admin: { email: 'admin@quickbite.com', pass: 'admin123' }
    };

    const target = accounts[roleKey];
    if (target) {
      try {
        await this.login(target.email, target.pass);
      } catch (e) {
        console.error(e);
      }
    }
  },

  // --- Router & Navigation ---
  navigate(viewName, params = {}) {
    this.state.currentView = viewName;
    this.state.viewParams = params;
    window.scrollTo({ top: 0, behavior: 'smooth' });
    this.render();
  },

  // --- UI Toast & Helpers ---
  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icon = type === 'success' ? '✅' : type === 'error' ? '⚠️' : 'ℹ️';
    toast.innerHTML = `<span>${icon}</span><div>${message}</div>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      setTimeout(() => toast.remove(), 250);
    }, 4000);
  },

  formatCurrency(val) {
    return '₹' + Number(val).toFixed(2);
  },

  formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  },

  // --- Render Master ---
  async render() {
    this.renderNavbar();
    this.updateCartBadge();
    const appEl = document.getElementById('app-root');
    if (!appEl) return;

    // View Routing
    switch (this.state.currentView) {
      case 'home':
        await this.renderHome(appEl);
        break;
      case 'restaurant-detail':
        await this.renderRestaurantDetail(appEl, this.state.viewParams.restaurantId);
        break;
      case 'cart':
        this.renderCart(appEl);
        break;
      case 'order-tracking':
        await this.renderOrderTracking(appEl, this.state.viewParams.orderId);
        break;
      case 'order-history':
        await this.renderOrderHistory(appEl);
        break;
      case 'profile':
        this.renderProfile(appEl);
        break;
      case 'login':
        this.renderLogin(appEl);
        break;
      case 'register':
        this.renderRegister(appEl);
        break;
      case 'restaurant-orders':
        await this.renderRestaurantOrders(appEl);
        break;
      case 'restaurant-menu':
        await this.renderRestaurantMenu(appEl);
        break;
      case 'delivery-portal':
        await this.renderDeliveryPortal(appEl);
        break;
      case 'admin-dashboard':
        await this.renderAdminDashboard(appEl);
        break;
      case 'admin-users':
        await this.renderAdminUsers(appEl);
        break;
      case 'admin-restaurants':
        await this.renderAdminRestaurants(appEl);
        break;
      case 'admin-partners':
        await this.renderAdminPartners(appEl);
        break;
      case 'admin-reports':
        await this.renderAdminReports(appEl);
        break;
      default:
        await this.renderHome(appEl);
    }
  },

  // --- Navbar ---
  renderNavbar() {
    const navLinks = document.getElementById('nav-links');
    const navActions = document.getElementById('nav-actions');
    const u = this.state.user;

    // Update active state in demo banner
    document.querySelectorAll('.role-switch-btn').forEach(btn => {
      btn.classList.remove('active');
      if (u && btn.dataset.role === u.role.toLowerCase().replace('_partner', '')) {
        btn.classList.add('active');
      }
    });

    if (!u) {
      // Unauthenticated view (UI-2)
      navLinks.innerHTML = `
        <li><a class="nav-link ${this.state.currentView === 'home' ? 'active' : ''}" onclick="App.navigate('home')">Restaurants</a></li>
      `;
      navActions.innerHTML = `
        <button class="cart-btn" onclick="App.navigate('cart')">
          🛒 <span id="nav-cart-badge" class="cart-badge" style="display:none">0</span>
        </button>
        <button class="btn btn-secondary btn-sm" onclick="App.navigate('login')">Sign In</button>
        <button class="btn btn-primary btn-sm" onclick="App.navigate('register')">Register</button>
      `;
      return;
    }

    // Role-specific navigations
    if (u.role === 'CUSTOMER') {
      navLinks.innerHTML = `
        <li><a class="nav-link ${this.state.currentView === 'home' ? 'active' : ''}" onclick="App.navigate('home')">Explore Food</a></li>
        <li><a class="nav-link ${this.state.currentView === 'order-history' ? 'active' : ''}" onclick="App.navigate('order-history')">My Orders</a></li>
        <li><a class="nav-link ${this.state.currentView === 'profile' ? 'active' : ''}" onclick="App.navigate('profile')">Profile</a></li>
      `;
      navActions.innerHTML = `
        <button class="cart-btn" onclick="App.navigate('cart')">
          🛒 Cart <span id="nav-cart-badge" class="cart-badge" style="display:none">0</span>
        </button>
        <div class="user-badge-pill">
          <div class="user-avatar">${u.name[0]}</div>
          <span>${u.name.split(' ')[0]}</span>
          <span class="role-tag customer">Customer</span>
        </div>
        <button class="btn btn-secondary btn-sm" onclick="App.logout()">Logout</button>
      `;
    } else if (u.role === 'RESTAURANT') {
      navLinks.innerHTML = `
        <li><a class="nav-link ${this.state.currentView === 'restaurant-orders' ? 'active' : ''}" onclick="App.navigate('restaurant-orders')">Live Orders</a></li>
        <li><a class="nav-link ${this.state.currentView === 'restaurant-menu' ? 'active' : ''}" onclick="App.navigate('restaurant-menu')">Menu Management</a></li>
      `;
      navActions.innerHTML = `
        <div class="user-badge-pill">
          <div class="user-avatar">🍳</div>
          <span>${u.name}</span>
          <span class="role-tag restaurant">Restaurant</span>
        </div>
        <button class="btn btn-secondary btn-sm" onclick="App.logout()">Logout</button>
      `;
    } else if (u.role === 'DELIVERY_PARTNER') {
      navLinks.innerHTML = `
        <li><a class="nav-link ${this.state.currentView === 'delivery-portal' ? 'active' : ''}" onclick="App.navigate('delivery-portal')">Assigned Deliveries</a></li>
      `;
      navActions.innerHTML = `
        <div class="user-badge-pill">
          <div class="user-avatar">🛵</div>
          <span>${u.name}</span>
          <span class="role-tag delivery_partner">Partner</span>
        </div>
        <button class="btn btn-secondary btn-sm" onclick="App.logout()">Logout</button>
      `;
    } else if (u.role === 'ADMIN') {
      navLinks.innerHTML = `
        <li><a class="nav-link ${this.state.currentView === 'admin-dashboard' ? 'active' : ''}" onclick="App.navigate('admin-dashboard')">Overview</a></li>
        <li><a class="nav-link ${this.state.currentView === 'admin-orders' ? 'active' : ''}" onclick="App.navigate('admin-reports')">Orders & Reports</a></li>
        <li><a class="nav-link ${this.state.currentView === 'admin-restaurants' ? 'active' : ''}" onclick="App.navigate('admin-restaurants')">Restaurants</a></li>
        <li><a class="nav-link ${this.state.currentView === 'admin-users' ? 'active' : ''}" onclick="App.navigate('admin-users')">Users</a></li>
        <li><a class="nav-link ${this.state.currentView === 'admin-partners' ? 'active' : ''}" onclick="App.navigate('admin-partners')">Partners</a></li>
      `;
      navActions.innerHTML = `
        <div class="user-badge-pill">
          <div class="user-avatar">🛡️</div>
          <span>${u.name}</span>
          <span class="role-tag admin">Admin</span>
        </div>
        <button class="btn btn-secondary btn-sm" onclick="App.logout()">Logout</button>
      `;
    }
  },

  // -------------------------------------------------------------------------
  // SCR-03 & SCR-05: Customer Home / Restaurant List
  // -------------------------------------------------------------------------
  async renderHome(container) {
    let restaurants = [];
    try {
      const res = await API.getRestaurants();
      restaurants = res.restaurants || [];
    } catch (e) {
      console.error(e);
    }

    container.innerHTML = `
      <div class="hero-banner">
        <h1 class="hero-title">Delicious Food, Delivered Fast.</h1>
        <p class="hero-subtitle">Browse premier local kitchens, customize dishes, and track your fresh order directly to your doorstep.</p>
        
        <div class="search-filter-box">
          <div class="search-input-wrap">
            <span class="search-icon">🔍</span>
            <input type="text" id="restaurant-search-input" placeholder="Search restaurant name, cuisine or location..." oninput="App.handleRestaurantSearch(this.value)">
          </div>
          <div class="cuisine-chips">
            <button class="chip-btn active" onclick="App.filterCuisine(this, 'ALL')">All</button>
            <button class="chip-btn" onclick="App.filterCuisine(this, 'Indian')">🍛 Indian</button>
            <button class="chip-btn" onclick="App.filterCuisine(this, 'Italian')">🍕 Italian</button>
            <button class="chip-btn" onclick="App.filterCuisine(this, 'Burgers')">🍔 Burgers</button>
          </div>
        </div>
      </div>

      <div class="section-header">
        <h2 class="section-title"><span>🍽️</span> Available Restaurants</h2>
        <span style="color: var(--text-muted); font-size: 0.9rem;" id="restaurants-count-label">${restaurants.length} kitchens ready</span>
      </div>

      <div class="cards-grid" id="restaurants-grid">
        ${this.buildRestaurantCardsHtml(restaurants)}
      </div>
    `;
  },

  buildRestaurantCardsHtml(restaurants) {
    if (!restaurants || restaurants.length === 0) {
      return `
        <div style="grid-column: 1/-1; text-align: center; padding: 48px; background: var(--bg-card); border-radius: var(--radius-lg); border: 1px solid var(--border-color);">
          <div style="font-size: 3rem; margin-bottom: 12px;">🔍</div>
          <h3>No restaurants found</h3>
          <p style="color: var(--text-muted); margin-top: 6px;">Try adjusting your search criteria or cuisine filter.</p>
        </div>
      `;
    }

    return restaurants.map(r => `
      <div class="restaurant-card" onclick="App.navigate('restaurant-detail', { restaurantId: '${r.restaurantId}' })">
        <div class="card-img-wrap">
          <img src="${r.image}" alt="${r.name}" loading="lazy">
          <div class="rating-badge">★ ${r.rating}</div>
        </div>
        <div class="card-body">
          <div>
            <h3 class="card-title">${r.name}</h3>
            <p class="card-subtitle">${r.cuisine} • ${r.address}</p>
          </div>
          <div class="card-meta">
            <div class="meta-item">⏱️ ${r.deliveryTime}</div>
            <div class="meta-item">🛵 Min. order ${App.formatCurrency(r.minOrder)}</div>
          </div>
        </div>
      </div>
    `).join('');
  },

  async handleRestaurantSearch(query) {
    try {
      const res = await API.getRestaurants({ search: query });
      const grid = document.getElementById('restaurants-grid');
      const countLabel = document.getElementById('restaurants-count-label');
      if (grid) grid.innerHTML = this.buildRestaurantCardsHtml(res.restaurants);
      if (countLabel) countLabel.textContent = `${res.restaurants.length} kitchens ready`;
    } catch (e) {
      console.error(e);
    }
  },

  async filterCuisine(btn, cuisine) {
    document.querySelectorAll('.chip-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    try {
      const res = await API.getRestaurants({ cuisine: cuisine === 'ALL' ? '' : cuisine });
      const grid = document.getElementById('restaurants-grid');
      const countLabel = document.getElementById('restaurants-count-label');
      if (grid) grid.innerHTML = this.buildRestaurantCardsHtml(res.restaurants);
      if (countLabel) countLabel.textContent = `${res.restaurants.length} kitchens ready`;
    } catch (e) {
      console.error(e);
    }
  },

  // -------------------------------------------------------------------------
  // SCR-06: Restaurant Menu & Items Display
  // -------------------------------------------------------------------------
  async renderRestaurantDetail(container, restaurantId) {
    let restaurant = null;
    let menu = [];

    try {
      const res = await API.getRestaurantMenu(restaurantId);
      restaurant = res.restaurant;
      menu = res.menu;
    } catch (err) {
      container.innerHTML = `<div class="hero-banner"><h2>Error loading restaurant: ${err.message}</h2></div>`;
      return;
    }

    // Group items by category (QB-FR-024)
    const categories = {};
    menu.forEach(item => {
      const cat = item.category || 'Specialties';
      if (!categories[cat]) categories[cat] = [];
      categories[cat].push(item);
    });

    container.innerHTML = `
      <div style="margin-bottom: 20px;">
        <button class="btn btn-secondary btn-sm" onclick="App.navigate('home')">← Back to All Restaurants</button>
      </div>

      <div class="hero-banner" style="display: flex; gap: 24px; align-items: center; flex-wrap: wrap;">
        <img src="${restaurant.image}" style="width: 140px; height: 140px; object-fit: cover; border-radius: var(--radius-lg); border: 2px solid var(--border-color);">
        <div style="flex: 1;">
          <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 6px;">
            <h1 style="font-size: 2rem; margin: 0;">${restaurant.name}</h1>
            <span class="rating-badge" style="position: static;">★ ${restaurant.rating}</span>
          </div>
          <p style="color: var(--text-muted); margin-bottom: 8px;">${restaurant.cuisine} • 📍 ${restaurant.address}</p>
          <div style="display: flex; gap: 18px; font-size: 0.88rem; color: var(--text-dim);">
            <span>⏱️ Delivery: ${restaurant.deliveryTime}</span>
            <span>📞 Contact: ${restaurant.contact}</span>
            <span>🛵 Min Order: ${App.formatCurrency(restaurant.minOrder)}</span>
          </div>
        </div>
      </div>

      <div class="menu-container">
        ${Object.keys(categories).map(catName => `
          <div class="category-block">
            <h3 class="category-title"><span>📂</span> ${catName} (${categories[catName].length})</h3>
            <div class="menu-items-grid">
              ${categories[catName].map(item => `
                <div class="menu-item-card ${!item.availability ? 'disabled' : ''}">
                  <div class="item-info">
                    <div class="item-top">
                      <span class="${item.isVeg ? 'veg-icon' : 'non-veg-icon'}"></span>
                      <span class="item-name">${item.name}</span>
                    </div>
                    <div class="item-price">${App.formatCurrency(item.price)}</div>
                    <p class="item-desc">${item.description || 'Prepared fresh with premium ingredients.'}</p>
                    <div>
                      <span class="badge ${item.availability ? 'badge-in-stock' : 'badge-out-of-stock'}">
                        ${item.availability ? '● In Stock' : '✕ Out of Stock'}
                      </span>
                    </div>
                  </div>
                  <div class="item-img-action">
                    <img class="item-img" src="${item.image}" alt="${item.name}">
                    ${item.availability ? `
                      <button class="btn btn-primary btn-sm btn-block" onclick='App.addToCart(${JSON.stringify(item)}, ${JSON.stringify(restaurant)})'>
                        + Add
                      </button>
                    ` : `
                      <button class="btn btn-secondary btn-sm btn-block" disabled title="Currently unavailable">
                        Sold Out
                      </button>
                    `}
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        `).join('')}
      </div>
    `;
  },

  // -------------------------------------------------------------------------
  // SCR-07: Cart & Checkout
  // -------------------------------------------------------------------------
  renderCart(container) {
    const { items, restaurantName } = this.state.cart;
    const totals = this.calculateCartTotals();
    const user = this.state.user;

    if (!items || items.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 64px 20px; background: var(--bg-card); border-radius: var(--radius-lg); border: 1px solid var(--border-color); max-width: 600px; margin: 40px auto;">
          <div style="font-size: 4rem; margin-bottom: 16px;">🛒</div>
          <h2>Your Cart is Empty</h2>
          <p style="color: var(--text-muted); margin: 8px 0 24px;">Discover restaurants and delicious meals to start your order!</p>
          <button class="btn btn-primary" onclick="App.navigate('home')">Browse Restaurants</button>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div style="margin-bottom: 24px; display: flex; align-items: center; justify-content: space-between;">
        <h2>Order Cart from <span style="color: var(--primary);">${restaurantName}</span></h2>
        <button class="btn btn-secondary btn-sm" onclick="App.clearCart(); App.render();">Clear Cart</button>
      </div>

      <div class="checkout-container">
        <!-- Left: Cart Items & Address -->
        <div class="cart-items-card">
          <h3 style="margin-bottom: 16px; border-bottom: 1px solid var(--border-color); padding-bottom: 10px;">Cart Items (${items.reduce((s,i)=>s+i.quantity, 0)})</h3>
          
          <div class="cart-items-list">
            ${items.map(item => `
              <div class="cart-item-row">
                <div class="cart-item-left">
                  <span class="${item.isVeg ? 'veg-icon' : 'non-veg-icon'}"></span>
                  <div>
                    <div style="font-weight: 700;">${item.name}</div>
                    <div style="color: var(--text-muted); font-size: 0.88rem;">${App.formatCurrency(item.price)} each</div>
                  </div>
                </div>
                <div style="display: flex; align-items: center; gap: 16px;">
                  <div class="qty-stepper">
                    <button onclick="App.updateCartQty('${item.itemId}', -1)">-</button>
                    <span class="qty-val">${item.quantity}</span>
                    <button onclick="App.updateCartQty('${item.itemId}', 1)">+</button>
                  </div>
                  <div style="font-weight: 700; min-width: 70px; text-align: right;">
                    ${App.formatCurrency(item.price * item.quantity)}
                  </div>
                  <button style="background:none; border:none; color: var(--accent-red); cursor: pointer;" onclick="App.removeCartItem('${item.itemId}')">✕</button>
                </div>
              </div>
            `).join('')}
          </div>

          <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid var(--border-color);">
            <h4 style="margin-bottom: 8px;">📍 Delivery Address</h4>
            <textarea id="checkout-address-input" class="form-control" rows="2" placeholder="Enter full delivery address...">${user ? (user.deliveryAddress || '') : 'Green Valley Villa No. 4, Kanjirappally, Kottayam'}</textarea>
          </div>
        </div>

        <!-- Right: Bill Details & Payment Confirmation -->
        <div class="bill-summary-card">
          <h3 style="margin-bottom: 16px;">Bill Summary</h3>
          <div class="bill-row">
            <span>Item Subtotal</span>
            <span>${App.formatCurrency(totals.subtotal)}</span>
          </div>
          <div class="bill-row">
            <span>GST & Restaurant Taxes (5%)</span>
            <span>${App.formatCurrency(totals.tax)}</span>
          </div>
          <div class="bill-row">
            <span>Delivery Fee</span>
            <span>${totals.deliveryFee === 0 ? '<span style="color: var(--accent-green)">FREE</span>' : App.formatCurrency(totals.deliveryFee)}</span>
          </div>
          <div class="bill-row total-row">
            <span>To Pay</span>
            <span style="color: var(--primary);">${App.formatCurrency(totals.grandTotal)}</span>
          </div>

          <div style="margin-top: 24px;">
            ${user && user.role === 'CUSTOMER' ? `
              <button class="btn btn-primary btn-block" style="padding: 14px;" onclick="App.openPaymentModal()">
                Proceed to Pay ${App.formatCurrency(totals.grandTotal)}
              </button>
            ` : `
              <div style="background: rgba(59, 130, 246, 0.1); border: 1px solid var(--secondary); padding: 12px; border-radius: var(--radius-sm); margin-bottom: 12px; font-size: 0.88rem;">
                Please log in with a customer account to place this order.
              </div>
              <button class="btn btn-primary btn-block" onclick="App.navigate('login')">Log In to Order</button>
            `}
          </div>
        </div>
      </div>
    `;
  },

  openPaymentModal() {
    const totals = this.calculateCartTotals();
    const address = document.getElementById('checkout-address-input').value.trim();

    if (!address) {
      this.showToast('Please specify a delivery address.', 'error');
      return;
    }

    const modalHtml = `
      <div class="modal-overlay" id="payment-modal">
        <div class="modal-content">
          <div class="modal-header">
            <h3 class="modal-title">💳 QuickBite Payment Gateway</h3>
            <button class="modal-close-btn" onclick="document.getElementById('payment-modal').remove()">×</button>
          </div>
          <div class="modal-body">
            <div style="background: var(--bg-secondary); padding: 14px; border-radius: var(--radius-md); margin-bottom: 18px; border: 1px solid var(--border-color);">
              <div style="display: flex; justify-content: space-between; font-weight: 700; font-size: 1.1rem;">
                <span>Total Charge:</span>
                <span style="color: var(--primary);">${App.formatCurrency(totals.grandTotal)}</span>
              </div>
              <div style="color: var(--text-muted); font-size: 0.8rem; margin-top: 4px;">
                Secure 256-bit payment transaction (CON-02 compliant)
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Select Payment Method</label>
              <select id="payment-method-select" class="form-control">
                <option value="UPI">UPI / QR (GPay, PhonePe, Paytm)</option>
                <option value="CARD">Credit / Debit Card</option>
                <option value="NET_BANKING">Net Banking</option>
                <option value="COD">Cash on Delivery</option>
              </select>
            </div>

            <div class="form-group" style="background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.2); padding: 10px 14px; border-radius: var(--radius-sm);">
              <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 0.88rem; color: #fca5a5;">
                <input type="checkbox" id="simulate-failure-checkbox">
                Simulate Payment Failure (Tests QB-FR-046 & QB-NFR-010 error handling)
              </label>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" onclick="document.getElementById('payment-modal').remove()">Cancel</button>
            <button class="btn btn-primary" id="confirm-payment-btn" onclick="App.executePaymentAndOrder('${address}')">
              Pay ${App.formatCurrency(totals.grandTotal)}
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
  },

  async executePaymentAndOrder(address) {
    const payBtn = document.getElementById('confirm-payment-btn');
    const paymentMethod = document.getElementById('payment-method-select').value;
    const simulateFailure = document.getElementById('simulate-failure-checkbox').checked;

    payBtn.disabled = true;
    payBtn.textContent = 'Processing Payment...';

    try {
      const res = await API.placeOrder({
        restaurantId: this.state.cart.restaurantId,
        items: this.state.cart.items,
        deliveryAddress: address,
        paymentMethod,
        simulatePaymentFailure: simulateFailure
      });

      document.getElementById('payment-modal').remove();
      this.clearCart();
      this.showToast('Order confirmed and sent to kitchen!', 'success');
      this.navigate('order-tracking', { orderId: res.order.orderId });
    } catch (err) {
      this.showToast(err.message || 'Payment failed', 'error');
      payBtn.disabled = false;
      payBtn.textContent = 'Retry Payment';
    }
  },

  // -------------------------------------------------------------------------
  // SCR-08: Order Tracking, Cancellation and Rating
  // -------------------------------------------------------------------------
  async renderOrderTracking(container, orderId) {
    let order = null;
    try {
      const res = await API.getOrder(orderId);
      order = res.order;
    } catch (e) {
      container.innerHTML = `<div class="hero-banner"><h2>Order not found: ${e.message}</h2></div>`;
      return;
    }

    // Milestones from Figure B.4 and SRS
    const steps = [
      { key: 'PLACED', label: 'Placed' },
      { key: 'CONFIRMED', label: 'Confirmed' },
      { key: 'PREPARING', label: 'Preparing' },
      { key: 'READY_FOR_PICKUP', label: 'Ready' },
      { key: 'PICKED_UP', label: 'Picked Up' },
      { key: 'OUT_FOR_DELIVERY', label: 'On The Way' },
      { key: 'DELIVERED', label: 'Delivered' }
    ];

    const currentIdx = steps.findIndex(s => s.key === order.status);
    const isCancelled = order.status === 'CANCELLED';
    const canCancel = ['PLACED', 'CONFIRMED', 'PREPARING', 'READY_FOR_PICKUP'].includes(order.status);
    const progressWidth = currentIdx >= 0 ? (currentIdx / (steps.length - 1)) * 100 : 0;

    container.innerHTML = `
      <div style="margin-bottom: 20px; display: flex; align-items: center; justify-content: space-between;">
        <button class="btn btn-secondary btn-sm" onclick="App.navigate('order-history')">← All Orders</button>
        <span class="badge badge-${order.status.toLowerCase()}">${order.status.replace(/_/g, ' ')}</span>
      </div>

      <div class="bill-summary-card" style="margin-bottom: 28px;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
          <div>
            <h2 style="font-size: 1.6rem;">Order #${order.orderId}</h2>
            <p style="color: var(--text-muted); font-size: 0.9rem;">From ${order.restaurantName} • Placed on ${App.formatDate(order.orderDate)}</p>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 1.5rem; font-weight: 800; color: var(--primary);">${App.formatCurrency(order.totalAmount)}</div>
            <div style="font-size: 0.8rem; color: var(--accent-green);">Paid via ${order.payment ? order.payment.paymentMethod : 'Online'}</div>
          </div>
        </div>

        ${!isCancelled ? `
          <!-- Visual Lifecycle Timeline (Figure B.4) -->
          <div class="tracking-stepper">
            <div class="tracking-stepper-progress" style="width: ${progressWidth}%;"></div>
            ${steps.map((st, idx) => {
              let cls = '';
              if (idx < currentIdx) cls = 'completed';
              else if (idx === currentIdx) cls = 'active';
              return `
                <div class="step-node ${cls}">
                  <div class="step-circle">${idx < currentIdx ? '✓' : idx + 1}</div>
                  <div class="step-label">${st.label}</div>
                </div>
              `;
            }).join('')}
          </div>
        ` : `
          <div style="background: rgba(239, 68, 68, 0.1); border: 1px solid var(--accent-red); border-radius: var(--radius-md); padding: 18px; margin: 24px 0;">
            <h4 style="color: #f87171; margin-bottom: 6px;">❌ Order Cancelled</h4>
            <p style="font-size: 0.9rem; color: #fca5a5;">Reason: ${order.cancellationReason || 'Cancelled'}</p>
            ${order.payment && order.payment.status === 'REFUNDED' ? `
              <p style="font-size: 0.85rem; color: #34d399; margin-top: 6px;">
                ✓ Automatic Refund of ${App.formatCurrency(order.payment.amount)} processed to original account.
              </p>
            ` : ''}
          </div>
        `}

        <!-- Delivery Partner Status & Checkpoint Location -->
        <div style="background: var(--bg-secondary); border-radius: var(--radius-md); padding: 18px; border: 1px solid var(--border-color); display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 14px;">
          <div>
            <div style="font-size: 0.85rem; color: var(--text-dim);">DELIVERY PARTNER</div>
            <div style="font-weight: 700; font-size: 1.05rem;">🛵 ${order.partnerName || 'Assigning soon...'}</div>
            <div style="font-size: 0.82rem; color: var(--text-muted);">${order.partnerVehicle ? `Vehicle: ${order.partnerVehicle}` : ''}</div>
          </div>
          <div>
            <div style="font-size: 0.85rem; color: var(--text-dim);">LOCATION CHECKPOINT (updateLocation)</div>
            <div style="font-weight: 600; color: #60a5fa;">📍 ${order.partnerLocation || 'Awaiting update'}</div>
          </div>
        </div>

        <div style="font-size: 0.75rem; color: var(--text-dim); margin-top: 10px; font-style: italic;">
          * Note: Status and location reflect the last update received, not live GPS observation (QB-NFR-012 compliant).
        </div>
      </div>

      <!-- Order Details & Actions -->
      <div class="checkout-container">
        <div class="cart-items-card">
          <h3 style="margin-bottom: 14px;">Items in this Order</h3>
          ${order.items.map(i => `
            <div style="display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid var(--border-color);">
              <div>${i.quantity}x ${i.name}</div>
              <div style="font-weight: 600;">${App.formatCurrency(i.subtotal)}</div>
            </div>
          `).join('')}
          <div style="margin-top: 14px; font-size: 0.88rem; color: var(--text-muted);">
            <div>Delivery to: <strong>${order.deliveryAddress}</strong></div>
          </div>
        </div>

        <div class="bill-summary-card">
          <h3 style="margin-bottom: 14px;">Actions</h3>
          ${canCancel ? `
            <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 14px;">
              You can cancel this order before the delivery partner picks it up from the kitchen.
            </p>
            <button class="btn btn-danger btn-block" onclick="App.cancelCustomerOrder('${order.orderId}')">
              Cancel Order & Refund
            </button>
          ` : order.status === 'DELIVERED' ? `
            <p style="font-size: 0.88rem; color: #34d399; margin-bottom: 14px;">
              ✓ Order delivered successfully!
            </p>
            ${!order.rating ? `
              <button class="btn btn-primary btn-block" onclick="App.openRatingModal('${order.orderId}')">
                ⭐ Rate this Order
              </button>
            ` : `
              <div style="background: var(--bg-secondary); padding: 12px; border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
                <div style="color: #fbbf24; font-size: 1.1rem; margin-bottom: 4px;">
                  ${'★'.repeat(order.rating.stars)}${'☆'.repeat(5 - order.rating.stars)} (${order.rating.stars}/5)
                </div>
                <div style="font-size: 0.88rem; color: var(--text-muted);">"${order.rating.comment || 'No review comment'}"</div>
              </div>
            `}
          ` : `
            <div style="font-size: 0.88rem; color: var(--text-muted);">
              Cancellation is closed once food is picked up or delivered (QB-FR-054).
            </div>
          `}
        </div>
      </div>
    `;
  },

  async cancelCustomerOrder(orderId) {
    const reason = prompt('Please specify a reason for cancellation:') || 'Customer requested cancellation';
    try {
      const res = await API.cancelOrder(orderId, reason);
      this.showToast(res.message, 'info');
      this.renderOrderTracking(document.getElementById('app-root'), orderId);
    } catch (e) {
      this.showToast(e.message, 'error');
    }
  },

  openRatingModal(orderId) {
    let currentStars = 5;
    const modalHtml = `
      <div class="modal-overlay" id="rating-modal">
        <div class="modal-content">
          <div class="modal-header">
            <h3 class="modal-title">⭐ Rate your Order</h3>
            <button class="modal-close-btn" onclick="document.getElementById('rating-modal').remove()">×</button>
          </div>
          <div class="modal-body" style="text-align: center;">
            <p style="color: var(--text-muted); margin-bottom: 16px;">How was your food and delivery experience?</p>
            <div class="star-rating" id="stars-wrap" style="justify-content: center; margin-bottom: 20px;">
              <span class="star selected" data-val="1">★</span>
              <span class="star selected" data-val="2">★</span>
              <span class="star selected" data-val="3">★</span>
              <span class="star selected" data-val="4">★</span>
              <span class="star selected" data-val="5">★</span>
            </div>
            <textarea id="rating-comment" class="form-control" rows="3" placeholder="Write a short review (optional)..."></textarea>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" onclick="document.getElementById('rating-modal').remove()">Cancel</button>
            <button class="btn btn-primary" onclick="App.submitRating('${orderId}')">Submit Review</button>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    // Star selection logic
    const stars = document.querySelectorAll('#stars-wrap .star');
    stars.forEach(s => {
      s.addEventListener('click', () => {
        const val = parseInt(s.dataset.val, 10);
        currentStars = val;
        stars.forEach(st => {
          if (parseInt(st.dataset.val, 10) <= val) st.classList.add('selected');
          else st.classList.remove('selected');
        });
      });
    });
  },

  async submitRating(orderId) {
    const selected = document.querySelectorAll('#stars-wrap .star.selected').length || 5;
    const comment = document.getElementById('rating-comment').value;

    try {
      const res = await API.rateOrder(orderId, selected, comment);
      document.getElementById('rating-modal').remove();
      this.showToast(res.message, 'success');
      this.renderOrderTracking(document.getElementById('app-root'), orderId);
    } catch (e) {
      this.showToast(e.message, 'error');
    }
  },

  // -------------------------------------------------------------------------
  // Customer Order History (QB-FR-052)
  // -------------------------------------------------------------------------
  async renderOrderHistory(container) {
    let orders = [];
    try {
      const res = await API.getOrders();
      orders = res.orders || [];
    } catch (e) {
      console.error(e);
    }

    container.innerHTML = `
      <div class="section-header">
        <h2 class="section-title"><span>📦</span> My Order History</h2>
        <button class="btn btn-primary btn-sm" onclick="App.navigate('home')">+ New Order</button>
      </div>

      ${orders.length === 0 ? `
        <div style="text-align: center; padding: 48px; background: var(--bg-card); border-radius: var(--radius-lg);">
          <h3>No past orders yet</h3>
          <p style="color: var(--text-muted); margin-top: 6px;">Browse dishes from top restaurants to place your first order!</p>
        </div>
      ` : `
        <div style="display: flex; flex-direction: column; gap: 16px;">
          ${orders.map(o => `
            <div class="restaurant-card" style="padding: 20px; flex-direction: row; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px;" onclick="App.navigate('order-tracking', { orderId: '${o.orderId}' })">
              <div>
                <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 6px;">
                  <span style="font-weight: 800; font-size: 1.1rem;">#${o.orderId}</span>
                  <span class="badge badge-${o.status.toLowerCase()}">${o.status.replace(/_/g, ' ')}</span>
                </div>
                <div style="font-weight: 600; color: var(--text-main);">${o.restaurantName}</div>
                <div style="color: var(--text-dim); font-size: 0.85rem;">${App.formatDate(o.orderDate)} • ${o.items.length} item(s)</div>
              </div>
              <div style="display: flex; align-items: center; gap: 20px;">
                <div style="font-size: 1.25rem; font-weight: 800; color: var(--primary);">
                  ${App.formatCurrency(o.totalAmount)}
                </div>
                <button class="btn btn-secondary btn-sm">View Details →</button>
              </div>
            </div>
          `).join('')}
        </div>
      `}
    `;
  },

  // -------------------------------------------------------------------------
  // SCR-04: Customer Profile (QB-FR-013 - QB-FR-018)
  // -------------------------------------------------------------------------
  renderProfile(container) {
    const user = this.state.user;
    if (!user) {
      this.navigate('login');
      return;
    }

    container.innerHTML = `
      <div class="bill-summary-card" style="max-width: 640px; margin: 0 auto;">
        <h2 style="margin-bottom: 20px;">👤 Profile & Account Settings</h2>
        
        <form id="profile-form" onsubmit="App.handleProfileSave(event)">
          <div class="form-group">
            <label class="form-label">Full Name</label>
            <input type="text" id="prof-name" class="form-control" value="${user.name}" required>
          </div>
          <div class="form-group">
            <label class="form-label">Email Address (Read-only)</label>
            <input type="email" class="form-control" value="${user.email}" disabled style="opacity: 0.7;">
          </div>
          <div class="form-group">
            <label class="form-label">Phone Number</label>
            <input type="text" id="prof-phone" class="form-control" value="${user.phone || ''}" required>
          </div>
          <div class="form-group">
            <label class="form-label">Default Delivery Address</label>
            <textarea id="prof-address" class="form-control" rows="3">${user.deliveryAddress || ''}</textarea>
          </div>
          
          <div style="display: flex; justify-content: flex-end; gap: 12px; margin-top: 24px;">
            <button type="submit" class="btn btn-primary">Save Changes</button>
          </div>
        </form>
      </div>
    `;
  },

  async handleProfileSave(e) {
    e.preventDefault();
    const name = document.getElementById('prof-name').value;
    const phone = document.getElementById('prof-phone').value;
    const deliveryAddress = document.getElementById('prof-address').value;

    try {
      const res = await API.updateProfile({ name, phone, deliveryAddress });
      this.state.user = res.user;
      API.setUser(res.user);
      this.showToast('Profile updated successfully.', 'success');
      this.render();
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  },

  // -------------------------------------------------------------------------
  // SCR-01 & SCR-02: Auth Forms (Login / Register)
  // -------------------------------------------------------------------------
  renderLogin(container) {
    container.innerHTML = `
      <div class="bill-summary-card" style="max-width: 440px; margin: 40px auto;">
        <h2 style="text-align: center; margin-bottom: 8px;">Welcome Back</h2>
        <p style="text-align: center; color: var(--text-muted); font-size: 0.9rem; margin-bottom: 24px;">Sign in to access your QuickBite portal</p>
        
        <form onsubmit="App.handleLoginForm(event)">
          <div class="form-group">
            <label class="form-label">Email Address</label>
            <input type="email" id="login-email" class="form-control" placeholder="user@quickbite.com" required>
          </div>
          <div class="form-group">
            <label class="form-label">Password</label>
            <input type="password" id="login-password" class="form-control" placeholder="••••••••" required>
          </div>
          <button type="submit" class="btn btn-primary btn-block" style="padding: 12px; margin-top: 12px;">Sign In</button>
        </form>

        <div style="margin-top: 24px; text-align: center; font-size: 0.88rem; color: var(--text-muted);">
          Don't have an account? <a href="javascript:void(0)" onclick="App.navigate('register')" style="color: var(--primary); font-weight: 600;">Register here</a>
        </div>
      </div>
    `;
  },

  async handleLoginForm(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const pass = document.getElementById('login-password').value;
    try {
      await this.login(email, pass);
    } catch (e) {
      // toast shown in login()
    }
  },

  renderRegister(container) {
    container.innerHTML = `
      <div class="bill-summary-card" style="max-width: 480px; margin: 30px auto;">
        <h2 style="text-align: center; margin-bottom: 8px;">Create Customer Account</h2>
        <p style="text-align: center; color: var(--text-muted); font-size: 0.9rem; margin-bottom: 24px;">Sign up to order delicious meals</p>

        <form onsubmit="App.handleRegisterForm(event)">
          <div class="form-group">
            <label class="form-label">Full Name *</label>
            <input type="text" id="reg-name" class="form-control" placeholder="John Doe" required>
          </div>
          <div class="form-group">
            <label class="form-label">Email Address *</label>
            <input type="email" id="reg-email" class="form-control" placeholder="john@example.com" required>
          </div>
          <div class="form-group">
            <label class="form-label">Phone Number *</label>
            <input type="tel" id="reg-phone" class="form-control" placeholder="+91 98765 43210" required>
          </div>
          <div class="form-group">
            <label class="form-label">Delivery Address</label>
            <textarea id="reg-address" class="form-control" rows="2" placeholder="Street, Apartment, City, Pincode"></textarea>
          </div>
          <div class="form-group">
            <label class="form-label">Password * (Min. 6 chars)</label>
            <input type="password" id="reg-password" class="form-control" placeholder="••••••••" required minlength="6">
          </div>
          <button type="submit" class="btn btn-primary btn-block" style="padding: 12px; margin-top: 12px;">Create Account</button>
        </form>

        <div style="margin-top: 20px; text-align: center; font-size: 0.88rem; color: var(--text-muted);">
          Already have an account? <a href="javascript:void(0)" onclick="App.navigate('login')" style="color: var(--primary); font-weight: 600;">Sign in here</a>
        </div>
      </div>
    `;
  },

  async handleRegisterForm(e) {
    e.preventDefault();
    const name = document.getElementById('reg-name').value;
    const email = document.getElementById('reg-email').value;
    const phone = document.getElementById('reg-phone').value;
    const deliveryAddress = document.getElementById('reg-address').value;
    const password = document.getElementById('reg-password').value;

    try {
      const res = await API.register({ name, email, phone, deliveryAddress, password });
      API.setToken(res.token);
      API.setUser(res.user);
      this.state.user = res.user;
      this.showToast('Account created successfully! Welcome to QuickBite.', 'success');
      this.navigate('home');
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  },

  // -------------------------------------------------------------------------
  // SCR-09 & SCR-10: Restaurant Panels
  // -------------------------------------------------------------------------
  async renderRestaurantOrders(container) {
    const user = this.state.user;
    if (!user || user.role !== 'RESTAURANT') {
      this.navigate('login');
      return;
    }

    let orders = [];
    try {
      const res = await API.getOrders();
      orders = res.orders || [];
    } catch (e) {
      console.error(e);
    }

    container.innerHTML = `
      <div class="section-header">
        <h2 class="section-title"><span>🍳</span> Kitchen Live Orders Pipeline</h2>
        <button class="btn btn-secondary btn-sm" onclick="App.render()">🔄 Refresh</button>
      </div>

      <div style="display: flex; flex-direction: column; gap: 18px;">
        ${orders.length === 0 ? `
          <div style="text-align: center; padding: 48px; background: var(--bg-card); border-radius: var(--radius-lg);">
            <h3>No orders received yet</h3>
          </div>
        ` : orders.map(o => `
          <div class="bill-summary-card" style="border-left: 4px solid var(--primary);">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 12px; margin-bottom: 14px;">
              <div>
                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 4px;">
                  <h3 style="margin: 0;">Order #${o.orderId}</h3>
                  <span class="badge badge-${o.status.toLowerCase()}">${o.status.replace(/_/g, ' ')}</span>
                </div>
                <div style="color: var(--text-muted); font-size: 0.88rem;">Customer: ${o.customerName} (${o.customerPhone}) • ${App.formatDate(o.orderDate)}</div>
                <div style="color: var(--text-dim); font-size: 0.82rem;">Address: ${o.deliveryAddress}</div>
              </div>
              <div style="text-align: right;">
                <div style="font-size: 1.3rem; font-weight: 800; color: var(--primary);">${App.formatCurrency(o.totalAmount)}</div>
                <div style="font-size: 0.8rem; color: var(--accent-green);">Paid (${o.payment?.paymentMethod || 'Online'})</div>
              </div>
            </div>

            <!-- Items -->
            <div style="background: var(--bg-secondary); padding: 12px; border-radius: var(--radius-sm); margin-bottom: 14px;">
              ${o.items.map(i => `
                <div style="display: flex; justify-content: space-between; font-size: 0.9rem; padding: 2px 0;">
                  <span>${i.quantity}x ${i.name}</span>
                  <span>${App.formatCurrency(i.subtotal)}</span>
                </div>
              `).join('')}
            </div>

            <!-- Restaurant Action Controls -->
            <div style="display: flex; justify-content: flex-end; gap: 10px; flex-wrap: wrap;">
              ${o.status === 'PLACED' ? `
                <button class="btn btn-danger btn-sm" onclick="App.updateKitchenStatus('${o.orderId}', 'CANCELLED', 'Rejected by kitchen (busy)')">Reject Order</button>
                <button class="btn btn-primary btn-sm" onclick="App.updateKitchenStatus('${o.orderId}', 'CONFIRMED')">✓ Accept Order</button>
              ` : o.status === 'CONFIRMED' ? `
                <button class="btn btn-primary btn-sm" onclick="App.updateKitchenStatus('${o.orderId}', 'PREPARING')">👨‍🍳 Start Preparing Food</button>
              ` : o.status === 'PREPARING' ? `
                <button class="btn btn-success btn-sm" onclick="App.updateKitchenStatus('${o.orderId}', 'READY_FOR_PICKUP')">📦 Mark Ready for Pickup</button>
              ` : o.status === 'READY_FOR_PICKUP' ? `
                <span style="color: var(--secondary); font-size: 0.9rem; font-weight: 600;">Waiting for Delivery Partner (${o.partnerName || 'Pending'}) to pick up</span>
              ` : `
                <span style="color: var(--text-dim); font-size: 0.85rem;">Status: ${o.status}</span>
              `}
            </div>
          </div>
        `).join('')}
      </div>
    `;
  },

  async updateKitchenStatus(orderId, status, reason) {
    try {
      const res = await API.updateRestaurantOrderStatus(orderId, status, reason);
      this.showToast(res.message, 'success');
      this.render();
    } catch (e) {
      this.showToast(e.message, 'error');
    }
  },

  async renderRestaurantMenu(container) {
    const user = this.state.user;
    let menu = [];

    try {
      const res = await API.getRestaurantMenu(user.restaurantId);
      menu = res.menu || [];
    } catch (e) {
      console.error(e);
    }

    container.innerHTML = `
      <div class="section-header">
        <h2 class="section-title"><span>📋</span> Menu Management (${menu.length} items)</h2>
        <button class="btn btn-primary btn-sm" onclick="App.openAddMenuItemModal()">+ Add New Menu Item</button>
      </div>

      <div class="data-table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Category</th>
              <th>Price</th>
              <th>Type</th>
              <th>Availability (Stock)</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${menu.map(item => `
              <tr>
                <td>
                  <div style="display: flex; align-items: center; gap: 10px;">
                    <img src="${item.image}" style="width: 44px; height: 44px; border-radius: 6px; object-fit: cover;">
                    <div>
                      <div style="font-weight: 700;">${item.name}</div>
                      <div style="font-size: 0.78rem; color: var(--text-dim);">${item.description ? item.description.substring(0, 45) + '...' : ''}</div>
                    </div>
                  </div>
                </td>
                <td>${item.category}</td>
                <td style="font-weight: 700; color: var(--primary);">${App.formatCurrency(item.price)}</td>
                <td><span class="${item.isVeg ? 'veg-icon' : 'non-veg-icon'}"></span> ${item.isVeg ? 'Veg' : 'Non-Veg'}</td>
                <td>
                  <button class="btn ${item.availability ? 'btn-success' : 'btn-danger'} btn-sm" onclick="App.toggleItemAvailability('${item.itemId}', ${!item.availability})">
                    ${item.availability ? '● In Stock' : '✕ Out of Stock'}
                  </button>
                </td>
                <td>
                  <button class="btn btn-secondary btn-sm" onclick='App.openEditMenuItemModal(${JSON.stringify(item)})'>Edit Price</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  },

  async toggleItemAvailability(itemId, availability) {
    try {
      await API.updateMenuItem(itemId, { availability });
      this.showToast('Item availability updated.', 'success');
      this.render();
    } catch (e) {
      this.showToast(e.message, 'error');
    }
  },

  openAddMenuItemModal() {
    const modalHtml = `
      <div class="modal-overlay" id="menu-modal">
        <div class="modal-content">
          <div class="modal-header">
            <h3 class="modal-title">+ Add Menu Item</h3>
            <button class="modal-close-btn" onclick="document.getElementById('menu-modal').remove()">×</button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label class="form-label">Dish Name *</label>
              <input type="text" id="new-item-name" class="form-control" placeholder="e.g. Butter Garlic Prawns" required>
            </div>
            <div class="form-group">
              <label class="form-label">Category *</label>
              <input type="text" id="new-item-cat" class="form-control" placeholder="e.g. Starters, Main Course, Desserts" required>
            </div>
            <div class="form-group">
              <label class="form-label">Price (₹) *</label>
              <input type="number" id="new-item-price" class="form-control" placeholder="250" required min="1" step="1">
            </div>
            <div class="form-group">
              <label class="form-label">Dietary Type</label>
              <select id="new-item-veg" class="form-control">
                <option value="true">Vegetarian</option>
                <option value="false">Non-Vegetarian</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Description</label>
              <textarea id="new-item-desc" class="form-control" rows="2" placeholder="Freshly cooked..."></textarea>
            </div>
            <div class="form-group">
              <label class="form-label">Image URL</label>
              <input type="url" id="new-item-img" class="form-control" placeholder="https://images.unsplash.com/...">
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" onclick="document.getElementById('menu-modal').remove()">Cancel</button>
            <button class="btn btn-primary" onclick="App.submitAddMenuItem()">Save Item</button>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
  },

  async submitAddMenuItem() {
    const name = document.getElementById('new-item-name').value;
    const category = document.getElementById('new-item-cat').value;
    const price = document.getElementById('new-item-price').value;
    const isVeg = document.getElementById('new-item-veg').value === 'true';
    const description = document.getElementById('new-item-desc').value;
    const image = document.getElementById('new-item-img').value;

    try {
      await API.createMenuItem({ name, category, price, isVeg, description, image });
      document.getElementById('menu-modal').remove();
      this.showToast('Menu item added successfully!', 'success');
      this.render();
    } catch (e) {
      this.showToast(e.message, 'error');
    }
  },

  openEditMenuItemModal(item) {
    const newPrice = prompt(`Update price for "${item.name}" (Current: ₹${item.price}):`, item.price);
    if (newPrice !== null && !isNaN(newPrice) && Number(newPrice) > 0) {
      API.updateMenuItem(item.itemId, { price: Number(newPrice) })
        .then(() => {
          this.showToast('Price updated successfully.', 'success');
          this.render();
        })
        .catch(e => this.showToast(e.message, 'error'));
    }
  },

  // -------------------------------------------------------------------------
  // SCR-11: Delivery Partner Operations
  // -------------------------------------------------------------------------
  async renderDeliveryPortal(container) {
    const user = this.state.user;
    let orders = [];

    try {
      const res = await API.getOrders();
      orders = res.orders || [];
    } catch (e) {
      console.error(e);
    }

    container.innerHTML = `
      <div class="section-header">
        <h2 class="section-title"><span>🛵</span> Delivery Partner Control Center</h2>
        <button class="btn btn-secondary btn-sm" onclick="App.render()">🔄 Refresh</button>
      </div>

      <!-- Quick Location Checkpoint Update (QB-FR-072) -->
      <div class="bill-summary-card" style="margin-bottom: 24px; background: linear-gradient(135deg, rgba(59, 130, 246, 0.12) 0%, rgba(16, 185, 129, 0.08) 100%);">
        <h3 style="margin-bottom: 8px;">📍 Broadcast Live Checkpoint (updateLocation)</h3>
        <p style="color: var(--text-muted); font-size: 0.88rem; margin-bottom: 14px;">Updates visible on the customer's live tracking view.</p>
        <div style="display: flex; gap: 10px; flex-wrap: wrap;">
          <input type="text" id="dp-location-input" class="form-control" style="flex: 1; min-width: 260px;" placeholder="e.g. Arrived at Restaurant / On MG Road / Reached Customer Gate">
          <button class="btn btn-primary" onclick="App.handleLocationUpdate()">Broadcast Location</button>
        </div>
      </div>

      <div style="display: flex; flex-direction: column; gap: 18px;">
        ${orders.length === 0 ? `
          <div style="text-align: center; padding: 48px; background: var(--bg-card); border-radius: var(--radius-lg);">
            <h3>No assigned deliveries currently</h3>
          </div>
        ` : orders.map(o => `
          <div class="bill-summary-card">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 12px; margin-bottom: 12px;">
              <div>
                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 4px;">
                  <h3 style="margin: 0;">Order #${o.orderId}</h3>
                  <span class="badge badge-${o.status.toLowerCase()}">${o.status.replace(/_/g, ' ')}</span>
                </div>
                <div style="font-weight: 600;">Pick up from: ${o.restaurantName}</div>
                <div style="color: var(--text-muted); font-size: 0.88rem;">Deliver to: <strong>${o.deliveryAddress}</strong></div>
                <div style="color: var(--text-dim); font-size: 0.82rem;">Customer: ${o.customerName} (${o.customerPhone})</div>
              </div>
              <div style="text-align: right;">
                <div style="font-weight: 800; font-size: 1.25rem; color: var(--primary);">${App.formatCurrency(o.totalAmount)}</div>
                <div style="font-size: 0.8rem; color: var(--accent-green);">Paid</div>
              </div>
            </div>

            <!-- Partner Action Progression -->
            <div style="display: flex; justify-content: flex-end; gap: 10px; border-top: 1px solid var(--border-color); padding-top: 14px; margin-top: 14px; flex-wrap: wrap;">
              ${o.status === 'READY_FOR_PICKUP' ? `
                <button class="btn btn-primary" onclick="App.updatePartnerStatus('${o.orderId}', 'PICKED_UP')">📦 Confirm Picked Up from Kitchen</button>
              ` : o.status === 'PICKED_UP' ? `
                <button class="btn btn-primary" onclick="App.updatePartnerStatus('${o.orderId}', 'OUT_FOR_DELIVERY')">🛵 Mark Out For Delivery</button>
              ` : o.status === 'OUT_FOR_DELIVERY' ? `
                <button class="btn btn-success" onclick="App.updatePartnerStatus('${o.orderId}', 'DELIVERED')">🎉 Mark Successfully Delivered</button>
              ` : `
                <span style="color: var(--text-muted); font-size: 0.85rem;">Status: ${o.status}</span>
              `}
            </div>
          </div>
        `).join('')}
      </div>
    `;
  },

  async handleLocationUpdate() {
    const loc = document.getElementById('dp-location-input').value;
    if (!loc || !loc.trim()) {
      this.showToast('Please type a location or milestone checkpoint.', 'error');
      return;
    }
    try {
      await API.updatePartnerLocation(loc.trim());
      this.showToast(`Broadcasted: "${loc}"`, 'success');
      document.getElementById('dp-location-input').value = '';
      this.render();
    } catch (e) {
      this.showToast(e.message, 'error');
    }
  },

  async updatePartnerStatus(orderId, status) {
    try {
      const res = await API.updateDeliveryStatus(orderId, status);
      this.showToast(res.message, 'success');
      this.render();
    } catch (e) {
      this.showToast(e.message, 'error');
    }
  },

  // -------------------------------------------------------------------------
  // SCR-12, SCR-13, SCR-14: Admin Features
  // -------------------------------------------------------------------------
  async renderAdminDashboard(container) {
    let stats = {};
    let orders = [];

    try {
      const res = await API.getAdminAnalytics();
      stats = res.stats || {};
      const ordersRes = await API.getAdminOrders();
      orders = ordersRes.orders.slice(0, 5) || [];
    } catch (e) {
      console.error(e);
    }

    container.innerHTML = `
      <div class="section-header">
        <h2 class="section-title"><span>🛡️</span> QuickBite Administrator Dashboard</h2>
        <div style="display: flex; gap: 10px;">
          <button class="btn btn-secondary btn-sm" onclick="App.triggerResetDb()">🔄 Reset Demo DB</button>
          <button class="btn btn-primary btn-sm" onclick="App.navigate('admin-reports')">View Full Reports →</button>
        </div>
      </div>

      <!-- KPI Metric Cards -->
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-label">Total Platform Revenue</div>
          <div class="stat-val" style="color: var(--accent-green);">${App.formatCurrency(stats.totalRevenue || 0)}</div>
          <div class="stat-icon">💰</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Total Orders Placed</div>
          <div class="stat-val">${stats.totalOrders || 0}</div>
          <div class="stat-icon">📦</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Active Orders</div>
          <div class="stat-val" style="color: var(--accent-amber);">${stats.activeOrdersCount || 0}</div>
          <div class="stat-icon">🔥</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Registered Customers</div>
          <div class="stat-val">${stats.totalCustomers || 0}</div>
          <div class="stat-icon">👥</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Partner Restaurants</div>
          <div class="stat-val">${stats.totalRestaurants || 0}</div>
          <div class="stat-icon">🍽️</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Delivery Fleet</div>
          <div class="stat-val">${stats.totalDeliveryPartners || 0}</div>
          <div class="stat-icon">🛵</div>
        </div>
      </div>

      <!-- Recent Orders Table -->
      <div class="section-header">
        <h3 class="section-title">Recent System Orders</h3>
      </div>
      <div class="data-table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Order ID</th>
              <th>Customer</th>
              <th>Restaurant</th>
              <th>Date</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Partner</th>
            </tr>
          </thead>
          <tbody>
            ${orders.map(o => `
              <tr>
                <td style="font-weight: 700;">#${o.orderId}</td>
                <td>${o.customerName}</td>
                <td>${o.restaurantName}</td>
                <td style="color: var(--text-muted); font-size: 0.85rem;">${App.formatDate(o.orderDate)}</td>
                <td style="font-weight: 700; color: var(--primary);">${App.formatCurrency(o.totalAmount)}</td>
                <td><span class="badge badge-${o.status.toLowerCase()}">${o.status}</span></td>
                <td>${o.partnerName || 'Unassigned'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  },

  async renderAdminUsers(container) {
    let users = [];
    try {
      const res = await API.getAdminUsers();
      users = res.users || [];
    } catch (e) {
      console.error(e);
    }

    container.innerHTML = `
      <div class="section-header">
        <h2 class="section-title"><span>👥</span> User Account Management</h2>
      </div>

      <div class="data-table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Role</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${users.map(u => `
              <tr>
                <td style="font-weight: 700;">${u.name}</td>
                <td>${u.email}</td>
                <td>${u.phone || '—'}</td>
                <td><span class="role-tag ${u.role.toLowerCase()}">${u.role}</span></td>
                <td>
                  <span class="badge ${u.active ? 'badge-in-stock' : 'badge-out-of-stock'}">
                    ${u.active ? 'Active' : 'Deactivated'}
                  </span>
                </td>
                <td>
                  <button class="btn btn-secondary btn-sm" onclick="App.toggleUserStatus('${u.userId}', ${!u.active})">
                    ${u.active ? 'Deactivate' : 'Reactivate'}
                  </button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  },

  async toggleUserStatus(userId, active) {
    try {
      await API.updateAdminUser(userId, { active });
      this.showToast(`User account status updated.`, 'success');
      this.render();
    } catch (e) {
      this.showToast(e.message, 'error');
    }
  },

  async renderAdminRestaurants(container) {
    let restaurants = [];
    try {
      const res = await API.getAdminRestaurants();
      restaurants = res.restaurants || [];
    } catch (e) {
      console.error(e);
    }

    container.innerHTML = `
      <div class="section-header">
        <h2 class="section-title"><span>🍽️</span> Restaurant Management</h2>
        <button class="btn btn-primary btn-sm" onclick="App.openAddRestaurantModal()">+ Register Restaurant</button>
      </div>

      <div class="data-table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Restaurant</th>
              <th>Cuisine</th>
              <th>Contact</th>
              <th>Address</th>
              <th>Rating</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${restaurants.map(r => `
              <tr>
                <td style="font-weight: 700;">${r.name}</td>
                <td>${r.cuisine}</td>
                <td>${r.contact}</td>
                <td>${r.address}</td>
                <td style="color: #fbbf24; font-weight: 700;">★ ${r.rating}</td>
                <td>
                  <span class="badge ${r.active ? 'badge-in-stock' : 'badge-out-of-stock'}">
                    ${r.active ? 'Active' : 'Closed'}
                  </span>
                </td>
                <td>
                  <button class="btn btn-secondary btn-sm" onclick="App.toggleRestaurantStatus('${r.restaurantId}', ${!r.active})">
                    ${r.active ? 'Close' : 'Open'}
                  </button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  },

  async toggleRestaurantStatus(restaurantId, active) {
    try {
      await API.updateAdminRestaurant(restaurantId, { active });
      this.showToast('Restaurant status updated.', 'success');
      this.render();
    } catch (e) {
      this.showToast(e.message, 'error');
    }
  },

  openAddRestaurantModal() {
    const modalHtml = `
      <div class="modal-overlay" id="add-rest-modal">
        <div class="modal-content">
          <div class="modal-header">
            <h3 class="modal-title">+ Add New Restaurant</h3>
            <button class="modal-close-btn" onclick="document.getElementById('add-rest-modal').remove()">×</button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label class="form-label">Restaurant Name *</label>
              <input type="text" id="add-rest-name" class="form-control" placeholder="e.g. Grand Malabar Diner" required>
            </div>
            <div class="form-group">
              <label class="form-label">Cuisine Specialities *</label>
              <input type="text" id="add-rest-cuisine" class="form-control" placeholder="e.g. Kerala Seafood & Biryanis" required>
            </div>
            <div class="form-group">
              <label class="form-label">Contact Phone *</label>
              <input type="text" id="add-rest-contact" class="form-control" placeholder="+91 98460 99887" required>
            </div>
            <div class="form-group">
              <label class="form-label">Address Location *</label>
              <input type="text" id="add-rest-address" class="form-control" placeholder="Near KSRTC Stand, Kottayam" required>
            </div>
            <div class="form-group">
              <label class="form-label">Min Order (₹)</label>
              <input type="number" id="add-rest-min" class="form-control" value="150">
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" onclick="document.getElementById('add-rest-modal').remove()">Cancel</button>
            <button class="btn btn-primary" onclick="App.submitAddRestaurant()">Save Restaurant</button>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
  },

  async submitAddRestaurant() {
    const name = document.getElementById('add-rest-name').value;
    const cuisine = document.getElementById('add-rest-cuisine').value;
    const contact = document.getElementById('add-rest-contact').value;
    const address = document.getElementById('add-rest-address').value;
    const minOrder = document.getElementById('add-rest-min').value;

    try {
      await API.createAdminRestaurant({ name, cuisine, contact, address, minOrder });
      document.getElementById('add-rest-modal').remove();
      this.showToast('Restaurant registered successfully!', 'success');
      this.render();
    } catch (e) {
      this.showToast(e.message, 'error');
    }
  },

  async renderAdminPartners(container) {
    let partners = [];
    try {
      const res = await API.getAdminPartners();
      partners = res.partners || [];
    } catch (e) {
      console.error(e);
    }

    container.innerHTML = `
      <div class="section-header">
        <h2 class="section-title"><span>🛵</span> Delivery Fleet Management</h2>
        <button class="btn btn-primary btn-sm" onclick="App.openAddPartnerModal()">+ Register Partner</button>
      </div>

      <div class="data-table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Partner Name</th>
              <th>Phone</th>
              <th>Vehicle Number</th>
              <th>Current Location</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${partners.map(p => `
              <tr>
                <td style="font-weight: 700;">${p.name}</td>
                <td>${p.phone}</td>
                <td><code>${p.vehicleNo}</code></td>
                <td>${p.currentLocation || 'Standby'}</td>
                <td>
                  <span class="badge ${p.active ? 'badge-in-stock' : 'badge-out-of-stock'}">
                    ${p.active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td>
                  <button class="btn btn-secondary btn-sm" onclick="App.togglePartnerStatus('${p.partnerId}', ${!p.active})">
                    ${p.active ? 'Deactivate' : 'Activate'}
                  </button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  },

  async togglePartnerStatus(partnerId, active) {
    try {
      await API.updateAdminPartner(partnerId, { active });
      this.showToast('Partner status updated.', 'success');
      this.render();
    } catch (e) {
      this.showToast(e.message, 'error');
    }
  },

  openAddPartnerModal() {
    const modalHtml = `
      <div class="modal-overlay" id="add-partner-modal">
        <div class="modal-content">
          <div class="modal-header">
            <h3 class="modal-title">+ Register Delivery Partner</h3>
            <button class="modal-close-btn" onclick="document.getElementById('add-partner-modal').remove()">×</button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label class="form-label">Full Name *</label>
              <input type="text" id="add-dp-name" class="form-control" placeholder="e.g. Arun George" required>
            </div>
            <div class="form-group">
              <label class="form-label">Contact Phone *</label>
              <input type="text" id="add-dp-phone" class="form-control" placeholder="+91 94473 11223" required>
            </div>
            <div class="form-group">
              <label class="form-label">Vehicle Registration Number *</label>
              <input type="text" id="add-dp-veh" class="form-control" placeholder="KL-05-EF-9988" required>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" onclick="document.getElementById('add-partner-modal').remove()">Cancel</button>
            <button class="btn btn-primary" onclick="App.submitAddPartner()">Register Partner</button>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
  },

  async submitAddPartner() {
    const name = document.getElementById('add-dp-name').value;
    const phone = document.getElementById('add-dp-phone').value;
    const vehicleNo = document.getElementById('add-dp-veh').value;

    try {
      await API.createAdminPartner({ name, phone, vehicleNo });
      document.getElementById('add-partner-modal').remove();
      this.showToast('Delivery partner registered!', 'success');
      this.render();
    } catch (e) {
      this.showToast(e.message, 'error');
    }
  },

  // -------------------------------------------------------------------------
  // SCR-14: Orders & Reporting
  // -------------------------------------------------------------------------
  async renderAdminReports(container) {
    let orders = [];
    try {
      const res = await API.getAdminOrders();
      orders = res.orders || [];
    } catch (e) {
      console.error(e);
    }

    const totalVal = orders.reduce((sum, o) => sum + o.totalAmount, 0);

    container.innerHTML = `
      <div class="section-header">
        <h2 class="section-title"><span>📊</span> Orders Ledger & Financial Report</h2>
        <button class="btn btn-secondary btn-sm" onclick="window.print()">🖨️ Print / Export Ledger</button>
      </div>

      <!-- Filter Controls (QB-FR-082) -->
      <div class="bill-summary-card" style="margin-bottom: 20px;">
        <div style="display: flex; gap: 14px; flex-wrap: wrap; align-items: flex-end;">
          <div style="flex: 1; min-width: 180px;">
            <label class="form-label">Status Filter</label>
            <select id="report-status-filter" class="form-control" onchange="App.filterAdminOrders()">
              <option value="ALL">All Statuses</option>
              <option value="PLACED">PLACED</option>
              <option value="CONFIRMED">CONFIRMED</option>
              <option value="PREPARING">PREPARING</option>
              <option value="READY_FOR_PICKUP">READY FOR PICKUP</option>
              <option value="PICKED_UP">PICKED UP</option>
              <option value="OUT_FOR_DELIVERY">OUT FOR DELIVERY</option>
              <option value="DELIVERED">DELIVERED</option>
              <option value="CANCELLED">CANCELLED</option>
            </select>
          </div>
          <div style="flex: 1; min-width: 180px;">
            <label class="form-label">Filter by Date</label>
            <input type="date" id="report-date-filter" class="form-control" onchange="App.filterAdminOrders()">
          </div>
          <button class="btn btn-secondary" onclick="document.getElementById('report-status-filter').value='ALL'; document.getElementById('report-date-filter').value=''; App.filterAdminOrders();">
            Reset Filters
          </button>
        </div>

        <div style="margin-top: 16px; padding-top: 14px; border-top: 1px solid var(--border-color); display: flex; justify-content: space-between; font-weight: 700;">
          <span id="report-orders-count">Showing ${orders.length} order(s)</span>
          <span id="report-orders-total" style="color: var(--primary);">Total Volume: ${App.formatCurrency(totalVal)}</span>
        </div>
      </div>

      <div class="data-table-wrap" id="admin-orders-table-wrap">
        ${this.buildAdminOrdersTableHtml(orders)}
      </div>
    `;
  },

  buildAdminOrdersTableHtml(orders) {
    if (!orders || orders.length === 0) {
      return `
        <div style="text-align: center; padding: 48px; color: var(--text-muted);">
          No orders match the selected filter criteria (QB-FR-085).
        </div>
      `;
    }

    return `
      <table class="data-table">
        <thead>
          <tr>
            <th>Order ID</th>
            <th>Customer</th>
            <th>Restaurant</th>
            <th>Items</th>
            <th>Date</th>
            <th>Total Amount</th>
            <th>Payment</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${orders.map(o => `
            <tr>
              <td style="font-weight: 700;">#${o.orderId}</td>
              <td>${o.customerName}</td>
              <td>${o.restaurantName}</td>
              <td>${o.items.map(i => `${i.quantity}x ${i.name}`).join(', ')}</td>
              <td style="font-size: 0.82rem; color: var(--text-muted);">${App.formatDate(o.orderDate)}</td>
              <td style="font-weight: 700; color: var(--primary);">${App.formatCurrency(o.totalAmount)}</td>
              <td>
                <span style="font-size: 0.8rem; font-weight: 600; color: ${o.payment?.status === 'REFUNDED' ? 'var(--accent-red)' : 'var(--accent-green)'}">
                  ${o.payment ? `${o.payment.paymentMethod} (${o.payment.status})` : '—'}
                </span>
              </td>
              <td><span class="badge badge-${o.status.toLowerCase()}">${o.status}</span></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  },

  async filterAdminOrders() {
    const status = document.getElementById('report-status-filter').value;
    const date = document.getElementById('report-date-filter').value;

    try {
      const res = await API.getAdminOrders({ status, date });
      const orders = res.orders || [];
      const totalVal = orders.reduce((sum, o) => sum + o.totalAmount, 0);

      document.getElementById('admin-orders-table-wrap').innerHTML = this.buildAdminOrdersTableHtml(orders);
      document.getElementById('report-orders-count').textContent = `Showing ${orders.length} order(s)`;
      document.getElementById('report-orders-total').textContent = `Total Volume: ${App.formatCurrency(totalVal)}`;
    } catch (e) {
      console.error(e);
    }
  },

  async triggerResetDb() {
    if (!confirm('Are you sure you want to reset the database to initial clean seed data?')) return;
    try {
      await API.resetDatabase();
      this.showToast('Database reset to clean test data.', 'success');
      this.render();
    } catch (e) {
      this.showToast(e.message, 'error');
    }
  },

  setupGlobalEvents() {
    // Listen for popstate or global hotkeys if needed
  }
};

window.App = App;
window.addEventListener('DOMContentLoaded', () => App.init());
