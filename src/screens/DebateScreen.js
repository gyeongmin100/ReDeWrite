import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { tokens as t } from '../theme/tokens';
import { chatWithAI } from '../services/aiService';
import { buildQuickChips } from '../services/debateQuickChips.js';
import {
  buildInitialDebateMessages,
  shouldShowWriteButton,
} from '../services/debateStateUtils.js';

export default function DebateScreen({ navigation, route, researches, updateResearch, user }) {
  const { companyId } = route.params;
  const research = researches.find(r => r.companyId === companyId);
  const report = research?.researchReport ?? null;
  const company = research?.name ?? report?.company ?? '기업';
  const role = research?.role ?? report?.role ?? '';

  const quickChips = buildQuickChips();

  const [messages, setMessages] = useState(() => buildInitialDebateMessages(research));
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showWriteBtn, setShowWriteBtn] = useState(() => shouldShowWriteButton(buildInitialDebateMessages(research)));
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }, [messages, loading]);

  const sendMessage = async (text) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const userMsg = { role: 'user', content: trimmed };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    updateResearch(companyId, { bestFit: { messages: nextMessages } });
    setInput('');
    setLoading(true);

    try {
      const aiText = await chatWithAI(
        nextMessages.filter(m => m.role !== 'system'),
        report,
        user?.experiences ?? [],
      );
      const aiMsg = { role: 'assistant', content: aiText };
      const completedMessages = [...nextMessages, aiMsg];
      setMessages(completedMessages);
      updateResearch(companyId, { bestFit: { messages: completedMessages } });
      // 1회 이상 실제 대화 후 Write 버튼 표시
      setShowWriteBtn(shouldShowWriteButton(completedMessages));
    } catch (err) {
      console.error('chatWithAI error:', err);
      const failedMessages = [...nextMessages, {
        role: 'assistant',
        content: '일시적인 오류가 발생했어요. 잠시 후 다시 시도해 주세요.',
      }];
      setMessages(failedMessages);
      updateResearch(companyId, { bestFit: { messages: failedMessages } });
    } finally {
      setLoading(false);
    }
  };

  const handleQuickChip = (chip) => sendMessage(chip);

  const handleWriteNavigate = () => {
    updateResearch(companyId, {
      bestFit: { messages },
      pipeline: ['done', 'done', 'active'],
      completedSteps: Math.max(research?.completedSteps ?? 1, 4),
    });
    navigation.navigate('Write', { companyId });
  };

  return (
    <SafeAreaView style={s.root}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <View style={s.inner}>
          {/* 헤더 */}
          <View style={s.header}>
            <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
              <Ionicons name="arrow-back" size={20} color={t.ink} />
            </TouchableOpacity>
            <Text style={s.tag}>DEBATE · AI 채팅</Text>
            <View style={s.liveChip}>
              <Text style={s.liveChipText}>AI 채팅</Text>
            </View>
          </View>

          {/* 채팅 영역 */}
          <ScrollView
            ref={scrollRef}
            style={{ flex: 1 }}
            contentContainerStyle={s.chatContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {messages.map((m, i) => (
              <View
                key={i}
                style={[
                  s.bubbleWrap,
                  m.role === 'user' ? s.bubbleWrapUser : s.bubbleWrapAI,
                ]}
              >
                {m.role === 'assistant' && (
                  <View style={s.aiAvatar}>
                    <Ionicons name="sparkles" size={14} color={t.primary} />
                  </View>
                )}
                <View
                  style={[
                    s.bubble,
                    m.role === 'user' ? s.bubbleUser : s.bubbleAI,
                  ]}
                >
                  <Text style={[s.bubbleText, m.role === 'user' && s.bubbleTextUser]}>
                    {m.content}
                  </Text>
                </View>
              </View>
            ))}

            {/* 타이핑 인디케이터 */}
            {loading && (
              <View style={[s.bubbleWrap, s.bubbleWrapAI]}>
                <View style={s.aiAvatar}>
                  <Ionicons name="sparkles" size={14} color={t.primary} />
                </View>
                <View style={[s.bubble, s.bubbleAI, s.typingBubble]}>
                  <View style={s.typingDots}>
                    {[0, 1, 2].map(i => (
                      <View key={i} style={s.typingDot} />
                    ))}
                  </View>
                </View>
              </View>
            )}

            {/* Write 이동 버튼 */}
            {showWriteBtn && !loading && (
              <TouchableOpacity
                style={s.writeBtn}
                onPress={handleWriteNavigate}
                activeOpacity={0.85}
              >
                <Text style={s.writeBtnText}>Write로 자소서 쓰기</Text>
                <Ionicons name="arrow-forward" size={16} color="#fff" />
              </TouchableOpacity>
            )}
          </ScrollView>

          {/* 빠른 선택 칩 - 항상 표시 (로딩 중 숨김) */}
          {!loading && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.quickChipsRow}
              style={s.chipsScroll}
            >
              {quickChips.map(chip => (
                <TouchableOpacity
                  key={chip}
                  style={s.quickChip}
                  onPress={() => handleQuickChip(chip)}
                  activeOpacity={0.75}
                >
                  <Text style={s.quickChipText}>{chip}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {/* 입력창 */}
          <View style={s.inputRow}>
            <TextInput
              ref={inputRef}
              style={s.input}
              value={input}
              onChangeText={setInput}
              placeholder="메시지를 입력하세요..."
              placeholderTextColor={t.faint}
              multiline
              maxLength={300}
              editable={!loading}
              returnKeyType="send"
              blurOnSubmit={false}
            />
            <TouchableOpacity
              style={[s.sendBtn, (!input.trim() || loading) && s.sendBtnDisabled]}
              onPress={() => sendMessage(input)}
              activeOpacity={0.8}
              disabled={!input.trim() || loading}
            >
              {loading
                ? <ActivityIndicator size="small" color="#fff" />
                : <Ionicons name="send" size={18} color="#fff" />
              }
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: t.bg },
  inner: { flex: 1, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8 },

  // 헤더
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  tag: { flex: 1, fontSize: 10, fontWeight: '700', color: t.debateFg, letterSpacing: 1.2 },
  liveChip: {
    paddingHorizontal: 10, height: 22, borderRadius: 999,
    backgroundColor: t.debateBg, alignItems: 'center', justifyContent: 'center',
  },
  liveChipText: { fontSize: 11, fontWeight: '600', color: t.debateFg },

  // 채팅
  chatContent: { paddingBottom: 16, gap: 10 },
  bubbleWrap: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  bubbleWrapAI: { justifyContent: 'flex-start' },
  bubbleWrapUser: { justifyContent: 'flex-end' },
  aiAvatar: {
    width: 28, height: 28, borderRadius: 10, backgroundColor: t.primarySoft,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  bubble: {
    maxWidth: '78%', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10,
  },
  bubbleAI: {
    backgroundColor: t.surface, borderWidth: 1, borderColor: t.border,
    borderBottomLeftRadius: 4,
  },
  bubbleUser: {
    backgroundColor: t.primary, borderBottomRightRadius: 4,
  },
  bubbleText: { fontSize: 14, color: t.ink, lineHeight: 22 },
  bubbleTextUser: { color: '#fff' },

  // 타이핑
  typingBubble: { paddingVertical: 14 },
  typingDots: { flexDirection: 'row', gap: 5, alignItems: 'center' },
  typingDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: t.faint },

  // 빠른 선택 칩
  chipsScroll: { flexGrow: 0, paddingVertical: 8, borderTopWidth: 1, borderTopColor: t.border },
  quickChipsRow: { gap: 8, paddingRight: 4, paddingLeft: 0 },
  quickChip: {
    paddingHorizontal: 14, height: 34, borderRadius: 999,
    backgroundColor: t.surface, borderWidth: 1, borderColor: t.borderStrong,
    alignItems: 'center', justifyContent: 'center',
  },
  quickChipText: { fontSize: 13, fontWeight: '500', color: t.inkSoft },

  // Write 버튼
  writeBtn: {
    height: 48, borderRadius: 14, backgroundColor: t.primaryDark,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginTop: 8, alignSelf: 'stretch',
  },
  writeBtnText: { fontSize: 14, fontWeight: '600', color: '#fff' },

  // 입력창
  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
    paddingTop: 8, borderTopWidth: 1, borderTopColor: t.border,
  },
  input: {
    flex: 1, minHeight: 44, maxHeight: 100, fontSize: 14, color: t.ink,
    backgroundColor: t.surface, borderRadius: 14, borderWidth: 1, borderColor: t.borderStrong,
    paddingHorizontal: 14, paddingVertical: 10,
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 12, backgroundColor: t.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.4 },
});
