import 'react-native-gesture-handler';
import React, { useContext } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";

import AppNavigator from "./src/navigation/AppNavigator";
import AuthScreen from "./src/screens/AuthScreen";

import { TokenProvider, TokenContext } from "./src/services/storage";
import { CartProvider } from "./src/services/CartContext";

const Stack = createStackNavigator();

/* ---------------- Root Navigator ---------------- */

function RootNavigator() {
  const { isAuthenticated } = useContext(TokenContext);

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {isAuthenticated() ? (
          <Stack.Screen name="Main" component={AppNavigator} />
        ) : (
          <Stack.Screen name="Auth" component={AuthScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

/* ---------------- App Entry ---------------- */

export default function App() {
  return (
    <TokenProvider>
      <CartProvider>
        <RootNavigator />
      </CartProvider>
    </TokenProvider>
  );
}