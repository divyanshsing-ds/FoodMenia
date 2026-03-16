import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  StatusBar,
  ScrollView,
  Image,
  Animated,
  Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons as Icon } from '@expo/vector-icons';
import { orderAPI } from '../services/api';
import { CONFIG } from '../utils/config';
import { COLORS, RADIUS, SPACING } from '../utils/theme';
import { getSocket } from '../services/socket';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width } = Dimensions.get('window');

const StatusTimeline = ({ status }) => {
  const steps = ['pending', 'confirmed', 'preparing', 'out_for_delivery', 'delivered'];
  const currentIdx = steps.indexOf(status);

  if (['rejected', 'cancelled', 'cancel_requested'].includes(status)) {
    return (
      <View style={tlStyles.cancelledBadge}>
        <Icon name="cancel" size={14} color={COLORS.danger} />
        <Text style={tlStyles.cancelledText}>
          {status === 'cancel_requested' ? 'Cancellation Requested' : status.charAt(0).toUpperCase() + status.slice(1)}
        </Text>
      </View>
    );
  }

  return (
    <View style={tlStyles.container}>
      {steps.map((step, i) => {
        const done = i <= currentIdx;
        const active = i === currentIdx;
        const icons = ['hourglass-empty', 'check-circle', 'restaurant', 'delivery-dining', 'verified'];
        return (
          <React.Fragment key={step}>
            <View style={[tlStyles.node, done && tlStyles.nodeDone, active && tlStyles.nodeActive]}>
              <Icon name={icons[i]} size={13} color={done ? '#fff' : COLORS.textDisabled} />
            </View>
            {i < steps.length - 1 && (
              <View style={[tlStyles.line, done && i < currentIdx && tlStyles.lineDone]} />
            )}
          </React.Fragment>
        );
      })}
    </View>
  );
};

const tlStyles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', marginVertical: 14 },
  node: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: COLORS.bgCard,
    borderWidth: 1, borderColor: COLORS.border,
    justifyContent: 'center', alignItems: 'center',
  },
  nodeDone: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  nodeActive: {
    backgroundColor: COLORS.primary, borderColor: COLORS.primary,
    shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8, shadowRadius: 6, elevation: 6,
  },
  line: { flex: 1, height: 2, backgroundColor: COLORS.border },
  lineDone: { backgroundColor: COLORS.primary },
  cancelledBadge: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: `${COLORS.danger}18`, borderRadius: RADIUS.xs,
    paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1, borderColor: COLORS.danger,
    alignSelf: 'flex-start', marginVertical: 10,
  },
  cancelledText: { color: COLORS.danger, fontSize: 12, fontWeight: '700', marginLeft: 6 },
});

const OTPBox = ({ otp }) => {
  const digits = otp.split('');
  return (
    <View style={otpStyles.container}>
      <View style={otpStyles.header}>
        <Icon name="verified-user" size={18} color={COLORS.success} />
        <Text style={otpStyles.title}>Delivery OTP</Text>
      </View>
      <Text style={otpStyles.subtitle}>Share this code with the delivery person to confirm receipt</Text>
      <View style={otpStyles.digitRow}>
        {digits.map((d, i) => (
          <View key={i} style={otpStyles.digitBox}>
            <Text style={otpStyles.digit}>{d}</Text>
          </View>
        ))}
      </View>
    </View>
  );
};

const otpStyles = StyleSheet.create({
  container: {
    backgroundColor: `${COLORS.success}12`,
    borderWidth: 1.5,
    borderColor: COLORS.success,
    borderRadius: RADIUS.md,
    padding: 16,
    marginVertical: 12,
  },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  title: { fontSize: 14, fontWeight: '800', color: COLORS.success, marginLeft: 8 },
  subtitle: { fontSize: 11, color: COLORS.textMuted, marginBottom: 12 },
  digitRow: { flexDirection: 'row', justifyContent: 'center', gap: 10 },
  digitBox: {
    width: 48, height: 56, borderRadius: RADIUS.sm,
    backgroundColor: COLORS.bgSurface,
    borderWidth: 2, borderColor: COLORS.success,
    justifyContent: 'center', alignItems: 'center',
  },
  digit: { fontSize: 26, fontWeight: '900', color: COLORS.textPrimary },
});

