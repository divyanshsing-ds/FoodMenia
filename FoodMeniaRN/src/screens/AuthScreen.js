import React, { useState, useContext } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  Dimensions,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { CONFIG, ROLES } from "../utils/config";
import { authAPI } from "../services/api";
import { TokenContext } from "../services/storage";
import { COLORS, RADIUS, SPACING } from "../utils/theme";

const { width, height } = Dimensions.get("window");

const AuthScreen = () => {
  const navigation = useNavigation();
  const { saveToken } = useContext(TokenContext);

  const [mode, setMode] = useState("login");
  const [role, setRole] = useState(ROLES.user);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    email: "",
    password: "",
    fullName: "",
    restaurantName: "",
  });

  const handleSubmit = async () => {
    if (!formData.email || !formData.password) {
      Alert.alert("Error", "Email and password required");
      return;
    }

    setLoading(true);

    try {
      const isSignup = mode === "signup";
      const response = await (isSignup
        ? authAPI.signup(formData, role)
        : authAPI.login(formData.email, formData.password, role));

      if (response?.data?.success) {
        await saveToken(role, response.data.token, response.data.data);
        // RootNavigator in App.js will handle the switch automatically based on state change
      } else {
        Alert.alert("Error", response?.data?.message || "Authentication failed");
      }
    } catch (error) {
      Alert.alert("Server Error", error?.response?.data?.message || "Unable to connect to backend");
    } finally {
      setLoading(false);
    }
  };

  const ROLES_UI = [
    { key: ROLES.user, label: "User", icon: "👤" },
    { key: ROLES.operator, label: "Partner", icon: "🏪" },
    { key: ROLES.creator, label: "Creator", icon: "🎥" },
  ];

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <LinearGradient
        colors={[COLORS.bgDeep, '#0e0e25', '#1a1a35']}
        style={StyleSheet.absoluteFill}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.logoEmoji}>🍕</Text>
          <Text style={styles.title}>FoodMenia</Text>
          <Text style={styles.subtitle}>Taste the Premium Experience</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.modeTabs}>
            <TouchableOpacity
              style={[styles.tab, mode === "login" && styles.activeTab]}
              onPress={() => setMode("login")}
            >
              <Text style={[styles.tabText, mode === "login" && styles.activeTabText]}>Login</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, mode === "signup" && styles.activeTab]}
              onPress={() => setMode("signup")}
            >
              <Text style={[styles.tabText, mode === "signup" && styles.activeTabText]}>Join Now</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>Select your role</Text>
          <View style={styles.roleGrid}>
            {ROLES_UI.map((r) => (
              <TouchableOpacity
                key={r.key}
                style={[styles.roleCard, role === r.key && styles.roleCardActive]}
                onPress={() => setRole(r.key)}
              >
                <Text style={styles.roleIcon}>{r.icon}</Text>
                <Text style={[styles.roleLabel, role === r.key && styles.roleLabelActive]}>{r.label}</Text>
                {role === r.key && (
                  <LinearGradient
                    colors={[COLORS.primary, COLORS.secondary]}
                    style={styles.roleDot}
                  />
                )}
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.inputContainer}>
            {mode === "signup" && (
              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.input}
                  placeholder="Full Name"
                  placeholderTextColor={COLORS.textMuted}
                  value={formData.fullName}
                  onChangeText={(text) => setFormData({ ...formData, fullName: text })}
                />
              </View>
            )}

            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.input}
                placeholder="Email Address"
                placeholderTextColor={COLORS.textMuted}
                keyboardType="email-address"
                autoCapitalize="none"
                value={formData.email}
                onChangeText={(text) => setFormData({ ...formData, email: text })}
              />
            </View>

            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor={COLORS.textMuted}
                secureTextEntry
                value={formData.password}
                onChangeText={(text) => setFormData({ ...formData, password: text })}
              />
            </View>
          </View>

          <TouchableOpacity onPress={handleSubmit} disabled={loading} activeOpacity={0.8}>
            <LinearGradient
              colors={[COLORS.primary, COLORS.secondary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.submitBtn}
            >
              <Text style={styles.submitText}>
                {loading ? "Authenticating..." : mode === "signup" ? "Create Account" : "Welcome Back"}
              </Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity style={styles.forgotBtn}>
            <Text style={styles.forgotText}>Forgot Password?</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>By continuing, you agree to our Terms & Privacy</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bgDeep },
  scrollContent: { flexGrow: 1, paddingBottom: 40 },
  header: {
    alignItems: "center",
    paddingTop: height * 0.1,
    paddingBottom: 40,
  },
  logoEmoji: { fontSize: 50, marginBottom: 10 },
  title: {
    fontSize: 42,
    fontWeight: "900",
    color: "white",
    letterSpacing: -1,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.textMuted,
    marginTop: 4,
    fontWeight: "500",
  },
  card: {
    marginHorizontal: 24,
    backgroundColor: COLORS.bgSurface,
    borderRadius: RADIUS.xl,
    padding: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.5,
    shadowRadius: 30,
    elevation: 10,
  },
  modeTabs: {
    flexDirection: "row",
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.md,
    padding: 4,
    marginBottom: 24,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: RADIUS.sm,
  },
  activeTab: {
    backgroundColor: COLORS.bgSurface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  tabText: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.textMuted,
  },
  activeTabText: { color: COLORS.textPrimary },
  label: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 12,
    marginLeft: 4,
  },
  roleGrid: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 24,
  },
  roleCard: {
    flex: 1,
    alignItems: "center",
    padding: 16,
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  roleCardActive: {
    borderColor: COLORS.borderBright,
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  roleIcon: { fontSize: 24, marginBottom: 6 },
  roleLabel: { fontSize: 11, color: COLORS.textMuted, fontWeight: "600" },
  roleLabelActive: { color: COLORS.textPrimary },
  roleDot: {
    position: 'absolute',
    bottom: -2,
    width: 20,
    height: 4,
    borderRadius: 2,
  },
  inputContainer: { marginBottom: 24 },
  inputWrapper: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 12,
    overflow: 'hidden',
  },
  input: {
    color: "white",
    padding: 16,
    fontSize: 15,
  },
  submitBtn: {
    padding: 18,
    borderRadius: RADIUS.md,
    alignItems: "center",
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
  },
  submitText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "white",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  forgotBtn: { marginTop: 16, alignItems: "center" },
  forgotText: { color: COLORS.textMuted, fontSize: 13, fontWeight: "500" },
  footer: { marginTop: 40, alignItems: "center", paddingHorizontal: 40 },
  footerText: {
    color: COLORS.textDisabled,
    fontSize: 12,
    textAlign: "center",
    lineHeight: 18,
  },
});

export default AuthScreen;