import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/auth.css";

const ROLES = [
  { key: "user", label: "User", icon: "👤" },
  { key: "creator", label: "Creator", icon: "🍳" },
  { key: "operator", label: "Operator", icon: "🏪" },
];

import CONFIG from "../utils/config";

const API_AUTH = `${CONFIG.API_BASE}/auth`;

export default function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState("login");
  const [role, setRole] = useState("user");
  const [formData, setFormData] = useState({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null); // { type: "success" | "error", text: "" }

  const isSignup = mode === "signup";

  const handleChange = (e) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const endpoint = isSignup ? "/signup" : "/login";
      const body = isSignup
        ? { ...formData, role }
        : { email: formData.email, password: formData.password };

      const res = await fetch(`${API_AUTH}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (data.success) {
        // Store JWT token and user data
        localStorage.setItem("token", data.token);
        localStorage.setItem("user", JSON.stringify(data.data));
        setMessage({ type: "success", text: data.message });
        setFormData({});
        e.target.reset();

        // Redirect based on role after a short delay
        setTimeout(() => {
          const userRole = data.data.role;
          if (userRole === "operator") {
            navigate("/operator");
          } else if (userRole === "user") {
            navigate("/user");
          } else if (userRole === "creator") {
            navigate("/creator");
          }
        }, 800);
      } else {
        setMessage({ type: "error", text: data.message });
      }
    } catch (err) {
      setMessage({ type: "error", text: "Could not connect to server. Is the backend running?" });
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (newMode) => {
    setMode(newMode);
    setFormData({});
    setMessage(null);
  };

  return (
    <div className="auth-wrapper">
      {/* LEFT BRANDING PANEL */}
      <div className="left-side">
        <div className="overlay">
          <span className="brand-badge">🍕 FoodMenia</span>
          <h1>
            {isSignup ? "Join the Flavor" : "Welcome Back"}
          </h1>
          <p>
            {isSignup
              ? "Create your account and start your culinary journey today."
              : "Sign in to explore, create & manage delicious experiences."}
          </p>
          <div className="feature-pills">
            <span className="pill">🔥 Trending Recipes</span>
            <span className="pill">📍 Nearby Restaurants</span>
            <span className="pill">⭐ Top Creators</span>
          </div>
        </div>
      </div>

      {/* RIGHT FORM PANEL */}
      <div className="right-side">
        <div className="auth-card" key={mode}>
          {/* MODE SWITCH */}
          <div className="mode-switch">
            <button
              id="btn-login"
              className={mode === "login" ? "active" : ""}
              onClick={() => switchMode("login")}
            >
              Login
            </button>
            <button
              id="btn-signup"
              className={mode === "signup" ? "active" : ""}
              onClick={() => switchMode("signup")}
            >
              Sign Up
            </button>
          </div>

          {/* TOAST MESSAGE */}
          {message && (
            <div className={`toast ${message.type}`}>
              {message.type === "success" ? "✅" : "⚠️"} {message.text}
            </div>
          )}

          {/* ROLE SWITCH (Signup only) */}
          {isSignup && (
            <div className="role-switch">
              {ROLES.map((r) => (
                <button
                  key={r.key}
                  id={`role-${r.key}`}
                  className={role === r.key ? "active" : ""}
                  onClick={() => setRole(r.key)}
                  title={`Sign up as ${r.label}`}
                >
                  <span className="role-icon">{r.icon}</span>
                  <span className="role-label">{r.label}</span>
                </button>
              ))}
            </div>
          )}

          {/* FORM */}
          <form onSubmit={handleSubmit} className="auth-form">
            {/* Full Name — signup only */}
            {isSignup && (
              <div className="input-group fadeIn">
                <label htmlFor="fullName">Full Name</label>
                <input
                  id="fullName"
                  name="fullName"
                  type="text"
                  placeholder="John Doe"
                  required
                  onChange={handleChange}
                />
              </div>
            )}

            {/* Email — always */}
            <div className="input-group fadeIn">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                name="email"
                type="email"
                placeholder="you@example.com"
                required
                onChange={handleChange}
              />
            </div>

            {/* Password — always */}
            <div className="input-group fadeIn">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                name="password"
                type="password"
                placeholder="••••••••"
                required
                onChange={handleChange}
              />
            </div>

            {/* Creator-specific field */}
            {isSignup && role === "creator" && (
              <div className="input-group fadeIn">
                <label htmlFor="creatorBio">Creator Bio</label>
                <input
                  id="creatorBio"
                  name="creatorBio"
                  type="text"
                  placeholder="Tell us about your culinary style"
                  required
                  onChange={handleChange}
                />
              </div>
            )}

            {/* Operator-specific fields */}
            {isSignup && role === "operator" && (
              <>
                <div className="input-group fadeIn">
                  <label htmlFor="restaurantName">Restaurant Name</label>
                  <input
                    id="restaurantName"
                    name="restaurantName"
                    type="text"
                    placeholder="The Golden Spoon"
                    required
                    onChange={handleChange}
                  />
                </div>
                <div className="input-group fadeIn">
                  <label htmlFor="restaurantLocation">Restaurant Location</label>
                  <input
                    id="restaurantLocation"
                    name="restaurantLocation"
                    type="text"
                    placeholder="123 Flavor St, Food City"
                    required
                    onChange={handleChange}
                  />
                </div>
              </>
            )}

            <button type="submit" id="submit-btn" className="submit-btn" disabled={loading}>
              {loading ? "Please wait…" : isSignup ? "Create Account" : "Login"}
            </button>
          </form>

          <p className="switch-text">
            {isSignup ? "Already have an account?" : "Don't have an account?"}{" "}
            <span
              className="switch-link"
              onClick={() => switchMode(isSignup ? "login" : "signup")}
            >
              {isSignup ? "Login" : "Sign Up"}
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}

