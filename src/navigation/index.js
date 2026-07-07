import React, { useState, useEffect, useRef } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import { tokens as t } from '../theme/tokens';
import { supabase } from '../services/supabaseClient';
import { chatWithAI, generateEssayDraft, generateEssayDrafts, reviseEssayDraft, parseIntent, collectCompanyInfo } from '../services/aiService';
import { buildProfileUpsertPayload } from '../services/profilePersistence.js';
import {
  buildCollectingResearchReportMarker,
  buildResearchInsertPayload,
  buildResearchPatchPayload,
  deriveInitialResearchFields,
  normalizeResearchRecord,
} from '../services/researchStateUtils.js';
import { PIPELINE_INIT, PIPELINE_AFTER_READ, PIPELINE_AFTER_DEBATE, PIPELINE_COMPLETE } from '../constants/researchStages';
import {
  buildDebatePendingBestFit,
  buildInitialDebateMessages,
  completeDebateBestFit,
  failDebateBestFit,
  shouldResumePendingReply,
} from '../services/debateStateUtils.js';
import {
  applyGeneratedEssayBatch,
  applyEssayRevision,
  buildEssayPayload,
  buildWritePendingState,
  buildWriteState,
  completeWritePendingState,
  failWritePendingState,
  hasAllRequiredEssaysComplete,
  normalizeWriteState,
  shouldGenerateEssayForQuestion,
  shouldResumeWritePending,
} from '../services/essayUtils.js';

import AuthScreen from '../screens/AuthScreen';
import HomeScreen from '../screens/HomeScreen';
import ResearchListScreen from '../screens/ResearchListScreen';
import SearchScreen from '../screens/SearchScreen';
import ResearchScreen from '../screens/ResearchScreen';
import ReadScreen from '../screens/ReadScreen';
import DebateScreen from '../screens/DebateScreen';
import WriteScreen from '../screens/WriteScreen';
import MyScreen from '../screens/MyScreen';
import SpecScreen from '../screens/SpecScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// 재시도해도 결과가 같은 오류(입력 검증·설정·인증 문제)는 일시적 오류로 보지 않는다.
const NON_TRANSIENT_RESEARCH_ERROR = /is required|too long|too many|로그인이 필요|설정되지 않|not configured/i;

function isTransientResearchError(error) {
  return !NON_TRANSIENT_RESEARCH_ERROR.test(String(error?.message || ''));
}

function buildUserFromSession(session) {
  const email = session.user.email ?? '';
  const meta = session.user.user_metadata || {};
  return {
    id: session.user.id,
    name: meta.full_name || meta.name || (email ? email.split('@')[0] : '사용자'),
    major: '',
    email,
    experiences: [],
  };
}

function HomeStack({ researches, user }) {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Home">
        {props => <HomeScreen {...props} user={user} researches={researches} />}
      </Stack.Screen>
    </Stack.Navigator>
  );
}

