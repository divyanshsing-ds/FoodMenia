import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Image,
  Modal,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons as Icon } from '@expo/vector-icons';
import { useCart } from '../services/CartContext';
import { COLORS, RADIUS, SPACING } from '../utils/theme';
import { CONFIG } from '../utils/config';
import { aiAPI } from '../services/api';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48) / 2;

/* ─── Nutrition Modal ─────────────────────────────────── */
const NutritionModal = ({ visible, onClose, item }) => {
  const [loading, setLoading] = useState(false);
  const [nutrition, setNutrition] = useState(null);
  const [error, setError] = useState(null);

  const analyze = async () => {
    setLoading(true);
    setError(null);
    setNutrition(null);
    try {
      const response = await aiAPI.getNutrition(item.name, item.category, item.price);
      if (response.data.success) {
        setNutrition(response.data.data);
      } else {
        setError('Could not analyze nutrition. Try again.');
      }
    } catch (e) {
      setError('AI is busy. Please try again in a moment.');
    } finally {
      setLoading(false);
    }
  };

  // Auto-analyze when modal opens
  React.useEffect(() => {
    if (visible && !nutrition && !loading) {
      analyze();
    }
  }, [visible]);

  const handleClose = () => {
    setNutrition(null);
    setError(null);
    onClose();
  };

  const getHealthColor = (score) => {
    if (score >= 8) return COLORS.success;
    if (score >= 5) return COLORS.amber;
    return COLORS.danger;
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <View style={ns.overlay}>
        <View style={ns.sheet}>
          <LinearGradient colors={['#0e0e25', COLORS.bgDeep]} style={StyleSheet.absoluteFill} />

          {/* Header */}
          <View style={ns.header}>
            <View style={ns.titleRow}>
              <LinearGradient colors={[COLORS.primary, COLORS.secondary]} style={ns.aiChip}>
                <Icon name="psychology" size={14} color="white" />
                <Text style={ns.aiChipText}>AI Analysis</Text>
              </LinearGradient>
              <TouchableOpacity onPress={handleClose} style={ns.closeBtn}>
                <Icon name="close" size={22} color={COLORS.textMuted} />
              </TouchableOpacity>
            </View>
            <Text style={ns.itemName}>{item?.name}</Text>
            <Text style={ns.itemCat}>{item?.category} · ₹{item?.price}</Text>
          </View>

          <ScrollView contentContainerStyle={ns.body} showsVerticalScrollIndicator={false}>
            {loading && (
              <View style={ns.loadingBox}>
                <ActivityIndicator color={COLORS.primary} size="large" />
                <Text style={ns.loadingText}>Analyzing nutrition with AI...</Text>
              </View>
            )}

            {error && (
              <View style={ns.errorBox}>
                <Icon name="error-outline" size={32} color={COLORS.danger} />
                <Text style={ns.errorText}>{error}</Text>
                <TouchableOpacity style={ns.retryBtn} onPress={analyze}>
                  <Text style={ns.retryText}>Try Again</Text>
                </TouchableOpacity>
              </View>
            )}

            {nutrition && (
              <>
                {/* Health Score */}
                <View style={ns.scoreCard}>
                  <Text style={ns.scoreLabel}>Health Score</Text>
                  <View style={[ns.scoreCircle, { borderColor: getHealthColor(nutrition.healthScore) }]}>
                    <Text style={[ns.scoreNumber, { color: getHealthColor(nutrition.healthScore) }]}>
                      {nutrition.healthScore}
                    </Text>
                    <Text style={ns.scoreMax}>/10</Text>
                  </View>
                </View>

                {/* Calories Banner */}
                <LinearGradient
                  colors={[`${COLORS.primary}20`, `${COLORS.secondary}10`]}
                  style={ns.calBanner}
                >
                  <Text style={ns.calLabel}>Est. Calories</Text>
                  <Text style={ns.calValue}>{nutrition.calories}</Text>
                </LinearGradient>

                {/* Macros Grid */}
                <View style={ns.macrosGrid}>
                  {[
                    { label: 'Protein', value: nutrition.protein, icon: 'fitness-center', color: '#3b82f6' },
                    { label: 'Carbs', value: nutrition.carbs, icon: 'grain', color: '#f59e0b' },
                    { label: 'Fat', value: nutrition.fat, icon: 'opacity', color: '#ef4444' },
                    { label: 'Fiber', value: nutrition.fiber, icon: 'eco', color: COLORS.success },
                  ].map(({ label, value, icon, color }) => (
                    <View key={label} style={ns.macroCard}>
                      <View style={[ns.macroIcon, { backgroundColor: `${color}20` }]}>
                        <Icon name={icon} size={16} color={color} />
                      </View>
                      <Text style={ns.macroValue}>{value}</Text>
                      <Text style={ns.macroLabel}>{label}</Text>
                    </View>
                  ))}
                </View>

                {/* Tip */}
                {nutrition.tip && (
                  <View style={ns.tipBox}>
                    <Icon name="lightbulb-outline" size={18} color={COLORS.amber} />
                    <Text style={ns.tipText}>{nutrition.tip}</Text>
                  </View>
                )}

                {/* Allergens */}
                {nutrition.allergens?.length > 0 && (
                  <View style={ns.allergenBox}>
                    <Text style={ns.allergenTitle}>
                      <Icon name="warning" size={13} color={COLORS.warning} /> Possible Allergens
                    </Text>
                    <View style={ns.allergenRow}>
                      {nutrition.allergens.map(a => (
                        <View key={a} style={ns.allergenChip}>
                          <Text style={ns.allergenChipText}>{a}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                <Text style={ns.disclaimer}>* Estimates generated by AI. Individual values may vary.</Text>
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const ns = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    maxHeight: '85%',
    minHeight: 300,
  },
  header: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  aiChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 4,
  },
  aiChipText: { fontSize: 11, fontWeight: '800', color: 'white' },
  closeBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: COLORS.bgCard,
    justifyContent: 'center', alignItems: 'center',
  },
  itemName: { fontSize: 20, fontWeight: '900', color: COLORS.textPrimary },
  itemCat: { fontSize: 13, color: COLORS.textMuted, marginTop: 4 },
  body: { padding: 20, paddingBottom: 40 },
  loadingBox: { alignItems: 'center', paddingVertical: 40 },
  loadingText: { color: COLORS.textMuted, marginTop: 14, fontSize: 14 },
  errorBox: { alignItems: 'center', paddingVertical: 30 },
  errorText: { color: COLORS.textSecondary, marginTop: 10, textAlign: 'center' },
  retryBtn: {
    marginTop: 16,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 20, paddingVertical: 10,
    borderRadius: RADIUS.md,
  },
  retryText: { color: 'white', fontWeight: '700' },
  scoreCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.bgSurface,
    borderRadius: RADIUS.md,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1, borderColor: COLORS.border,
  },
  scoreLabel: { fontSize: 15, fontWeight: '700', color: COLORS.textSecondary },
  scoreCircle: {
    width: 56, height: 56, borderRadius: 28,
    borderWidth: 3,
    justifyContent: 'center', alignItems: 'center',
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  scoreNumber: { fontSize: 22, fontWeight: '900' },
  scoreMax: { fontSize: 12, color: COLORS.textMuted, marginLeft: 1 },
  calBanner: {
    borderRadius: RADIUS.md,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: `${COLORS.primary}30`,
  },
  calLabel: { fontSize: 14, color: COLORS.textSecondary, fontWeight: '600' },
  calValue: { fontSize: 24, fontWeight: '900', color: COLORS.textPrimary },
  macrosGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 14,
  },
  macroCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: COLORS.bgSurface,
    borderRadius: RADIUS.md,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.border,
  },
  macroIcon: {
    width: 34, height: 34, borderRadius: 17,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 8,
  },
  macroValue: { fontSize: 18, fontWeight: '900', color: COLORS.textPrimary },
  macroLabel: { fontSize: 11, color: COLORS.textMuted, marginTop: 3, fontWeight: '600' },
  tipBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: `${COLORS.amber}12`,
    borderRadius: RADIUS.md,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1, borderColor: `${COLORS.amber}30`,
    gap: 10,
  },
  tipText: { flex: 1, fontSize: 13, color: COLORS.textSecondary, lineHeight: 19 },
  allergenBox: {
    backgroundColor: `${COLORS.warning}10`,
    borderRadius: RADIUS.md,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1, borderColor: `${COLORS.warning}25`,
  },
  allergenTitle: { fontSize: 12, fontWeight: '700', color: COLORS.warning, marginBottom: 8 },
  allergenRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  allergenChip: {
    backgroundColor: COLORS.bgCard,
    borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: COLORS.border,
  },
  allergenChipText: { fontSize: 11, color: COLORS.textSecondary },
  disclaimer: { fontSize: 10, color: COLORS.textDisabled, textAlign: 'center' },
});

/* ─── Main Card ──────────────────────────────────────── */
const MenuItemCard = ({ item }) => {
  const [quantity, setQuantity] = useState(1);
  const [showNutrition, setShowNutrition] = useState(false);
  const { addToCart } = useCart();

  const incrementQty = () => setQuantity(prev => prev + 1);
  const decrementQty = () => setQuantity(prev => Math.max(1, prev - 1));

  const handleAddToCart = () => {
    addToCart(item, quantity);
  };

  const getFoodTypeColor = (type) => {
    if (type === 'veg') return COLORS.success;
    if (type === 'non-veg') return COLORS.danger;
    return COLORS.warning;
  };

  const imageUrl = item.image ? `${CONFIG.UPLOADS_BASE}${item.image}` : null;

  return (
    <View style={styles.cardContainer}>
      <TouchableOpacity style={styles.card} activeOpacity={0.95}>
        <View style={[styles.foodTypeDot, { backgroundColor: getFoodTypeColor(item.foodType) }]} />

        {item.isBestSeller && (
          <LinearGradient
            colors={['#f09819', '#ff512f']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.bestSellerBadge}
          >
            <Text style={styles.badgeText}>🔥 BEST SELLER</Text>
          </LinearGradient>
        )}

        {/* AI Nutrition Button */}
        <TouchableOpacity style={styles.aiBtn} onPress={() => setShowNutrition(true)}>
          <LinearGradient colors={[COLORS.primary, COLORS.secondary]} style={styles.aiBtnGrad}>
            <Icon name="psychology" size={13} color="white" />
          </LinearGradient>
        </TouchableOpacity>

        <View style={styles.imageContainer}>
          {imageUrl ? (
            <Image source={{ uri: imageUrl }} style={styles.image} />
          ) : (
            <Text style={styles.imagePlaceholder}>{item.name[0]}</Text>
          )}
        </View>

        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
          <View style={styles.ratingRow}>
            <Text style={styles.rating}>★ {item.averageRating || 'New'}</Text>
            {item.ratings?.length > 0 && <Text style={styles.reviews}>({item.ratings.length})</Text>}
          </View>
          <Text style={styles.desc} numberOfLines={1}>{item.description || 'Tasty & Delicious'}</Text>

          <View style={styles.footer}>
            <Text style={styles.price}>₹{item.price}</Text>
            <View style={styles.qtyContainer}>
              <TouchableOpacity style={styles.qtyBtn} onPress={decrementQty}>
                <Text style={styles.qtyText}>-</Text>
              </TouchableOpacity>
              <Text style={styles.qty}>{quantity}</Text>
              <TouchableOpacity style={styles.qtyBtn} onPress={incrementQty}>
                <Text style={styles.qtyText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <TouchableOpacity onPress={handleAddToCart} activeOpacity={0.8}>
          <LinearGradient
            colors={['#ff512f', '#dd2476']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.addBtn}
          >
            <Text style={styles.addText}>Add to Cart</Text>
          </LinearGradient>
        </TouchableOpacity>
      </TouchableOpacity>

      {/* Nutrition Modal */}
      <NutritionModal
        visible={showNutrition}
        onClose={() => setShowNutrition(false)}
        item={item}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    margin: 8,
    flex: 1,
    maxWidth: CARD_WIDTH,
  },
  card: {
    backgroundColor: COLORS.bgSurface,
    borderRadius: RADIUS.lg,
    padding: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  foodTypeDot: {
    position: 'absolute',
    top: 10,
    left: 10,
    width: 10,
    height: 10,
    borderRadius: 5,
    zIndex: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  aiBtn: {
    position: 'absolute',
    top: 8,
    left: 24,
    zIndex: 12,
  },
  aiBtnGrad: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bestSellerBadge: {
    position: 'absolute',
    top: 8,
    right: 0,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderTopLeftRadius: RADIUS.sm,
    borderBottomLeftRadius: RADIUS.sm,
    zIndex: 10,
  },
  badgeText: { fontSize: 8, color: 'white', fontWeight: '900' },
  imageContainer: {
    width: '100%',
    height: 120,
    borderTopLeftRadius: RADIUS.md,
    borderTopRightRadius: RADIUS.md,
    backgroundColor: COLORS.bgCard,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.sm,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  imagePlaceholder: {
    fontSize: 40,
    fontWeight: 'bold',
    color: 'rgba(255,255,255,0.1)',
  },
  info: { paddingHorizontal: 2 },
  name: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginBottom: 4,
    letterSpacing: 0.2,
  },
  ratingRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  rating: { fontSize: 13, fontWeight: 'bold', color: COLORS.amber },
  reviews: { fontSize: 11, color: COLORS.textMuted, marginLeft: 4 },
  desc: { fontSize: 11, color: COLORS.textMuted, marginBottom: 12 },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  price: { fontSize: 18, fontWeight: '900', color: COLORS.textPrimary },
  qtyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  qtyBtn: { padding: 4, paddingHorizontal: 8 },
  qtyText: { fontSize: 16, fontWeight: 'bold', color: COLORS.textPrimary },
  qty: { fontSize: 14, fontWeight: 'bold', color: COLORS.textPrimary, minWidth: 20, textAlign: 'center' },
  addBtn: {
    paddingVertical: 10,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  addText: { color: 'white', fontWeight: 'bold', fontSize: 13, textTransform: 'uppercase' },
});

export default MenuItemCard;