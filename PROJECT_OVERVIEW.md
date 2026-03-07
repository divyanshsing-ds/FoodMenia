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
- **AI Integration**: `Google Gemini AI` (native integration for nutrition, reels & student verification)
- **Icons**: Emoji Glyphs (Optimized for performance and universal support)

### **Backend Architecture**
- **Runtime**: `Node.js` (LTS)
- **Framework**: `Express.js` (RESTful API architecture)
- **Authentication**: `JSON Web Tokens (JWT)` (Secure stateless auth)
- **Security**: `Bcryptjs` (Password hashing)
- **File Handling**: `Multer` (Disk-storage engine for image & video uploads)
- **Middleware**: `CORS`, `Express.json`, `Dotenv`, `Custom Request Logger`
- **Error Handling**: Global `try/catch` guards + dedicated 404 catch-all + global error handler middleware

### **Database**
- **Database**: `MongoDB` (NoSQL Document Store)
- **ORM**: `Mongoose` (Schema validation, data modeling & pre-save hooks)
- **AI Engine**: `Google Gemini AI (gemini-2.5-flash)` (Computer Vision for student ID analysis, nutrition estimation, and creative copywriting)

---

## � 2. Data Models

| Model | Key Fields |
|---|---|
| `User` | name, email, password, role, **phone**, **address**, studentStatus, studentIdImage, institutionName, idExpiryDate |
| `Operator` | name, email, password, role, restaurantName |
| `Creator` | name, email, password, role, bio, profilePicture |
| `MenuItem` | operatorId, restaurantName, name, price, category, image, **restaurantImage**, available, **foodType** (veg/non-veg/both), ratings[], averageRating, **orderCount**, **isBestSeller**, **bestSellerUpdatedAt** |
| `Order` | userId, operatorId, items[], totalAmount, status, **customerPhone**, **customerAddress**, **instructions**, paymentMethod, paymentStatus, deliveryOTP, studentDiscountApplied, discountAmount, rejectionReason, cancellationReason |
| `Video` | title, description, videoUrl, thumbnailUrl, creatorId, restaurantId, likedBy[], views, comments[] |

---

## �🛡️ 3. Security & Data Integrity Features

- **Multi-Role Session Isolation**: Role-specific localStorage keys (`userToken`, `operatorToken`, `creatorToken`) support 3 parallel logins in one browser.
- **Role-Based Guards**: Sequential backend `authMiddleware` + `roleMiddleware` preventing unauthorized API access.
- **Role-Aware Login**: Login endpoint requires `role` field, searching only the specific collection.
- **Email Collision Check**: Global signup validation ensures an email cannot be reused across all three role collections.
- **Environment Shield**: Strict `.env` management with `.env.example` templates for deployment safety.
- **History Redaction**: Custom Git history purging to remove any previously leaked secrets.
- **Storage Cleanup**: `fs.unlink` logic deletes physical files (images/videos) whenever a DB record is removed.
- **OTP Gate**: The `delivered` order status is only reachable through the dedicated `/verify-otp` route — operators cannot bypass it.
- **Payment Ownership Check**: UPI payment endpoint verifies order ownership before marking `paid`.

---

## ✨ 4. Comprehensive Feature List by Role

### **A. Customer (User) Features**
- **TikTok-Style Reels Feed**: Infinite scroll feed of food videos from creators with auto-play/pause on scroll.
- **Social Interaction**: Like reels, post/like comments, and reply to comment threads.
- **Creator Public Profile**: Dedicated page at `/creator-profile/:id` showing creator bio, profile picture, and their uploaded reels in a grid.
- **Dynamic Menu Browsing**: Real-time menu with **Veg / Non-Veg / Both** filter buttons.
- **Enhanced Cart System**:
    - **Unified Scrolling**: Cart body, pricing summary, and checkout actions are now part of a single, fluid scrollable area for better mobile experience.
    - **Smart Instructions**: Persistent "Special Instructions" box with automatic auto-reset logic (clears on new item or empty cart) to prevent stale ordering notes.
- **Best Seller Badges**: Menu items automatically flagged as 🏆 Best Sellers based on order volume.
- **Dual Payment Flow**:
    - **COD**: Direct order placement with instant UI updates.
    - **UPI**: Simulated secure gateway; backend verifies order ownership before processing.
- **Live Order Stepper**: 5-stage visual progress bar (Pending → Confirmed → Preparing → Out for Delivery → Delivered).
- **Payment Status Transparency**: Order cards clearly display **Paid / Unpaid / Refunded** badges corresponding to the transaction state.
- **Secure Handover**: Dynamic 4-digit OTP generated for the user to share with the delivery partner (hidden from operators).
- **Smart Delivery Persistence**:
    - **Address Storage**: Saves phone and address to the DB on first order.
    - **Interactive Edit Button**: Users can instantly toggle between viewing their saved address and editing it via a premium pill-shaped button.
