import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { tokens as t } from '../theme/tokens';
import { PIPELINE_COMPLETE } from '../constants/researchStages';
import {
  applyEssayRevision,
  buildEssayPayload,
  buildEssayShareText,
  buildWriteState,
  countEssayChars,
  getEssayLengthTarget,
  getWriteStageAfterStateChange,
  hasAllRequiredEssaysComplete,
  hasTemporaryWriteQuestions,
  normalizeWriteState,
  redoEssayRevision,
  shouldAutosaveWriteQuestions,
  undoEssayRevision,
} from '../services/essayUtils.js';

let idCounter = 0;
const makeId = () => `q_${++idCounter}_${Date.now()}`;

function getInitialWriteState(research) {
  if (research?.essay) return normalizeWriteState(research.essay);

  if (Array.isArray(research?.essays) && research.essays.length > 0) {
    const questions =
      Array.isArray(research.questions) && research.questions.length === research.essays.length
        ? research.questions
        : research.essays.map((essay, index) => ({
            id: `q_legacy_${index}`,
            questionText: essay?.questionText || '',
            targetLength: essay?.targetLength || '',
          }));

    return buildWriteState({ questions, essays: research.essays, pending: null });
  }

  return buildWriteState({
    questions: [{ id: makeId(), questionText: '', targetLength: '' }],
    essays: [null],
    pending: null,
  });
}

