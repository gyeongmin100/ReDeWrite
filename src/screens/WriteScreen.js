import React, { useState, useEffect } from 'react';
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
import { generateEssayDraft, reviseEssayDraft } from '../services/aiService';
import {
  applyEssayRevision,
  buildEssayPayload,
  buildEssayShareText,
  undoEssayRevision,
} from '../services/essayUtils.js';

let _idCounter = 0;
const makeId = () => `q_${++_idCounter}_${Date.now()}`;

function parseInitialState(research) {
  if (research?.essays && Array.isArray(research.essays) && research.essays.length > 0) {
    const qs =
      Array.isArray(research.questions) && research.questions.length === research.essays.length
        ? research.questions
        : research.essays.map((e, i) => ({
            id: `q_legacy_${i}`,
            questionText: e?.questionText || '',
            targetLength: e?.targetLength || '',
          }));
    return { questions: qs, essays: research.essays };
  }
  if (research?.essay?.draft) {
    const q = {
      id: makeId(),
      questionText: research.essay.questionText || '',
      targetLength: research.essay.targetLength || '',
    };
    return { questions: [q], essays: [research.essay] };
  }
  return {
    questions: [{ id: makeId(), questionText: '', targetLength: '' }],
    essays: [null],
  };
}

export default function WriteScreen({ navigation, route, researches, updateResearch, user }) {
  const { companyId } = route.params;
  const research = researches.find(r => r.companyId === companyId);
  const companyName = research?.name || research?.researchReport?.company || '기업';
  const report = research?.researchReport ?? null;
  const debateMessages = research?.bestFit?.messages ?? [];

  const { questions: initQ, essays: initE } = parseInitialState(research);
  const hasAnyDraft = initE.some(e => e?.draft);

  const [questions, setQuestions] = useState(initQ);
  const [essays, setEssays] = useState(initE);
  const [stage, setStage] = useState(hasAnyDraft ? 'result' : 'input');
  const [activeIdx, setActiveIdx] = useState(0);
  const [draftText, setDraftText] = useState(initE[0]?.draft || '');
  const [revisionRequest, setRevisionRequest] = useState('');
  const [loading, setLoading] = useState(false);
  const [generatingIdx, setGeneratingIdx] = useState(-1);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  // 탭 전환 시 해당 문항의 초안으로 동기화
  useEffect(() => {
    setDraftText(essays[activeIdx]?.draft || '');
    setRevisionRequest('');
    setCopied(false);
    setError('');
  }, [activeIdx]); // eslint-disable-line react-hooks/exhaustive-deps

  const persistAll = (nextQ, nextE) => {
    const hasDraft = nextE.some(e => e?.draft);
    updateResearch(companyId, {
      questions: nextQ,
      essays: nextE,
      ...(hasDraft
        ? {
            pipeline: ['done', 'done', 'done'],
            completedSteps: Math.max(research?.completedSteps ?? 0, 3),
          }
        : {}),
    });
  };

  const updateQuestion = (idx, field, value) => {
    setQuestions(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  };

  const addQuestion = () => {
    setQuestions(prev => [...prev, { id: makeId(), questionText: '', targetLength: '' }]);
    setEssays(prev => [...prev, null]);
  };

  const removeQuestion = (idx) => {
    if (questions.length <= 1) return;
    const nextQ = questions.filter((_, i) => i !== idx);
    const nextE = essays.filter((_, i) => i !== idx);
    setQuestions(nextQ);
    setEssays(nextE);
    if (activeIdx >= idx && activeIdx > 0) setActiveIdx(prev => prev - 1);
  };

  const handleGenerateAll = async () => {
    const hasValid = questions.some(q => q.questionText.trim());
    if (!hasValid || loading) return;

    // 입력 화면에서 그대로 생성 시작 (stage 전환 없음)
    setLoading(true);
    setGeneratingIdx(0);
    setError('');

    const nextEssays = [...essays];

    for (let idx = 0; idx < questions.length; idx++) {
      const q = questions[idx];
      if (!q.questionText.trim() || nextEssays[idx]?.draft) continue;

      setGeneratingIdx(idx);

      try {
        const result = await generateEssayDraft({
          questionText: q.questionText.trim(),
          targetLength: q.targetLength.trim(),
          researchReport: report,
          debateMessages,
          userExperiences: user?.experiences ?? [],
        });
        nextEssays[idx] = buildEssayPayload({
          questionText: q.questionText.trim(),
          targetLength: q.targetLength,
          draft: result.draft,
          evidenceSummary: result.evidenceSummary,
        });
        setEssays([...nextEssays]);
      } catch (err) {
        console.warn(`generateEssayDraft error q${idx + 1}:`, err.message);
        setError(`문항 ${idx + 1} 생성 실패. 잠시 후 다시 시도해 주세요.`);
      }
    }

    setGeneratingIdx(-1);
    setLoading(false);
    setActiveIdx(0);
    setDraftText(nextEssays[0]?.draft || '');
    persistAll(questions, nextEssays);

    // 모든 생성 완료 후 결과 화면으로 전환
    if (nextEssays.some(e => e?.draft)) {
      setStage('result');
    }
  };

  const handleGenerate = async () => {
    const q = questions[activeIdx];
    const trimmedQuestion = q?.questionText.trim();
    if (!trimmedQuestion || loading) return;

    setLoading(true);
    setError('');
    setCopied(false);

    try {
      const result = await generateEssayDraft({
        questionText: trimmedQuestion,
        targetLength: q.targetLength.trim(),
        researchReport: report,
        debateMessages,
        userExperiences: user?.experiences ?? [],
      });
      const nextEssay = buildEssayPayload({
        questionText: trimmedQuestion,
        targetLength: q.targetLength,
        draft: result.draft,
        evidenceSummary: result.evidenceSummary,
      });
      const nextEssays = [...essays];
      nextEssays[activeIdx] = nextEssay;
      setEssays(nextEssays);
      setDraftText(nextEssay.draft);
      persistAll(questions, nextEssays);
    } catch (err) {
      console.warn('generateEssayDraft error:', err.message);
      setError('초안 생성에 실패했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveDraft = () => {
    const essay = essays[activeIdx];
    if (!essay) return;
    const nextEssay = buildEssayPayload({
      ...essay,
      questionText: questions[activeIdx].questionText,
      targetLength: questions[activeIdx].targetLength,
      draft: draftText,
    });
    const nextEssays = [...essays];
    nextEssays[activeIdx] = nextEssay;
    setEssays(nextEssays);
    setCopied(false);
    persistAll(questions, nextEssays);
  };

  const handleRevise = async () => {
    const request = revisionRequest.trim();
    const essay = essays[activeIdx];
    const q = questions[activeIdx];
    if (!essay || !draftText.trim() || !request || loading) return;

    setLoading(true);
    setError('');
    setCopied(false);

    try {
      const result = await reviseEssayDraft({
        questionText: q.questionText.trim() || essay.questionText,
        targetLength: q.targetLength.trim() || essay.targetLength,
        currentDraft: draftText,
        revisionRequest: request,
        researchReport: report,
        debateMessages,
        userExperiences: user?.experiences ?? [],
      });
      const revised = applyEssayRevision(
        { ...essay, questionText: q.questionText, targetLength: q.targetLength, draft: draftText },
        result.draft,
      );
      const nextEssay = buildEssayPayload({ ...revised, evidenceSummary: result.evidenceSummary });
      const nextEssays = [...essays];
      nextEssays[activeIdx] = nextEssay;
      setEssays(nextEssays);
      setDraftText(nextEssay.draft);
      setRevisionRequest('');
      persistAll(questions, nextEssays);
    } catch (err) {
      console.warn('reviseEssayDraft error:', err.message);
      setError('AI 수정에 실패했어요. 요청을 조금 더 짧게 바꿔 다시 시도해 주세요.');
    } finally {
      setLoading(false);
    }
  };

  const handleUndo = () => {
    const essay = essays[activeIdx];
    if (!essay?.previousDraft) return;
    const nextEssay = undoEssayRevision(essay);
    const nextEssays = [...essays];
    nextEssays[activeIdx] = nextEssay;
    setEssays(nextEssays);
    setDraftText(nextEssay.draft);
    persistAll(questions, nextEssays);
  };

  const handleCopy = async () => {
    const essay = essays[activeIdx];
    if (!essay?.draft) return;
    const text = buildEssayShareText({
      companyName,
      essay: { ...essay, questionText: questions[activeIdx].questionText, draft: draftText },
    });
    await Clipboard.setStringAsync(text);
    setCopied(true);
  };

  const handleShare = async () => {
    const essay = essays[activeIdx];
    if (!essay?.draft) return;
    const text = buildEssayShareText({
      companyName,
      essay: { ...essay, questionText: questions[activeIdx].questionText, draft: draftText },
    });
    try {
      await Share.share({ message: text });
    } catch (err) {
      console.warn('Share essay error:', err.message);
    }
  };

  const activeEssay = essays[activeIdx] ?? null;
  const activeQuestion = questions[activeIdx] ?? questions[0];
  const dirty = Boolean(activeEssay && draftText !== activeEssay.draft);
  const canGenerate = Boolean(activeQuestion?.questionText.trim()) && !loading;
  const canRevise = Boolean(activeEssay?.draft && revisionRequest.trim() && !loading);

  // ─────────────────────────────────────────
  // INPUT STAGE
  // ─────────────────────────────────────────
  if (stage === 'input') {
    return (
      <SafeAreaView style={s.root}>
        <ScrollView
          contentContainerStyle={s.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={s.header}>
            <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
              <Ionicons name="arrow-back" size={20} color={t.ink} />
            </TouchableOpacity>
            <Text style={s.tag}>WRITE · 자소서</Text>
          </View>

          <Text style={s.title}>{companyName} 자소서</Text>
          <Text style={s.sub}>지원서 문항을 입력하면 AI가 맞춤 초안을 작성합니다</Text>

          {questions.map((q, idx) => (
            <View key={q.id} style={s.questionCard}>
              <View style={s.questionCardHeader}>
                <View style={s.qNumBadge}>
                  <Text style={s.qNumText}>{idx + 1}</Text>
                </View>
                <Text style={s.qCardTitle}>문항 {idx + 1}</Text>
                {essays[idx]?.draft && (
                  <View style={s.draftDoneChip}>
                    <Ionicons name="checkmark-circle" size={13} color={t.primary} />
                    <Text style={s.draftDoneText}>초안 완료</Text>
                  </View>
                )}
                {questions.length > 1 && (
                  <TouchableOpacity
                    style={s.deleteBtn}
                    onPress={() => removeQuestion(idx)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="close" size={16} color={t.muted} />
                  </TouchableOpacity>
                )}
              </View>

              <TextInput
                style={[s.inputBox, s.questionInput]}
                value={q.questionText}
                onChangeText={(v) => updateQuestion(idx, 'questionText', v)}
                placeholder="지원서에 있는 문항을 그대로 붙여넣어 주세요"
                placeholderTextColor={t.faint}
                multiline
                maxLength={2000}
              />

              <TextInput
                style={s.charLimitInput}
                value={q.targetLength}
                onChangeText={(v) => updateQuestion(idx, 'targetLength', v.replace(/[^0-9]/g, ''))}
                placeholder="글자 수 제한"
                placeholderTextColor={t.faint}
                keyboardType="numeric"
                maxLength={6}
              />
            </View>
          ))}

          <TouchableOpacity style={s.addQuestionBtn} onPress={addQuestion} activeOpacity={0.75}>
            <Ionicons name="add-circle-outline" size={18} color={t.primary} />
            <Text style={s.addQuestionText}>문항 추가</Text>
          </TouchableOpacity>

          {error ? <Text style={s.errorText}>{error}</Text> : null}

          <TouchableOpacity
            style={[s.primaryBtn, (questions.every(q => !q.questionText.trim()) || loading) && s.btnDisabled]}
            onPress={handleGenerateAll}
            activeOpacity={0.85}
            disabled={questions.every(q => !q.questionText.trim()) || loading}
          >
            {loading ? (
              <>
                <ActivityIndicator size="small" color="#fff" />
                <Text style={s.primaryBtnText}>
                  문항 {generatingIdx + 1}/{questions.length} 생성 중...
                </Text>
              </>
            ) : (
              <>
                <Ionicons name="sparkles" size={18} color="#fff" />
                <Text style={s.primaryBtnText}>AI 초안 생성</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ─────────────────────────────────────────
  // RESULT STAGE
  // ─────────────────────────────────────────
  return (
    <SafeAreaView style={s.root}>
      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={20} color={t.ink} />
          </TouchableOpacity>
          <Text style={s.tag}>WRITE · 자소서</Text>
          {essays.some(e => e?.draft) && (
            <View style={s.savedChip}>
              <Text style={s.savedChipText}>저장됨</Text>
            </View>
          )}
          <TouchableOpacity onPress={() => setStage('input')} activeOpacity={0.75}>
            <Text style={s.editQText}>문항 편집</Text>
          </TouchableOpacity>
        </View>

        <Text style={s.title}>{companyName} 자소서</Text>

        {/* 문항 탭 */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={s.tabsScroll}
          contentContainerStyle={s.tabsContainer}
        >
          {questions.map((q, idx) => (
            <TouchableOpacity
              key={q.id}
              style={[s.tab, activeIdx === idx && s.tabActive]}
              onPress={() => setActiveIdx(idx)}
              activeOpacity={0.75}
            >
              {essays[idx]?.draft && <View style={s.tabDot} />}
              <Text style={[s.tabText, activeIdx === idx && s.tabTextActive]}>
                문항 {idx + 1}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* 선택된 문항 */}
        <View style={s.questionBox}>
          <Text style={s.questionBoxLabel}>QUESTION {activeIdx + 1}</Text>
          <Text style={s.questionBoxText}>
            {activeQuestion.questionText || '문항을 입력해 주세요'}
          </Text>
          {activeQuestion.targetLength ? (
            <Text style={s.targetLengthText}>{activeQuestion.targetLength}자 이내</Text>
          ) : null}
        </View>

        {!activeEssay?.draft ? (
          <View style={s.emptyDraftBox}>
            {loading ? (
              <ActivityIndicator size="small" color={t.primary} />
            ) : (
              <>
                <Text style={s.emptyDraftText}>아직 초안이 없어요</Text>
                <TouchableOpacity
                  style={[s.primaryBtn, !canGenerate && s.btnDisabled]}
                  onPress={handleGenerate}
                  activeOpacity={0.85}
                  disabled={!canGenerate}
                >
                  <Ionicons name="sparkles" size={18} color="#fff" />
                  <Text style={s.primaryBtnText}>이 문항 초안 생성</Text>
                </TouchableOpacity>
              </>
            )}
            {error ? <Text style={s.errorText}>{error}</Text> : null}
          </View>
        ) : (
          <>
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

            {activeEssay.evidenceSummary?.length > 0 && (
              <View style={s.citationCard}>
                <Text style={s.citationLabel}>반영 근거</Text>
                {activeEssay.evidenceSummary.map((item, index) => (
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
              <TouchableOpacity
                style={s.secondaryBtn}
                onPress={handleGenerate}
                activeOpacity={0.8}
                disabled={loading}
              >
                <Ionicons name="refresh" size={16} color={t.ink} />
                <Text style={s.secondaryBtnText}>다시 생성</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.secondaryBtn, !activeEssay.previousDraft && s.btnDisabled]}
                onPress={handleUndo}
                activeOpacity={0.8}
                disabled={!activeEssay.previousDraft}
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
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: t.bg },
  scroll: { paddingHorizontal: 20, paddingBottom: 40 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 14,
    marginBottom: 14,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  tag: { flex: 1, fontSize: 10, fontWeight: '700', color: t.primary, letterSpacing: 1.2 },
  savedChip: {
    paddingHorizontal: 10,
    height: 22,
    borderRadius: 999,
    backgroundColor: t.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  savedChipText: { fontSize: 11, fontWeight: '600', color: t.primary },
  editQText: { fontSize: 12, fontWeight: '700', color: t.primary },
  title: { fontSize: 22, fontWeight: '700', color: t.ink, marginBottom: 6 },
  sub: { fontSize: 12, color: t.muted, lineHeight: 18, marginBottom: 20 },
  section: { gap: 10 },
  label: { fontSize: 12, fontWeight: '700', color: t.muted, marginBottom: 8 },

  // 문항 카드 (input stage)
  questionCard: {
    backgroundColor: t.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: t.border,
    padding: 14,
    marginBottom: 12,
  },
  questionCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  qNumBadge: {
    width: 24,
    height: 24,
    borderRadius: 8,
    backgroundColor: t.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qNumText: { fontSize: 12, fontWeight: '700', color: '#fff' },
  qCardTitle: { flex: 1, fontSize: 13, fontWeight: '700', color: t.ink },
  draftDoneChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  draftDoneText: { fontSize: 11, fontWeight: '600', color: t.primary },
  deleteBtn: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },

  inputBox: {
    backgroundColor: t.bg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: t.borderStrong,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: t.ink,
    lineHeight: 21,
    marginBottom: 8,
  },
  questionInput: { minHeight: 100, textAlignVertical: 'top' },
  charLimitInput: {
    backgroundColor: t.bg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: t.borderStrong,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: t.ink,
  },

  addQuestionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: t.primary,
    borderStyle: 'dashed',
    marginBottom: 16,
  },
  addQuestionText: { fontSize: 14, fontWeight: '600', color: t.primary },

  primaryBtn: {
    height: 52,
    borderRadius: 14,
    backgroundColor: t.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
  },
  primaryBtnText: { fontSize: 15, fontWeight: '600', color: '#fff' },
  btnDisabled: { opacity: 0.45 },
  errorText: { fontSize: 12, color: t.danger, lineHeight: 18, marginBottom: 10 },

  // 탭 (result stage)
  tabsScroll: { marginBottom: 14 },
  tabsContainer: { gap: 8, paddingBottom: 2 },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    height: 32,
    borderRadius: 999,
    backgroundColor: t.surface,
    borderWidth: 1,
    borderColor: t.border,
  },
  tabActive: {
    backgroundColor: t.primarySoft,
    borderColor: t.primary,
  },
  tabDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: t.primary,
  },
  tabText: { fontSize: 13, fontWeight: '600', color: t.muted },
  tabTextActive: { color: t.primary },

  // 문항 박스 (result stage)
  questionBox: {
    backgroundColor: t.primarySoft,
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    gap: 6,
  },
  questionBoxLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: t.primary,
    letterSpacing: 0.8,
  },
  questionBoxText: { fontSize: 13, color: t.ink, lineHeight: 20 },
  targetLengthText: { fontSize: 11, color: t.muted },

  draftInput: { minHeight: 280, textAlignVertical: 'top' },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 12,
  },
  charCount: { fontSize: 11, color: t.faint },
  saveInlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    height: 28,
  },
  saveInlineText: { fontSize: 12, fontWeight: '700', color: t.primary },
  citationCard: {
    backgroundColor: t.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: t.border,
    padding: 14,
    marginBottom: 14,
  },
  citationLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: t.primary,
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  evidenceRow: { flexDirection: 'row', gap: 8, marginBottom: 6 },
  evidenceDot: { color: t.primary, fontSize: 13, lineHeight: 20 },
  evidenceText: { flex: 1, minWidth: 0, fontSize: 12, color: t.inkSoft, lineHeight: 20 },
  revisionCard: {
    backgroundColor: t.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: t.border,
    padding: 14,
    marginBottom: 12,
  },
  revisionRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  revisionInput: {
    flex: 1,
    minHeight: 44,
    maxHeight: 112,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: t.borderStrong,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: t.ink,
    lineHeight: 19,
  },
  revisionBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: t.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  secondaryBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: 14,
    backgroundColor: t.surface,
    borderWidth: 1,
    borderColor: t.borderStrong,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 10,
  },
  secondaryBtnText: { fontSize: 14, fontWeight: '600', color: t.ink },
  darkBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: 14,
    backgroundColor: t.ink,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 10,
  },
  darkBtnText: { fontSize: 14, fontWeight: '600', color: '#fff' },
  copiedText: { fontSize: 12, color: t.primary, textAlign: 'center', marginTop: 2 },
  progressCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: t.primarySoft,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 14,
  },
  progressText: { fontSize: 13, fontWeight: '600', color: t.primary },
  emptyDraftBox: {
    gap: 12,
    paddingVertical: 8,
  },
  emptyDraftText: { fontSize: 13, color: t.muted, textAlign: 'center' },
});
