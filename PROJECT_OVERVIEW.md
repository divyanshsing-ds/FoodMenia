# 🍕 FoodMenia - Ultimate Project Master File

FoodMenia is a high-performance **MERN** (MongoDB, Express, React, Node.js) platform that bridges the gap between traditional food delivery and social media. It serves three distinct user bases through a unified, role-aware dashboard system.

---

## 🛠️ 1. Complete Technology Stack

### **Frontend Architecture**
- **Core Library**: `React 19.x` (Component-based UI)
- **Build Tool**: `Vite 8.0` (Ultra-fast development & bundling)
- **Routing**: `React Router 7.x` (Role-based protected route management)
- **Styling**: `Vanilla CSS3` (Custom-built design system with modern CSS variables)
- **State Management**: `React Hooks` (`useState`, `useEffect`, `useCallback`, `useMemo`, `useRef`)
- **PDF Engine**: `jsPDF` & `jsPDF-AutoTable` (For dynamic invoice generation)
- **Icons**: Emoji Glyphs (Optimized for performance and universal support)

### **Backend Architecture**
- **Runtime**: `Node.js` (LTS)
- **Framework**: `Express.js` (RESTful API architecture)
- **Authentication**: `JSON Web Tokens (JWT)` (Secure stateless auth)
- **Security**: `Bcryptjs` (Password hashing)
- **File Handling**: `Multer` (Disk-storage engine for media uploads)
- **Middleware**: `CORS`, `Express.json`, `Dotenv`, `Custom Request Loggers`

### **Database & AI**
- **Database**: `MongoDB` (NoSQL Document Store)
- **ORM**: `Mongoose` (Schema validation & data modeling)
- **AI Engine**: `Google Gemini AI (gemini-2.5-flash)` (Natural language processing)

---

## 🛡️ 2. Security & Data Integrity Features

- **Multi-Role Session Isolation**: Uses role-specific localStorage keys (`userToken`, `operatorToken`, etc.) to support 3 parallel logins in one browser.
- **Role-Based Guards**: Sequential backend `authMiddleware` + `roleMiddleware` preventing unauthorized API access.
- **Environment Shield**: Strict `.env` management with `.env.example` templates for deployment.
- **History Redaction**: Custom Git history purging to remove leaked secrets and sensitive data.
- **Storage Cleanup**: Persistent `fs.unlink` logic to delete physical files (images/videos) when database records are removed.
- **Email Collision Check**: Global signup validation ensuring an email cannot be reused across different roles.

---

## ✨ 3. Comprehensive Feature List by Role

### **A. Customer (User) Features**
- **TikTok-Style Reels**: Infinite scroll feed of food videos from creators.
- **Social Interaction**: Like reels, read comments, and reply to creation threads.
- **Dynamic Menu**: Real-time menu browsing with instant Veg/Non-Veg/Both filters.
- **Search System**: Global search for specific dishes or restaurants.
- **AI Nutritionist**: One-click analysis of the shopping cart to estimate Calories, Protein, Carbs, and Fats.
- **Dual Payment Flow**: 
    - **COD**: Direct placing with instant UI updates.
    - **UPI**: Simulated secure gateway that verifies order ownership before processing.
- **Live Order Stepper**: 5-stage visual progress bar (Pending → Confirmed → Preparing → Out for Delivery → Delivered).
- **Secure Handover**: Dynamic 4-digit OTP generated for the user to share with the delivery partner.
- **Review Engine**: Star-rating system for food items with text reviews.

### **B. Restaurant Owner (Operator) Features**
- **Pro Menu Manager**: Upload dish photos, set dynamic prices, and toggle availability.
- **Order Command Center**: Real-time dashboard to Accept/Reject/Update orders.
- **Financial Analytics**: 
    - Gross Sales vs. Net Earnings tracking.
    - Automated Platform Fee calculation (5%).
    - Daily/Weekly/Monthly revenue summaries.
- **Invoice System**: Generate and download professional PDF invoices for every order.
- **Security Gate**: Delivery status is blocked until the Customer's OTP is verified.
- **Customer Engagement**: Like and reply to user reviews directly from the dashboard.
- **Cancellation Management**: Review and approve/deny user cancellation requests.

### **C. Content Creator (Creator) Features**
- **Video Workshop**: High-speed video ingestion via Multer for high-res reels.
- **Store Linking**: Ability to associate specific reels with physical restaurant IDs.
- **AI Content Assistant**: Auto-generates mouth-watering captions/descriptions using Gemini AI.
- **Earnings Tracker**: Real-time revenue estimation based on a formula of (Views/20) + (Likes/100).
- **Profile Persistence**: Custom Bio and user-specific Profile Picture that survives reloads.

---

## 🔄 4. Order & Payment Lifecycle

1.  **Placement**: Selection between **Cash on Delivery (COD)** or **UPI Simluation**.
2.  **UPI Flow**: User completes a simulated payment; backend verifies ownership before processing.
3.  **Kitchen Processing**: Operator moves status from `Pending` → `Confirmed` → `Preparing`.
4.  **Delivery Verification**: System generates a 4-digit OTP shown only to the customer.
5.  **Completion**: Operator must enter the customer's OTP to mark the order as `Delivered`.
6.  **Refunds**: Automatic `Refunded` status update if a paid order is rejected or cancelled.

---

## 🚀 5. Current Production Readiness
- **Frontend Build**: Vite-optimized production assets ready.
- **Backend API**: Structured error handling with `try/catch` and status code precision.
- **Mobile Responsive**: Flexbox/Grid based design compatible with all screen sizes.
- **UX/UI**: Premium **Dark Theme** with Outfit typography and glassmorphism.
