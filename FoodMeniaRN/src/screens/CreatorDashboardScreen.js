import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar, FlatList,
  Alert, Modal, TextInput, ScrollView, ActivityIndicator, Pressable,
} from 'react-native';
import { Video } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons as Icon } from '@expo/vector-icons';
import { videoAPI, authAPI, aiAPI } from '../services/api';
import { COLORS, RADIUS } from '../utils/theme';
import { CONFIG } from '../utils/config';

const videoUrl = (url) => (url?.startsWith('http') ? url : `${CONFIG.API_BASE.replace('/api', '')}${url}`);

const CreatorDashboardScreen = () => {
  const [reels, setReels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [restaurants, setRestaurants] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Upload form
  const [showUpload, setShowUpload] = useState(false);
  const [uploadForm, setUploadForm] = useState({ title: '', description: '', restaurantId: '' });
  const [videoFile, setVideoFile] = useState(null);
  const [generatingDesc, setGeneratingDesc] = useState(false);

  // Edit modal
  const [editReel, setEditReel] = useState(null);
  const [editSaving, setEditSaving] = useState(false);

  // Followers
  const [followers] = useState([]);

  useFocusEffect(
    useCallback(() => {
      fetchReels();
      fetchRestaurants();
    }, [])
  );

  const fetchReels = async () => {
    setLoading(true);
    try {
      const res = await videoAPI.getMyReels();
      if (res.data.success) setReels(res.data.data);
    } catch (e) { console.error('Fetch reels:', e); }
    finally { setLoading(false); }
  };

  const fetchRestaurants = async () => {
    try {
      const res = await authAPI.getOperators();
      if (res.data.success) setRestaurants(res.data.data);
    } catch { /* ignore */ }
  };

  const pickVideo = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission', 'Camera roll access is needed.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      allowsEditing: false,
      quality: 1,
    });
    if (!result.canceled) {
      const asset = result.assets[0];
      setVideoFile({ uri: asset.uri, name: asset.fileName || 'reel.mp4', type: 'video/mp4' });
    }
  };

  const handleGenerateDesc = async (isEdit = false) => {
    const title = isEdit ? editReel?.title : uploadForm.title;
    if (!title?.trim()) {
      Alert.alert('Tip', 'Enter a title first for best AI results');
      return;
    }
    setGeneratingDesc(true);
    try {
      const prompt = `Write a captivating short food reel description (2-3 sentences) for a video titled: "${title}". Make it engaging, mouth-watering, and social-media friendly.`;
      const res = await aiAPI.chat(prompt);
      const desc = res.data?.reply || res.data?.message || '';
      if (isEdit) {
        setEditReel((p) => ({ ...p, description: desc }));
      } else {
        setUploadForm((p) => ({ ...p, description: desc }));
      }
    } catch { Alert.alert('Error', 'AI generation failed'); }
    finally { setGeneratingDesc(false); }
  };

  const handleUpload = async () => {
    if (!videoFile) { Alert.alert('Error', 'Please select a video first'); return; }
    if (!uploadForm.title.trim()) { Alert.alert('Error', 'Title is required'); return; }
    setUploading(true);
    setUploadProgress(0);
    try {
      const fd = new FormData();
      fd.append('title', uploadForm.title);
      fd.append('description', uploadForm.description);
      if (uploadForm.restaurantId) fd.append('restaurantId', uploadForm.restaurantId);
      fd.append('video', { uri: videoFile.uri, name: videoFile.name, type: videoFile.type });
      await videoAPI.uploadReel(fd, (e) => {
        setUploadProgress(Math.round((e.loaded / e.total) * 100));
      });
      Alert.alert('🎉 Published!', 'Your reel is now live!');
      setShowUpload(false);
      setVideoFile(null);
      setUploadForm({ title: '', description: '', restaurantId: '' });
      fetchReels();
    } catch (e) {
      Alert.alert('Error', 'Upload failed. Please try again.');
      console.error('Upload error:', e.response?.data || e.message);
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDelete = (id) => {
    Alert.alert('Delete Reel', 'This will permanently remove your reel.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            const res = await videoAPI.deleteReel(id);
            if (res.data.success) setReels((p) => p.filter((r) => r._id !== id));
          } catch { Alert.alert('Error', 'Delete failed'); }
        },
      },
    ]);
  };

  const handleEditSave = async () => {
    if (!editReel.title.trim()) return;
    setEditSaving(true);
    try {
      const res = await videoAPI.updateReel(editReel._id, {
        title: editReel.title,
        description: editReel.description,
      });
      if (res.data.success) {
        setReels((p) =>
          p.map((r) =>
            r._id === editReel._id ? { ...r, title: editReel.title, description: editReel.description } : r
          )
        );
        setEditReel(null);
      }
    } catch { Alert.alert('Error', 'Could not save changes'); }
    finally { setEditSaving(false); }
  };

  const renderReel = ({ item }) => (
    <View style={styles.reelCard}>
      <Video
        source={{ uri: videoUrl(item.videoUrl) }}
        style={styles.reelThumb}
        resizeMode="cover"
        shouldPlay={false}
        isMuted
      />
      <View style={styles.reelBody}>
        <Text style={styles.reelTitle} numberOfLines={2}>{item.title}</Text>
        {item.restaurantId?.restaurantName && (
          <Text style={styles.reelRestaurant}>🏪 {item.restaurantId.restaurantName}</Text>
        )}
        {item.description ? (
          <Text style={styles.reelDesc} numberOfLines={2}>{item.description}</Text>
        ) : null}
        <View style={styles.reelStats}>
          <Text style={styles.statPill}>❤️ {item.likedBy?.length || 0}</Text>
          <Text style={styles.statPill}>💬 {item.comments?.length || 0}</Text>
          <Text style={styles.statPill}>👁️ {item.views || 0}</Text>
        </View>
        <View style={styles.reelActions}>
          <TouchableOpacity
            style={styles.editBtn}
            onPress={() => setEditReel({ _id: item._id, title: item.title, description: item.description || '' })}
          >
            <Icon name="edit" size={18} color={COLORS.info} />
            <Text style={[styles.actionText, { color: COLORS.info }]}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(item._id)}>
            <Icon name="delete-outline" size={18} color={COLORS.danger} />
            <Text style={[styles.actionText, { color: COLORS.danger }]}>Delete</Text>
          </TouchableOpacity>
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
          <Text style={styles.headerTitle}>My Reels</Text>
          <Text style={styles.headerSub}>{reels.length} reel{reels.length !== 1 ? 's' : ''}</Text>
        </View>
        <TouchableOpacity style={styles.uploadToggleBtn} onPress={() => setShowUpload((v) => !v)}>
          <LinearGradient colors={[COLORS.primary, COLORS.secondary]} style={styles.uploadGradient}>
            <Icon name={showUpload ? 'close' : 'add'} size={22} color="#fff" />
            <Text style={styles.uploadBtnText}>{showUpload ? 'Cancel' : 'New Reel'}</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Upload Form */}
      {showUpload && (
        <View style={styles.uploadForm}>
          <TouchableOpacity style={styles.videoPickBtn} onPress={pickVideo}>
            <Icon name={videoFile ? 'check-circle' : 'video-call'} size={28} color={videoFile ? COLORS.success : COLORS.primary} />
            <Text style={[styles.videoPickText, videoFile && { color: COLORS.success }]}>
              {videoFile ? `✅ ${videoFile.name}` : 'Tap to select video'}
            </Text>
          </TouchableOpacity>

          <TextInput
            style={styles.input}
            value={uploadForm.title}
            onChangeText={(v) => setUploadForm({ ...uploadForm, title: v })}
            placeholder="Reel Title *"
            placeholderTextColor={COLORS.textMuted}
          />

          <View style={styles.descRow}>
            <TextInput
              style={[styles.input, { flex: 1, height: 80, textAlignVertical: 'top' }]}
              value={uploadForm.description}
              onChangeText={(v) => setUploadForm({ ...uploadForm, description: v })}
              placeholder="Description (or AI generate ✨)"
              placeholderTextColor={COLORS.textMuted}
              multiline
            />
            <TouchableOpacity style={styles.aiBtn} onPress={() => handleGenerateDesc(false)} disabled={generatingDesc}>
              <LinearGradient colors={['#7c3aed', '#a855f7']} style={styles.aiBtnGrad}>
                {generatingDesc ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.aiBtnText}>✨ AI</Text>}
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* Restaurant Tags */}
          {restaurants.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 8 }}
              contentContainerStyle={{ gap: 8, paddingHorizontal: 2 }}>
              <TouchableOpacity
                style={[styles.restChip, !uploadForm.restaurantId && styles.activeRestChip]}
                onPress={() => setUploadForm({ ...uploadForm, restaurantId: '' })}
              >
                <Text style={styles.restChipText}>No Restaurant</Text>
              </TouchableOpacity>
              {restaurants.map((r) => (
                <TouchableOpacity key={r._id}
                  style={[styles.restChip, uploadForm.restaurantId === r._id && styles.activeRestChip]}
                  onPress={() => setUploadForm({ ...uploadForm, restaurantId: r._id })}
                >
                  <Text style={styles.restChipText}>{r.restaurantName}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {uploading && (
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${uploadProgress}%` }]} />
              <Text style={styles.progressText}>{uploadProgress}%</Text>
            </View>
          )}

          <TouchableOpacity style={styles.publishBtn} onPress={handleUpload} disabled={uploading}>
            <LinearGradient colors={[COLORS.primary, COLORS.secondary]} style={styles.publishGradient}>
              {uploading
                ? <ActivityIndicator color="#fff" />
                : <><Icon name="publish" size={20} color="#fff" /><Text style={styles.publishText}>Publish Reel</Text></>
              }
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>
      ) : (
        <FlatList
          data={reels}
          renderItem={renderReel}
          keyExtractor={(r) => r._id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Icon name="videocam-off" size={60} color={COLORS.bgCard} />
              <Text style={styles.emptyText}>No reels yet. Upload your first!</Text>
            </View>
          }
        />
      )}

      {/* Edit Modal */}
      <Modal visible={!!editReel} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>✏️ Edit Reel</Text>
              <TouchableOpacity onPress={() => setEditReel(null)}>
                <Icon name="close" size={24} color={COLORS.textPrimary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.label}>Title *</Text>
            <TextInput
              style={styles.input}
              value={editReel?.title || ''}
              onChangeText={(v) => setEditReel((p) => ({ ...p, title: v }))}
              placeholderTextColor={COLORS.textMuted}
            />
            <View style={styles.descRow}>
              <TextInput
                style={[styles.input, { flex: 1, height: 100, textAlignVertical: 'top' }]}
                value={editReel?.description || ''}
                onChangeText={(v) => setEditReel((p) => ({ ...p, description: v }))}
                placeholder="Description..."
                placeholderTextColor={COLORS.textMuted}
                multiline
              />
              <TouchableOpacity style={styles.aiBtn} onPress={() => handleGenerateDesc(true)} disabled={generatingDesc}>
                <LinearGradient colors={['#7c3aed', '#a855f7']} style={styles.aiBtnGrad}>
                  {generatingDesc ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.aiBtnText}>✨</Text>}
                </LinearGradient>
              </TouchableOpacity>
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: COLORS.bgCard }]} onPress={() => setEditReel(null)}>
                <Text style={{ color: COLORS.textMuted, fontWeight: 'bold' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, { flex: 2 }]} onPress={handleEditSave} disabled={editSaving}>
                <LinearGradient colors={[COLORS.primary, COLORS.secondary]} style={styles.saveBtnGrad}>
                  {editSaving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>💾 Save</Text>}
                </LinearGradient>
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
  header: { paddingTop: 60, paddingHorizontal: 20, paddingBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { fontSize: 28, fontWeight: '900', color: '#fff' },
  headerSub: { color: COLORS.textMuted, fontSize: 13 },
  uploadToggleBtn: { borderRadius: 20, overflow: 'hidden' },
  uploadGradient: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, gap: 6 },
  uploadBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  uploadForm: { backgroundColor: COLORS.bgSurface, marginHorizontal: 16, borderRadius: RADIUS.lg, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: COLORS.border },
  videoPickBtn: { backgroundColor: COLORS.bgCard, borderRadius: RADIUS.md, padding: 18, alignItems: 'center', gap: 8, marginBottom: 12, borderWidth: 1, borderColor: COLORS.border, borderStyle: 'dashed', flexDirection: 'row', justifyContent: 'center' },
  videoPickText: { color: COLORS.textMuted, fontSize: 14 },
  input: { backgroundColor: COLORS.bgCard, borderRadius: RADIUS.md, color: '#fff', padding: 14, borderWidth: 1, borderColor: COLORS.border, marginBottom: 10 },
  descRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  aiBtn: { width: 50, borderRadius: RADIUS.md, overflow: 'hidden' },
  aiBtnGrad: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  aiBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
  restChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border },
  activeRestChip: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  restChipText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  progressBar: { backgroundColor: COLORS.bgCard, borderRadius: 8, height: 24, overflow: 'hidden', marginBottom: 10, justifyContent: 'center' },
  progressFill: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: COLORS.primary, borderRadius: 8 },
  progressText: { color: '#fff', fontWeight: 'bold', fontSize: 12, textAlign: 'center' },
  publishBtn: { borderRadius: RADIUS.md, overflow: 'hidden' },
  publishGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 15 },
  publishText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  list: { paddingHorizontal: 16, paddingBottom: 40 },
  reelCard: { flexDirection: 'row', backgroundColor: COLORS.bgSurface, borderRadius: RADIUS.lg, overflow: 'hidden', marginBottom: 14, borderWidth: 1, borderColor: COLORS.border },
  reelThumb: { width: 110, height: 140, backgroundColor: '#111' },
  reelBody: { flex: 1, padding: 12 },
  reelTitle: { color: '#fff', fontWeight: 'bold', fontSize: 15, marginBottom: 4 },
  reelRestaurant: { color: COLORS.primary, fontSize: 12, marginBottom: 4 },
  reelDesc: { color: COLORS.textMuted, fontSize: 12, marginBottom: 8 },
  reelStats: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  statPill: { color: COLORS.textSecondary, fontSize: 12 },
  reelActions: { flexDirection: 'row', gap: 12 },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionText: { fontWeight: 'bold', fontSize: 13 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { alignItems: 'center', marginTop: 80 },
  emptyText: { color: COLORS.textMuted, fontSize: 15, marginTop: 14 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: COLORS.bgSurface, borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 24 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  label: { color: COLORS.textMuted, fontSize: 13, marginBottom: 8 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  modalBtn: { flex: 1, borderRadius: RADIUS.md, overflow: 'hidden', padding: 12, alignItems: 'center', justifyContent: 'center' },
  saveBtnGrad: { paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  saveBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
});

export default CreatorDashboardScreen;
