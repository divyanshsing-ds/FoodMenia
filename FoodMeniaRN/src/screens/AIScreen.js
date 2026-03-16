import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Animated,
  Easing,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons as Icon } from '@expo/vector-icons';
import { aiAPI } from '../services/api';
import { COLORS, RADIUS, SPACING } from '../utils/theme';

/* ---------- Suggestion chips ---------- */
const QUICK_SUGGESTIONS = [
  '🍕 Best pizza near me',
  '🥗 Healthy diet options',
  '⏱️ Fastest delivery?',
  '💰 Budget meals under ₹100',
  '🌶️ Spicy recommendations',
];

/* ---------- Typing indicator ---------- */
const TypingDots = () => {
  const dots = [useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current];

  useEffect(() => {
    const anims = dots.map((dot, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 150),
          Animated.timing(dot, { toValue: -6, duration: 300, easing: Easing.ease, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0, duration: 300, easing: Easing.ease, useNativeDriver: true }),
        ])
      )
    );
    Animated.parallel(anims).start();
    return () => anims.forEach(a => a.stop());
  }, []);

  return (
    <View style={tdStyles.container}>
      <View style={tdStyles.bubble}>
        <View style={tdStyles.aiIcon}><Text style={tdStyles.aiIconText}>AI</Text></View>
        <View style={tdStyles.dotsRow}>
          {dots.map((dot, i) => (
            <Animated.View key={i} style={[tdStyles.dot, { transform: [{ translateY: dot }] }]} />
          ))}
        </View>
      </View>
    </View>
  );
};

const tdStyles = StyleSheet.create({
  container: { paddingHorizontal: 16, marginBottom: 8 },
  bubble: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start' },
  aiIcon: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: COLORS.primary,
    justifyContent: 'center', alignItems: 'center', marginRight: 10,
  },
  aiIconText: { fontSize: 9, fontWeight: '900', color: 'white' },
  dotsRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.bgSurface,
    borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10,
    gap: 5,
  },
  dot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: COLORS.primary },
});

/* ---------- Message Bubble ---------- */
const MessageBubble = ({ item }) => {
  const isUser = item.sender === 'user';
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(10)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 250, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 250, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View style={[
      styles.messageRow,
      isUser ? styles.userRow : styles.aiRow,
      { opacity, transform: [{ translateY }] }
    ]}>
      {!isUser && (
        <View style={styles.aiAvatar}>
          <LinearGradient colors={[COLORS.primary, COLORS.secondary]} style={styles.aiAvatarGrad}>
            <Text style={styles.aiAvatarText}>AI</Text>
          </LinearGradient>
        </View>
      )}
      <View style={[styles.bubble, isUser ? styles.userBubble : styles.aiBubble]}>
        {!isUser && <Text style={styles.aiLabel}>FoodMenia AI</Text>}
        <Text style={[styles.messageText, isUser ? styles.userText : styles.aiText]}>
          {item.text}
        </Text>
        <Text style={[styles.timeText, isUser && { color: 'rgba(255,255,255,0.6)' }]}>
          {item.time}
        </Text>
      </View>
    </Animated.View>
  );
};

