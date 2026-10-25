# QuickBite — Food Delivery Management System

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new)

**QuickBite** is a full-stack, multi-role food delivery web application built according to a formal Software Requirements Specification (SRS v1.0).

---

## ⚡ Key Highlights & Features

- **4 Multi-Role Portals:**
  - 👤 **Customer:** Restaurant catalog discovery, live search, single-restaurant cart validation, automatic GST & delivery fee calculation, payment gateway with failure simulation, 7-stage live milestone tracking, and order reviews.
  - 🍳 **Restaurant / Kitchen:** Live incoming orders pipeline (Accept → Prepare → Mark Ready for Pickup), real-time stock toggles, price updates, and new item creation.
  - 🛵 **Delivery Fleet:** Order dispatch queue, location checkpoint broadcasting, and delivery fulfillment progression.
  - 🛡️ **Administrator:** Financial overview, platform revenue metrics, user activation toggles, restaurant onboarding, and printable orders ledger.
- **⚡ Instant Demo Role Switcher:** Fixed top bar allows evaluators and teammates to toggle between Customer, Kitchen, Delivery Driver, and Admin with one click.
- **Cloud-Ready on Vercel:** Zero-configuration serverless Express backend and static frontend.

---

## 🚀 Running Locally

```bash
# 1. Clone repository
git clone https://github.com/SIMON-code12/quickbite.git
cd quickbite

# 2. Install dependencies
npm install

# 3. Start local development server
npm start
```

Visit [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🌐 Deploying to Vercel

1. Push this repository to GitHub under your account (`SIMON-code12/quickbite`).
2. Go to [vercel.com](https://vercel.com) and log in with your GitHub account.
3. Click **Add New...** → **Project**.
4. Select the `quickbite` repository and click **Deploy**.
5. Vercel automatically detects the static assets in `public/` and the serverless API in `api/index.js`.

---

## 🔑 Pre-Configured Demo Credentials

| Role | Email | Password |
| :--- | :--- | :--- |
| **Customer** | `customer@quickbite.com` | `password123` |
| **Kitchen (Royal Spice)** | `spice@quickbite.com` | `spice123` |
| **Delivery (Alex)** | `alex@quickbite.com` | `alex123` |
| **Administrator** | `admin@quickbite.com` | `admin123` |

---

## 🛠️ Tech Stack

- **Frontend:** Vanilla HTML5, CSS3, JavaScript (ES6+), Google Fonts (Inter & Outfit)
- **Backend:** Node.js, Express.js
- **Auth & Security:** JWT (JSON Web Tokens), bcryptjs
- **Deployment:** Vercel (Serverless Functions & Edge CDN)
