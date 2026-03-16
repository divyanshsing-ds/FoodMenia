import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { CONFIG } from "../utils/config";

const api = axios.create({
  baseURL: CONFIG.API_BASE,
  timeout: 30000, // longer for video uploads
});

/* ---------- REQUEST INTERCEPTOR ---------- */

api.interceptors.request.use(
  async (config) => {
    try {
      const roles = ["userToken", "operatorToken", "creatorToken"];
      for (const roleKey of roles) {
        const token = await AsyncStorage.getItem(roleKey);
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
          break;
        }
      }
    } catch (err) {
      console.log("Token read error:", err);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

/* ---------- RESPONSE INTERCEPTOR ---------- */

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      console.log("⚠️ Token invalid or expired");
    }
    return Promise.reject(error);
  }
);

/* ---------- AUTH ---------- */

export const authAPI = {
  login: (email, password, role = "user") =>
    api.post("/auth/login", { email, password, role }),
  signup: (data, role = "user") =>
    api.post("/auth/signup", { ...data, role }),
  getOperators: () => api.get("/auth/operators"),
  updateProfile: (formData) =>
    api.patch("/auth/profile", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
};

/* ---------- MENU ---------- */

export const menuAPI = {
  getMenu: (restaurantId) =>
    restaurantId ? api.get(`/menu?restaurantId=${restaurantId}`) : api.get("/menu"),
  getMyMenu: () => api.get("/menu/my"),
  addMenuItem: (formData) =>
    api.post("/menu", formData, { headers: { "Content-Type": "multipart/form-data" } }),
  updateMenuItem: (id, formData) => {
    const isFormData = formData instanceof FormData;
    return api.put(`/menu/${id}`, formData, {
      headers: { "Content-Type": isFormData ? "multipart/form-data" : "application/json" },
    });
  },
  deleteMenuItem: (id) => api.delete(`/menu/${id}`),
  toggleBestSeller: (id) => api.patch(`/menu/${id}/bestseller`),
  likeRating: (itemId, ratingId) => api.post(`/menu/${itemId}/rating/${ratingId}/like`),
  replyRating: (itemId, ratingId, text) =>
    api.post(`/menu/${itemId}/rating/${ratingId}/reply`, { text }),
};

/* ---------- ORDERS ---------- */

export const orderAPI = {
  getMyOrders: () => api.get("/orders/my"),
  placeOrder: (data) => api.post("/orders", data),
  getOperatorOrders: () => api.get("/orders/operator"),
  updateOrderStatus: (orderId, status, reason = null) =>
    api.put(`/orders/${orderId}/status`, { status, rejectionReason: reason }),
  verifyOtp: (orderId, otp) => api.post(`/orders/${orderId}/verify-otp`, { otp }),
};

/* ---------- VIDEO / REELS ---------- */

export const videoAPI = {
  // Public feed
  getFeed: () => api.get("/video/feed"),

  // Creator CRUD
  getMyReels: () => api.get("/video/my"),
  uploadReel: (formData, onUploadProgress) =>
    api.post("/video/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress,
    }),
  updateReel: (id, data) => api.patch(`/video/${id}`, data),
  deleteReel: (id) => api.delete(`/video/${id}`),

  // Engagement
  likeReel: (id) => api.post(`/video/${id}/like`),
  addComment: (id, text) => api.post(`/video/${id}/comment`, { text }),
  likeComment: (reelId, commentId) =>
    api.post(`/video/${reelId}/comment/${commentId}/like`),
  replyComment: (reelId, commentId, text) =>
    api.post(`/video/${reelId}/comment/${commentId}/reply`, { text }),
  deleteComment: (reelId, commentId) =>
    api.delete(`/video/${reelId}/comment/${commentId}`),
  deleteReply: (reelId, commentId, replyId) =>
    api.delete(`/video/${reelId}/comment/${commentId}/reply/${replyId}`),
};

/* ---------- CREATOR ---------- */

export const creatorAPI = {
  getFollowers: () => api.get("/creator/my/followers"),
};

/* ---------- AI ---------- */

export const aiAPI = {
  chat: (message) => api.post("/ai/chat", { message }),
  getNutrition: (foodName, category, price) =>
    api.post("/ai/nutrition", { foodName, category, price }),
  analyzeFood: (imageData) => api.post("/ai/analyze-food", { image: imageData }),
};

export default api;