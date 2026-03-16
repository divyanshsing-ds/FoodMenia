import React, { useState, useCallback } from 'react';
import {
    View, Text, FlatList, StyleSheet, TouchableOpacity, StatusBar,
    TextInput, Alert, ActivityIndicator, Modal, ScrollView,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons as Icon } from '@expo/vector-icons';
import { orderAPI } from '../services/api';
import { COLORS, RADIUS, SPACING } from '../utils/theme';
import { getSocket } from '../services/socket';
import { useTokens } from '../services/storage';

const TABS = ['pending', 'cancel_req', 'active', 'completed'];
const TAB_LABELS = { pending: 'Pending', cancel_req: 'Cancel Requests', active: 'Running', completed: 'Completed' };

const getStatusColor = (status) => {
    const MAP = {
        pending: COLORS.amber,
        confirmed: COLORS.info,
        preparing: COLORS.secondary,
        out_for_delivery: COLORS.primary,
        delivered: COLORS.success,
        cancel_requested: COLORS.warning,
        rejected: COLORS.danger,
        cancelled: COLORS.danger,
    };
    return MAP[status] || COLORS.textMuted;
};

const formatStatus = (s) =>
    s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const PartnerOrdersScreen = () => {
    const { getUserData } = useTokens();
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('pending');
    const [otpValues, setOtpValues] = useState({});
    const [refreshing, setRefreshing] = useState(false);

    // Rejection reason modal
    const [rejModal, setRejModal] = useState({ show: false, orderId: null });
    const [rejReason, setRejReason] = useState('');

    const fetchOrders = useCallback(async (isSilent = false) => {
        if (!isSilent) setLoading(true);
        try {
            const resp = await orderAPI.getOperatorOrders();
            if (resp.data.success) setOrders(resp.data.data);
        } catch (e) {
            console.error('Partner fetch orders:', e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            fetchOrders();
            const socket = getSocket();
            if (socket) {
                getUserData('operator').then((u) => {
                    if (u?._id) socket.emit('join_room', `operator_${u._id}`);
                });
                socket.on('order_created', () => {
                    fetchOrders(true);
                    // Potential sound notification here
                });
                socket.on('order_update', () => fetchOrders(true));
            }
            return () => {
                if (socket) {
                    socket.off('order_created');
                    socket.off('order_update');
                }
            };
        }, [fetchOrders, getUserData])
    );

    const handleUpdateStatus = async (orderId, status, reason = null) => {
        try {
            const res = await orderAPI.updateOrderStatus(orderId, status, reason);
            if (res.data.success) fetchOrders(true);
        } catch (e) {
            Alert.alert('Error', 'Failed to update status');
        }
    };

    const handleReject = (orderId) => {
        setRejModal({ show: true, orderId });
        setRejReason('');
    };

    const confirmReject = async () => {
        if (!rejReason.trim()) {
            Alert.alert('Error', 'Please provide a rejection reason');
            return;
        }
        await handleUpdateStatus(rejModal.orderId, 'rejected', rejReason);
        setRejModal({ show: false, orderId: null });
        setRejReason('');
    };

    const handleVerifyOtp = async (orderId) => {
        const otp = otpValues[orderId];
        if (!otp || otp.length !== 4) {
            Alert.alert('Error', 'Enter the 4-digit OTP');
            return;
        }
        try {
            const res = await orderAPI.verifyOtp(orderId, otp);
            if (res.data.success) {
                setOtpValues((p) => { const n = { ...p }; delete n[orderId]; return n; });
                fetchOrders(true);
            } else {
                Alert.alert('Error', res.data.message || 'Invalid OTP');
            }
        } catch (e) {
            Alert.alert('Error', 'OTP verification failed');
        }
    };

    const filteredOrders = orders.filter((o) => {
        if (activeTab === 'pending') return o.status === 'pending';
        if (activeTab === 'cancel_req') return o.status === 'cancel_requested';
        if (activeTab === 'active') return ['confirmed', 'preparing', 'out_for_delivery'].includes(o.status);
        if (activeTab === 'completed') return ['delivered', 'rejected', 'cancelled'].includes(o.status);
        return false;
    }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const cancelReqCount = orders.filter((o) => o.status === 'cancel_requested').length;
    const pendingCount = orders.filter((o) => o.status === 'pending').length;

    const getNextStatus = (current) => {
        const FLOW = { confirmed: 'preparing', preparing: 'out_for_delivery' };
        return FLOW[current] || null;
    };

    const renderOrderItem = ({ item }) => (
        <View style={styles.orderCard}>
            <View style={styles.cardHeader}>
                <View>
                    <Text style={styles.orderId}>#{item._id.slice(-8).toUpperCase()}</Text>
                    <Text style={styles.customerName}>{item.userName}</Text>
                    <View style={styles.timeContainer}>
                        <Icon name="access-time" size={12} color={COLORS.textMuted} />
                        <Text style={styles.orderTime}>{new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                    </View>
                </View>
                <View style={styles.statusBox}>
                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '15', borderColor: getStatusColor(item.status) + '30' }]}>
                        <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
                            {formatStatus(item.status)}
                        </Text>
                    </View>
                    {item.studentDiscountApplied && (
                        <View style={styles.studentBadge}>
                            <Icon name="school" size={10} color={COLORS.amber} />
                            <Text style={styles.studentBadgeText}>STUDENT</Text>
                        </View>
                    )}
                </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.itemsScroll}>
                {item.items.map((it, idx) => (
                    <View key={idx} style={styles.itemRow}>
                        <View style={[styles.dot, { backgroundColor: it.foodType === 'veg' ? '#10b981' : '#ef4444' }]} />
                        <Text style={styles.itemName} numberOfLines={1}>{it.name}</Text>
                        <Text style={styles.itemQty}>× {it.quantity}</Text>
                        <Text style={styles.itemPrice}>₹{it.price * it.quantity}</Text>
                    </View>
                ))}
            </View>

            <View style={styles.infoSection}>
                {item.customerPhone && (
                    <TouchableOpacity style={styles.detailItem} activeOpacity={0.7}>
                        <Icon name="phone" size={16} color={COLORS.primary} />
                        <Text style={styles.detailText}>{item.customerPhone}</Text>
                    </TouchableOpacity>
                )}
                {item.customerAddress && (
                    <View style={styles.detailItem}>
                        <Icon name="location-on" size={16} color={COLORS.secondary} />
                        <Text style={styles.detailText} numberOfLines={2}>{item.customerAddress}</Text>
                    </View>
                )}
                {item.instructions && (
                    <View style={styles.instrBox}>
                        <Icon name="info" size={14} color={COLORS.amber} />
                        <Text style={styles.instrText}>"{item.instructions}"</Text>
                    </View>
                )}
            </View>

            {item.status === 'cancel_requested' && (
                <View style={styles.cancelAlert}>
                    <Text style={styles.cancelAlertTitle}>Cancellation Requested</Text>
                    <Text style={styles.cancelAlertReason}>{item.cancellationReason || "No reason provided"}</Text>
                    <View style={styles.cancelActions}>
                        <TouchableOpacity style={styles.cancelBtnApprove} onPress={() => handleUpdateStatus(item._id, 'cancelled')}>
                            <Text style={styles.cancelBtnText}>Accept</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.cancelBtnDeny} onPress={() => handleUpdateStatus(item._id, 'confirmed')}>
                            <Text style={styles.cancelBtnText}>Deny</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            )}

            <View style={styles.cardFooter}>
                <View>
                    <Text style={styles.totalLabel}>Grand Total</Text>
                    <Text style={styles.totalAmount}>₹{item.totalAmount}</Text>
                    <View style={[styles.payBadge, { backgroundColor: item.paymentStatus === 'paid' ? COLORS.success + '15' : COLORS.warning + '15' }]}>
                        <Text style={[styles.payBadgeText, { color: item.paymentStatus === 'paid' ? COLORS.success : COLORS.warning }]}>
                            {item.paymentMethod?.toUpperCase()} • {item.paymentStatus?.toUpperCase()}
                        </Text>
                    </View>
                </View>

                <View style={styles.actionArea}>
                    {item.status === 'pending' && (
                        <View style={styles.buttonRow}>
                            <TouchableOpacity
                                style={[styles.mainActionBtn, { backgroundColor: COLORS.success }]}
                                onPress={() => handleUpdateStatus(item._id, 'confirmed')}
                            >
                                <Text style={styles.btnText}>ACCEPT</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.subActionBtn]}
                                onPress={() => handleReject(item._id)}
                            >
                                <Icon name="close" size={20} color={COLORS.danger} />
                            </TouchableOpacity>
                        </View>
                    )}

                    {getNextStatus(item.status) && (
                        <TouchableOpacity
                            style={[styles.mainActionBtn, { backgroundColor: COLORS.info, minWidth: 140 }]}
                            onPress={() => handleUpdateStatus(item._id, getNextStatus(item.status))}
                        >
                            <Text style={styles.btnText}>MARK AS {formatStatus(getNextStatus(item.status)).toUpperCase()}</Text>
                        </TouchableOpacity>
                    )}

                    {item.status === 'out_for_delivery' && (
                        <View style={styles.otpSection}>
                            <TextInput
                                style={styles.otpInput}
                                placeholder="OTP"
                                placeholderTextColor={COLORS.textMuted}
                                keyboardType="numeric"
                                maxLength={4}
                                value={otpValues[item._id] || ''}
                                onChangeText={(v) => setOtpValues({ ...otpValues, [item._id]: v })}
                            />
                            <TouchableOpacity style={styles.otpBtn} onPress={() => handleVerifyOtp(item._id)}>
                                <Icon name="check" size={20} color="white" />
                            </TouchableOpacity>
                        </View>
                    )}

                    {(item.status === 'delivered' || item.status === 'rejected' || item.status === 'cancelled') && (
                        <Text style={styles.doneTime}>
                            {item.status === 'delivered' ? '✓ Delivered' : '✕ Finished'}
                        </Text>
                    )}
                </View>
            </View>
        </View>
    );

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" />
            <LinearGradient colors={[COLORS.bgDeep, '#0e0e25']} style={StyleSheet.absoluteFill} />

            <View style={styles.header}>
                <View>
                    <Text style={styles.headerTitle}>Order Queue</Text>
                    <Text style={styles.headerSubtitle}>Real-time partner dashboard</Text>
                </View>
                <TouchableOpacity style={styles.refreshBtn} onPress={() => fetchOrders()}>
                    <Icon name="refresh" size={22} color={COLORS.primary} />
                </TouchableOpacity>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabContainer} contentContainerStyle={styles.tabContent}>
                {TABS.map((tab) => {
                    const count = tab === 'pending' ? pendingCount : tab === 'cancel_req' ? cancelReqCount : 0;
                    return (
                        <TouchableOpacity
                            key={tab}
                            style={[styles.tab, activeTab === tab && styles.activeTab]}
                            onPress={() => setActiveTab(tab)}
                        >
                            <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
                                {TAB_LABELS[tab]}
                            </Text>
                            {count > 0 && <View style={styles.tabBadge}><Text style={styles.tabBadgeText}>{count}</Text></View>}
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>

            {loading ? (
                <View style={styles.centered}><ActivityIndicator size="large" color={COLORS.primary} /></View>
            ) : (
                <FlatList
                    data={filteredOrders}
                    renderItem={renderOrderItem}
                    keyExtractor={(item) => item._id}
                    contentContainerStyle={styles.listPadding}
                    onRefresh={() => fetchOrders(true)}
                    refreshing={refreshing}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Icon name="inbox" size={60} color={COLORS.textDisabled} />
                            <Text style={styles.emptyText}>No orders in {TAB_LABELS[activeTab]}</Text>
                        </View>
                    }
                />
            )}

            {/* Reject Modal */}
            <Modal visible={rejModal.show} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <Text style={styles.modalTitle}>Reject Order</Text>
                        <Text style={styles.modalSub}>Specify a reason for rejection:</Text>
                        <TextInput
                            style={styles.modalInput}
                            placeholder="e.g. Out of stock, Kitchen closed"
                            placeholderTextColor={COLORS.textMuted}
                            value={rejReason}
                            onChangeText={setRejReason}
                            multiline
                        />
                        <View style={styles.modalButtons}>
                            <TouchableOpacity style={styles.modalSubBtn} onPress={() => setRejModal({ show: false })}>
                                <Text style={styles.modalSubBtnText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.modalMainBtn} onPress={confirmReject}>
                                <Text style={styles.modalMainBtnText}>Confirm</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { paddingTop: 60, paddingHorizontal: 24, paddingBottom: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    headerTitle: { fontSize: 26, fontWeight: '900', color: '#fff' },
    headerSubtitle: { fontSize: 13, color: COLORS.textMuted, marginTop: 2 },
    refreshBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.bgSurface, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },

    tabContainer: { height: 50, marginBottom: 15, flexGrow: 0 },
    tabContent: { paddingHorizontal: 16, paddingBottom: 8, gap: 10 },
    tab: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, height: 40, borderRadius: 20, backgroundColor: COLORS.bgSurface, borderWidth: 1, borderColor: COLORS.border },
    activeTab: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
    tabText: { fontSize: 13, color: COLORS.textMuted, fontWeight: '600' },
    activeTabText: { color: '#fff' },
    tabBadge: { marginLeft: 6, backgroundColor: '#fff', borderRadius: 10, minWidth: 18, height: 18, justifyContent: 'center', alignItems: 'center' },
    tabBadgeText: { fontSize: 10, color: COLORS.primary, fontWeight: '900' },

    listPadding: { paddingHorizontal: 16, paddingBottom: 40 },
    orderCard: { backgroundColor: COLORS.bgSurface, borderRadius: RADIUS.lg, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: COLORS.border, elevation: 2 },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    orderId: { fontSize: 10, color: COLORS.textMuted, fontWeight: 'bold', letterSpacing: 0.5 },
    customerName: { fontSize: 17, fontWeight: '900', color: '#fff', marginTop: 2 },
    timeContainer: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
    orderTime: { fontSize: 11, color: COLORS.textMuted },

    statusBox: { alignItems: 'flex-end' },
    statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
    statusText: { fontSize: 9, fontWeight: 'bold', letterSpacing: 0.3 },
    studentBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.amber + '15', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginTop: 4 },
    studentBadgeText: { fontSize: 8, fontWeight: '900', color: COLORS.amber },

    divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 14 },

    itemRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
    dot: { width: 6, height: 6, borderRadius: 3, marginRight: 8 },
    itemName: { flex: 1, fontSize: 13, color: COLORS.textSecondary },
    itemQty: { fontSize: 12, color: COLORS.textMuted, marginHorizontal: 8 },
    itemPrice: { fontSize: 13, color: '#fff', fontWeight: 'bold' },

    infoSection: { marginTop: 12, gap: 8 },
    detailItem: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: COLORS.bgCard, padding: 8, borderRadius: 8 },
    detailText: { flex: 1, fontSize: 12, color: COLORS.textSecondary },
    instrBox: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 4 },
    instrText: { fontSize: 11, color: COLORS.amber, fontStyle: 'italic' },

    cancelAlert: { marginTop: 16, padding: 12, backgroundColor: COLORS.danger + '10', borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.danger + '30' },
    cancelAlertTitle: { fontSize: 13, fontWeight: 'bold', color: COLORS.danger },
    cancelAlertReason: { fontSize: 11, color: COLORS.textMuted, marginTop: 4, marginBottom: 12 },
    cancelActions: { flexDirection: 'row', gap: 8 },
    cancelBtnApprove: { flex: 1, backgroundColor: COLORS.danger, paddingVertical: 8, borderRadius: 6, alignItems: 'center' },
    cancelBtnDeny: { flex: 1, backgroundColor: COLORS.bgSurface, borderWidth: 1, borderColor: COLORS.border, paddingVertical: 8, borderRadius: 6, alignItems: 'center' },
    cancelBtnText: { fontSize: 12, color: '#fff', fontWeight: 'bold' },

    cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 16 },
    totalLabel: { fontSize: 10, color: COLORS.textMuted, marginBottom: 2 },
    totalAmount: { fontSize: 20, fontWeight: '900', color: COLORS.success },
    payBadge: { alignSelf: 'flex-start', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginTop: 4 },
    payBadgeText: { fontSize: 8, fontWeight: 'bold' },

    actionArea: { flex: 1, alignItems: 'flex-end' },
    buttonRow: { flexDirection: 'row', gap: 8 },
    mainActionBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
    subActionBtn: { width: 44, height: 44, borderRadius: 10, backgroundColor: COLORS.danger + '10', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: COLORS.danger + '20' },
    btnText: { fontSize: 12, fontWeight: '900', color: '#fff', letterSpacing: 0.5 },

    otpSection: { flexDirection: 'row', gap: 8, alignItems: 'center' },
    otpInput: { width: 70, height: 44, backgroundColor: COLORS.bgCard, borderRadius: 10, color: '#fff', textAlign: 'center', fontWeight: 'bold', letterSpacing: 2, fontSize: 14, borderWidth: 1, borderColor: COLORS.border },
    otpBtn: { width: 44, height: 44, borderRadius: 10, backgroundColor: COLORS.success, justifyContent: 'center', alignItems: 'center' },
    doneTime: { fontSize: 12, color: COLORS.textMuted, fontWeight: '600' },

    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: 80 },
    emptyText: { fontSize: 14, color: COLORS.textMuted, marginTop: 12 },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center', padding: 24 },
    modalCard: { width: '100%', backgroundColor: COLORS.bgSurface, borderRadius: 20, padding: 24, borderWidth: 1, borderColor: COLORS.border },
    modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff', marginBottom: 8 },
    modalSub: { fontSize: 14, color: COLORS.textMuted, marginBottom: 16 },
    modalInput: { backgroundColor: COLORS.bgCard, borderRadius: 12, padding: 14, color: '#fff', fontSize: 14, minHeight: 80, textAlignVertical: 'top', borderWidth: 1, borderColor: COLORS.border },
    modalButtons: { flexDirection: 'row', gap: 12, marginTop: 24 },
    modalSubBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
    modalSubBtnText: { color: COLORS.textMuted, fontWeight: 'bold' },
    modalMainBtn: { flex: 2, backgroundColor: COLORS.danger, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
    modalMainBtnText: { color: '#fff', fontWeight: 'bold' },
});

export default PartnerOrdersScreen;
