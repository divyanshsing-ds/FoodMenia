import React, { useState, useEffect } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, Alert, StatusBar,
  ScrollView, Modal, TextInput,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialIcons as Icon } from "@expo/vector-icons";
import { useTokens } from "../services/storage";
import { COLORS, RADIUS } from "../utils/theme";

/* ─────────────────────────────────────────────────────
   Role Configurations
───────────────────────────────────────────────────── */
const ROLE_CONFIG = {
  user: {
    badge: "Premium Member",
    badgeColor: COLORS.info,
    avatarGradient: [COLORS.primary, COLORS.secondary],
    editModalTitle: "Update Delivery Info",
    showPhone: true,
    showAddress: true,
    showRestaurant: false,
    showBio: false,
    showStudentVerify: true,
  },
  operator: {
    badge: "Restaurant Partner",
    badgeColor: "#f59e0b",
    avatarGradient: ["#f59e0b", "#ef4444"],
    editModalTitle: "Update Business Contact",
    showPhone: true,
    showAddress: true, // Renaming label below
    showRestaurant: true,
    showBio: false,
    showStudentVerify: false,
  },
  creator: {
    badge: "Content Creator",
    badgeColor: "#a855f7",
    avatarGradient: ["#7c3aed", "#a855f7"],
    editModalTitle: "Update Contact Info",
    showPhone: true,
    showAddress: false,
    showRestaurant: false,
    showBio: true,
    showStudentVerify: false,
  },
};