function ResearchStack({
  researches,
  updateResearch,
  startResearch,
  refreshResearch,
  deleteResearch,
  sendDebateMessage,
  resumeDebateReply,
  startWriteGenerateAll,
  startWriteGenerateOne,
  startWriteRevise,
  resumeWriteTask,
  collectingResearchIds,
  user,
}) {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ResearchList">
        {props => (
          <ResearchListScreen
            {...props}
            researches={researches}
            deleteResearch={deleteResearch}
            user={user}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="Search">
        {props => <SearchScreen {...props} startResearch={startResearch} />}
      </Stack.Screen>
      <Stack.Screen name="Research">
        {props => <ResearchScreen {...props} researches={researches} />}
      </Stack.Screen>
      <Stack.Screen name="Read">
        {props => (
          <ReadScreen
            {...props}
            researches={researches}
            updateResearch={updateResearch}
            refreshResearch={refreshResearch}
            collectingResearchIds={collectingResearchIds}
            user={user}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="Debate">
        {props => (
          <DebateScreen
            {...props}
            researches={researches}
            updateResearch={updateResearch}
            sendDebateMessage={sendDebateMessage}
            resumeDebateReply={resumeDebateReply}
            user={user}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="Write">
        {props => (
          <WriteScreen
            {...props}
            researches={researches}
            updateResearch={updateResearch}
            startWriteGenerateAll={startWriteGenerateAll}
            startWriteGenerateOne={startWriteGenerateOne}
            startWriteRevise={startWriteRevise}
            resumeWriteTask={resumeWriteTask}
            user={user}
          />
        )}
      </Stack.Screen>
    </Stack.Navigator>
  );
}

function MainTabs({
  researches,
  updateResearch,
  startResearch,
  refreshResearch,
  deleteResearch,
  sendDebateMessage,
  resumeDebateReply,
  startWriteGenerateAll,
  startWriteGenerateOne,
  startWriteRevise,
  resumeWriteTask,
  collectingResearchIds,
  user,
  onSignOut,
  onUpdateUser,
}) {
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: t.ink,
        tabBarInactiveTintColor: t.faint,
        tabBarStyle: {
          backgroundColor: 'rgba(255,255,255,0.96)',
          borderTopColor: t.border,
          borderTopWidth: 1,
          height: 60 + insets.bottom,
          paddingBottom: insets.bottom + 4,
        },
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
        tabBarIcon: ({ color, focused }) => {
          const icons = {
            HomeTab: focused ? 'home' : 'home-outline',
            ResearchTab: focused ? 'layers' : 'layers-outline',
            SpecTab: focused ? 'star' : 'star-outline',
            MyTab: focused ? 'person' : 'person-outline',
          };
          return <Ionicons name={icons[route.name]} size={22} color={color} />;
        },
      })}
    >
      <Tab.Screen
        name="HomeTab"
        options={{ title: '홈' }}
        listeners={({ navigation }) => ({
          tabPress: (event) => {
            event.preventDefault();
            navigation.navigate('HomeTab', { screen: 'Home' });
          },
        })}
      >
        {() => <HomeStack researches={researches} user={user} />}
      </Tab.Screen>
      <Tab.Screen
        name="ResearchTab"
        options={{ title: '리서치' }}
        listeners={({ navigation }) => ({
          tabPress: (event) => {
            event.preventDefault();
            navigation.navigate('ResearchTab', { screen: 'ResearchList' });
          },
        })}
      >
        {() => (
          <ResearchStack
            researches={researches}
            updateResearch={updateResearch}
            startResearch={startResearch}
            refreshResearch={refreshResearch}
            deleteResearch={deleteResearch}
            sendDebateMessage={sendDebateMessage}
            resumeDebateReply={resumeDebateReply}
            startWriteGenerateAll={startWriteGenerateAll}
            startWriteGenerateOne={startWriteGenerateOne}
            startWriteRevise={startWriteRevise}
            resumeWriteTask={resumeWriteTask}
            collectingResearchIds={collectingResearchIds}
            user={user}
          />
        )}
      </Tab.Screen>
      <Tab.Screen name="SpecTab" options={{ title: '스펙' }}>
        {() => (
          <SpecScreen
            experiences={user.experiences}
            onUpdateExperiences={onUpdateUser}
          />
        )}
      </Tab.Screen>
      <Tab.Screen name="MyTab" options={{ title: 'MY' }}>
        {() => <MyScreen user={user} onSignOut={onSignOut} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const [authedUser, setAuthedUser] = useState(null);
  const [user, setUser] = useState({ id: '', name: '', major: '', email: '', experiences: [] });
  const [researches, setResearches] = useState([]);
  const [collectingResearchIds, setCollectingResearchIds] = useState([]);
  const debateReplyInFlightRef = useRef(new Set());
  const writeTaskInFlightRef = useRef(new Set());
  const writeTaskSettledRef = useRef(new Set());
  const researchCollectInFlightRef = useRef(new Set());
  const researchesRef = useRef(researches);
  const userRef = useRef(user);

  useEffect(() => {
    researchesRef.current = researches;
  }, [researches]);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const loadUserData = async (userId) => {
    // profiles 로드
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('name, major, experiences')
      .eq('id', userId)
      .maybeSingle();

    if (profileError) {
      console.warn('Profile load error:', profileError.message);
    }

    if (profile) {
      setUser(prev => ({
        ...prev,
        name: profile.name || prev.name,
        major: profile.major || '',
        experiences: (profile.experiences || []).map(e =>
          typeof e === 'string'
            ? { id: Date.now().toString(36) + Math.random().toString(36).slice(2), text: e, category: '기타' }
            : e
        ),
      }));
    }

    // researches 로드
    const { data, error } = await supabase
      .from('researches')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('loadUserData error:', error.message);
      return;
    }

    if (data && data.length > 0) {
      const mapped = data.map(r => ({
        ...normalizeResearchRecord(r),
        createdAt: r.created_at,
      }));
      setResearches(mapped);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setAuthedUser(session.user);
        setUser(buildUserFromSession(session));
        loadUserData(session.user.id);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        setAuthedUser(session.user);
        setUser(buildUserFromSession(session));
        loadUserData(session.user.id);
      } else {
        setAuthedUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);


  const markCollecting = (companyId, collecting) => {
    setCollectingResearchIds(prev => {
      const set = new Set(prev);
      if (collecting) {
        set.add(companyId);
      } else {
        set.delete(companyId);
      }
      return Array.from(set);
    });
  };

  const persistResearchInsert = (research) => {
    if (!authedUser) return;

    supabase.from('researches').insert(
      buildResearchInsertPayload(research, authedUser.id)
    ).then(({ error }) => {
      if (error) console.warn('Research save error:', error.message);
    });
  };

  const handleResearchCollectFailure = (companyId, query, error) => {
    console.warn('Research collect error:', error.message);
    setResearches(prev =>
      prev.map(r =>
        r.companyId === companyId
          ? { ...r, status: 'failed', errorMessage: '분석에 실패했습니다. 다시 시도해 주세요.' }
          : r
      )
    );
    updateResearch(companyId, {
      researchReport: buildCollectingResearchReportMarker({
        query,
        lastError: error.message,
      }),
      status: 'failed',
    });
  };

  const runResearchCollect = (companyId, query) => {
    if (!query || researchCollectInFlightRef.current.has(companyId)) return;
    researchCollectInFlightRef.current.add(companyId);
    markCollecting(companyId, true);

    let parsedCompany = query;
    let parsedRole = '';

    const attempt = async () => {
      const { company, role } = await parseIntent(query);
      parsedCompany = company;
      parsedRole = role;
      console.info('Research parse complete:', {
        companyId,
        hasCompany: Boolean(company),
        hasRole: Boolean(role),
        companyLength: String(company || '').length,
        roleLength: String(role || '').length,
      });
      setResearches(prev =>
        prev.map(r => r.companyId === companyId ? { ...r, name: company, role } : r)
      );
      updateResearch(companyId, { name: company, role });
      console.info('Research collect start:', { companyId });
      return collectCompanyInfo(company, role);
    };

    (async () => {
      let report;
      try {
        report = await attempt();
      } catch (error) {
        // 일시적 오류(네트워크 끊김·타임아웃·429/503 등)면 1회만 자동 재시도.
        if (!isTransientResearchError(error)) {
          handleResearchCollectFailure(companyId, query, error);
          return;
        }
        console.warn('Research collect transient error, retrying once:', error.message);
        await new Promise(resolve => setTimeout(resolve, 1500));
        try {
          report = await attempt();
        } catch (retryError) {
          handleResearchCollectFailure(companyId, query, retryError);
          return;
        }
      }

      console.info('Research collect complete:', {
        companyId,
        hasReport: Boolean(report),
        company: report.company,
        role: report.role,
      });
      const completed = {
        name: report.company || parsedCompany,
        role: report.role || parsedRole,
        researchReport: report,
        status: 'ready',
        errorMessage: null,
      };
      setResearches(prev =>
        prev.map(r => r.companyId === companyId ? { ...r, ...completed } : r)
      );
      updateResearch(companyId, completed);
    })().finally(() => {
      researchCollectInFlightRef.current.delete(companyId);
      markCollecting(companyId, false);
    });
  };

  const startResearch = (query) => {
    const companyId = `research-${Date.now()}`;
    const now = new Date().toISOString();
    const initialFields = deriveInitialResearchFields(query);
    const pendingResearch = {
      companyId,
      name: initialFields.name || query,
      role: initialFields.role,
      pipeline: PIPELINE_INIT,
      completedSteps: 1,
      researchReport: null,
      readResult: null,
      bestFit: null,
      essay: null,
      createdAt: now,
      status: 'collecting',
      query,
    };

    setResearches(prev => [pendingResearch, ...prev]);
    persistResearchInsert(pendingResearch);
    runResearchCollect(companyId, query);
    return companyId;

    markCollecting(companyId, true);

    let parsedCompany = query;
    let parsedRole = '';

    parseIntent(query)
      .then(({ company, role }) => {
        parsedCompany = company;
        parsedRole = role;
        console.info('Research parse complete:', {
          companyId,
          hasCompany: Boolean(company),
          hasRole: Boolean(role),
          companyLength: String(company || '').length,
          roleLength: String(role || '').length,
        });
        setResearches(prev =>
          prev.map(r => r.companyId === companyId ? { ...r, name: company, role } : r)
        );
        updateResearch(companyId, { name: company, role });
        console.info('Research collect start:', { companyId });
        return collectCompanyInfo(company, role);
      })
      .then(report => {
        console.info('Research collect complete:', {
          companyId,
          hasReport: Boolean(report),
          company: report.company,
          role: report.role,
        });
        const completed = {
          ...pendingResearch,
          name: report.company || parsedCompany,
          role: report.role || parsedRole,
          researchReport: report,
          status: 'ready',
        };
        setResearches(prev =>
          prev.map(r => r.companyId === companyId ? completed : r)
        );
        updateResearch(companyId, completed);
      })
      .catch(error => {
        console.warn('Research collect error:', error.message);
        setResearches(prev =>
          prev.map(r =>
            r.companyId === companyId
              ? { ...r, status: 'failed', errorMessage: '분석에 실패했습니다. 다시 시도해 주세요.' }
              : r
          )
        );
      })
      .finally(() => markCollecting(companyId, false));

    return companyId;
  };

  useEffect(() => {
    researches
      .filter(research => research.status === 'collecting' && !research.researchReport)
      .forEach(research => {
        runResearchCollect(research.companyId, research.query || research.name);
      });
  }, [researches]); // eslint-disable-line react-hooks/exhaustive-deps

  const refreshResearch = async (companyId, collect) => {
    const research = researches.find(r => r.companyId === companyId);
    if (!research || collectingResearchIds.includes(companyId)) return;

    markCollecting(companyId, true);
    setResearches(prev =>
      prev.map(r => (r.companyId === companyId ? { ...r, status: 'collecting' } : r))
    );

    try {
      const fetched = await collect(research.name, research.role, research.researchReport);
      updateResearch(companyId, {
        researchReport: fetched,
        status: 'ready',
        errorMessage: null,
      });
    } catch (error) {
      console.warn('Research refresh error:', error.message);
      setResearches(prev =>
          prev.map(r => (
          r.companyId === companyId
            ? { ...r, status: 'ready', errorMessage: '업데이트에 실패했습니다.' }
            : r
        ))
      );
    } finally {
      markCollecting(companyId, false);
    }
  };

  const updateResearch = (companyId, patch) => {
    setResearches(prev =>
      prev.map(r => (r.companyId === companyId ? { ...r, ...patch } : r))
    );

    if (authedUser) {
      const dbPatch = buildResearchPatchPayload(patch);
      if (Object.keys(dbPatch).length === 0) return;

      supabase.from('researches')
        .update(dbPatch)
        .eq('company_id', companyId)
        .eq('user_id', authedUser.id)
        .then(({ error }) => {
          if (error) console.warn('Research update error:', error.message);
        });
    }
  };

  const runDebateReply = async (companyId, bestFit) => {
    if (!shouldResumePendingReply(bestFit) || debateReplyInFlightRef.current.has(companyId)) return;

    const research = researches.find(r => r.companyId === companyId);
    if (!research) return;

    debateReplyInFlightRef.current.add(companyId);

    try {
      const aiText = await chatWithAI(
        bestFit.messages.filter(m => m.role !== 'system'),
        research.researchReport ?? null,
        user?.experiences ?? [],
      );
      updateResearch(companyId, {
        bestFit: completeDebateBestFit(bestFit, aiText),
      });
    } catch (err) {
      console.error('chatWithAI error:', err);
      updateResearch(companyId, {
        bestFit: failDebateBestFit(
          bestFit,
          '일시적인 오류가 발생했어요. 잠시 후 다시 시도해 주세요.',
        ),
      });
    } finally {
      debateReplyInFlightRef.current.delete(companyId);
    }
  };

  const sendDebateMessage = (companyId, text) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    const research = researches.find(r => r.companyId === companyId);
    if (!research?.researchReport) return;

    const nextBestFit = buildDebatePendingBestFit(
      research.bestFit,
      trimmed,
      buildInitialDebateMessages(research)
    );
    updateResearch(companyId, { bestFit: nextBestFit });
    runDebateReply(companyId, nextBestFit);
  };

  const resumeDebateReply = (companyId) => {
    const research = researches.find(r => r.companyId === companyId);
    if (shouldResumePendingReply(research?.bestFit)) {
      runDebateReply(companyId, research.bestFit);
    }
  };

  const markWriteCompletePatch = (writeState) => {
    const isComplete = hasAllRequiredEssaysComplete(writeState?.questions, writeState?.essays);
    return isComplete
      ? {
          essay: writeState,
          pipeline: PIPELINE_COMPLETE,
          completedSteps: 3,
        }
      : { essay: writeState };
  };

  const runWriteTask = async (companyId, writeState) => {
    const state = normalizeWriteState(writeState);
    const pending = state.pending;
    const taskKey = `${companyId}:${pending?.requestedAt || 'write'}`;

    if (
      !shouldResumeWritePending(state)
      || writeTaskInFlightRef.current.has(taskKey)
      || writeTaskSettledRef.current.has(taskKey)
    ) return;

    const research = researchesRef.current.find(r => r.companyId === companyId);
    if (!research?.researchReport) return;

    writeTaskInFlightRef.current.add(taskKey);
    let latestState = state;

    try {
      let nextEssays = [...state.essays];
      const questions = state.questions;
      const debateMessages = research.bestFit?.messages ?? [];
      const userExperiences = userRef.current?.experiences ?? [];

      const generateAt = async (idx) => {
        const question = questions[idx];
        const trimmedQuestion = question?.questionText?.trim();
        if (!trimmedQuestion) return;

        const result = await generateEssayDraft({
          questionText: trimmedQuestion,
          targetLength: question.targetLength?.trim() || '',
          researchReport: research.researchReport,
          debateMessages,
          userExperiences,
        });

        nextEssays[idx] = buildEssayPayload({
          questionText: trimmedQuestion,
          targetLength: question.targetLength,
          draft: result.draft,
          evidenceSummary: result.evidenceSummary,
        });
      };

      if (pending.type === 'generateAll') {
        const targetIndexes = questions
          .map((question, idx) => ({ question, idx }))
          .filter(({ question, idx }) => shouldGenerateEssayForQuestion(question, nextEssays[idx]))
          .map(({ idx }) => idx);

        const progressState = buildWritePendingState(
          { ...state, questions, essays: nextEssays },
          { ...pending, currentIndex: 0 },
        );
        latestState = progressState;
        updateResearch(companyId, { essay: progressState });

        if (targetIndexes.length > 0) {
          const result = await generateEssayDrafts({
            questions: targetIndexes.map(idx => ({
              index: idx,
              questionText: questions[idx].questionText.trim(),
              targetLength: questions[idx].targetLength?.trim() || '',
            })),
            researchReport: research.researchReport,
            debateMessages,
            userExperiences,
          });
          nextEssays = applyGeneratedEssayBatch(
            questions,
            nextEssays,
            result.essays,
            targetIndexes,
          );
        }
      } else if (pending.type === 'generateOne') {
        await generateAt(pending.index);
      } else if (pending.type === 'revise') {
        const idx = pending.index;
        const question = questions[idx];
        const essay = nextEssays[idx];
        const result = await reviseEssayDraft({
          questionText: question?.questionText?.trim() || essay?.questionText || '',
          targetLength: question?.targetLength?.trim() || essay?.targetLength || '',
          currentDraft: pending.currentDraft || essay?.draft || '',
          revisionRequest: pending.revisionRequest || '',
          researchReport: research.researchReport,
          debateMessages,
          userExperiences,
        });
        const revised = applyEssayRevision(
          {
            ...(essay || {}),
            questionText: question?.questionText || essay?.questionText || '',
            targetLength: question?.targetLength || essay?.targetLength || '',
            draft: pending.currentDraft || essay?.draft || '',
          },
          result.draft,
        );
        nextEssays[idx] = buildEssayPayload({ ...revised, evidenceSummary: result.evidenceSummary });
      }

      const completedState = completeWritePendingState(
        { ...state, questions, essays: nextEssays },
        nextEssays,
      );
      console.info('writeTask complete:', {
        companyId,
        taskKey,
        questionCount: questions.filter(question => question?.questionText?.trim()).length,
        draftCount: nextEssays.filter(essay => essay?.draft?.trim()).length,
        isComplete: hasAllRequiredEssaysComplete(completedState.questions, completedState.essays),
      });
      writeTaskSettledRef.current.add(taskKey);
      updateResearch(companyId, markWriteCompletePatch(completedState));
    } catch (err) {
      console.error('writeTask error:', err);
      writeTaskSettledRef.current.add(taskKey);
      updateResearch(companyId, {
        essay: failWritePendingState(
          latestState,
          '자소서 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.',
        ),
      });
    } finally {
      writeTaskInFlightRef.current.delete(taskKey);
    }
  };

  const startWriteGenerateAll = (companyId, questions, essays) => {
    const research = researchesRef.current.find(r => r.companyId === companyId);
    if (!research?.researchReport) return;

    const pendingState = buildWritePendingState(
      buildWriteState({ previousState: research.essay, questions, essays }),
      { type: 'generateAll', currentIndex: 0 },
    );
    updateResearch(companyId, { essay: pendingState });
    runWriteTask(companyId, pendingState);
  };

  const startWriteGenerateOne = (companyId, questions, essays, index) => {
    const research = researchesRef.current.find(r => r.companyId === companyId);
    if (!research?.researchReport) return;

    const pendingState = buildWritePendingState(
      buildWriteState({ previousState: research.essay, questions, essays }),
      { type: 'generateOne', index },
    );
    updateResearch(companyId, { essay: pendingState });
    runWriteTask(companyId, pendingState);
  };

  const startWriteRevise = (companyId, questions, essays, index, currentDraft, revisionRequest) => {
    const research = researchesRef.current.find(r => r.companyId === companyId);
    if (!research?.researchReport) return;

    const pendingState = buildWritePendingState(
      buildWriteState({ previousState: research.essay, questions, essays }),
      { type: 'revise', index, currentDraft, revisionRequest },
    );
    updateResearch(companyId, { essay: pendingState });
    runWriteTask(companyId, pendingState);
  };

  const resumeWriteTask = (companyId) => {
    const research = researchesRef.current.find(r => r.companyId === companyId);
    if (shouldResumeWritePending(research?.essay)) {
      runWriteTask(companyId, research.essay);
    }
  };

  const deleteResearch = (companyId) => {
    setResearches(prev => prev.filter(r => r.companyId !== companyId));
    markCollecting(companyId, false);

    if (authedUser) {
      supabase.from('researches')
        .delete()
        .eq('company_id', companyId)
        .eq('user_id', authedUser.id)
        .then(({ error }) => {
          if (error) console.warn('Research delete error:', error.message);
        });
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setAuthedUser(null);
    setUser({ id: '', name: '', major: '', email: '', experiences: [] });
    setResearches([]);
    setCollectingResearchIds([]);
  };

  const updateUserExperiences = async (experiences) => {
    setUser(prev => ({ ...prev, experiences }));
    if (authedUser) {
      const payload = buildProfileUpsertPayload({
        ...userRef.current,
        id: authedUser.id,
        experiences,
      });
      const { error } = await supabase
        .from('profiles')
        .upsert(payload, { onConflict: 'id' });

      if (error) {
        console.warn('Profile save error:', error.message);
      }
    }
  };

  if (!authedUser) {
    return (
      <SafeAreaProvider>
        <NavigationContainer>
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="Auth">
              {() => (
                <AuthScreen
                  onSignIn={u => {
                    setAuthedUser({ id: u.id, email: u.email });
                    setUser({
                      id: u.id,
                      name: u.name,
                      major: u.major,
                      email: u.email,
                      experiences: [],
                    });
                    loadUserData(u.id);
                  }}
                />
              )}
            </Stack.Screen>
          </Stack.Navigator>
        </NavigationContainer>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <MainTabs
          researches={researches}
          updateResearch={updateResearch}
          startResearch={startResearch}
          refreshResearch={refreshResearch}
          deleteResearch={deleteResearch}
          sendDebateMessage={sendDebateMessage}
          resumeDebateReply={resumeDebateReply}
          startWriteGenerateAll={startWriteGenerateAll}
          startWriteGenerateOne={startWriteGenerateOne}
          startWriteRevise={startWriteRevise}
          resumeWriteTask={resumeWriteTask}
          collectingResearchIds={collectingResearchIds}
          user={user}
          onSignOut={handleSignOut}
          onUpdateUser={updateUserExperiences}
        />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