export default function WriteScreen({
  navigation,
  route,
  researches,
  updateResearch,
  startWriteGenerateAll,
  startWriteGenerateOne,
  startWriteRevise,
  resumeWriteTask,
}) {
  const { companyId } = route.params;
  const research = researches.find(r => r.companyId === companyId);
  const companyName = research?.name || research?.researchReport?.company || '기업';
  const initialState = getInitialWriteState(research);

  const [questions, setQuestions] = useState(initialState.questions);
  const [essays, setEssays] = useState(initialState.essays);
  const [stage, setStage] = useState(
    hasAllRequiredEssaysComplete(initialState.questions, initialState.essays) ? 'result' : 'input',
  );
  const [activeIdx, setActiveIdx] = useState(0);
  const [draftText, setDraftText] = useState(initialState.essays[0]?.draft || '');
  const [revisionRequest, setRevisionRequest] = useState('');
  const [loading, setLoading] = useState(initialState.pending?.status === 'pending');
  const [error, setError] = useState('');
  const autosaveReadyRef = useRef(false);
  const lastAutosavedQuestionsRef = useRef(JSON.stringify(initialState.questions));
  const autosaveTimerRef = useRef(null);
  const savedWriteStateRef = useRef(initialState);
  const generateAllPendingRef = useRef(false);
  const editingQuestionsRef = useRef(false);
  const revisionPendingRef = useRef(false);
  const revisionPendingSeenRef = useRef(false);
  const suppressNextResearchSyncRef = useRef(false);
  const inputScrollRef = useRef(null);
  const resultScrollRef = useRef(null);
  const questionYRef = useRef({});
  const focusedQuestionIdxRef = useRef(null);
  const draftYRef = useRef(0);
  const revisionYRef = useRef(0);

  useEffect(() => {
    const state = getInitialWriteState(research);
    savedWriteStateRef.current = state;
    if (suppressNextResearchSyncRef.current) {
      suppressNextResearchSyncRef.current = false;
      lastAutosavedQuestionsRef.current = JSON.stringify(state.questions);
      return;
    }
    setQuestions(state.questions);
    setEssays(state.essays);
    lastAutosavedQuestionsRef.current = JSON.stringify(state.questions);
    setLoading(state.pending?.status === 'pending');

    if (state.pending?.status === 'failed') {
      setError(state.pending.errorMessage || '자소서 생성에 실패했습니다. 다시 시도해 주세요.');
    } else {
      setError('');
    }

    const pending = state.pending;
    const isPending = pending?.status === 'pending';
    const isComplete = hasAllRequiredEssaysComplete(state.questions, state.essays);
    const nextStage = getWriteStageAfterStateChange({
      currentStage: stage,
      previousGenerateAllPending: generateAllPendingRef.current,
      pending,
      isComplete,
      isEditingQuestions: editingQuestionsRef.current,
    });

    if (!isPending) {
      generateAllPendingRef.current = false;
    }
    if (nextStage === 'result') {
      editingQuestionsRef.current = false;
      if (stage !== 'result') {
        setActiveIdx(0);
        setDraftText(state.essays[0]?.draft || '');
      }
    }
    if (nextStage !== stage) setStage(nextStage);
    if (nextStage !== 'result' || stage === 'result') {
      setDraftText(state.essays[activeIdx]?.draft || '');
    }

    if (revisionPendingRef.current && state.pending?.type === 'revise' && state.pending?.status === 'pending') {
      revisionPendingSeenRef.current = true;
    }

    if (
      revisionPendingRef.current
      && revisionPendingSeenRef.current
      && !state.pending
      && state.essays[activeIdx]?.draft
    ) {
      revisionPendingRef.current = false;
      revisionPendingSeenRef.current = false;
      setRevisionRequest('');
      setTimeout(() => {
        resultScrollRef.current?.scrollTo({ y: 0, animated: true });
      }, 120);
    } else if (revisionPendingRef.current && state.pending?.status === 'failed') {
      revisionPendingRef.current = false;
      revisionPendingSeenRef.current = false;
    }
  }, [research?.essay]);

  useEffect(() => {
    setDraftText(essays[activeIdx]?.draft || '');
  }, [activeIdx, essays]);

  useEffect(() => {
    resumeWriteTask?.(companyId);
  }, [companyId, research?.essay?.pending?.requestedAt, research?.essay?.pending?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
    if (!research?.researchReport || loading) return undefined;

    const serializedQuestions = JSON.stringify(questions);
    if (!autosaveReadyRef.current) {
      autosaveReadyRef.current = true;
      lastAutosavedQuestionsRef.current = serializedQuestions;
      return undefined;
    }
    if (!shouldAutosaveWriteQuestions({
      serializedQuestions,
      lastSerializedQuestions: lastAutosavedQuestionsRef.current,
      loading,
      hasTemporaryQuestions: hasTemporaryWriteQuestions(questions, essays),
      isEditingQuestions: editingQuestionsRef.current,
    })) return undefined;

    autosaveTimerRef.current = setTimeout(() => {
      const nextEssayState = buildWriteState({
        previousState: research?.essay,
        questions,
        essays,
        pending: null,
      });
      lastAutosavedQuestionsRef.current = serializedQuestions;
      updateResearch(companyId, { essay: nextEssayState });
      autosaveTimerRef.current = null;
    }, 800);

    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
    };
  }, [companyId, essays, loading, questions, research?.essay, research?.researchReport, updateResearch]);

  const scrollInputTo = (y, offset = 24) => {
    setTimeout(() => {
      inputScrollRef.current?.scrollTo({
        y: Math.max(y - offset, 0),
        animated: true,
      });
    }, 80);
  };

  const scrollResultTo = (y, offset = 24) => {
    setTimeout(() => {
      resultScrollRef.current?.scrollTo({
        y: Math.max(y - offset, 0),
        animated: true,
      });
    }, 80);
  };

  const persistAll = (nextQuestions, nextEssays) => {
    const hasDraft = nextEssays.some(essay => essay?.draft);
    const nextEssayState = buildWriteState({
      previousState: research?.essay,
      questions: nextQuestions,
      essays: nextEssays,
      pending: null,
    });
    savedWriteStateRef.current = nextEssayState;

    updateResearch(companyId, {
      essay: nextEssayState,
      ...(hasDraft
        ? {
            pipeline: PIPELINE_COMPLETE,
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
    setActiveIdx(questions.length);
  };

  const removeQuestion = (idx) => {
    if (questions.length <= 1) return;
    const removedQuestionId = questions[idx]?.id;
    const nextQuestions = questions.filter((_, index) => index !== idx);
    const nextEssays = essays.filter((_, index) => index !== idx);
    setQuestions(nextQuestions);
    setEssays(nextEssays);

    const savedState = savedWriteStateRef.current;
    const savedIndex = savedState.questions.findIndex(question => question.id === removedQuestionId);
    if (savedIndex >= 0) {
      const savedQuestions = savedState.questions.filter((_, index) => index !== savedIndex);
      const savedEssays = savedState.essays.filter((_, index) => index !== savedIndex);
      const nextSavedState = buildWriteState({
        previousState: savedState,
        questions: savedQuestions,
        essays: savedEssays,
        pending: null,
      });
      savedWriteStateRef.current = nextSavedState;
      lastAutosavedQuestionsRef.current = JSON.stringify(nextSavedState.questions);
      suppressNextResearchSyncRef.current = true;
      const hasDraft = savedEssays.some(essay => essay?.draft);
      updateResearch(companyId, {
        essay: nextSavedState,
        ...(hasDraft
          ? {
              pipeline: PIPELINE_COMPLETE,
              completedSteps: Math.max(research?.completedSteps ?? 0, 3),
            }
          : {}),
      });
    }
    if (activeIdx >= idx && activeIdx > 0) setActiveIdx(prev => prev - 1);
  };

  const confirmRemoveQuestion = (idx) => {
    if (questions.length <= 1 || loading) return;
    Alert.alert(
      '문항을 삭제하시겠습니까?',
      '삭제한 문항과 해당 초안은 복구할 수 없습니다.',
      [
        { text: '취소', style: 'cancel' },
        { text: '삭제', style: 'destructive', onPress: () => removeQuestion(idx) },
      ],
    );
  };

  const handleReturnToEssayBox = () => {
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
    const savedState = savedWriteStateRef.current;
    const nextActiveIdx = Math.min(activeIdx, Math.max(savedState.questions.length - 1, 0));
    editingQuestionsRef.current = false;
    setQuestions(savedState.questions);
    setEssays(savedState.essays);
    setActiveIdx(nextActiveIdx);
    setDraftText(savedState.essays[nextActiveIdx]?.draft || '');
    lastAutosavedQuestionsRef.current = JSON.stringify(savedState.questions);
    setStage('result');
  };

  const getCurrentWriteState = (nextEssays = essays) =>
    buildWriteState({
      previousState: research?.essay,
      questions,
      essays: nextEssays,
    });

  const handleGenerateAll = () => {
    if (questions.every(q => !q.questionText.trim()) || loading) return;

    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
    const state = getCurrentWriteState();
    lastAutosavedQuestionsRef.current = JSON.stringify(state.questions);
    generateAllPendingRef.current = true;
    editingQuestionsRef.current = false;
    setStage('input');
    setLoading(true);
    setError('');
    startWriteGenerateAll?.(companyId, state.questions, state.essays);
  };

  const handleGenerate = () => {
    const question = questions[activeIdx];
    if (!question?.questionText.trim() || loading) return;

    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
    const state = getCurrentWriteState();
    lastAutosavedQuestionsRef.current = JSON.stringify(state.questions);
    editingQuestionsRef.current = false;
    updateResearch(companyId, { essay: state });
    setLoading(true);
    setError('');
    startWriteGenerateOne?.(companyId, state.questions, state.essays, activeIdx);
  };

  const handleSaveDraft = () => {
    const essay = essays[activeIdx];
    if (!essay) return;

    const nextEssay = applyEssayRevision(
      {
        ...essay,
        questionText: questions[activeIdx].questionText,
        targetLength: questions[activeIdx].targetLength,
      },
      draftText,
    );
    const nextEssays = [...essays];
    nextEssays[activeIdx] = nextEssay;
    setEssays(nextEssays);
    persistAll(questions, nextEssays);
  };

  const handleRevise = () => {
    const request = revisionRequest.trim();
    const essay = essays[activeIdx];
    if (!essay || !draftText.trim() || !request || loading) return;

    const nextEssays = [...essays];
    nextEssays[activeIdx] = buildEssayPayload({ ...essay, draft: draftText });
    const state = getCurrentWriteState(nextEssays);

    revisionPendingRef.current = true;
    revisionPendingSeenRef.current = false;
    updateResearch(companyId, { essay: state });
    setEssays(nextEssays);
    setLoading(true);
    setError('');
    startWriteRevise?.(companyId, state.questions, state.essays, activeIdx, draftText, request);
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

  const handleRedo = () => {
    const essay = essays[activeIdx];
    if (!essay?.redoDraft) return;

    const nextEssay = redoEssayRevision(essay);
    const nextEssays = [...essays];
    nextEssays[activeIdx] = nextEssay;
    setEssays(nextEssays);
    setDraftText(nextEssay.draft);
    persistAll(questions, nextEssays);
  };

  const handleCopy = async () => {
    const essay = essays[activeIdx];
    if (!essay?.draft) return;

    await Clipboard.setStringAsync(
      buildEssayShareText({
        companyName,
        essay: { ...essay, questionText: questions[activeIdx].questionText, draft: draftText },
      }),
    );
  };

  const handleShare = async () => {
    const essay = essays[activeIdx];
    if (!essay?.draft) return;

    try {
      await Share.share({
        message: buildEssayShareText({
          companyName,
          essay: { ...essay, questionText: questions[activeIdx].questionText, draft: draftText },
        }),
      });
    } catch (err) {
      console.warn('Share essay error:', err.message);
    }
  };

  const activeEssay = essays[activeIdx] ?? null;
  const activeQuestion = questions[activeIdx] ?? questions[0];
  const activeLengthTarget = getEssayLengthTarget(activeQuestion?.targetLength);
  const draftCharCount = countEssayChars(draftText);
  const dirty = Boolean(activeEssay && draftText !== activeEssay.draft);
  const canGenerate = Boolean(activeQuestion?.questionText.trim()) && !loading;
  const canRevise = Boolean(activeEssay?.draft && revisionRequest.trim() && !loading);
  const currentPending = research?.essay?.pending;
  const generatingAllInProgress = Boolean(
    generateAllPendingRef.current
    || (currentPending?.status === 'pending' && currentPending?.type === 'generateAll')
  );
  const canReturnToEssayBox = Boolean(
    editingQuestionsRef.current
    && !loading
    && !generatingAllInProgress
    && hasAllRequiredEssaysComplete(savedWriteStateRef.current.questions, savedWriteStateRef.current.essays)
  );
  const shouldShowInputStage = stage === 'input' || generatingAllInProgress;

  if (shouldShowInputStage) {
    return (
      <SafeAreaView style={s.root} edges={['top']}>
        <KeyboardAvoidingView
          style={s.keyboard}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={0}
        >
        <ScrollView
          ref={inputScrollRef}
          contentContainerStyle={s.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={s.header}>
            <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
              <Ionicons name="arrow-back" size={20} color={t.ink} />
            </TouchableOpacity>
            <Text style={s.tag}>WRITE · 자소서</Text>
            {canReturnToEssayBox ? (
              <TouchableOpacity onPress={handleReturnToEssayBox} activeOpacity={0.75}>
                <Text style={s.editQText}>자소서함</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          <Text style={s.title}>{companyName} 자소서</Text>
          <Text style={s.sub}>지원서 문항과 글자 수를 입력하면 AI가 맞춤 초안을 작성합니다.</Text>

          {questions.map((question, idx) => (
            <View
              key={question.id}
              style={s.questionCard}
              onLayout={event => { questionYRef.current[idx] = event.nativeEvent.layout.y; }}
            >
              <View style={s.questionCardHeader}>
                <View style={s.qNumBadge}>
                  <Text style={s.qNumText}>{idx + 1}</Text>
                </View>
                <Text style={s.qCardTitle}>문항 {idx + 1}</Text>
                {questions.length > 1 ? (
                  <TouchableOpacity
                    style={[s.deleteBtn, loading && { opacity: 0.35 }]}
                    onPress={() => confirmRemoveQuestion(idx)}
                    activeOpacity={0.7}
                    disabled={loading}
                  >
                    <Ionicons name="close" size={16} color={t.muted} />
                  </TouchableOpacity>
                ) : null}
              </View>

              <TextInput
                style={[s.inputBox, s.questionInput]}
                value={question.questionText}
                onChangeText={value => updateQuestion(idx, 'questionText', value)}
                onFocus={() => {
                  focusedQuestionIdxRef.current = idx;
                  scrollInputTo(questionYRef.current[idx] || 0);
                }}
                onContentSizeChange={event => {
                  if (focusedQuestionIdxRef.current === idx) {
                    scrollInputTo(
                      (questionYRef.current[idx] || 0) + event.nativeEvent.contentSize.height,
                      260,
                    );
                  }
                }}
                placeholder="지원서에 있는 문항을 그대로 붙여 넣어 주세요"
                placeholderTextColor={t.faint}
                multiline
                maxLength={2000}
                editable={!loading}
              />

              <TextInput
                style={s.charLimitInput}
                value={question.targetLength}
                onChangeText={value => updateQuestion(idx, 'targetLength', value.replace(/[^0-9]/g, ''))}
                onFocus={() => scrollInputTo(questionYRef.current[idx] || 0)}
                placeholder="글자 수 제한"
                placeholderTextColor={t.faint}
                keyboardType="numeric"
                maxLength={6}
                editable={!loading}
              />
            </View>
          ))}

          <TouchableOpacity style={[s.addQuestionBtn, loading && s.btnDisabled]} onPress={addQuestion} activeOpacity={0.75} disabled={loading}>
            <Ionicons name="add-circle-outline" size={18} color={t.primary} />
            <Text style={s.addQuestionText}>문항 추가</Text>
          </TouchableOpacity>

          {error ? <Text style={s.errorText}>{error}</Text> : null}

          <TouchableOpacity
            style={[
              s.primaryBtn,
              (questions.every(q => !q.questionText.trim()) || loading) && s.btnDisabled,
            ]}
            onPress={handleGenerateAll}
            activeOpacity={0.85}
            disabled={questions.every(q => !q.questionText.trim()) || loading}
          >
            {loading ? (
              <>
                <ActivityIndicator size="small" color="#fff" />
                <Text style={s.primaryBtnText}>자소서 초안 작성중</Text>
              </>
            ) : (
              <>
                <Ionicons name="sparkles" size={18} color="#fff" />
                <Text style={s.primaryBtnText}>AI 초안 생성</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <KeyboardAvoidingView
        style={s.keyboard}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
      <ScrollView
        ref={resultScrollRef}
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={20} color={t.ink} />
          </TouchableOpacity>
          <Text style={s.tag}>WRITE · 자소서</Text>
          <TouchableOpacity
            onPress={() => {
              editingQuestionsRef.current = true;
              setStage('input');
            }}
            activeOpacity={0.75}
          >
            <Text style={s.editQText}>문항 편집</Text>
          </TouchableOpacity>
        </View>

        <Text style={s.title}>{companyName} 자소서</Text>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={s.tabsScroll}
          contentContainerStyle={s.tabsContainer}
        >
          {questions.map((question, idx) => (
            <TouchableOpacity
              key={question.id}
              style={[s.tab, activeIdx === idx && s.tabActive]}
              onPress={() => setActiveIdx(idx)}
              activeOpacity={0.75}
            >
              {essays[idx]?.draft ? <View style={s.tabDot} /> : null}
              <Text style={[s.tabText, activeIdx === idx && s.tabTextActive]}>문항 {idx + 1}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={s.questionBox}>
          <Text style={s.questionBoxLabel}>QUESTION {activeIdx + 1}</Text>
          <Text style={s.questionBoxText}>{activeQuestion?.questionText || '문항을 입력해 주세요'}</Text>
          {activeQuestion?.targetLength ? (
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
            <View
              style={s.draftHeaderRow}
              onLayout={event => { draftYRef.current = event.nativeEvent.layout.y; }}
            >
              <Text style={[s.label, s.draftLabel]}>초안</Text>
              <View style={s.draftHeaderActions}>
                <TouchableOpacity
                  style={[s.iconBtn, !activeEssay.previousDraft && s.iconBtnDisabled]}
                  onPress={handleUndo}
                  activeOpacity={0.75}
                  disabled={!activeEssay.previousDraft}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="return-up-back" size={18} color={t.ink} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.iconBtn, !activeEssay.redoDraft && s.iconBtnDisabled]}
                  onPress={handleRedo}
                  activeOpacity={0.75}
                  disabled={!activeEssay.redoDraft}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="return-up-forward" size={18} color={t.ink} />
                </TouchableOpacity>
              </View>
            </View>
            <TextInput
              style={[s.inputBox, s.draftInput]}
              value={draftText}
              onChangeText={setDraftText}
              multiline
              textAlignVertical="top"
              maxLength={activeLengthTarget?.limit ?? 6000}
            />

            <View style={s.metaRow}>
              <Text style={s.charCount}>
                {activeLengthTarget
                  ? `${draftCharCount} / ${activeLengthTarget.limit}자`
                  : `총 ${draftCharCount}자`}
              </Text>
              {dirty ? (
                <TouchableOpacity style={s.saveInlineBtn} onPress={handleSaveDraft} activeOpacity={0.75}>
                  <Ionicons name="save-outline" size={14} color={t.primary} />
                  <Text style={s.saveInlineText}>수정 저장</Text>
                </TouchableOpacity>
              ) : null}
            </View>

            {activeEssay.evidenceSummary?.length > 0 ? (
              <View style={s.citationCard}>
                <Text style={s.citationLabel}>반영 근거</Text>
                {activeEssay.evidenceSummary.map((item, index) => (
                  <View key={`${item}-${index}`} style={s.evidenceRow}>
                    <Text style={s.evidenceDot}>•</Text>
                    <Text style={s.evidenceText}>{item}</Text>
                  </View>
                ))}
              </View>
            ) : null}

            <View
              style={s.revisionCard}
              onLayout={event => { revisionYRef.current = event.nativeEvent.layout.y; }}
            >
              <Text style={s.label}>AI에게 수정 요청</Text>
              <View style={s.revisionRow}>
                <TextInput
                  style={s.revisionInput}
                  value={revisionRequest}
                  onChangeText={setRevisionRequest}
                  onFocus={() => scrollResultTo(revisionYRef.current || 0)}
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
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: t.bg },
  keyboard: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingBottom: 180 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 14,
    marginBottom: 14,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  tag: { flex: 1, fontSize: 10, fontWeight: '700', color: t.primary, letterSpacing: 1.2 },
  editQText: { fontSize: 12, fontWeight: '700', color: t.primary },
  title: { fontSize: 22, fontWeight: '700', color: t.ink, marginBottom: 6 },
  sub: { fontSize: 12, color: t.muted, lineHeight: 18, marginBottom: 20 },
  label: { fontSize: 12, fontWeight: '700', color: t.muted, marginBottom: 8 },
  draftHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 8,
  },
  draftLabel: { marginBottom: 0 },
  draftHeaderActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: t.surface,
    borderWidth: 1,
    borderColor: t.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnDisabled: { opacity: 0.35 },
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
  tabActive: { backgroundColor: t.primarySoft, borderColor: t.primary },
  tabDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: t.primary },
  tabText: { fontSize: 13, fontWeight: '600', color: t.muted },
  tabTextActive: { color: t.primary },
  questionBox: {
    backgroundColor: t.primarySoft,
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    gap: 6,
  },
  questionBoxLabel: { fontSize: 11, fontWeight: '700', color: t.primary, letterSpacing: 0.8 },
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
  saveInlineBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, height: 28 },
  saveInlineText: { fontSize: 12, fontWeight: '700', color: t.primary },
  citationCard: {
    backgroundColor: t.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: t.border,
    padding: 14,
    marginBottom: 14,
  },
  citationLabel: { fontSize: 11, fontWeight: '700', color: t.primary, letterSpacing: 0.8, marginBottom: 8 },
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
  emptyDraftBox: { gap: 12, paddingVertical: 8 },
  emptyDraftText: { fontSize: 13, color: t.muted, textAlign: 'center' },
});