/* ─────────────────────────────────────────────────────
   Component
───────────────────────────────────────────────────── */
const ProfileScreen = () => {
  const { clearToken, getUserData, getCurrentRole, getDeliveryInfo, saveDeliveryInfo } = useTokens();

  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [deliveryInfo, setDeliveryInfo] = useState({ phone: "", address: "" });
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [editForm, setEditForm] = useState({ phone: "", address: "" });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      const currentRole = getCurrentRole();
      setRole(currentRole);

      if (currentRole) {
        const data = await getUserData(currentRole);
        setUser(data);
      }

      const info = await getDeliveryInfo();
      if (info) {
        setDeliveryInfo(info);
        setEditForm(info);
      }
      setIsLoading(false);
    })();
  }, []);

  // ── Handlers ────────────────────────────────────────

  const handleUpdateProfile = async () => {
    if (!editForm.phone) {
      Alert.alert("Error", "Phone number is required");
      return;
    }
    await saveDeliveryInfo(editForm);
    setDeliveryInfo(editForm);
    setIsEditModalVisible(false);
    Alert.alert("✅ Saved", "Your contact info has been updated.");
  };

  const handleLogout = () => {
    Alert.alert("Logout", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          await clearToken(role || "user");
        },
      },
    ]);
  };

  // ── Helpers ─────────────────────────────────────────

  const config = ROLE_CONFIG[role] || ROLE_CONFIG.user;
  const initials = user?.fullName?.charAt(0).toUpperCase() || "?";

  // Role-aware stats
  const getStats = () => {
    if (role === "operator") {
      return [
        { label: "Restaurant", value: user?.restaurantName || "—" },
        { label: "Phone", value: deliveryInfo.phone || "—" },
        { label: "Location", value: user?.location || "—" },
      ];
    }
    if (role === "creator") {
      return [
        { label: "Reels", value: user?.reelCount ?? "—" },
        { label: "Followers", value: user?.followerCount ?? "—" },
        { label: "Bio", value: user?.creatorBio ? "Set ✓" : "Not set" },
      ];
    }
    // user
    return [
      { label: "Orders", value: user?.orderCount ?? "—" },
      { label: "Reviews", value: user?.reviewCount ?? "—" },
      { label: "Student", value: user?.isStudentVerified ? "✓ Verified" : "Not yet" },
    ];
  };

  // ── Sub-components ───────────────────────────────────

  const ProfileItem = ({ icon, label, value, iconColor }) => (
    <View style={styles.profileItem}>
      <View style={[styles.itemIconBox, { backgroundColor: (iconColor || COLORS.primary) + "22" }]}>
        <Icon name={icon} size={20} color={iconColor || COLORS.primary} />
      </View>
      <View style={styles.itemContent}>
        <Text style={styles.itemLabel}>{label}</Text>
        <Text style={[styles.itemValue, !value && styles.itemValueEmpty]}>
          {value || "Not provided"}
        </Text>
      </View>
    </View>
  );

  if (isLoading) {
    return (
      <View style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
        <LinearGradient colors={[COLORS.bgDeep, "#0e0e25"]} style={StyleSheet.absoluteFill} />
        <Text style={{ color: COLORS.textMuted, fontSize: 15 }}>Loading profile…</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={[COLORS.bgDeep, "#0e0e25"]} style={StyleSheet.absoluteFill} />

      {/* ── HEADER ───────────────────────────────────── */}
      <View style={styles.header}>
        <View style={styles.avatarWrap}>
          <LinearGradient colors={config.avatarGradient} style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </LinearGradient>
          <TouchableOpacity style={styles.editAvatarBtn} onPress={() => setIsEditModalVisible(true)}>
            <Icon name="edit" size={14} color="#fff" />
          </TouchableOpacity>
        </View>

        <Text style={styles.userName}>{user?.fullName || "Welcome"}</Text>
        <View style={[styles.roleBadge, { backgroundColor: config.badgeColor + "22", borderColor: config.badgeColor + "55" }]}>
          <Text style={[styles.roleBadgeText, { color: config.badgeColor }]}>{config.badge}</Text>
        </View>
        {user?.email && <Text style={styles.userEmail}>{user.email}</Text>}
      </View>

      {/* ── STATS ────────────────────────────────────── */}
      <View style={styles.statsRow}>
        {getStats().map((s, i) => (
          <View key={i} style={[styles.statBox, i === 1 && styles.statBorder]}>
            <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>{s.value}</Text>
            <Text style={styles.statLabel}>{s.label}</Text>
          </View>
        ))}
      </View>

      {/* ── ACCOUNT DETAILS ──────────────────────────── */}
      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Account Details</Text>
          <TouchableOpacity onPress={() => setIsEditModalVisible(true)}>
            <Text style={styles.editLink}>Edit Contact</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.card}>
          <ProfileItem icon="person" label="Full Name" value={user?.fullName} />
          <ProfileItem icon="email" label="Email Address" value={user?.email} iconColor={COLORS.info} />

          {config.showRestaurant && (
            <ProfileItem icon="store" label="Restaurant Name" value={user?.restaurantName} iconColor="#f59e0b" />
          )}
          {config.showRestaurant && (
            <ProfileItem icon="location-city" label="Location" value={user?.location} iconColor="#f59e0b" />
          )}
          {config.showPhone && (
            <ProfileItem icon="phone" label="Phone Number" value={deliveryInfo.phone} iconColor={COLORS.success} />
          )}
          {config.showAddress && (
            <ProfileItem 
              icon="location-on" 
              label={role === 'operator' ? "Restaurant Address" : "Delivery Address"} 
              value={deliveryInfo.address} 
              iconColor={COLORS.secondary} 
            />
          )}
          {config.showBio && (
            <ProfileItem icon="record-voice-over" label="Creator Bio" value={user?.creatorBio} iconColor="#a855f7" />
          )}

          {role === "operator" && user?.cuisineType && (
            <ProfileItem icon="restaurant" label="Cuisine Type" value={user.cuisineType} iconColor={COLORS.primary} />
          )}
        </View>
      </View>

      {/* ── ROLE-SPECIFIC SECTION ────────────────────── */}
      {config.showStudentVerify && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Perks & Verifications</Text>
          <View style={styles.card}>
            <View style={styles.studentRow}>
              <View style={styles.studentLeft}>
                <View style={[styles.itemIconBox, { backgroundColor: COLORS.amber + "22" }]}>
                  <Icon name="school" size={20} color={COLORS.amber} />
                </View>
                <View style={{ marginLeft: 14 }}>
                  <Text style={styles.itemLabel}>Student Discount</Text>
                  <Text style={styles.itemValue}>
                    {user?.isStudentVerified ? "✅ Verified — 20% off active" : "Get 20% off on every order"}
                  </Text>
                </View>
              </View>
              {!user?.isStudentVerified && (
                <TouchableOpacity style={styles.verifyBtn}>
                  <Text style={styles.verifyText}>Verify</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      )}

      {role === "operator" && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Partner Info</Text>
          <View style={styles.card}>
            <View style={styles.infoRow}>
              <View style={[styles.itemIconBox, { backgroundColor: "#f59e0b22" }]}>
                <Icon name="account-balance" size={20} color="#f59e0b" />
              </View>
              <View style={{ marginLeft: 14, flex: 1 }}>
                <Text style={styles.itemLabel}>Platform Fee</Text>
                <Text style={styles.itemValue}>5% commission per delivered order</Text>
              </View>
            </View>
            <View style={[styles.infoRow, { borderTopWidth: 1, borderTopColor: COLORS.border }]}>
              <View style={[styles.itemIconBox, { backgroundColor: COLORS.success + "22" }]}>
                <Icon name="verified" size={20} color={COLORS.success} />
              </View>
              <View style={{ marginLeft: 14, flex: 1 }}>
                <Text style={styles.itemLabel}>Partner Status</Text>
                <Text style={[styles.itemValue, { color: COLORS.success }]}>Active ✓</Text>
              </View>
            </View>
          </View>
        </View>
      )}

      {role === "creator" && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Creator Monetization</Text>
          <View style={styles.card}>
            <View style={styles.infoRow}>
              <View style={[styles.itemIconBox, { backgroundColor: "#a855f722" }]}>
                <Icon name="monetization-on" size={20} color="#a855f7" />
              </View>
              <View style={{ marginLeft: 14, flex: 1 }}>
                <Text style={styles.itemLabel}>Revenue Formula</Text>
                <Text style={styles.itemValue}>Views ÷ 20 × $0.012 + Likes ÷ 100 × $0.012</Text>
              </View>
            </View>
          </View>
        </View>
      )}

      {/* ── LOGOUT ───────────────────────────────────── */}
      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.85}>
        <LinearGradient colors={["#ff4b2b", "#ff416c"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.logoutGradient}>
          <Icon name="logout" size={20} color="white" />
          <Text style={styles.logoutText}>Log Out</Text>
        </LinearGradient>
      </TouchableOpacity>

      <Text style={styles.versionText}>FoodMeniaRN v1.0 · {config.badge}</Text>

      {/* ── EDIT CONTACT MODAL ────────────────────────── */}
      <Modal visible={isEditModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{config.editModalTitle}</Text>
              <TouchableOpacity onPress={() => setIsEditModalVisible(false)}>
                <Icon name="close" size={24} color={COLORS.textPrimary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Phone Number</Text>
            <TextInput
              style={styles.textInput}
              value={editForm.phone}
              onChangeText={(v) => setEditForm({ ...editForm, phone: v })}
              placeholder={role === "operator" ? "Business phone..." : "+91 00000 00000"}
              placeholderTextColor={COLORS.textMuted}
              keyboardType="phone-pad"
            />

            {config.showAddress && (
              <>
                <Text style={styles.inputLabel}>
                  {role === "operator" ? "Restaurant Address" : "Delivery Address"}
                </Text>
                <TextInput
                  style={[styles.textInput, { height: 80, textAlignVertical: "top" }]}
                  value={editForm.address}
                  onChangeText={(v) => setEditForm({ ...editForm, address: v })}
                  placeholder={role === "operator" ? "Full restaurant address..." : "Your delivery address..."}
                  placeholderTextColor={COLORS.textMuted}
                  multiline
                />
              </>
            )}

            <TouchableOpacity style={styles.saveBtn} onPress={handleUpdateProfile}>
              <LinearGradient colors={[COLORS.primary, COLORS.secondary]} style={styles.saveGradient}>
                <Text style={styles.saveText}>Save Changes</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

/* ─────────────────────────────────────────────────────
   Styles
───────────────────────────────────────────────────── */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bgDeep },
  scroll: { paddingBottom: 50 },

  // Header
  header: { alignItems: "center", paddingTop: 65, paddingBottom: 28 },
  avatarWrap: { position: "relative", marginBottom: 16 },
  avatar: { width: 96, height: 96, borderRadius: 48, justifyContent: "center", alignItems: "center", borderWidth: 3, borderColor: COLORS.bgSurface },
  avatarText: { fontSize: 38, fontWeight: "900", color: "#fff" },
  editAvatarBtn: { position: "absolute", bottom: 0, right: 0, backgroundColor: COLORS.info, padding: 7, borderRadius: 14, borderWidth: 2, borderColor: COLORS.bgDeep },
  userName: { fontSize: 24, fontWeight: "bold", color: "#fff", marginBottom: 8 },
  roleBadge: { paddingHorizontal: 14, paddingVertical: 5, borderRadius: 20, borderWidth: 1, marginBottom: 8 },
  roleBadgeText: { fontWeight: "bold", fontSize: 12, letterSpacing: 0.5 },
  userEmail: { color: COLORS.textMuted, fontSize: 13 },

  // Stats
  statsRow: { flexDirection: "row", backgroundColor: COLORS.bgSurface, marginHorizontal: 20, borderRadius: RADIUS.lg, paddingVertical: 18, borderWidth: 1, borderColor: COLORS.border, marginBottom: 28 },
  statBox: { flex: 1, alignItems: "center", paddingHorizontal: 8 },
  statBorder: { borderLeftWidth: 1, borderRightWidth: 1, borderColor: COLORS.border },
  statValue: { fontSize: 16, fontWeight: "bold", color: "#fff", textAlign: "center" },
  statLabel: { fontSize: 11, color: COLORS.textMuted, marginTop: 4, textAlign: "center" },

  // Sections
  section: { paddingHorizontal: 20, marginBottom: 22 },
  sectionHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  sectionTitle: { fontSize: 15, fontWeight: "bold", color: COLORS.textSecondary, marginLeft: 2 },
  editLink: { color: COLORS.primary, fontSize: 13, fontWeight: "bold" },

  // Card
  card: { backgroundColor: COLORS.bgSurface, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, overflow: "hidden" },
  profileItem: { flexDirection: "row", alignItems: "center", padding: 14, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  itemIconBox: { width: 38, height: 38, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  itemContent: { flex: 1, marginLeft: 14 },
  itemLabel: { fontSize: 11, color: COLORS.textMuted, marginBottom: 2, textTransform: "uppercase", letterSpacing: 0.4 },
  itemValue: { fontSize: 14, fontWeight: "600", color: "#fff" },
  itemValueEmpty: { color: COLORS.textMuted, fontStyle: "italic", fontWeight: "400" },

  // Student / Info rows
  studentRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 14 },
  studentLeft: { flexDirection: "row", alignItems: "center", flex: 1 },
  infoRow: { flexDirection: "row", alignItems: "center", padding: 14 },
  verifyBtn: { backgroundColor: COLORS.bgCard, paddingHorizontal: 14, paddingVertical: 7, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: COLORS.amber },
  verifyText: { color: COLORS.amber, fontWeight: "bold", fontSize: 12 },

  // Logout
  logoutBtn: { marginHorizontal: 20, marginTop: 16, borderRadius: RADIUS.md, overflow: "hidden" },
  logoutGradient: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 16 },
  logoutText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
  versionText: { textAlign: "center", color: COLORS.textMuted, fontSize: 11, marginTop: 24 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.88)", justifyContent: "flex-end" },
  modalContent: { backgroundColor: COLORS.bgSurface, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, borderWidth: 1, borderColor: COLORS.border },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  modalTitle: { fontSize: 19, fontWeight: "bold", color: "#fff" },
  inputLabel: { color: COLORS.textMuted, fontSize: 12, marginBottom: 8, marginTop: 14, textTransform: "uppercase", letterSpacing: 0.5 },
  textInput: { backgroundColor: COLORS.bgCard, borderRadius: RADIUS.md, color: "#fff", padding: 14, borderWidth: 1, borderColor: COLORS.border },
  saveBtn: { marginTop: 24, borderRadius: RADIUS.md, overflow: "hidden" },
  saveGradient: { paddingVertical: 16, alignItems: "center" },
  saveText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
});

export default ProfileScreen;
