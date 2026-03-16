import React, { createContext, useState, useEffect, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const CartContext = createContext();

export const CartProvider = ({ children }) => {
  const [cart, setCart] = useState([]);

  useEffect(() => {
    loadCart();
  }, []);

  const loadCart = async () => {
    try {
      const savedCart = await AsyncStorage.getItem('foodmenia_cart');
      if (savedCart) {
        setCart(JSON.parse(savedCart));
      }
    } catch (error) {
      console.error('Failed to load cart:', error);
    }
  };

  const saveCart = async (newCart) => {
    try {
      await AsyncStorage.setItem('foodmenia_cart', JSON.stringify(newCart));
    } catch (error) {
      console.error('Failed to save cart:', error);
    }
  };

  const addToCart = (item, quantity = 1) => {
    setCart((prev) => {
      const existing = prev.find((i) => i._id === item._id);
      let newCart;
      if (existing) {
        newCart = prev.map((i) =>
          i._id === item._id ? { ...i, quantity: i.quantity + quantity } : i
        );
      } else {
        newCart = [...prev, { ...item, quantity }];
      }
      saveCart(newCart);
      return newCart;
    });
  };

  const removeFromCart = (itemId) => {
    setCart((prev) => {
      const newCart = prev.filter((i) => i._id !== itemId);
      saveCart(newCart);
      return newCart;
    });
  };

  const clearCart = () => {
    setCart([]);
    saveCart([]);
  };

  const updateQuantity = (itemId, quantity) => {
    setCart((prev) => {
      const newCart = prev.map((i) =>
        i._id === itemId ? { ...i, quantity: Math.max(1, quantity) } : i
      );
      saveCart(newCart);
      return newCart;
    });
  };

  return (
    <CartContext.Provider
      value={{
        cart,
        addToCart,
        removeFromCart,
        clearCart,
        updateQuantity,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => useContext(CartContext);
