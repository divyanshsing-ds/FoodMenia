import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar,
  ScrollView, Modal, TextInput, FlatList, ActivityIndicator, Alert,
} from 'react-native';
import { Video } from 'expo-av';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons as Icon } from '@expo/vector-icons';
import { videoAPI, creatorAPI } from '../services/api';
import { COLORS, RADIUS } from '../utils/theme';
import { CONFIG } from '../utils/config';

const videoUrl = (url) => (url?.startsWith('http') ? url : `${CONFIG.API_BASE.replace('/api', '')}${url}`);

const CreatorAnalyticsScreen = () => {
  const [reels, setReels] = useState([]);
  const [followers, setFollowers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showFollowers, setShowFollowers] = useState(false);

  // Comments
  const [commentReel, setCommentReel] = useState(null);
  const [replyTo, setReplyTo] = useState(null);
  const [replyText, setReplyText] = useState('');

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [])
  );

  const fetchData = async () => {
    setLoading(true);
    try {
      const [reelRes, follRes] = await Promise.all([
        videoAPI.getMyReels(),
        creatorAPI.getFollowers(),
      ]);
      if (reelRes.data.success) setReels(reelRes.data.data);
      if (follRes.data.success) setFollowers(follRes.data.data);
    } catch (e) {
      console.error('Analytics fetch:', e);
    } finally {
      setLoading(false);
    }
  };

  const totalLikes = reels.reduce((s, r) => s + (r.likedBy?.length || 0), 0);
  const totalComments = reels.reduce((s, r) => s + (r.comments?.length || 0), 0);
  const totalViews = reels.reduce((s, r) => s + (r.views || 0), 0);
  const totalEarnings = (totalViews / 20) * 0.012 + (totalLikes / 100) * 0.012;

  const statCards = [
    { icon: '🎬', val: reels.length, label: 'Total Reels' },
    { icon: '👥', val: followers.length, label: 'Followers', action: () => setShowFollowers(true) },
    { icon: '👁️', val: totalViews.toLocaleString(), label: 'Total Views' },
    { icon: '❤️', val: totalLikes.toLocaleString(), label: 'Total Likes' },
    { icon: '💬', val: totalComments.toLocaleString(), label: 'Total Comments' },
    { icon: '💰', val: `$${totalEarnings.toFixed(3)}`, label: 'Est. Revenue' },
  ];

  const handleLikeComment = async (reelId, commentId) => {
    try {
      const res = await videoAPI.likeComment(reelId, commentId);
      if (res.data.success) fetchData();
    } catch (e) { console.error('Like comment:', e); }
  };

  const handleReplyComment = async (reelId, commentId) => {
    if (!replyText.trim()) return;
    try {
      const res = await videoAPI.replyComment(reelId, commentId, replyText);
      if (res.data.success) {
        setReplyText('');
        setReplyTo(null);
        fetchData();
      }
    } catch { Alert.alert('Error', 'Reply failed'); }
  };

  const handleDeleteComment = async (reelId, commentId) => {
    Alert.alert('Delete Comment', 'Remove this comment?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await videoAPI.deleteComment(reelId, commentId);
            fetchData();
          } catch { Alert.alert('Error', 'Delete failed'); }
        },
      },
    ]);
  };

  const handleDeleteReply = async (reelId, commentId, replyId) => {
    Alert.alert('Delete Reply', 'Remove this reply?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await videoAPI.deleteReply(reelId, commentId, replyId);
            fetchData();
          } catch { Alert.alert('Error', 'Delete failed'); }
        },
      },
    ]);
  };

  const reelEarnings = (r) =>
    ((r.views || 0) / 20) * 0.012 + ((r.likedBy?.length || 0) / 100) * 0.012;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={[COLORS.bgDeep, '#0e0e25']} style={StyleSheet.absoluteFill} />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Analytics</Text>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* Summary Cards */}
          <View style={styles.statsGrid}>
            {statCards.map((card) => (
              <TouchableOpacity key={card.label} style={styles.statCard} onPress={card.action} activeOpacity={card.action ? 0.7 : 1}>
                <Text style={styles.statIcon}>{card.icon}</Text>
                <Text style={styles.statVal}>{card.val}</Text>
                <Text style={styles.statLabel}>{card.label}</Text>
                {card.action && <Text style={styles.tapHint}>Tap to view</Text>}
              </TouchableOpacity>
            ))}
          </View>

          {/* Per-Reel Breakdown */}
          <Text style={styles.sectionTitle}>Per Reel Breakdown</Text>
          {reels.length === 0 ? (
            <View style={styles.empty}>
              <Icon name="bar-chart" size={50} color={COLORS.bgCard} />
              <Text style={styles.emptyText}>Upload reels to see analytics</Text>
            </View>
          ) : (
            reels.map((reel) => (
              <View key={reel._id} style={styles.reelRow}>
                <Video
                  source={{ uri: videoUrl(reel.videoUrl) }}
                  style={styles.reelThumb}
                  shouldPlay={false}
                  isMuted
                  resizeMode="cover"
                />
                <View style={styles.reelInfo}>
                  <Text style={styles.reelTitle} numberOfLines={2}>{reel.title}</Text>
                  {reel.restaurantId?.restaurantName && (
                    <Text style={styles.reelRest}>🏪 {reel.restaurantId.restaurantName}</Text>
                  )}
                  <View style={styles.metricsRow}>
                    <View style={styles.metric}>
                      <Text style={styles.metricIcon}>👁️</Text>
                      <Text style={styles.metricVal}>{reel.views || 0}</Text>
                    </View>
                    <View style={styles.metric}>
                      <Text style={styles.metricIcon}>❤️</Text>
                      <Text style={styles.metricVal}>{reel.likedBy?.length || 0}</Text>
                    </View>
                    <View style={styles.metric}>
                      <Text style={styles.metricIcon}>💬</Text>
                      <Text style={styles.metricVal}>{reel.comments?.length || 0}</Text>
                    </View>
                    <View style={styles.metric}>
                      <Text style={styles.metricIcon}>💵</Text>
                      <Text style={[styles.metricVal, { color: COLORS.success }]}>${reelEarnings(reel).toFixed(4)}</Text>
                    </View>
                  </View>

                  {reel.comments?.length > 0 && (
                    <TouchableOpacity
                      style={styles.viewCommentsBtn}
                      onPress={() => setCommentReel(reel)}
                    >
                      <Icon name="comment" size={14} color={COLORS.info} />
                      <Text style={styles.viewCommentsText}>Manage {reel.comments.length} comments</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}

      {/* Comments Modal */}
      <Modal visible={!!commentReel} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '88%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle} numberOfLines={1}>
                💬 {commentReel?.title}
              </Text>
              <TouchableOpacity onPress={() => { setCommentReel(null); setReplyTo(null); setReplyText(''); }}>
                <Icon name="close" size={24} color={COLORS.textPrimary} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {commentReel?.comments?.slice().reverse().map((c, i) => (
                <View key={i} style={styles.commentCard}>
                  <View style={styles.commentHeader}>
                    <Text style={styles.commentUser}>{c.userName || 'User'}</Text>
                    <View style={styles.commentMeta}>
                      <TouchableOpacity onPress={() => handleLikeComment(commentReel._id, c._id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Icon name="favorite" size={14} color={COLORS.danger} />
                        <Text style={{ color: COLORS.danger, fontSize: 12 }}>{c.likedBy?.length || 0}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => handleDeleteComment(commentReel._id, c._id)}>
                        <Icon name="delete-outline" size={16} color={COLORS.textMuted} />
                      </TouchableOpacity>
                    </View>
                  </View>
                  <Text style={styles.commentText}>{c.text}</Text>

                  {c.replies?.length > 0 && (
                    <View style={styles.repliesContainer}>
                      {c.replies.map((rep, ri) => (
                        <View key={ri} style={styles.replyItem}>
                          <Text style={styles.replyUser}>{rep.userName}</Text>
                          <Text style={styles.replyText}>{rep.text}</Text>
                          <TouchableOpacity
                            style={styles.delReplyBtn}
                            onPress={() => handleDeleteReply(commentReel._id, c._id, rep._id)}
                          >
                            <Icon name="close" size={12} color={COLORS.textMuted} />
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  )}

                  {replyTo?.commentId === c._id ? (
                    <View style={styles.replyFormRow}>
                      <TextInput
                        style={styles.replyInput}
                        placeholder="Your reply..."
                        placeholderTextColor={COLORS.textMuted}
                        value={replyText}
                        onChangeText={setReplyText}
                        autoFocus
                      />
                      <TouchableOpacity
                        style={styles.sendBtn}
                        onPress={() => handleReplyComment(commentReel._id, c._id)}
                      >
                        <Text style={styles.sendBtnText}>Send</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => setReplyTo(null)}>
                        <Icon name="close" size={18} color={COLORS.textMuted} />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={styles.replyTrigger}
                      onPress={() => setReplyTo({ reelId: commentReel._id, commentId: c._id, userName: c.userName })}
                    >
                      <Text style={styles.replyTriggerText}>Reply</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Followers Modal */}
      <Modal visible={showFollowers} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>👥 Your Followers</Text>
              <TouchableOpacity onPress={() => setShowFollowers(false)}>
                <Icon name="close" size={24} color={COLORS.textPrimary} />
              </TouchableOpacity>
            </View>
            <ScrollView>
              {followers.length > 0 ? followers.map((f) => (
                <View key={f._id} style={styles.followerRow}>
                  <View style={styles.followerAvatar}>
                    <Text style={styles.followerAvatarText}>{f.fullName?.charAt(0).toUpperCase() || '?'}</Text>
                  </View>
                  <Text style={styles.followerName}>{f.fullName}</Text>
                </View>
              )) : (
                <View style={styles.empty}>
                  <Text style={styles.emptyText}>No followers yet. Keep posting! 🎬</Text>
                </View>
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
  header: { paddingTop: 60, paddingHorizontal: 24, paddingBottom: 12 },
  headerTitle: { fontSize: 28, fontWeight: '900', color: '#fff' },
  scroll: { paddingHorizontal: 16, paddingBottom: 40 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
  statCard: { flex: 1, minWidth: '30%', backgroundColor: COLORS.bgSurface, borderRadius: RADIUS.lg, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  statIcon: { fontSize: 24, marginBottom: 8 },
  statVal: { color: '#fff', fontWeight: '900', fontSize: 20 },
  statLabel: { color: COLORS.textMuted, fontSize: 11, textAlign: 'center', marginTop: 4 },
  tapHint: { color: COLORS.info, fontSize: 9, marginTop: 4 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#fff', marginBottom: 14 },
  reelRow: { flexDirection: 'row', backgroundColor: COLORS.bgSurface, borderRadius: RADIUS.lg, overflow: 'hidden', marginBottom: 12, borderWidth: 1, borderColor: COLORS.border },
  reelThumb: { width: 90, height: 120, backgroundColor: '#111' },
  reelInfo: { flex: 1, padding: 12 },
  reelTitle: { color: '#fff', fontWeight: 'bold', fontSize: 14, marginBottom: 4 },
  reelRest: { color: COLORS.primary, fontSize: 11, marginBottom: 8 },
  metricsRow: { flexDirection: 'row', gap: 12, marginBottom: 8 },
  metric: { alignItems: 'center' },
  metricIcon: { fontSize: 14 },
  metricVal: { color: COLORS.textSecondary, fontSize: 12, fontWeight: 'bold' },
  viewCommentsBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  viewCommentsText: { color: COLORS.info, fontSize: 12, fontWeight: '600' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { alignItems: 'center', marginTop: 60 },
  emptyText: { color: COLORS.textMuted, fontSize: 15, marginTop: 14 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: COLORS.bgSurface, borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 24 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#fff', flex: 1, paddingRight: 8 },
  commentCard: { backgroundColor: COLORS.bgCard, borderRadius: RADIUS.md, padding: 12, marginBottom: 10 },
  commentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  commentUser: { color: COLORS.primary, fontWeight: 'bold', fontSize: 13 },
  commentMeta: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  commentText: { color: COLORS.textSecondary, fontSize: 14 },
  repliesContainer: { borderLeftWidth: 2, borderLeftColor: COLORS.border, paddingLeft: 10, marginTop: 8 },
  replyItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 6 },
  replyUser: { color: COLORS.success, fontWeight: 'bold', fontSize: 12, minWidth: 60 },
  replyText: { flex: 1, color: COLORS.textSecondary, fontSize: 13 },
  delReplyBtn: { padding: 2 },
  replyFormRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  replyInput: { flex: 1, backgroundColor: COLORS.bgSurface, borderRadius: RADIUS.md, color: '#fff', paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: COLORS.border, fontSize: 13 },
  sendBtn: { backgroundColor: COLORS.primary, paddingHorizontal: 12, paddingVertical: 8, borderRadius: RADIUS.md },
  sendBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 13 },
  replyTrigger: { marginTop: 8 },
  replyTriggerText: { color: COLORS.info, fontSize: 12, fontWeight: '600' },
  followerRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  followerAvatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center' },
  followerAvatarText: { color: '#fff', fontWeight: 'bold', fontSize: 18 },
  followerName: { color: '#fff', fontWeight: '600', fontSize: 15 },
});

export default CreatorAnalyticsScreen;
