import React, { useEffect, useState } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialIcons as Icon } from '@expo/vector-icons';
import { useCart } from '../services/CartContext';
import { useTokens } from '../services/storage';

// ── User Screens ──────────────────────────────────────────────────
import ReelsScreen from '../screens/ReelsScreen';
import BrowseScreen from '../screens/BrowseScreen';
import CartScreen from '../screens/CartScreen';
import OrdersScreen from '../screens/OrdersScreen';
import AIScreen from '../screens/AIScreen';
import ProfileScreen from '../screens/ProfileScreen';

// ── Partner (Operator) Screens ────────────────────────────────────
import PartnerOrdersScreen from '../screens/PartnerOrdersScreen';
import PartnerMenuScreen from '../screens/PartnerMenuScreen';
import PartnerEarningsScreen from '../screens/PartnerEarningsScreen';

// ── Creator Screens ───────────────────────────────────────────────
import CreatorDashboardScreen from '../screens/CreatorDashboardScreen';
import CreatorAnalyticsScreen from '../screens/CreatorAnalyticsScreen';

import { COLORS } from '../utils/theme';

const Tab = createBottomTabNavigator();

const TAB_BAR_STYLE = {
  backgroundColor: COLORS.bgSurface,
  borderTopColor: COLORS.border,
  height: 65,
  paddingBottom: 10,
  paddingTop: 8,
};

/* ─── USER TABS ─────────────────────────────────────────────────── */
const UserTabs = () => {
  const { cart } = useCart();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ color, size }) => {
          const icons = {
            Reels: 'video-collection',
            Browse: 'restaurant-menu',
            Cart: 'shopping-cart',
            Orders: 'shopping-bag',
            AI: 'psychology',
            Profile: 'person',
          };
          return <Icon name={icons[route.name] || 'apps'} size={size} color={color} />;
        },
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textMuted,
        tabBarStyle: TAB_BAR_STYLE,
        headerShown: false,
      })}
    >
      <Tab.Screen name="Reels" component={ReelsScreen} />
      <Tab.Screen name="Browse" component={BrowseScreen} />
      <Tab.Screen
        name="Cart"
        component={CartScreen}
        options={{
          tabBarBadge: cart.length > 0 ? cart.length : null,
          tabBarBadgeStyle: { backgroundColor: COLORS.primary, color: 'white', fontSize: 10 },
        }}
      />
      <Tab.Screen name="Orders" component={OrdersScreen} />
      <Tab.Screen name="AI" component={AIScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
};

/* ─── PARTNER TABS ──────────────────────────────────────────────── */
const PartnerTabs = () => (
  <Tab.Navigator
    screenOptions={({ route }) => ({
      tabBarIcon: ({ color, size }) => {
        const icons = {
          'Order Queue': 'list-alt',
          'My Menu': 'restaurant-menu',
          Earnings: 'account-balance-wallet',
          AI: 'psychology',
          Profile: 'person',
        };
        return <Icon name={icons[route.name] || 'apps'} size={size} color={color} />;
      },
      tabBarActiveTintColor: COLORS.primary,
      tabBarInactiveTintColor: COLORS.textMuted,
      tabBarStyle: TAB_BAR_STYLE,
      headerShown: false,
    })}
  >
    <Tab.Screen name="Order Queue" component={PartnerOrdersScreen} />
    <Tab.Screen name="My Menu" component={PartnerMenuScreen} />
    <Tab.Screen name="Earnings" component={PartnerEarningsScreen} />
    <Tab.Screen name="AI" component={AIScreen} />
    <Tab.Screen name="Profile" component={ProfileScreen} />
  </Tab.Navigator>
);

/* ─── CREATOR TABS ──────────────────────────────────────────────── */
const CreatorTabs = () => (
  <Tab.Navigator
    screenOptions={({ route }) => ({
      tabBarIcon: ({ color, size }) => {
        const icons = {
          'My Reels': 'video-collection',
          Analytics: 'bar-chart',
          AI: 'psychology',
          Profile: 'person',
        };
        return <Icon name={icons[route.name] || 'apps'} size={size} color={color} />;
      },
      tabBarActiveTintColor: COLORS.primary,
      tabBarInactiveTintColor: COLORS.textMuted,
      tabBarStyle: TAB_BAR_STYLE,
      headerShown: false,
    })}
  >
    <Tab.Screen name="My Reels" component={CreatorDashboardScreen} />
    <Tab.Screen name="Analytics" component={CreatorAnalyticsScreen} />
    <Tab.Screen name="AI" component={AIScreen} />
    <Tab.Screen name="Profile" component={ProfileScreen} />
  </Tab.Navigator>
);

/* ─── ROOT NAVIGATOR ────────────────────────────────────────────── */
const AppNavigator = () => {
  const { getCurrentRole } = useTokens();
  const [role, setRole] = useState(null);

  useEffect(() => {
    const detect = async () => {
      const r = await getCurrentRole();
      setRole(r);
    };
    detect();
  }, [getCurrentRole]);

  if (role === 'operator') return <PartnerTabs />;
  if (role === 'creator') return <CreatorTabs />;
  return <UserTabs />;
};

export default AppNavigator;