- **AI Student Discount**:
    - **Vision Verification**: Users can upload student IDs; **Gemini Vision AI** "sees" the card to extract school names and expiry dates.
    - **20% Savings**: Verified students receive a recurring 20% discount on all orders.
    - **History Badging**: Discounted orders feature original prices crossed out (~~₹500~~ ₹400) and a `🎓` badge.
- **Cancellation Requests**: Users can submit cancellation requests that operators must approve.
- **Automatic Refunds**: If a UPI-paid order is rejected or cancelled, the payment status auto-updates to `refunded`.

### **B. Restaurant Owner (Operator) Features**
- **Pro Menu Manager**: Upload dish photos & restaurant banners, set prices, and select food type (Veg/Non-Veg/Both).
- **Best Seller Tracker**: `orderCount` on each menu item is incremented per sale; `isBestSeller` badge recalculated weekly.
- **Order Command Center**: Accept / Reject / Prepare / Dispatch orders with rejection reason support and **Student Discount visibility**.
- **Cancellation Management**: Review and approve/deny user cancellation requests.
- **OTP Delivery Gate**: Operators must enter the customer's 4-digit OTP to mark an order as `Delivered`.
- **Financial Analytics & Profit Tab**:
    - **Gross Sales vs. Net Earnings tracking**.
    - **Student Discount Monitoring**: Dedicated tracking for how many discounts were applied and their total impact on revenue.
    - **Automated Platform Fee calculation (5%)** based on final discounted totals.
    - **Timeframe Filters**: Daily / Monthly / Year / Custom date range summaries.
- **Premium Invoice System**:
    - Generate professional PDF invoices using `jsPDF`.
    - **Executive Summary**: PDFs include an executive breakdown of Gross Revenue, Student Discounts, Platform Fees, and Net Payout.
- **Customer Engagement**: View, **like**, and **reply to** user reviews directly from the dashboard.

### **C. Content Creator (Creator) Features**
- **Video Workshop**: High-speed video ingestion via Multer for high-res reels with disk storage.
- **Store Linking**: Associate specific reels with physical restaurant IDs.
- **AI Caption Generator**: Auto-generates mouth-watering captions/descriptions using Gemini AI.
- **Earnings Tracker**: Real-time revenue estimation based on `(Views / 20) + (Likes / 100)`.
- **Profile Persistence**: Custom bio and profile picture that survive page reloads.
- **Public Profile**: Full public-facing profile page accessible to all users.

---

## 🔄 5. Order & Payment Lifecycle

1. **Placement**: User selects **COD** or **UPI**. Special instructions are captured.
2. **UPI Flow**: User completes a simulated payment; backend verifies ownership before marking `paid`.
3. **Kitchen Processing**: Operator moves status: `Pending` → `Confirmed` → `Preparing`.
4. **Dispatch**: Operator marks `Out for Delivery`; system auto-generates a 4-digit OTP shown only on the customer's dashboard.
5. **Completion**: Operator must enter the customer's OTP to mark the order as `Delivered` (increments `orderCount` on each `MenuItem` and clears instructions).
6. **Refunds**: Any `paid` order that is subsequently `rejected` or `cancelled` automatically updates to `paymentStatus: "refunded"`.

---

## 🗺️ 6. Route Map

### Frontend Routes (`React Router`)
| Path | Component | Access |
|---|---|---|
| `/` | `AuthPage` | Public |
| `/user` | `UserDashboard` | Protected (user) |
| `/operator` | `OperatorDashboard` | Protected (operator) |
| `/creator` | `CreatorDashboard` | Protected (creator) |
| `/creator-profile/:id` | `CreatorPublicProfile` | Protected (user) |

### Backend API Routes (`Express`)
| Prefix | File | Description |
|---|---|---|
| `/api/auth` | `routes/auth.js` | Login, Signup, Profile update |
| `/api/menu` | `routes/menu.js` | CRUD for menu items, ratings, reviews |
| `/api/orders` | `routes/order.js` | Order lifecycle, OTP, UPI payment |
| `/api/video` | `routes/video.js` | Video upload, likes, comments, views |
| `/api/student` | `routes/student.js` | AI ID verification, status, revocation |
| `/api/creator` | `routes/creator.js` | Creator profile data |
| `/uploads/*` | Static | Served from `Backend/uploads/` |

---

## 🚀 7. Current Production Readiness
- **Frontend Build**: Vite-optimized production assets ready.
- **UX/UI**: Premium **Dark Theme** with Outfit typography, glassmorphism cards, and smooth cubic-bezier transitions.
- **Scroll Optimized Cart**: Enhanced mobile cart experience with unified scrolling and smart state management.
- **Financial Accuracy**: Full transparency for restaurants with Student Discount tracking and PDF exports.
- **File Cleanup**: Orphaned uploads are automatically deleted from disk on record removal.
- **Request Logging**: Every API call is logged with method, URL, status code, and response time.
