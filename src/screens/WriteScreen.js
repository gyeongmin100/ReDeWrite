import React, { useState } from 'react';
import {
  ActivityIndicator,
  Share,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  View,
  StyleSheet,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { tokens as t } from '../theme/tokens';
import {
  generateEssayDraft,
  reviseEssayDraft,
} from '../services/aiService';
import {
  applyEssayRevision,
  buildEssayPayload,
  buildEssayShareText,
  undoEssayRevision,
} from '../services/essayUtils.js';

export default function WriteScreen({ navigation, route, researches, updateResearch, user }) {
  const { companyId } = route.params;
  const research = researches.find(r => r.companyId === companyId);
  const companyName = research?.name || research?.researchReport?.company || '기업';
  const report = research?.researchReport ?? null;
  const savedEssay = research?.essay ?? null;
  const debateMessages = research?.bestFit?.messages ?? [];

  const [stage, setStage] = useState(savedEssay?.draft ? 'result' : 'input');
  const [questionText, setQuestionText] = useState(savedEssay?.questionText || '');
  const [targetLength, setTargetLength] = useState(savedEssay?.targetLength || '');
  const [essay, setEssay] = useState(savedEssay);
  const [draftText, setDraftText] = useState(savedEssay?.draft || '');
  const [revisionRequest, setRevisionRequest] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const persistEssay = (nextEssay) => {
    setEssay(nextEssay);
    setDraftText(nextEssay.draft);
    updateResearch(companyId, {
      essay: nextEssay,
      pipeline: ['done', 'done', 'done'],
      completedSteps: Math.max(research?.completedSteps ?? 1, 6),
    });
  };

  const handleGenerate = async () => {
    const trimmedQuestion = questionText.trim();
    if (!trimmedQuestion || loading) return;

    setLoading(true);
    setError('');
    setCopied(false);

    try {
      const result = await generateEssayDraft({
        questionText: trimmedQuestion,
        targetLength: targetLength.trim(),
        researchReport: report,
        debateMessages,
        userExperiences: user?.experiences ?? [],
      });
      const nextEssay = buildEssayPayload({
        questionText: trimmedQuestion,
        targetLength,
        draft: result.draft,
        evidenceSummary: result.evidenceSummary,
      });
      persistEssay(nextEssay);
      setStage('result');
    } catch (err) {
      console.warn('generateEssayDraft error:', err.message);
      setError('초안 생성에 실패했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveDraft = () => {
    if (!essay) return;
    const nextEssay = buildEssayPayload({
      ...essay,
      questionText,
      targetLength,
      draft: draftText,
    });
    persistEssay(nextEssay);
    setCopied(false);
  };

  const handleRevise = async () => {
    const request = revisionRequest.trim();
    if (!essay || !draftText.trim() || !request || loading) return;

    setLoading(true);
    setError('');
    setCopied(false);

    try {
      const result = await reviseEssayDraft({
        questionText: questionText.trim() || essay.questionText,
        targetLength: targetLength.trim() || essay.targetLength,
        currentDraft: draftText,
        revisionRequest: request,
        researchReport: report,
        debateMessages,
        userExperiences: user?.experiences ?? [],
      });
      const revised = applyEssayRevision(
        { ...essay, questionText, targetLength, draft: draftText },
        result.draft,
      );
      const nextEssay = buildEssayPayload({
        ...revised,
        evidenceSummary: result.evidenceSummary,
      });
      persistEssay(nextEssay);
      setRevisionRequest('');
    } catch (err) {
      console.warn('reviseEssayDraft error:', err.message);
      setError('AI 수정에 실패했어요. 요청을 조금 더 짧게 바꿔 다시 시도해 주세요.');
    } finally {
      setLoading(false);
    }
  };

  const handleUndo = () => {
    if (!essay?.previousDraft) return;
    persistEssay(undoEssayRevision(essay));
  };

  const handleCopy = async () => {
    if (!essay?.draft) return;
    const text = buildEssayShareText({
      companyName,
      essay: { ...essay, questionText, draft: draftText },
    });
    await Clipboard.setStringAsync(text);
    setCopied(true);
  };

  const handleShare = async () => {
    if (!essay?.draft) return;
    const text = buildEssayShareText({
      companyName,
      essay: { ...essay, questionText, draft: draftText },
    });

    try {
      await Share.share({ message: text });
    } catch (err) {
      console.warn('Share essay error:', err.message);
    }
  };

  const dirty = Boolean(essay && draftText !== essay.draft);
  const canGenerate = questionText.trim().length > 0 && !loading;
  const canRevise = Boolean(essay?.draft && revisionRequest.trim() && !loading);

  return (
    <SafeAreaView style={s.root}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={20} color={t.ink} />
          </TouchableOpacity>
          <Text style={s.tag}>WRITE · 자소서</Text>
          {essay?.draft && <View style={s.savedChip}><Text style={s.savedChipText}>저장됨</Text></View>}
        </View>

        <Text style={s.title}>{companyName} 자소서</Text>
        <Text style={s.sub}>실제 지원서 문항을 기준으로 초안을 만들고 다듬습니다</Text>

        {stage === 'input' && (
          <View style={s.section}>
            <Text style={s.label}>자소서 문항</Text>
            <TextInput
              style={[s.inputBox, s.questionInput]}
              value={questionText}
              onChangeText={setQuestionText}
              placeholder="지원서에 있는 문항을 그대로 붙여넣어 주세요"
              placeholderTextColor={t.faint}
              multiline
              maxLength={2000}
            />

            <Text style={s.label}>글자 수 제한</Text>
            <TextInput
              style={s.inputBox}
              value={targetLength}
              onChangeText={setTargetLength}
              placeholder="예: 700자 이내"
              placeholderTextColor={t.faint}
              maxLength={40}
            />

            {error ? <Text style={s.errorText}>{error}</Text> : null}

            <TouchableOpacity
              style={[s.primaryBtn, !canGenerate && s.btnDisabled]}
              onPress={handleGenerate}
              activeOpacity={0.85}
              disabled={!canGenerate}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="sparkles" size={18} color="#fff" />
              )}
              <Text style={s.primaryBtnText}>{loading ? '초안 작성 중...' : 'AI 초안 생성'}</Text>
            </TouchableOpacity>
          </View>
        )}

        {stage === 'result' && essay && (
          <>
            <View style={s.questionBox}>
              <View style={s.questionHeader}>
                <Text style={s.questionBoxLabel}>QUESTION</Text>
                <TouchableOpacity onPress={() => setStage('input')} activeOpacity={0.75}>
                  <Text style={s.editQuestionText}>문항 수정</Text>
                </TouchableOpacity>
              </View>
              <Text style={s.questionBoxText}>{questionText || essay.questionText}</Text>
              {(targetLength || essay.targetLength) ? (
                <Text style={s.targetLengthText}>{targetLength || essay.targetLength}</Text>
              ) : null}
            </View>

            <Text style={s.label}>초안</Text>
            <TextInput
              style={[s.inputBox, s.draftInput]}
              value={draftText}
              onChangeText={(text) => {
                setDraftText(text);
                setCopied(false);
              }}
              multiline
              textAlignVertical="top"
              maxLength={6000}
            />

            <View style={s.metaRow}>
              <Text style={s.charCount}>총 {draftText.length}자</Text>
              {dirty && (
                <TouchableOpacity style={s.saveInlineBtn} onPress={handleSaveDraft} activeOpacity={0.75}>
                  <Ionicons name="save-outline" size={14} color={t.primary} />
                  <Text style={s.saveInlineText}>수정 저장</Text>
                </TouchableOpacity>
              )}
            </View>

            {essay.evidenceSummary?.length > 0 && (
              <View style={s.citationCard}>
                <Text style={s.citationLabel}>반영 근거</Text>
                {essay.evidenceSummary.map((item, index) => (
                  <View key={`${item}-${index}`} style={s.evidenceRow}>
                    <Text style={s.evidenceDot}>•</Text>
                    <Text style={s.evidenceText}>{item}</Text>
                  </View>
                ))}
              </View>
            )}

            <View style={s.revisionCard}>
              <Text style={s.label}>AI에게 수정 요청</Text>
              <View style={s.revisionRow}>
                <TextInput
                  style={s.revisionInput}
                  value={revisionRequest}
                  onChangeText={setRevisionRequest}
                  placeholder="예: 700자로 줄이고 직무 연결을 강화해줘"
                  placeholderTextColor={t.faint}
                  multiline
                  maxLength={1000}
                  editable={!loading}
                />
                <TouchableOpacity
                  style={[s.revisionBtn, !canRevise && s.btnDisabled]}
                  onPress={handleRevise}
                  disabled={!canRevise}
                  activeOpacity={0.8}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Ionicons name="send" size={17} color="#fff" />
                  )}
                </TouchableOpacity>
              </View>
              {error ? <Text style={s.errorText}>{error}</Text> : null}
            </View>

            <View style={s.actions}>
              <TouchableOpacity style={s.secondaryBtn} onPress={handleGenerate} activeOpacity={0.8} disabled={loading}>
                <Ionicons name="refresh" size={16} color={t.ink} />
                <Text style={s.secondaryBtnText}>다시 생성</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.secondaryBtn, !essay.previousDraft && s.btnDisabled]}
                onPress={handleUndo}
                activeOpacity={0.8}
                disabled={!essay.previousDraft}
              >
                <Ionicons name="return-up-back" size={16} color={t.ink} />
                <Text style={s.secondaryBtnText}>되돌리기</Text>
              </TouchableOpacity>
            </View>

            <View style={s.actions}>
              <TouchableOpacity style={s.secondaryBtn} onPress={handleCopy} activeOpacity={0.8}>
                <Ionicons name="copy-outline" size={16} color={t.ink} />
                <Text style={s.secondaryBtnText}>복사</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.darkBtn} onPress={handleShare} activeOpacity={0.85}>
                <Ionicons name="share-social-outline" size={16} color="#fff" />
                <Text style={s.darkBtnText}>공유</Text>
              </TouchableOpacity>
            </View>
            {copied && <Text style={s.copiedText}>복사됨</Text>}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: t.bg },
  scroll: { paddingHorizontal: 20, paddingBottom: 32 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 14, marginBottom: 14 },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  tag: { flex: 1, fontSize: 10, fontWeight: '700', color: t.primary, letterSpacing: 1.2 },
  savedChip: { paddingHorizontal: 10, height: 22, borderRadius: 999, backgroundColor: t.primarySoft, alignItems: 'center', justifyContent: 'center' },
  savedChipText: { fontSize: 11, fontWeight: '600', color: t.primary },
  title: { fontSize: 22, fontWeight: '700', color: t.ink, marginBottom: 6 },
  sub: { fontSize: 12, color: t.muted, lineHeight: 18, marginBottom: 18 },
  section: { gap: 10 },
  label: { fontSize: 12, fontWeight: '700', color: t.muted, marginBottom: 8 },
  inputBox: {
    backgroundColor: t.surface, borderRadius: 14, borderWidth: 1, borderColor: t.borderStrong,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: t.ink, lineHeight: 21,
    marginBottom: 12,
  },
  questionInput: { minHeight: 132, textAlignVertical: 'top' },
  draftInput: { minHeight: 280, textAlignVertical: 'top' },
  primaryBtn: {
    height: 52, borderRadius: 14, backgroundColor: t.primary,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 4,
  },
  primaryBtnText: { fontSize: 15, fontWeight: '600', color: '#fff' },
  btnDisabled: { opacity: 0.45 },
  errorText: { fontSize: 12, color: t.danger, lineHeight: 18, marginBottom: 10 },
  questionBox: { backgroundColor: t.primarySoft, borderRadius: 14, padding: 14, marginBottom: 14 },
  questionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 6 },
  questionBoxLabel: { fontSize: 11, fontWeight: '700', color: t.primary, letterSpacing: 0.8 },
  editQuestionText: { fontSize: 12, fontWeight: '700', color: t.primary },
  questionBoxText: { fontSize: 13, color: t.ink, lineHeight: 20 },
  targetLengthText: { fontSize: 11, color: t.muted, marginTop: 8 },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 12 },
  charCount: { fontSize: 11, color: t.faint },
  saveInlineBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, height: 28 },
  saveInlineText: { fontSize: 12, fontWeight: '700', color: t.primary },
  citationCard: { backgroundColor: t.surface, borderRadius: 14, borderWidth: 1, borderColor: t.border, padding: 14, marginBottom: 14 },
  citationLabel: { fontSize: 11, fontWeight: '700', color: t.primary, letterSpacing: 0.8, marginBottom: 8 },
  evidenceRow: { flexDirection: 'row', gap: 8, marginBottom: 6 },
  evidenceDot: { color: t.primary, fontSize: 13, lineHeight: 20 },
  evidenceText: { flex: 1, minWidth: 0, fontSize: 12, color: t.inkSoft, lineHeight: 20 },
  revisionCard: { backgroundColor: t.surface, borderRadius: 14, borderWidth: 1, borderColor: t.border, padding: 14, marginBottom: 12 },
  revisionRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  revisionInput: {
    flex: 1, minHeight: 44, maxHeight: 112, borderRadius: 12, borderWidth: 1, borderColor: t.borderStrong,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: t.ink, lineHeight: 19,
  },
  revisionBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: t.primary, alignItems: 'center', justifyContent: 'center' },
  actions: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  secondaryBtn: {
    flex: 1, minHeight: 44, borderRadius: 14, backgroundColor: t.surface,
    borderWidth: 1, borderColor: t.borderStrong,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingHorizontal: 10,
  },
  secondaryBtnText: { fontSize: 14, fontWeight: '600', color: t.ink },
  darkBtn: {
    flex: 1, minHeight: 44, borderRadius: 14, backgroundColor: t.ink,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingHorizontal: 10,
  },
  darkBtnText: { fontSize: 14, fontWeight: '600', color: '#fff' },
  copiedText: { fontSize: 12, color: t.primary, textAlign: 'center', marginTop: 2 },
});