const OrdersScreen = () => {
  const [activeOrders, setActiveOrders] = useState([]);
  const [pastOrders, setPastOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [liveIndicator] = useState(new Animated.Value(1));
  const socketRef = useRef(null);
  const userIdRef = useRef(null);

  // Pulse animation for live indicator
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(liveIndicator, { toValue: 0.3, duration: 800, useNativeDriver: true }),
        Animated.timing(liveIndicator, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  // Load userId and connect to socket
  useEffect(() => {
    let pollInterval;
    const init = async () => {
      try {
        const raw = await AsyncStorage.getItem('userData');
        if (raw) {
          const data = JSON.parse(raw);
          userIdRef.current = data._id || data.id;
        }
      } catch (e) {}
      fetchOrders();
      connectSocket();
      // Fallback: poll every 15s in case socket fails
      pollInterval = setInterval(fetchOrders, 15000);
    };
    init();
    return () => {
      disconnectSocket();
      if (pollInterval) clearInterval(pollInterval);
    };
  }, []);

  const connectSocket = () => {
    const socket = getSocket();
    socketRef.current = socket;

    if (userIdRef.current) {
      socket.emit('join_room', `user_${userIdRef.current}`);
    }

    socket.on('order_update', (updatedOrder) => {
      updateOrderInState(updatedOrder);
    });

    socket.on('order_created', (newOrder) => {
      setActiveOrders(prev => {
        const exists = prev.find(o => o._id === newOrder._id);
        if (exists) return prev;
        return [newOrder, ...prev];
      });
    });
  };

  const disconnectSocket = () => {
    if (socketRef.current && userIdRef.current) {
      socketRef.current.off('order_update');
      socketRef.current.off('order_created');
      socketRef.current.emit('leave_room', `user_${userIdRef.current}`);
    }
  };

  const updateOrderInState = (updatedOrder) => {
    const isPast = ['delivered', 'rejected', 'cancelled'].includes(updatedOrder.status);
    setActiveOrders(prev => {
      const filtered = prev.filter(o => o._id !== updatedOrder._id);
      return isPast ? filtered : [updatedOrder, ...filtered];
    });
    setPastOrders(prev => {
      const filtered = prev.filter(o => o._id !== updatedOrder._id);
      return isPast ? [updatedOrder, ...filtered] : filtered;
    });
  };

  useFocusEffect(
    React.useCallback(() => {
      fetchOrders();
      if (socketRef.current && userIdRef.current) {
        socketRef.current.emit('join_room', `user_${userIdRef.current}`);
      }
    }, [])
  );

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const response = await orderAPI.getMyOrders();
      if (response.data.success) {
        const allOrders = response.data.data;
        setActiveOrders(allOrders.filter(o => !['delivered', 'rejected', 'cancelled'].includes(o.status)));
        setPastOrders(allOrders.filter(o => ['delivered', 'rejected', 'cancelled'].includes(o.status)));
      }
    } catch (error) {
      console.error('Failed to fetch orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatStatus = (status) => status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

  const getStatusColor = (status) => {
    switch (status) {
      case 'delivered': return COLORS.success;
      case 'rejected':
      case 'cancelled': return COLORS.danger;
      case 'preparing':
      case 'out_for_delivery': return COLORS.amber;
      default: return COLORS.warning;
    }
  };

  const renderOrder = ({ item }) => {
    const firstItemWithImage = item.items?.find(i => i.image);
    const orderImageUrl = firstItemWithImage
      ? `${CONFIG.UPLOADS_BASE}${firstItemWithImage.image}`
      : null;
    const isOutForDelivery = item.status === 'out_for_delivery';

    return (
      <View style={styles.orderCard}>
        {/* ── Header ── */}
        <View style={styles.orderHeader}>
          <View style={styles.orderIdRow}>
            <Text style={styles.orderIdLabel}>Order ID</Text>
            <Text style={styles.orderIdValue}>#{item._id.slice(-8).toUpperCase()}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: `${getStatusColor(item.status)}15`, borderColor: getStatusColor(item.status) }]}>
            <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>{formatStatus(item.status)}</Text>
          </View>
        </View>

        {/* ── Restaurant Row ── */}
        <View style={styles.restaurantRow}>
          <View style={styles.restaurantImageContainer}>
            {orderImageUrl ? (
              <Image source={{ uri: orderImageUrl }} style={styles.orderThumb} />
            ) : (
              <View style={styles.restaurantIcon}>
                <Icon name="restaurant" size={20} color={COLORS.primary} />
              </View>
            )}
          </View>
          <View style={styles.restaurantDetails}>
            <Text style={styles.restaurantName}>{item.restaurantName}</Text>
            <Text style={styles.orderMeta}>{item.items?.length} {item.items?.length === 1 ? 'item' : 'items'} · ₹{item.totalAmount}</Text>
          </View>
        </View>

        {/* ── OTP Box ── */}
        {isOutForDelivery && item.deliveryOTP && (
          <OTPBox otp={item.deliveryOTP} />
        )}

        {/* ── Status Timeline ── */}
        {!['rejected', 'cancelled', 'delivered'].includes(item.status) && (
          <StatusTimeline status={item.status} />
        )}

        <View style={styles.divider} />

        {/* ── Items List ── */}
        <View style={styles.itemsList}>
          {item.items?.map((orderItem, i) => (
            <View key={i} style={styles.itemRow}>
              <Text style={styles.itemName} numberOfLines={1}>{orderItem.name}</Text>
              <Text style={styles.itemQty}>×{orderItem.quantity}</Text>
              <Text style={styles.itemPrice}>₹{orderItem.price * orderItem.quantity}</Text>
            </View>
          ))}
        </View>

        {/* ── Footer ── */}
        <View style={styles.orderFooter}>
          <View>
            <Text style={styles.dateText}>{new Date(item.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</Text>
            <Text style={styles.paymentMethod}>{item.paymentMethod?.toUpperCase()} · {item.paymentStatus}</Text>
          </View>
          {['pending', 'confirmed'].includes(item.status) && (
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => Alert.alert('Cancel Order', 'Request cancellation?', [
                { text: 'No', style: 'cancel' },
                { text: 'Yes, Cancel', style: 'destructive', onPress: () => {} }
              ])}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={[COLORS.bgDeep, '#0e0e25']} style={StyleSheet.absoluteFill} />

      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Your Orders</Text>
          <View style={styles.liveRow}>
            <Animated.View style={[styles.liveDot, { opacity: liveIndicator }]} />
            <Text style={styles.liveText}>Live Updates</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.refreshBtn} onPress={fetchOrders}>
          <Icon name="refresh" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {activeOrders.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Icon name="timer" size={20} color={COLORS.amber} />
              <Text style={styles.sectionTitle}>Active Orders</Text>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{activeOrders.length}</Text>
              </View>
            </View>
            {activeOrders.map(order => (
              <View key={order._id}>{renderOrder({ item: order })}</View>
            ))}
          </View>
        )}

        {activeOrders.length === 0 && !loading && (
          <View style={styles.emptyCard}>
            <Icon name="delivery-dining" size={52} color={COLORS.primary} style={{ opacity: 0.4 }} />
            <Text style={styles.emptyTitle}>No Active Orders</Text>
            <Text style={styles.emptyText}>Your ongoing orders will appear here</Text>
          </View>
        )}

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Icon name="history" size={20} color={COLORS.info} />
            <Text style={styles.sectionTitle}>Order History</Text>
          </View>
          {pastOrders.length > 0 ? (
            pastOrders.map(order => (
              <View key={order._id}>{renderOrder({ item: order })}</View>
            ))
          ) : (
            <View style={styles.emptyCard}>
              <Icon name="shopping-basket" size={48} color={COLORS.bgCard} />
              <Text style={styles.emptyText}>No past orders yet</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bgDeep },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 16,
  },
  title: { fontSize: 28, fontWeight: '900', color: COLORS.textPrimary },
  liveRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  liveDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: COLORS.success, marginRight: 6 },
  liveText: { fontSize: 11, color: COLORS.success, fontWeight: '700', letterSpacing: 0.5 },
  refreshBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: COLORS.bgSurface,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.border, marginTop: 4,
  },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },
  section: { marginTop: 8, marginBottom: 16 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: COLORS.textSecondary, marginLeft: 8 },
  badge: {
    backgroundColor: COLORS.amber, borderRadius: 10,
    paddingHorizontal: 7, paddingVertical: 1, marginLeft: 8,
  },
  badgeText: { fontSize: 11, fontWeight: '900', color: '#000' },
  orderCard: {
    backgroundColor: COLORS.bgSurface,
    borderRadius: RADIUS.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 14,
  },
  orderHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 14,
  },
  orderIdRow: { flexDirection: 'column' },
  orderIdLabel: { fontSize: 10, color: COLORS.textMuted, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  orderIdValue: { fontSize: 14, fontWeight: 'bold', color: COLORS.textPrimary, marginTop: 2 },
  statusBadge: {
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: RADIUS.xs, borderWidth: 1,
  },
  statusText: { fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 },
  restaurantRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  restaurantImageContainer: { marginRight: 12 },
  restaurantIcon: {
    width: 48, height: 48, borderRadius: RADIUS.md,
    backgroundColor: `${COLORS.primary}15`,
    justifyContent: 'center', alignItems: 'center',
  },
  orderThumb: { width: 48, height: 48, borderRadius: RADIUS.md, backgroundColor: COLORS.bgCard },
  restaurantDetails: { flex: 1 },
  restaurantName: { fontSize: 16, fontWeight: '800', color: COLORS.textPrimary },
  orderMeta: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 12 },
  itemsList: { marginBottom: 12 },
  itemRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  itemName: { flex: 1, fontSize: 13, color: COLORS.textSecondary },
  itemQty: { fontSize: 13, fontWeight: '700', color: COLORS.textMuted, marginHorizontal: 8 },
  itemPrice: { fontSize: 13, fontWeight: '800', color: COLORS.textPrimary },
  orderFooter: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingTop: 12,
    borderTopWidth: 1, borderTopColor: COLORS.border,
  },
  dateText: { fontSize: 12, color: COLORS.textMuted },
  paymentMethod: { fontSize: 11, fontWeight: '600', color: COLORS.textMuted, marginTop: 2, textTransform: 'uppercase' },
  cancelBtn: {
    borderWidth: 1, borderColor: COLORS.danger,
    paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: RADIUS.sm,
  },
  cancelBtnText: { color: COLORS.danger, fontWeight: '700', fontSize: 12 },
  emptyCard: {
    backgroundColor: COLORS.bgSurface,
    borderRadius: RADIUS.lg,
    padding: 40,
    alignItems: 'center',
    borderStyle: 'dashed',
    borderWidth: 2,
    borderColor: COLORS.border,
    marginBottom: 16,
  },
  emptyTitle: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '800', marginTop: 14 },
  emptyText: { color: COLORS.textMuted, fontSize: 13, marginTop: 6, fontWeight: '500', textAlign: 'center' },
});

export default OrdersScreen;