/* ---------- Main Screen ---------- */
const AIScreen = () => {
  const [messages, setMessages] = useState([
    {
      id: 1,
      text: "👋 Hi! I'm FoodMenia AI, your personal food assistant.\n\nI can help you find the best dishes, suggest meals based on your budget, answer nutrition questions, or track your order!\n\nWhat can I help you with today?",
      sender: 'ai',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const flatListRef = useRef();

  const getTime = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const handleSend = async (text) => {
    const msgText = text || inputText;
    if (!msgText.trim()) return;

    setShowSuggestions(false);
    const userMessage = { id: Date.now(), text: msgText, sender: 'user', time: getTime() };
    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setLoading(true);

    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

    try {
      const response = await aiAPI.chat(msgText);
      const aiReply = {
        id: Date.now() + 1,
        text: response.data.reply || "I'm sorry, I couldn't understand that.",
        sender: 'ai',
        time: getTime(),
      };
      setMessages(prev => [...prev, aiReply]);
    } catch (error) {
      console.error('AI Chat Error:', error);
      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        text: "⚠️ I'm having trouble connecting right now. Please check your connection and try again.",
        sender: 'ai',
        time: getTime(),
      }]);
    } finally {
      setLoading(false);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  const handleClearChat = () => {
    setMessages([{
      id: Date.now(),
      text: "Chat cleared! How can I help you today?",
      sender: 'ai',
      time: getTime(),
    }]);
    setShowSuggestions(true);
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={[COLORS.bgDeep, '#0e0e25']} style={StyleSheet.absoluteFill} />

      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <LinearGradient colors={[COLORS.primary, COLORS.secondary]} style={styles.headerIcon}>
            <Icon name="psychology" size={22} color="white" />
          </LinearGradient>
          <View style={{ marginLeft: 12 }}>
            <Text style={styles.headerTitle}>FoodMenia AI</Text>
            <View style={styles.onlineRow}>
              <View style={styles.onlineDot} />
              <Text style={styles.onlineText}>Online · Powered by Gemini</Text>
            </View>
          </View>
        </View>
        <TouchableOpacity style={styles.clearBtn} onPress={handleClearChat}>
          <Icon name="delete-sweep" size={20} color={COLORS.textMuted} />
        </TouchableOpacity>
      </View>

      {/* ── Messages ── */}
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={({ item }) => <MessageBubble item={item} />}
        keyExtractor={item => item.id.toString()}
        contentContainerStyle={styles.chatContainer}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
        showsVerticalScrollIndicator={false}
        ListFooterComponent={loading ? <TypingDots /> : null}
      />

      {/* ── Quick Suggestions ── */}
      {showSuggestions && (
        <View style={styles.suggestionsWrapper}>
          <FlatList
            data={QUICK_SUGGESTIONS}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={item => item}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.chip} onPress={() => handleSend(item.replace(/^[^\s]+\s/, ''))}>
                <Text style={styles.chipText}>{item}</Text>
              </TouchableOpacity>
            )}
          />
        </View>
      )}

      {/* ── Input ── */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View style={styles.inputContainer}>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              placeholder="Ask anything about food..."
              placeholderTextColor={COLORS.textMuted}
              value={inputText}
              onChangeText={setInputText}
              multiline
              maxLength={500}
              onSubmitEditing={() => handleSend()}
            />
            {inputText.length > 0 && (
              <TouchableOpacity onPress={() => setInputText('')} style={styles.clearInput}>
                <Icon name="close" size={16} color={COLORS.textMuted} />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity
            style={[styles.sendBtn, (!inputText.trim() || loading) && styles.sendBtnDisabled]}
            onPress={() => handleSend()}
            disabled={!inputText.trim() || loading}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={(!inputText.trim() || loading) ? [COLORS.bgCard, COLORS.bgCard] : [COLORS.primary, COLORS.secondary]}
              style={styles.sendGradient}
            >
              {loading
                ? <ActivityIndicator size="small" color={COLORS.textMuted} />
                : <Icon name="send" size={20} color="white" />
              }
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bgDeep },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 56, paddingBottom: 16, paddingHorizontal: 20,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  headerIcon: {
    width: 44, height: 44, borderRadius: 22,
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: '900', color: COLORS.textPrimary },
  onlineRow: { flexDirection: 'row', alignItems: 'center', marginTop: 3 },
  onlineDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.success, marginRight: 5 },
  onlineText: { fontSize: 11, color: COLORS.textMuted },
  clearBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: COLORS.bgCard, justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.border,
  },
  chatContainer: { paddingVertical: 16, paddingHorizontal: 4, paddingBottom: 8 },
  messageRow: { paddingHorizontal: 12, marginBottom: 10 },
  userRow: { alignItems: 'flex-end' },
  aiRow: { flexDirection: 'row', alignItems: 'flex-end' },
  aiAvatar: { marginRight: 8, marginBottom: 4 },
  aiAvatarGrad: {
    width: 28, height: 28, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center',
  },
  aiAvatarText: { fontSize: 9, fontWeight: '900', color: 'white' },
  bubble: { maxWidth: '78%', borderRadius: 18, padding: 12 },
  userBubble: {
    backgroundColor: COLORS.primary,
    borderBottomRightRadius: 4,
  },
  aiBubble: {
    backgroundColor: COLORS.bgSurface,
    borderWidth: 1, borderColor: COLORS.border,
    borderBottomLeftRadius: 4,
  },
  aiLabel: { fontSize: 10, fontWeight: '800', color: COLORS.primary, marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.5 },
  messageText: { fontSize: 14, lineHeight: 21 },
  userText: { color: 'white' },
  aiText: { color: COLORS.textPrimary },
  timeText: { fontSize: 10, color: COLORS.textMuted, marginTop: 5, textAlign: 'right' },
  suggestionsWrapper: { paddingVertical: 10 },
  chip: {
    backgroundColor: COLORS.bgSurface,
    borderWidth: 1, borderColor: COLORS.borderBright,
    borderRadius: RADIUS.full,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  chipText: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '500' },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 32 : 14,
    backgroundColor: COLORS.bgSurface,
    borderTopWidth: 1, borderTopColor: COLORS.border,
    gap: 10,
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.bgDeep,
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1, borderColor: COLORS.border,
    minHeight: 44,
  },
  input: {
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: 14,
    maxHeight: 100,
    lineHeight: 20,
  },
  clearInput: { padding: 4, marginLeft: 4 },
  sendBtn: { width: 44, height: 44, borderRadius: 22, overflow: 'hidden' },
  sendBtnDisabled: { opacity: 0.5 },
  sendGradient: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
});

export default AIScreen;
