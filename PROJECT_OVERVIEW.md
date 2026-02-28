# 🍕 FoodMenia - Project Overview & Roadmap

FoodMenia is a multi-role food delivery and content platform built with the **MERN** stack (MongoDB, Express, React, Node.js). It uniquely combines traditional food ordering with a social "Reels" component for food creators.

---

## 🏗️ 1. Project Architecture

### **Backend (`/Backend`)**
- **Server**: Express.js server running on port `9090`.
- **Database**: MongoDB (via Mongoose) with models for `User`, `Operator`, `MenuItem`, `Order`, and `Video`.
- **Auth**: JWT-based authentication with a shared secret `MYFOOD`.
- **Storage**: Local file storage in `/uploads` for menu images and `/uploads/reels` for videos (using Multer).

### **Frontend (`/Frontend`)**
- **Framework**: React with Vite.
- **Routing**: `react-router-dom` with protected routes based on user roles.
- **Styling**: Vanilla CSS with a focus on modern, dark-themed dashboard aesthetics.

---

## 🔄 2. Transactional & Data Flows

### **A. User Roles & Permissions**
1.  **User**: Browses menu, watches reels, places orders, and rates items.
2.  **Operator**: Manages restaurant menu, accepts/rejects orders, and views financial analytics.
3.  **Creator**: Uploads food reels, associates them with restaurants, and tracks engagement/earnings.

### **B. Order Lifecycle**
`Pending` -> `Confirmed` -> `Preparing` -> `Out for Delivery` -> `Delivered`
*   *Note: Users can request cancellations, and Operators can approve/deny them.*

### **C. The "Reel" Ecosystem**
- **Creators** upload videos and link them to a specific **Operator's** restaurant.
- **Users** watch reels in a TikTok-style feed.
- **Analytics**: Creators earn "Estimated Revenue" based on a formula involving views and likes.

---

## 📈 3. Key Features Recently Implemented
- **Financial Analytics**: Operators can view revenue, platform fees (5%), and download a premium PDF invoice.
- **Review System**: Users can rate items they've bought; Operators can "Like" and "Reply" to these reviews.
- **AI Integration**: Creators can auto-generate reel descriptions using Google's Gemini AI.
- **Toast Notifications**: Modern, non-intrusive alerts for order updates and status changes.

---

## 🛠️ 4. Immediate Technical Debt (Useless/Suboptimal Code)
*Based on recent analysis:*
- **Unused `roleMiddleware`**: Defined in `auth.js` but not utilized in routes.
- **Redundant Auth Checks**: Dashboards perform manual role checks that are already handled by `ProtectedRoute` in `App.jsx`.
- **Hardcoded API URLs**: `http://localhost:9090/api` is repeated across multiple frontend files.
- **Model Bloat**: `MenuItem` contains a `restaurantImage` field that is never used.

---

## 🚀 5. What to Do Next (Roadmap)

### **Phase 1: Stabilization & Cleanup (High Priority)**
1.  **Refactor Config**: Create a `src/utils/config.js` to store `API_BASE` and use it globally.
2.  **Route Protection**: Use `roleMiddleware` in the backend routes to clean up the `if (req.user.role !== '...')` blocks.
3.  **Image Optimization**: Implement logic to delete old images/videos from the server when an item is deleted or updated.

### **Phase 2: Feature Enhancements**
1.  **Live Order Tracking**: Implement WebSockets (Socket.io) so users see order status changes in real-time without reloading.
2.  **Creator-Restaurant Collaboration**: Allow Operators to "Approve" reels before they appear on their restaurant's profile.
3.  **Search & Filters**: Add global search for restaurants and categories on the User Dashboard.

### **Phase 3: Production Readiness**
1.  **Environment Variables**: Ensure all secrets (JWT, MongoDB URI) are moved entirely to `.env` (already started, but needs verification).
2.  **Global Loading States**: Replace per-page `loading` states with a global progress bar or skeleton screens for a more premium feel.

---

> [!TIP]
> **To start the project:**
> 1.  Backend: `cd Backend && npm start`
> 2.  Frontend: `cd Frontend && npm run dev`
