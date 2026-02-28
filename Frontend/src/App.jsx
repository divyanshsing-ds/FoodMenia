import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import AuthPage from "./Pages/AuthPage";
import OperatorDashboard from "./Pages/OperatorDashboard";
import UserDashboard from "./Pages/UserDashboard";
import CreatorDashboard from "./Pages/CreatorDashboard";
import CONFIG from "./utils/config";

function ProtectedRoute({ children, allowedRole }) {
  const token = localStorage.getItem(CONFIG.tokenKey(allowedRole));
  const user = JSON.parse(localStorage.getItem(CONFIG.dataKey(allowedRole)) || "{}");

  if (!token) return <Navigate to="/" replace />;
  if (allowedRole && user.role !== allowedRole) return <Navigate to="/" replace />;

  return children;
}

function App() {
  useEffect(() => {
    ["user", "operator", "creator"].forEach((role) => {
      const t = localStorage.getItem(CONFIG.tokenKey(role));
      const u = localStorage.getItem(CONFIG.dataKey(role));
      if (t) console.log(`🛠️ Session [${role}] - Token: Exists | User:`, u ? JSON.parse(u).role : "NONE");
    });
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AuthPage />} />
        <Route
          path="/operator"
          element={
            <ProtectedRoute allowedRole="operator">
              <OperatorDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/user"
          element={
            <ProtectedRoute allowedRole="user">
              <UserDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/creator"
          element={
            <ProtectedRoute allowedRole="creator">
              <CreatorDashboard />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
