# FoodMenia: Problems & Solutions Log

This document tracks technical debt, security vulnerabilities, and logic issues identified in the codebase and the corresponding solutions implemented to resolve them.

---

## 🔒 1. Security & Environment Management

### Problem: Hardcoded Secrets
**Issue:** `GEMINI_API_KEY`, `JWT_SECRET`, and `MONGO_URI` were hardcoded in the source code.
**Solution:**
- Moved all constants into `.env` files.
- Added `.env` to `.gitignore`.
- Created `.env.example` files for reference.
- Used `import.meta.env.VITE_...` in frontend and `process.env. ...` in backend.

### Problem: Exposed Gemini API Key
**Issue:** The Gemini API key was committed to the repository.
**Solution:** Migrated the key to `Frontend/.env` and updated `src/utils/gemini.js` to read from the environment.

---

## 🔑 2. Authentication & Authorization

### Problem: Blind Login Roles
**Issue:** Login was "role-blind." If an email existed as both a "user" and an "operator," the login would always return the "user" role because the backend searched sequentially and the frontend didn't specify the role.
**Solution:**
- **Frontend:** Added role selector (User/Creator/Operator) to the Login modal.
- **Backend:** Updated `POST /api/auth/login` to require `role` and search *only* the specific collection.

### Problem: Cross-Role Email Collision
**Issue:** A person could create a "User" account and an "Operator" account using the same email address, because signup only checked one collection at a time.
**Solution:** Updated `POST /api/auth/signup` to check all three collections (`User`, `Creator`, `Operator`) before allowing registration.

---

## 🌯 3. Order & Payment Flow

### Problem: Fake Payment Logic
**Issue:** Orders had no payment status, making them all "manual."
**Solution:** 
- Added `paymentMethod` ("cod", "upi") and `paymentStatus` ("pending", "paid") to the `Order` model.
- Added a secure **UPI Simulation** where users "pay" (call `/api/orders/:id/pay`) before the order is placed.
- Integrated backend logic to ensure users can only pay for their own orders.

### Problem: Manual Delivery Exploits
**Issue:** Operators could mark an order as "delivered" without any proof of handover.
**Solution:**
- **OTP Verification:** When an order is moved to `out_for_delivery`, a 4-digit code is generated.
- **Customer Control:** The code is shown *only* on the customer dashboard.
- **Gatekeeper:** The `delivered` status is blocked on the standard update route and can only be set via the `/api/orders/:id/verify-otp` route using the customer's code.

---

## 📂 4. File Management

### Problem: Ghost Files (Storage Pollution)
**Issue:** When deleting a menu item or video, only the database record was removed. The physical image/video stayed in the `uploads/` folder forever.
**Solution:** Added `fs.unlinkSync()` to delete physical files whenever a corresponding database record is deleted or updated.

---

## 🎨 5. User Interface (Aesthetics)

### Problem: Basic Design
**Issue:** Traditional CSS without depth or polish.
**Solution:**
- Implemented **Glassmorphism** (backdrop filters, subtle borders).
- Integrated **Outfit** font for a premium display feel.
- Added **Cubic-bezier** smooth transitions and glowing active states.
- Created reusable CSS Variable tokens for consistency.
