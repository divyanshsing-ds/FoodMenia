import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity, StatusBar,
  TextInput, Alert, Modal, ScrollView, ActivityIndicator, Image,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons as Icon } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { menuAPI } from '../services/api';
import { COLORS, RADIUS, SPACING } from '../utils/theme';
import { CONFIG } from '../utils/config';

const CATEGORIES = ['Starter', 'Main Course', 'Dessert', 'Beverage', 'Snacks', 'General'];

const PartnerMenuScreen = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [editModal, setEditModal] = useState({ show: false, item: null });
  const [form, setForm] = useState({ 
    name: '', 
    description: '', 
    price: '', 
    category: 'General', 
    foodType: 'veg',
    image: null 
  });

  const [reviewPanel, setReviewPanel] = useState({ show: false, item: null });
  const [replyText, setReplyText] = useState({});

  const fetchMenu = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await menuAPI.getMyMenu();
      if (res.data.success) setItems(res.data.data);
    } catch (e) {
      console.error('Menu fetch error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { fetchMenu(); }, [fetchMenu]));

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled) {
      setForm({ ...form, image: result.assets[0].uri });
    }
  };

  const openAdd = () => {
    setForm({ name: '', description: '', price: '', category: 'General', foodType: 'veg', image: null });
    setEditModal({ show: true, item: null });
  };

  const openEdit = (item) => {
    setForm({
      name: item.name,
      description: item.description || '',
      price: item.price.toString(),
      category: item.category || 'General',
      foodType: item.foodType || 'veg',
      image: item.image ? `${CONFIG.UPLOADS_BASE}/${item.image}` : null,
    });
    setEditModal({ show: true, item });
  };

  const handleSave = async () => {
    if (!form.name || !form.price) {
      Alert.alert('Missing Fields', 'Please enter at least a name and price.');
      return;
    }
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('name', form.name);
      fd.append('description', form.description);
      fd.append('price', form.price);
      fd.append('category', form.category);
      fd.append('foodType', form.foodType);

      if (form.image && form.image.startsWith('file://')) {
        const filename = form.image.split('/').pop();
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : `image`;
        fd.append('image', { uri: form.image, name: filename, type });
      }

      let res;
      if (editModal.item) {
        res = await menuAPI.updateMenuItem(editModal.item._id, fd);
      } else {
        res = await menuAPI.addMenuItem(fd);
      }

      if (res.data.success) {
        setEditModal({ show: false, item: null });
        fetchMenu(true);
      }
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Could not save the item. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (id) => {
    Alert.alert('Delete Item?', 'This item will be permanently removed.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await menuAPI.deleteMenuItem(id); fetchMenu(true); } catch { Alert.alert('Error', 'Failed to delete'); }
      }}
    ]);
  };

  const handleToggleBestSeller = async (id) => {
    try {
      const res = await menuAPI.toggleBestSeller(id);
      if (res.data.success) {
        setItems(prev => prev.map(it => it._id === id ? { ...it, isBestSeller: !it.isBestSeller } : it));
      }
    } catch (e) {
      Alert.alert('Error', 'Action failed');
    }
  };

  const handleReplyRating = async (itemId, ratingId) => {
    const text = replyText[ratingId];
    if (!text?.trim()) return;
    try {
      const res = await menuAPI.replyRating(itemId, ratingId, text);
      if (res.data.success) {
        setReplyText(p => { const n = { ...p }; delete n[ratingId]; return n; });
        fetchMenu(true);
        if (reviewPanel.item) {
          const updatedRatings = reviewPanel.item.ratings.map(r =>
            r._id === ratingId ? { ...r, replies: [...(r.replies || []), res.data.data] } : r
          );
          setReviewPanel({ ...reviewPanel, item: { ...reviewPanel.item, ratings: updatedRatings } });
        }
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to send reply');
    }
  };

  const renderItem = ({ item }) => {
    const avgRating = item.ratings?.length
      ? (item.ratings.reduce((s, r) => s + r.rating, 0) / item.ratings.length).toFixed(1)
      : null;

    const imgUri = item.image ? `${CONFIG.UPLOADS_BASE}/${item.image}` : null;

    return (
      <View style={styles.menuCard}>
        <View style={styles.cardInfo}>
          <View style={styles.nameRow}>
            <View style={[styles.typeIndicator, { borderColor: item.foodType === 'veg' ? '#10b981' : '#ef4444' }]}>
              <View style={[styles.typeDot, { backgroundColor: item.foodType === 'veg' ? '#10b981' : '#ef4444' }]} />
            </View>
            <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
          </View>
          <Text style={styles.itemCategory}>{item.category}</Text>
          <View style={styles.priceContainer}>
             <Text style={styles.currency}>₹</Text>
             <Text style={styles.itemPrice}>{item.price}</Text>
          </View>
          {avgRating && (
            <TouchableOpacity style={styles.ratingBox} onPress={() => setReviewPanel({ show: true, item })}>
              <Icon name="star" size={14} color={COLORS.amber} />
              <Text style={styles.ratingText}>{avgRating} ({item.ratings.length} Reviews)</Text>
            </TouchableOpacity>
          )}
        </View>

        {imgUri ? (
          <Image source={{ uri: imgUri }} style={styles.itemThumb} />
        ) : (
          <View style={[styles.itemThumb, styles.itemPlaceholder]}>
            <Icon name="image" size={24} color={COLORS.textDisabled} />
          </View>
        )}

        <View style={styles.cardActions}>
          <TouchableOpacity 
            style={[styles.actionIconButton, item.isBestSeller && styles.activeBestSeller]} 
            onPress={() => handleToggleBestSeller(item._id)}
          >
            <Icon name={item.isBestSeller ? 'star' : 'star-outline'} size={18} color={item.isBestSeller ? '#fff' : COLORS.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionIconButton} onPress={() => openEdit(item)}>
            <Icon name="edit" size={18} color={COLORS.info} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionIconButton} onPress={() => handleDelete(item._id)}>
            <Icon name="delete-outline" size={18} color={COLORS.danger} />
          </TouchableOpacity>
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
          <Text style={styles.headerTitle}>Menu Builder</Text>
          <Text style={styles.headerSub}>{items.length} items active</Text>
        </View>
        <TouchableOpacity style={styles.addBtnContainer} onPress={openAdd}>
          <LinearGradient colors={['#7c3aed', '#a855f7']} style={styles.addGradient}>
            <Icon name="add" size={24} color="#fff" />
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {loading && !refreshing ? (
        <View style={styles.centered}><ActivityIndicator size="large" color={COLORS.primary} /></View>
      ) : (
        <FlatList
          data={items}
          renderItem={renderItem}
          keyExtractor={(i) => i._id}
          contentContainerStyle={styles.listContainer}
          onRefresh={() => fetchMenu(true)}
          refreshing={refreshing}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Icon name="restaurant" size={60} color={COLORS.textDisabled} />
              <Text style={styles.emptyText}>Start building your digital menu</Text>
              <TouchableOpacity style={styles.emptyAddBtn} onPress={openAdd}>
                 <Text style={styles.emptyAddText}>Add First Item</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}

      {/* Edit Item Modal */}
      <Modal visible={editModal.show} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
           <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                 <Text style={styles.modalTitle}>{editModal.item ? 'Modify Item' : 'New Dish'}</Text>
                 <TouchableOpacity onPress={() => setEditModal({ show: false })}>
                    <Icon name="close" size={22} color="#fff" />
                 </TouchableOpacity>
              </View>
              
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 }}>
                 
                 <TouchableOpacity style={styles.imagePicker} onPress={pickImage}>
                    {form.image ? (
                      <Image source={{ uri: form.image }} style={styles.formImage} />
                    ) : (
                      <View style={styles.imagePickerInner}>
                        <Icon name="add-a-photo" size={32} color={COLORS.textDisabled} />
                        <Text style={styles.imagePickerText}>Upload Dish Photo</Text>
                      </View>
                    )}
                 </TouchableOpacity>

                 <Text style={styles.inputLabel}>Dish Name</Text>
                 <TextInput 
                   style={styles.textInput} 
                   value={form.name} 
                   onChangeText={v => setForm({ ...form, name: v })} 
                   placeholder="e.g. Garlic Naan" 
                   placeholderTextColor={COLORS.textDisabled}
                 />

                 <View style={styles.inputRow}>
                   <View style={{ flex: 1 }}>
                     <Text style={styles.inputLabel}>Price (₹)</Text>
                     <TextInput 
                       style={styles.textInput} 
                       value={form.price} 
                       onChangeText={v => setForm({ ...form, price: v })} 
                       keyboardType="numeric" 
                       placeholder="0.00" 
                       placeholderTextColor={COLORS.textDisabled}
                     />
                   </View>
                   <View style={{ flex: 1, marginLeft: 16 }}>
                     <Text style={styles.inputLabel}>Type</Text>
                     <View style={styles.typeSelectorRow}>
                        <TouchableOpacity 
                          style={[styles.typeBtn, form.foodType === 'veg' && styles.typeBtnVeg]} 
                          onPress={() => setForm({ ...form, foodType: 'veg' })}
                        >
                          <Text style={[styles.typeBtnText, form.foodType === 'veg' && { color: '#fff' }]}>Veg</Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                          style={[styles.typeBtn, form.foodType === 'non-veg' && styles.typeBtnNon]} 
                          onPress={() => setForm({ ...form, foodType: 'non-veg' })}
                        >
                          <Text style={[styles.typeBtnText, form.foodType === 'non-veg' && { color: '#fff' }]}>Non-Veg</Text>
                        </TouchableOpacity>
                     </View>
                   </View>
                 </View>

                 <Text style={styles.inputLabel}>Category</Text>
                 <View style={styles.chipGrid}>
                    {CATEGORIES.map(c => (
                      <TouchableOpacity 
                        key={c} 
                        style={[styles.chip, form.category === c && styles.activeChip]} 
                        onPress={() => setForm({ ...form, category: c })}
                      >
                         <Text style={[styles.chipText, form.category === c && { color: '#fff' }]}>{c}</Text>
                      </TouchableOpacity>
                    ))}
                 </View>

                 <Text style={styles.inputLabel}>Short Description</Text>
                 <TextInput 
                    style={[styles.textInput, { height: 70, textAlignVertical: 'top' }]} 
                    value={form.description} 
                    onChangeText={v => setForm({ ...form, description: v })} 
                    placeholder="Brief ingredients or dish summary..." 
                    placeholderTextColor={COLORS.textDisabled}
                    multiline
                 />

                 <TouchableOpacity style={styles.submitBtn} onPress={handleSave} disabled={loading}>
                    <LinearGradient colors={['#7c3aed', '#a855f7']} style={styles.submitGradient}>
                       {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Publish Item</Text>}
                    </LinearGradient>
                 </TouchableOpacity>
              </ScrollView>
           </View>
        </View>
      </Modal>

      {/* Reviews Panel */}
      <Modal visible={reviewPanel.show} animationType="fade" transparent>
        <View style={styles.modalBackdrop}>
           <View style={[styles.modalContent, { height: '80%' }]}>
              <View style={styles.modalHeader}>
                 <Text style={styles.modalTitle}>Reviews: {reviewPanel.item?.name}</Text>
                 <TouchableOpacity onPress={() => setReviewPanel({ show: false })}>
                    <Icon name="close" size={22} color="#fff" />
                 </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false}>
                 {reviewPanel.item?.ratings?.map((r, i) => (
                    <View key={i} style={styles.revCard}>
                       <View style={styles.revHeader}>
                          <Text style={styles.revUser}>{r.userName}</Text>
                          <Text style={styles.revStars}>{'★'.repeat(r.rating)}{'☆'.repeat(5-r.rating)}</Text>
                       </View>
                       <Text style={styles.revText}>{r.comment || "No comment left."}</Text>
                       
                       {r.replies?.map((rep, ri) => (
                          <View key={ri} style={styles.replyBubble}>
                             <Text style={styles.replySender}>Merchant Reply:</Text>
                             <Text style={styles.replyMsg}>{rep.text}</Text>
                          </View>
                       ))}

                       <View style={styles.replyInputArea}>
                          <TextInput 
                            style={styles.replyInput} 
                            placeholder="Type a response..." 
                            placeholderTextColor={COLORS.textMuted}
                            value={replyText[r._id] || ''}
                            onChangeText={v => setReplyText({ ...replyText, [r._id]: v })}
                          />
                          <TouchableOpacity 
                            style={styles.replySendBtn} 
                            onPress={() => handleReplyRating(reviewPanel.item._id, r._id)}
                          >
                             <Icon name="send" size={16} color="#fff" />
                          </TouchableOpacity>
                       </View>
                    </View>
                 ))}
                 {!reviewPanel.item?.ratings?.length && (
                    <Text style={styles.noRevText}>No ratings for this item yet.</Text>
                 )}
              </ScrollView>
           </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingTop: 60, paddingHorizontal: 24, paddingBottom: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { fontSize: 28, fontWeight: '900', color: '#fff' },
  headerSub: { fontSize: 13, color: COLORS.textMuted, marginTop: 2 },
  addBtnContainer: { width: 50, height: 50, borderRadius: 15, overflow: 'hidden', elevation: 4 },
  addGradient: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  listContainer: { paddingHorizontal: 16, paddingBottom: 40 },
  menuCard: { backgroundColor: COLORS.bgSurface, borderRadius: RADIUS.lg, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: COLORS.border, flexDirection: 'row', alignItems: 'center' },
  cardInfo: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  typeIndicator: { width: 14, height: 14, borderWidth: 1.5, borderRadius: 2, justifyContent: 'center', alignItems: 'center' },
  typeDot: { width: 6, height: 6, borderRadius: 3 },
  itemName: { fontSize: 16, fontWeight: 'bold', color: '#fff' },
  itemCategory: { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
  priceContainer: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 8 },
  currency: { fontSize: 12, color: COLORS.primary, fontWeight: 'bold', marginTop: 2, marginRight: 2 },
  itemPrice: { fontSize: 20, fontWeight: '900', color: '#fff' },
  ratingBox: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  ratingText: { fontSize: 10, color: COLORS.amber, fontWeight: 'bold' },

  itemThumb: { width: 70, height: 70, borderRadius: 12, marginLeft: 16 },
  itemPlaceholder: { backgroundColor: COLORS.bgCard, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },

  cardActions: { gap: 6, marginLeft: 16 },
  actionIconButton: { width: 38, height: 38, borderRadius: 10, backgroundColor: COLORS.bgCard, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  activeBestSeller: { backgroundColor: COLORS.amber, borderColor: COLORS.amber },

  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyContainer: { flex: 1, alignItems: 'center', marginTop: 100, paddingHorizontal: 40 },
  emptyText: { color: COLORS.textMuted, fontSize: 15, textAlign: 'center', marginTop: 16 },
  emptyAddBtn: { marginTop: 20, backgroundColor: COLORS.primary + '20', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: COLORS.primary },
  emptyAddText: { color: COLORS.primary, fontWeight: 'bold' },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: COLORS.bgSurface, borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 24, paddingBottom: 0, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  
  imagePicker: { width: '100%', height: 160, backgroundColor: COLORS.bgCard, borderRadius: 15, marginBottom: 12, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.border, borderStyle: 'dashed' },
  imagePickerInner: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  imagePickerText: { color: COLORS.textDisabled, fontSize: 12, marginTop: 8, fontWeight: 'bold' },
  formImage: { width: '100%', height: '100%' },

  inputLabel: { fontSize: 11, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8, marginTop: 12 },
  textInput: { backgroundColor: COLORS.bgCard, borderRadius: 12, padding: 14, color: '#fff', fontSize: 14, borderWidth: 1, borderColor: COLORS.border },
  inputRow: { flexDirection: 'row', alignItems: 'center' },
  typeSelectorRow: { flexDirection: 'row', backgroundColor: COLORS.bgCard, borderRadius: 8, padding: 4, gap: 4 },
  typeBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 6 },
  typeBtnText: { fontSize: 11, color: COLORS.textDisabled, fontWeight: 'bold' },
  typeBtnVeg: { backgroundColor: '#10b981' },
  typeBtnNon: { backgroundColor: '#ef4444' },

  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border },
  activeChip: { backgroundColor: '#7c3aed', borderColor: '#7c3aed' },
  chipText: { fontSize: 11, color: COLORS.textMuted },

  submitBtn: { marginTop: 24, borderRadius: 15, overflow: 'hidden', elevation: 4 },
  submitGradient: { paddingVertical: 16, alignItems: 'center' },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },

  revCard: { backgroundColor: COLORS.bgCard, borderRadius: 15, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: COLORS.border },
  revHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  revUser: { fontSize: 14, fontWeight: 'bold', color: '#fff' },
  revStars: { fontSize: 12, color: COLORS.amber },
  revText: { fontSize: 13, color: COLORS.textSecondary, marginBottom: 12 },
  replyBubble: { backgroundColor: COLORS.bgSurface, padding: 10, borderRadius: 10, borderLeftWidth: 3, borderLeftColor: COLORS.info, marginBottom: 8 },
  replySender: { fontSize: 10, color: COLORS.info, fontWeight: 'bold', marginBottom: 2 },
  replyMsg: { fontSize: 12, color: COLORS.textSecondary },
  replyInputArea: { flexDirection: 'row', gap: 8, marginTop: 6 },
  replyInput: { flex: 1, backgroundColor: COLORS.bgSurface, borderRadius: 8, paddingHorizontal: 12, fontSize: 12, color: '#fff', borderWidth: 1, borderColor: COLORS.border },
  replySendBtn: { width: 36, height: 36, borderRadius: 8, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center' },
  noRevText: { color: COLORS.textMuted, textAlign: 'center', marginVertical: 30 },
});

export default PartnerMenuScreen;
