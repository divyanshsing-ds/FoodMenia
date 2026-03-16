import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  StyleSheet,
  Alert,
  StatusBar,
  ScrollView,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons as Icon } from '@expo/vector-icons';
import { useCart } from '../services/CartContext';
import { orderAPI } from '../services/api';
import { useTokens } from '../services/storage';
import { COLORS, RADIUS, SPACING } from '../utils/theme';

const CartScreen = () => {
  const { cart, removeFromCart, clearCart } = useCart();
  const { getDeliveryInfo, saveDeliveryInfo } = useTokens();
  const [modalVisible, setModalVisible] = useState(false);
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cod');
  const [isEditing, setIsEditing] = useState(false);
  const [hasSavedInfo, setHasSavedInfo] = useState(false);

  useEffect(() => {
    loadSavedDetails();
  }, []);

  const loadSavedDetails = async () => {
    const info = await getDeliveryInfo();
    if (info) {
      setPhone(info.phone || '');
      setAddress(info.address || '');
      setHasSavedInfo(true);
      setIsEditing(false);
    } else {
      setIsEditing(true);
      setHasSavedInfo(false);
    }
  };

  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const deliveryFee = cart.length > 0 ? 40 : 0;
  const platformFee = cart.length > 0 ? 10 : 0;
  const grandTotal = cartTotal + deliveryFee + platformFee;

  const placeOrder = async () => {
    if (!phone || !address) {
      Alert.alert('Error', 'Please provide delivery details');
      return;
    }
    if (cart.length === 0) return;

    try {
      const firstItem = cart[0];
      const response = await orderAPI.placeOrder({
        operatorId: firstItem.operatorId,
        restaurantName: firstItem.restaurantName,
        items: cart.map(item => ({ menuItemId: item._id, quantity: item.quantity })),
        phone,
        address,
        paymentMethod,
      });
      
      if (response.data.success) {
        // Save these details for next time
        await saveDeliveryInfo({ phone, address });
        
        Alert.alert('Success', 'Your feast is on the way! 🍕');
        clearCart();
        setModalVisible(false);
        setHasSavedInfo(true);
        setIsEditing(false);
      } else {
        Alert.alert('Error', response.data.message || 'Failed to place order');
      }
    } catch (error) {
      console.error('Order Error:', error.response?.data || error.message);
      Alert.alert('Error', error.response?.data?.message || 'Failed to place order');
    }
  };

  const renderCartItem = ({ item }) => (
    <View style={styles.cartItem}>
      <View style={styles.itemImagePlaceholder}>
        <Text style={styles.itemEmoji}>🍲</Text>
      </View>
      <View style={styles.itemInfo}>
        <Text style={styles.itemName}>{item.name}</Text>
        <Text style={styles.itemPrice}>₹{item.price}</Text>
      </View>
      <View style={styles.qtyContainer}>
        <Text style={styles.qtyText}>x{item.quantity}</Text>
        <TouchableOpacity style={styles.removeBtn} onPress={() => removeFromCart(item._id)}>
          <Icon name="delete-outline" size={20} color={COLORS.danger} />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient
        colors={[COLORS.bgDeep, '#0e0e25']}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.header}>
        <Text style={styles.title}>Your Cart</Text>
        <Text style={styles.itemCount}>{cart.length} Items</Text>
      </View>

      {cart.length > 0 ? (
        <>
          <FlatList
            data={cart}
            renderItem={renderCartItem}
            keyExtractor={item => item._id}
            contentContainerStyle={styles.cartList}
            showsVerticalScrollIndicator={false}
          />

          <View style={styles.summaryContainer}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Item Total</Text>
              <Text style={styles.summaryValue}>₹{cartTotal}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Delivery Fee</Text>
              <Text style={styles.summaryValue}>₹{deliveryFee}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Platform Fee</Text>
              <Text style={styles.summaryValue}>₹{platformFee}</Text>
            </View>
            <View style={styles.totalDivider} />
            <View style={styles.summaryRow}>
              <Text style={styles.grandTotalLabel}>Grand Total</Text>
              <Text style={styles.grandTotalValue}>₹{grandTotal}</Text>
            </View>

            <TouchableOpacity 
              style={styles.checkoutBtn} 
              onPress={() => {
                loadSavedDetails();
                setModalVisible(true);
              }} 
              activeOpacity={0.8}
            >
               <LinearGradient
                 colors={[COLORS.primary, COLORS.secondary]}
                 start={{ x: 0, y: 0 }}
                 end={{ x: 1, y: 0 }}
                 style={styles.checkoutGradient}
               >
                 <Text style={styles.checkoutText}>Proceed to Checkout</Text>
                 <Icon name="arrow-forward" size={20} color="white" />
               </LinearGradient>
            </TouchableOpacity>
          </View>
        </>
      ) : (
        <View style={styles.emptyCart}>
          <Icon name="shopping-cart-checkout" size={80} color={COLORS.bgCard} />
          <Text style={styles.emptyTitle}>Cart is empty</Text>
          <Text style={styles.emptyDesc}>Add some delicious food to your cart to see them here!</Text>
        </View>
      )}

      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Checkout Details</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Icon name="close" size={24} color={COLORS.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {hasSavedInfo && !isEditing ? (
                <View style={styles.savedInfoBox}>
                  <View style={styles.savedInfoHeader}>
                    <Text style={styles.savedInfoTitle}>Delivery Address</Text>
                    <TouchableOpacity onPress={() => setIsEditing(true)}>
                      <Text style={styles.editBtnText}>Edit</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.savedInfoContent}>
                    <View style={styles.infoRow}>
                      <Icon name="phone" size={16} color={COLORS.primary} />
                      <Text style={styles.infoText}>{phone}</Text>
                    </View>
                    <View style={styles.infoRow}>
                      <Icon name="location-pin" size={16} color={COLORS.primary} />
                      <Text style={styles.infoText}>{address}</Text>
                    </View>
                  </View>
                </View>
              ) : (
                <>
                  <Text style={styles.inputLabel}>Delivery Contact</Text>
                  <View style={styles.inputWrapper}>
                    <Icon name="phone" size={20} color={COLORS.textMuted} style={styles.inputIcon} />
                    <TextInput 
                      style={styles.input} 
                      placeholder="Enter phone number" 
                      placeholderTextColor={COLORS.textMuted}
                      value={phone} 
                      onChangeText={setPhone}
                      keyboardType="phone-pad"
                    />
                  </View>

                  <Text style={styles.inputLabel}>Delivery Address</Text>
                  <View style={[styles.inputWrapper, { height: 100, alignItems: 'flex-start', paddingTop: 12 }]}>
                    <Icon name="location-pin" size={20} color={COLORS.textMuted} style={styles.inputIcon} />
                    <TextInput 
                      style={[styles.input, { textAlignVertical: 'top' }]} 
                      placeholder="Enter full address" 
                      placeholderTextColor={COLORS.textMuted}
                      multiline 
                      value={address} 
                      onChangeText={setAddress} 
                    />
                  </View>
                  {hasSavedInfo && (
                    <TouchableOpacity style={styles.cancelEditBtn} onPress={() => setIsEditing(false)}>
                      <Text style={styles.cancelEditBtnText}>Cancel</Text>
                    </TouchableOpacity>
                  )}
                </>
              )}

              <Text style={styles.inputLabel}>Payment Method</Text>
              <View style={styles.paymentRow}>
                <TouchableOpacity 
                   style={[styles.paymentBtn, paymentMethod === 'cod' && styles.paymentBtnActive]} 
                   onPress={() => setPaymentMethod('cod')}
                >
                  <Icon name="money" size={22} color={paymentMethod === 'cod' ? 'white' : COLORS.textMuted} />
                  <Text style={[styles.paymentText, paymentMethod === 'cod' && styles.paymentTextActive]}>Cash on Delivery</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                   style={[styles.paymentBtn, paymentMethod === 'upi' && styles.paymentBtnActive]} 
                   onPress={() => setPaymentMethod('upi')}
                >
                  <Icon name="account-balance-wallet" size={22} color={paymentMethod === 'upi' ? 'white' : COLORS.textMuted} />
                  <Text style={[styles.paymentText, paymentMethod === 'upi' && styles.paymentTextActive]}>UPI / Online</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={styles.placeOrderBtn} onPress={placeOrder}>
                <LinearGradient
                  colors={['#10b981', '#059669']}
                  style={styles.placeOrderGradient}
                >
                  <Text style={styles.placeOrderText}>Confirm Order • ₹{grandTotal}</Text>
                </LinearGradient>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bgDeep },
  header: { 
    paddingHorizontal: 24, 
    paddingTop: 60, 
    paddingBottom: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  title: { fontSize: 28, fontWeight: '900', color: COLORS.textPrimary },
  itemCount: { fontSize: 14, color: COLORS.textMuted, fontWeight: '600' },
  cartList: { paddingHorizontal: 24, paddingBottom: 20 },
  cartItem: { 
    flexDirection: 'row', 
    alignItems: 'center',
    backgroundColor: COLORS.bgSurface, 
    borderRadius: RADIUS.lg, 
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  itemImagePlaceholder: {
    width: 60,
    height: 60,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.bgCard,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemEmoji: { fontSize: 24 },
  itemInfo: { flex: 1, marginLeft: 16 },
  itemName: { fontSize: 16, fontWeight: 'bold', color: COLORS.textPrimary },
  itemPrice: { fontSize: 14, color: COLORS.primary, fontWeight: '700', marginTop: 4 },
  qtyContainer: { alignItems: 'flex-end', justifyContent: 'center' },
  qtyText: { fontSize: 14, fontWeight: 'bold', color: COLORS.textPrimary, marginBottom: 8 },
  removeBtn: { padding: 4 },
  summaryContainer: {
    backgroundColor: COLORS.bgSurface,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    padding: 24,
    paddingBottom: 40,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  summaryLabel: { fontSize: 14, color: COLORS.textMuted },
  summaryValue: { fontSize: 14, color: COLORS.textPrimary, fontWeight: '600' },
  totalDivider: { height: 1, backgroundColor: COLORS.border, marginVertical: 12 },
  grandTotalLabel: { fontSize: 18, fontWeight: 'bold', color: COLORS.textPrimary },
  grandTotalValue: { fontSize: 22, fontWeight: '900', color: COLORS.primary },
  checkoutBtn: { marginTop: 20 },
  checkoutGradient: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 18,
    borderRadius: RADIUS.md,
  },
  checkoutText: { color: 'white', fontWeight: 'bold', fontSize: 16, marginRight: 10 },
  emptyCart: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
  emptyTitle: { fontSize: 24, fontWeight: 'bold', color: COLORS.textPrimary, marginTop: 24 },
  emptyDesc: { fontSize: 15, color: COLORS.textMuted, textAlign: 'center', marginTop: 12, lineHeight: 22 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  modalContent: { 
    backgroundColor: COLORS.bgSurface, 
    borderTopLeftRadius: 30, 
    borderTopRightRadius: 30, 
    padding: 24,
    maxHeight: '85%',
  },
  modalHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center',
    marginBottom: 30,
  },
  modalTitle: { fontSize: 22, fontWeight: 'bold', color: COLORS.textPrimary },
  inputLabel: { fontSize: 14, color: COLORS.textSecondary, fontWeight: '600', marginBottom: 8 },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  inputIcon: { marginRight: 12 },
  input: { flex: 1, color: 'white', paddingVertical: 12, fontSize: 15 },
  paymentRow: { gap: 12, marginBottom: 30 },
  paymentBtn: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: 16, 
    backgroundColor: COLORS.bgCard, 
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  paymentBtnActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  paymentText: { color: COLORS.textSecondary, fontWeight: '600', marginLeft: 12 },
  paymentTextActive: { color: 'white' },
  placeOrderBtn: { marginTop: 10, borderRadius: RADIUS.md, overflow: 'hidden' },
  placeOrderGradient: { paddingVertical: 18, alignItems: 'center' },
  placeOrderText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  savedInfoBox: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.lg,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  savedInfoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingBottom: 10,
  },
  savedInfoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  editBtnText: {
    color: COLORS.primary,
    fontWeight: 'bold',
    fontSize: 14,
  },
  savedInfoContent: {
    gap: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  infoText: {
    color: COLORS.textSecondary,
    fontSize: 15,
    flex: 1,
  },
  cancelEditBtn: {
    alignItems: 'center',
    paddingVertical: 12,
    marginBottom: 10,
  },
  cancelEditBtnText: {
    color: COLORS.textMuted,
    fontWeight: '600',
    fontSize: 14,
  },
});

export default CartScreen;
