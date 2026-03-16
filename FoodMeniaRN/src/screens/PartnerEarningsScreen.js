import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar,
  ScrollView, ActivityIndicator, FlatList, Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons as Icon } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { orderAPI } from '../services/api';
import { useTokens } from '../services/storage';
import { COLORS, RADIUS, SPACING } from '../utils/theme';

const TIMEFRAMES = [
  { key: 'day', label: 'Today' },
  { key: 'month', label: '30 Days' },
  { key: '3_months', label: '3 Months' },
  { key: '6_months', label: '6 Months' },
  { key: 'year', label: 'Full Year' },
];

const PartnerEarningsScreen = () => {
  const [orders, setOrders] = useState([]);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [timeframe, setTimeframe] = useState('month');

  const { getUserData } = useTokens();

  useEffect(() => {
    getUserData('operator').then(setUserData);
  }, [getUserData]);

  useFocusEffect(
    useCallback(() => {
      const fetchOrders = async () => {
        setLoading(true);
        try {
          const res = await orderAPI.getOperatorOrders();
          if (res.data.success) setOrders(res.data.data);
        } catch (e) {
          console.error('Earnings fetch error:', e);
        } finally {
          setLoading(false);
        }
      };
      fetchOrders();
    }, [])
  );

  const now = new Date();
  const filteredOrders = orders.filter((o) => {
    if (o.status !== 'delivered') return false;
    const oDate = new Date(o.createdAt);
    if (timeframe === 'day') {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      return oDate >= today;
    }
    const cutoff = new Date();
    if (timeframe === 'month') cutoff.setDate(now.getDate() - 30);
    else if (timeframe === '3_months') cutoff.setDate(now.getDate() - 90);
    else if (timeframe === '6_months') cutoff.setDate(now.getDate() - 180);
    else if (timeframe === 'year') cutoff.setDate(now.getDate() - 365);
    return oDate >= cutoff;
  }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const grossRevenue = filteredOrders.reduce((s, o) => s + o.totalAmount, 0);
  const totalStudentDiscount = filteredOrders.reduce((s, o) => s + (o.discountAmount || 0), 0);
  const platformFee = grossRevenue * 0.05;
  const netProfit = grossRevenue - platformFee;

  const handleDownloadInvoice = async () => {
    if (filteredOrders.length === 0) {
      Alert.alert('Empty Set', 'There are no delivered orders to export for this period.');
      return;
    }

    setDownloading(true);
    try {
      const html = `
        <html>
          <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
            <style>
              body { font-family: 'Helvetica'; padding: 30px; color: #1e293b; }
              .header { text-align: center; border-bottom: 3px solid #ff512f; padding-bottom: 25px; margin-bottom: 40px; }
              .res-name { font-size: 28px; font-weight: bold; color: #ff512f; }
              .title { font-size: 16px; color: #64748b; margin-top: 8px; text-transform: uppercase; letter-spacing: 1px; }
              .stats-row { display: flex; justify-content: space-between; margin-bottom: 40px; }
              .stat-card { flex: 1; padding: 20px; background: #f8fafc; border-radius: 12px; margin: 0 10px; border: 1px solid #e2e8f0; }
              .stat-label { font-size: 10px; color: #64748b; margin-bottom: 5px; text-transform: uppercase; }
              .stat-val { font-size: 18px; font-weight: bold; color: #0f172a; }
              table { width: 100%; border-collapse: collapse; }
              th { text-align: left; border-bottom: 2px solid #f1f5f9; padding: 12px; font-size: 12px; color: #94a3b8; text-transform: uppercase; }
              td { padding: 15px 12px; border-bottom: 1px solid #f1f5f9; font-size: 13px; color: #334155; }
              .amount { font-weight: bold; text-align: right; }
              .footer { margin-top: 60px; text-align: center; font-size: 11px; color: #94a3b8; font-style: italic; }
            </style>
          </head>
          <body>
            <div class="header">
              <div class="res-name">${userData?.restaurantName || 'FoodMenia Partner'}</div>
              <div class="title">Settlement Report • ${TIMEFRAMES.find(t => t.key === timeframe).label}</div>
            </div>

            <div class="stats-row">
              <div class="stat-card">
                <div class="stat-label">Gross Sales</div>
                <div class="stat-val">₹${grossRevenue.toLocaleString()}</div>
              </div>
              <div class="stat-card">
                <div class="stat-label">Platform Fee</div>
                <div class="stat-val">₹${platformFee.toLocaleString()}</div>
              </div>
              <div class="stat-card" style="background: #ecfdf5; border-color: #10b981;">
                <div class="stat-label">Net Payout</div>
                <div class="stat-val" style="color: #10b981;">₹${netProfit.toLocaleString()}</div>
              </div>
            </div>

            <table>
              <thead>
                <tr>
                  <th>Order Details</th>
                  <th>Customer</th>
                  <th style="text-align: right">Amount</th>
                </tr>
              </thead>
              <tbody>
                ${filteredOrders.map(o => `
                  <tr>
                    <td>
                      <div style="font-weight: bold">#${o._id.slice(-8).toUpperCase()}</div>
                      <div style="font-size: 10px; color: #94a3b8">${new Date(o.createdAt).toLocaleDateString()}</div>
                    </td>
                    <td>${o.userName}</td>
                    <td class="amount">₹${o.totalAmount}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>

            <div class="footer">This report is automatically generated for FoodMenia Partners.</div>
          </body>
        </html>
      `;

      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
    } catch (e) {
      Alert.alert('Export Failed', 'Internal error while generating PDF.');
    } finally {
      setDownloading(false);
    }
  };

  const statCards = [
    { label: 'GROSS REVENUE', value: `₹${grossRevenue.toLocaleString()}`, icon: 'payments', color: COLORS.info },
    { label: 'STUDENT DISCOUNTS', value: `₹${totalStudentDiscount.toLocaleString()}`, icon: 'school', color: COLORS.warning },
    { label: 'PLATFORM FEE (5%)', value: `- ₹${platformFee.toLocaleString()}`, icon: 'account-balance', color: COLORS.danger },
  ];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={[COLORS.bgDeep, '#0e0e25']} style={StyleSheet.absoluteFill} />

      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <View>
            <Text style={styles.headerTitle}>Finance</Text>
            <Text style={styles.headerSub}>Payout & settlement status</Text>
          </View>
          <TouchableOpacity 
            style={[styles.exportBtn, downloading && { opacity: 0.6 }]} 
            onPress={handleDownloadInvoice}
            disabled={downloading}
          >
            <LinearGradient colors={['#3b82f6', '#2563eb']} style={styles.exportGradient}>
              {downloading ? <ActivityIndicator size="small" color="#fff" /> : <><Icon name="description" size={18} color="#fff" /><Text style={styles.exportText}>Export</Text></>}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tfScroll} contentContainerStyle={styles.tfContent}>
        {TIMEFRAMES.map((tf) => (
          <TouchableOpacity
            key={tf.key}
            style={[styles.tfChip, timeframe === tf.key && styles.activeTfChip]}
            onPress={() => setTimeframe(tf.key)}
          >
            <Text style={[styles.tfChipText, timeframe === tf.key && { color: '#fff' }]}>{tf.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <View style={styles.centered}><ActivityIndicator size="large" color={COLORS.primary} /></View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollArea} showsVerticalScrollIndicator={false}>
          {/* Top Hero Stat */}
          <View style={styles.heroProfitCard}>
            <LinearGradient colors={[COLORS.success + '20', COLORS.bgSurface]} style={styles.heroProfitInternal} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
              <View>
                <Text style={styles.heroProfitLabel}>Net Business Payout</Text>
                <Text style={styles.heroProfitValue}>₹{netProfit.toLocaleString()}</Text>
              </View>
              <View style={styles.profitIconCircle}>
                 <Icon name="savings" size={32} color={COLORS.success} />
              </View>
            </LinearGradient>
          </View>

          {/* Stat Grid */}
          <View style={styles.summaryGrid}>
            {statCards.map((card, idx) => (
               <View key={idx} style={styles.gridCard}>
                 <View style={[styles.gridIconBox, { backgroundColor: card.color + '15' }]}>
                   <Icon name={card.icon} size={18} color={card.color} />
                 </View>
                 <Text style={styles.gridValue}>{card.value}</Text>
                 <Text style={styles.gridLabel}>{card.label}</Text>
               </View>
            ))}
          </View>

          <View style={styles.historySection}>
            <Text style={styles.sectionTitle}>Transaction History</Text>
            {filteredOrders.length === 0 ? (
              <View style={styles.emptyBox}>
                <Icon name="history" size={48} color={COLORS.textDisabled} />
                <Text style={styles.emptyNote}>No settlements recorded for this period.</Text>
              </View>
            ) : (
              filteredOrders.map((order) => (
                <View key={order._id} style={styles.historyCard}>
                  <View style={styles.histLeft}>
                    <Text style={styles.histId}>#{order._id.slice(-8).toUpperCase()}</Text>
                    <Text style={styles.histUser}>{order.userName}</Text>
                    <Text style={styles.histDate}>{new Date(order.createdAt).toLocaleDateString()}</Text>
                  </View>
                  <View style={styles.histRight}>
                    <Text style={styles.histGross}>₹{order.totalAmount}</Text>
                    <Text style={styles.histNet}>+ ₹{(order.totalAmount * 0.95).toFixed(2)}</Text>
                    {order.studentDiscountApplied && <View style={styles.studPill}><Text style={styles.studPillText}>Student Applied</Text></View>}
                  </View>
                </View>
              ))
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingTop: 60, paddingHorizontal: 24, paddingBottom: 16 },
  headerTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { fontSize: 32, fontWeight: '900', color: '#fff' },
  headerSub: { fontSize: 13, color: COLORS.textMuted, marginTop: 4 },
  exportBtn: { borderRadius: 12, overflow: 'hidden', elevation: 4 },
  exportGradient: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, gap: 6 },
  exportText: { color: '#fff', fontWeight: 'bold', fontSize: 13 },

  tfScroll: { height: 50, marginBottom: 15, flexGrow: 0 },
  tfContent: { paddingHorizontal: 16, paddingBottom: 5, gap: 10, alignItems: 'center' },
  tfChip: { paddingHorizontal: 20, height: 40, borderRadius: 20, backgroundColor: COLORS.bgSurface, borderWidth: 1, borderColor: COLORS.border, justifyContent: 'center' },
  activeTfChip: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  tfChipText: { fontSize: 13, color: COLORS.textMuted, fontWeight: '900' },

  scrollArea: { paddingHorizontal: 16, paddingBottom: 40 },
  heroProfitCard: { backgroundColor: COLORS.bgSurface, borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.success + '30', marginBottom: 20 },
  heroProfitInternal: { padding: 24, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heroProfitLabel: { fontSize: 12, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  heroProfitValue: { fontSize: 36, fontWeight: '900', color: COLORS.success },
  profitIconCircle: { width: 60, height: 60, borderRadius: 30, backgroundColor: COLORS.success + '20', justifyContent: 'center', alignItems: 'center' },

  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 30 },
  gridCard: { flex: 1, minWidth: '45%', backgroundColor: COLORS.bgSurface, borderRadius: 18, padding: 18, borderWidth: 1, borderColor: COLORS.border },
  gridIconBox: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  gridValue: { fontSize: 18, fontWeight: '900', color: '#fff', marginBottom: 4 },
  gridLabel: { fontSize: 10, color: COLORS.textMuted, fontWeight: 'bold' },

  historySection: { marginTop: 10 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#fff', marginBottom: 16 },
  historyCard: { backgroundColor: COLORS.bgCard, borderRadius: 16, padding: 16, marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  histId: { fontSize: 10, color: COLORS.textMuted, fontWeight: 'bold', letterSpacing: 0.5 },
  histUser: { fontSize: 15, fontWeight: 'bold', color: '#fff', marginTop: 4 },
  histDate: { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
  histRight: { alignItems: 'flex-end' },
  histGross: { fontSize: 12, color: COLORS.textMuted, textDecorationLine: 'line-through' },
  histNet: { fontSize: 16, fontWeight: '900', color: COLORS.success, marginTop: 2 },
  studPill: { backgroundColor: COLORS.warning + '15', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginTop: 4 },
  studPillText: { fontSize: 8, color: COLORS.warning, fontWeight: 'bold' },

  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyBox: { alignItems: 'center', marginTop: 50 },
  emptyNote: { color: COLORS.textMuted, fontSize: 14, marginTop: 12 },
});

export default PartnerEarningsScreen;
