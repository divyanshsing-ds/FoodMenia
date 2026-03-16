import React, { createContext, useContext, useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

/* ---------------- Token Keys ---------------- */

const TOKEN_KEYS = {
  user: "userToken",
  operator: "operatorToken",
  creator: "creatorToken",
};

const DATA_KEYS = {
  user: "userData",
  operator: "operatorData",
  creator: "creatorData",
};

/* ---------------- Context ---------------- */

export const TokenContext = createContext(null);

/* ---------------- Provider ---------------- */

export const TokenProvider = ({ children }) => {
  const [tokens, setTokens] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTokens();
  }, []);

  /* ---------------- Load Tokens ---------------- */

  const loadTokens = async () => {
    try {
      const loaded = {};

      for (const role of Object.keys(TOKEN_KEYS)) {
        const token = await AsyncStorage.getItem(TOKEN_KEYS[role]);
        if (token) {
          loaded[role] = token;
        }
      }

      setTokens(loaded);
    } catch (error) {
      console.log("Token load error:", error);
    } finally {
      setLoading(false);
    }
  };

  /* ---------------- Save Token ---------------- */

  const saveToken = async (role, token, userData) => {
    try {
      await AsyncStorage.setItem(TOKEN_KEYS[role], token);
      await AsyncStorage.setItem(DATA_KEYS[role], JSON.stringify(userData));

      setTokens((prev) => ({
        ...prev,
        [role]: token,
      }));
    } catch (error) {
      console.log("Save token error:", error);
    }
  };

  /* ---------------- Clear Token ---------------- */

  const clearToken = async (role) => {
    try {
      await AsyncStorage.multiRemove([TOKEN_KEYS[role], DATA_KEYS[role]]);

      setTokens((prev) => {
        const updated = { ...prev };
        delete updated[role];
        return updated;
      });
    } catch (error) {
      console.log("Clear token error:", error);
    }
  };

  /* ---------------- Auth Check ---------------- */

  const isAuthenticated = () => {
    return Object.values(tokens).some(t => !!t);
  };

  const getCurrentRole = () => {
    return Object.keys(tokens).find(role => !!tokens[role]) || null;
  };

  /* ---------------- Get User Data ---------------- */

  const getUserData = async (role = "user") => {
    try {
      const data = await AsyncStorage.getItem(DATA_KEYS[role]);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.log("Get user data error:", error);
      return null;
    }
  };

  /* ---------------- Delivery Info ---------------- */

  const saveDeliveryInfo = async (info) => {
    try {
      await AsyncStorage.setItem("deliveryInfo", JSON.stringify(info));
    } catch (error) {
      console.log("Save delivery info error:", error);
    }
  };

  const getDeliveryInfo = async () => {
    try {
      const data = await AsyncStorage.getItem("deliveryInfo");
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.log("Get delivery info error:", error);
      return null;
    }
  };

  /* ---------------- Context Value ---------------- */

  const value = {
    tokens,
    loading,
    saveToken,
    clearToken,
    isAuthenticated,
    getCurrentRole,
    getUserData,
    loadTokens,
    saveDeliveryInfo,
    getDeliveryInfo,
  };

  return <TokenContext.Provider value={value}>{children}</TokenContext.Provider>;
};

/* ---------------- Custom Hook ---------------- */

export const useTokens = () => {
  return useContext(TokenContext);
};