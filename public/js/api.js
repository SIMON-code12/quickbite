// API Client for QuickBite Food Delivery System

const API = {
  getToken() {
    return localStorage.getItem('qb_token');
  },

  setToken(token) {
    if (token) localStorage.setItem('qb_token', token);
    else localStorage.removeItem('qb_token');
  },

  getUser() {
    try {
      const u = localStorage.getItem('qb_user');
      return u ? JSON.parse(u) : null;
    } catch (e) {
      return null;
    }
  },

  setUser(user) {
    if (user) localStorage.setItem('qb_user', JSON.stringify(user));
    else localStorage.removeItem('qb_user');
  },

  async request(endpoint, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    };

    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const res = await fetch(endpoint, {
        ...options,
        headers
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || `HTTP error ${res.status}`);
      }

      return data;
    } catch (err) {
      console.error(`API Error on [${options.method || 'GET'} ${endpoint}]:`, err.message);
      throw err;
    }
  },

  // Auth
  async register(payload) {
    return this.request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  async login(email, password) {
    return this.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
  },

  async getMe() {
    return this.request('/api/auth/me');
  },

  async updateProfile(payload) {
    return this.request('/api/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
  },

  // Restaurants & Menus
  async getRestaurants(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/api/restaurants${query ? '?' + query : ''}`);
  },

  async getRestaurantMenu(id) {
    return this.request(`/api/restaurants/${id}`);
  },

  // Orders & Payment
  async placeOrder(payload) {
    return this.request('/api/orders', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  async getOrders(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/api/orders${query ? '?' + query : ''}`);
  },

  async getOrder(id) {
    return this.request(`/api/orders/${id}`);
  },

  async cancelOrder(id, reason) {
    return this.request(`/api/orders/${id}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason })
    });
  },

  async rateOrder(id, stars, comment) {
    return this.request(`/api/orders/${id}/rate`, {
      method: 'POST',
      body: JSON.stringify({ stars, comment })
    });
  },

  // Restaurant Management
  async updateRestaurantOrderStatus(orderId, status, reason) {
    return this.request(`/api/restaurant/orders/${orderId}/status`, {
      method: 'POST',
      body: JSON.stringify({ status, reason })
    });
  },

  async createMenuItem(payload) {
    return this.request('/api/menu-items', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  async updateMenuItem(id, payload) {
    return this.request(`/api/menu-items/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
  },

  // Delivery Partner
  async updateDeliveryStatus(orderId, status) {
    return this.request(`/api/delivery/orders/${orderId}/status`, {
      method: 'POST',
      body: JSON.stringify({ status })
    });
  },

  async updatePartnerLocation(location) {
    return this.request('/api/delivery/location', {
      method: 'POST',
      body: JSON.stringify({ location })
    });
  },

  // Admin
  async getAdminAnalytics() {
    return this.request('/api/admin/analytics');
  },

  async getAdminUsers() {
    return this.request('/api/admin/users');
  },

  async updateAdminUser(id, payload) {
    return this.request(`/api/admin/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
  },

  async getAdminRestaurants() {
    return this.request('/api/admin/restaurants');
  },

  async createAdminRestaurant(payload) {
    return this.request('/api/admin/restaurants', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  async updateAdminRestaurant(id, payload) {
    return this.request(`/api/admin/restaurants/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
  },

  async getAdminPartners() {
    return this.request('/api/admin/partners');
  },

  async createAdminPartner(payload) {
    return this.request('/api/admin/partners', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  async updateAdminPartner(id, payload) {
    return this.request(`/api/admin/partners/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
  },

  async getAdminOrders(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/api/admin/orders${query ? '?' + query : ''}`);
  },

  async resetDatabase() {
    return this.request('/api/admin/reset-db', { method: 'POST' });
  }
};
