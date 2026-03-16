import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  FlatList,
  Dimensions,
  TouchableOpacity,
  Text,
  StyleSheet,
  StatusBar,
  Platform,
} from "react-native";
import { Video } from "expo-av";
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons as Icon } from '@expo/vector-icons';
import { useIsFocused, useFocusEffect } from "@react-navigation/native";
import { videoAPI } from "../services/api";
import { CONFIG } from "../utils/config";
import { COLORS, RADIUS } from "../utils/theme";

const { width: screenWidth } = Dimensions.get("window");

const ReelsScreen = () => {
  const [reels, setReels] = useState([]);
  const [displayReels, setDisplayReels] = useState([]);
  const [layoutHeight, setLayoutHeight] = useState(0);
  const [muted, setMuted] = useState(false);
  // Track which single reel should be playing
  const activeIdRef = useRef(null);
  const videosRef = useRef({});
  const flatListRef = useRef(null);
  const isFocused = useIsFocused();

  useEffect(() => {
    fetchReels();
  }, []);

  // ----- Robust Focus Management -----
  useFocusEffect(
    React.useCallback(() => {
      // Screen gained focus
      const resumeActive = async () => {
        if (activeIdRef.current && videosRef.current[activeIdRef.current]) {
          try {
            await videosRef.current[activeIdRef.current].playAsync();
          } catch (e) {}
        }
      };
      resumeActive();

      return () => {
        // Screen lost focus - PAUSE EVERYTHING
        Object.values(videosRef.current).forEach(ref => {
          if (ref) {
            ref.pauseAsync().catch(() => {});
          }
        });
      };
    }, [])
  );

  const fetchReels = async () => {
    try {
      const response = await videoAPI.getFeed();
      if (response.data.success) {
        const shuffled = response.data.data.sort(() => Math.random() - 0.5);
        setReels(shuffled);
        setDisplayReels([...shuffled]);
      }
    } catch (error) {
      console.error("Failed to fetch reels:", error);
    }
  };

  // ----- Play the visible one, PAUSE ALL others -----
  const onViewableItemsChanged = useCallback(({ viewableItems }) => {
    if (viewableItems.length === 0) return;

    // The topmost fully-visible reel
    const visible = viewableItems[0];
    const newActiveId = visible.item._id;

    if (newActiveId === activeIdRef.current) return;

    // Pause EVERY video except the new one
    Object.entries(videosRef.current).forEach(([id, ref]) => {
      if (id !== newActiveId) {
        ref?.pauseAsync().catch(() => {});
      }
    });

    activeIdRef.current = newActiveId;

    // Play new (only if tab is focused)
    if (isFocused && videosRef.current[newActiveId]) {
      videosRef.current[newActiveId].playAsync().catch(() => {});
    }
  }, [isFocused]);

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 70,
    minimumViewTime: 200,
  });

  const renderReel = useCallback(({ item }) => (
    <View style={[styles.reelContainer, { height: layoutHeight }]}>
      <Video
        ref={(ref) => {
          if (ref) {
            videosRef.current[item._id] = ref;
          } else {
            delete videosRef.current[item._id];
          }
        }}
        source={{
          uri: item.videoUrl?.startsWith("http")
            ? item.videoUrl
            : `${CONFIG.UPLOADS_BASE}${item.videoUrl}`,
        }}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
        isLooping
        shouldPlay={false}   // <-- never auto-plays; we control it manually
        isMuted={muted}
        useNativeControls={false}
      />

      {/* Gradient overlays */}
      <LinearGradient
        colors={['rgba(0,0,0,0.45)', 'transparent', 'rgba(0,0,0,0.88)']}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      {/* Right action buttons */}
      <View style={styles.rightActions}>
        <TouchableOpacity style={styles.actionBtn}>
          <Icon name="favorite-border" size={30} color="white" />
          <Text style={styles.actionText}>{item.likedBy?.length || 0}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn}>
          <Icon name="chat-bubble-outline" size={28} color="white" />
          <Text style={styles.actionText}>{item.comments?.length || 0}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn}>
          <Icon name="share" size={28} color="white" />
          <Text style={styles.actionText}>Share</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={() => setMuted(m => !m)}>
          <Icon name={muted ? "volume-off" : "volume-up"} size={26} color="white" />
        </TouchableOpacity>
      </View>

      {/* Bottom info */}
      <View style={styles.bottomInfo}>
        <View style={styles.creatorRow}>
          <View style={styles.creatorInfo}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {item.creatorId?.fullName?.charAt(0).toUpperCase() || 'C'}
              </Text>
            </View>
            <View>
              <Text style={styles.creatorName}>
                @{item.creatorId?.fullName?.replace(/\s/g, '').toLowerCase() || "creator"}
              </Text>
              {item.restaurantId?.restaurantName && (
                <Text style={styles.restaurantTag}>{item.restaurantId.restaurantName}</Text>
              )}
            </View>
          </View>
          <TouchableOpacity style={styles.followBtn}>
            <Text style={styles.followText}>Follow</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
        <Text style={styles.description} numberOfLines={2}>{item.description}</Text>

        <View style={styles.musicRow}>
          <View style={styles.musicIcon}>
            <Icon name="music-note" size={12} color="white" />
          </View>
          <Text style={styles.musicText}>
            Original Sound · {item.restaurantId?.restaurantName || 'FoodMenia'}
          </Text>
        </View>
      </View>
    </View>
  ), [layoutHeight, muted, isFocused]);

  const loadMoreReels = () => {
    if (reels.length > 0) {
      setDisplayReels(prev => [...prev, ...reels]);
    }
  };

  return (
    <View
      style={styles.container}
      onLayout={(e) => setLayoutHeight(e.nativeEvent.layout.height)}
    >
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {layoutHeight > 0 && (
        <FlatList
          ref={flatListRef}
          data={displayReels}
          renderItem={renderReel}
          keyExtractor={(item, index) => `${item._id}-${index}`}
          pagingEnabled
          snapToInterval={layoutHeight}
          snapToAlignment="start"
          decelerationRate="fast"
          showsVerticalScrollIndicator={false}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig.current}
          onEndReached={loadMoreReels}
          onEndReachedThreshold={0.5}
          windowSize={3}
          maxToRenderPerBatch={3}
          removeClippedSubviews={Platform.OS === 'android'}
          extraData={layoutHeight}
        />
      )}

      {displayReels.length === 0 && (
        <View style={styles.emptyState}>
          <Icon name="videocam-off" size={52} color={COLORS.textMuted} />
          <Text style={styles.emptyText}>No reels available yet</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'black' },
  reelContainer: { width: screenWidth, overflow: 'hidden' },
  rightActions: {
    position: 'absolute',
    right: 14,
    bottom: 130,
    alignItems: 'center',
    zIndex: 10,
  },
  actionBtn: { alignItems: 'center', marginBottom: 24 },
  actionText: {
    color: 'white', fontSize: 12, fontWeight: 'bold', marginTop: 4,
    textShadowColor: 'rgba(0,0,0,0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 10,
  },
  bottomInfo: {
    position: 'absolute',
    bottom: 0, left: 0, right: 72,
    padding: 20, paddingBottom: 44,
    zIndex: 10,
  },
  creatorRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 14,
  },
  creatorInfo: { flexDirection: 'row', alignItems: 'center' },
  avatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: COLORS.primary,
    borderWidth: 2, borderColor: 'white',
    justifyContent: 'center', alignItems: 'center', marginRight: 10,
  },
  avatarText: { color: 'white', fontWeight: '900', fontSize: 16 },
  creatorName: { color: 'white', fontSize: 14, fontWeight: '800' },
  restaurantTag: { color: 'rgba(255,255,255,0.65)', fontSize: 11, marginTop: 2 },
  followBtn: {
    borderWidth: 1.5, borderColor: 'white',
    paddingHorizontal: 14, paddingVertical: 5, borderRadius: 5,
  },
  followText: { color: 'white', fontSize: 13, fontWeight: '800' },
  title: {
    color: 'white', fontSize: 16, fontWeight: 'bold', marginBottom: 5,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 4,
  },
  description: {
    color: 'rgba(255,255,255,0.85)', fontSize: 13, marginBottom: 12, lineHeight: 18,
  },
  musicRow: { flexDirection: 'row', alignItems: 'center' },
  musicIcon: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center', alignItems: 'center', marginRight: 7,
  },
  musicText: { color: 'white', fontSize: 12 },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { color: COLORS.textMuted, marginTop: 12, fontSize: 15 },
});

export default ReelsScreen;