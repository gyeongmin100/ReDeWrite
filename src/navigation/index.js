import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import { tokens as t } from '../theme/tokens';
import { supabase } from '../services/supabaseClient';
import { runResearch } from '../services/aiService';
import { buildProfileUpsertPayload } from '../services/profilePersistence.js';

import AuthScreen from '../screens/AuthScreen';
import HomeScreen from '../screens/HomeScreen';
import ResearchListScreen from '../screens/ResearchListScreen';
import SearchScreen from '../screens/SearchScreen';
import ResearchScreen from '../screens/ResearchScreen';
import ReadScreen from '../screens/ReadScreen';
import DebateScreen from '../screens/DebateScreen';
import WriteScreen from '../screens/WriteScreen';
import ArchiveScreen from '../screens/ArchiveScreen';
import MyScreen from '../screens/MyScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

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
            ArchiveTab: focused ? 'document-text' : 'document-text-outline',
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
            collectingResearchIds={collectingResearchIds}
            user={user}
          />
        )}
      </Tab.Screen>
      <Tab.Screen name="ArchiveTab" options={{ title: '자소서함' }}>
        {props => <ArchiveScreen {...props} researches={researches} />}
      </Tab.Screen>
      <Tab.Screen name="MyTab" options={{ title: 'MY' }}>
        {props => <MyScreen {...props} user={user} onSignOut={onSignOut} onUpdateUser={onUpdateUser} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const [authedUser, setAuthedUser] = useState(null);
  const [user, setUser] = useState({ id: '', name: '', major: '', email: '', experiences: [] });
  const [researches, setResearches] = useState([]);
  const [collectingResearchIds, setCollectingResearchIds] = useState([]);

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
        experiences: profile.experiences || [],
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
        companyId: r.company_id,
        name: r.name,
        role: r.role,
        pipeline: r.pipeline,
        completedSteps: r.completed_steps,
        researchReport: r.research_report,
        readResult: r.read_result,
        bestFit: r.best_fit,
        essay: r.essay,
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

  const addResearch = async (researchItem) => {
    const companyId =
      researchItem.company.toLowerCase().replace(/\s/g, '-') + '-' + Date.now();
    const newResearch = {
      companyId,
      name: researchItem.company,
      role: researchItem.role,
      pipeline: ['active', 'pending', 'pending'],
      completedSteps: 1,
      researchReport: researchItem,
      readResult: null,
      bestFit: null,
      essay: null,
      createdAt: new Date().toISOString(),
    };

    setResearches(prev => [newResearch, ...prev]);

    if (authedUser) {
      supabase.from('researches').insert({
        user_id: authedUser.id,
        company_id: companyId,
        name: researchItem.company,
        role: researchItem.role,
        pipeline: ['active', 'pending', 'pending'],
        completed_steps: 1,
        research_report: researchItem,
      }).then(({ error }) => {
        if (error) console.warn('Research save error:', error.message);
      });
    }

    return companyId;
  };

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

    supabase.from('researches').insert({
      user_id: authedUser.id,
      company_id: research.companyId,
      name: research.name,
      role: research.role,
      pipeline: research.pipeline,
      completed_steps: research.completedSteps,
      research_report: research.researchReport,
    }).then(({ error }) => {
      if (error) console.warn('Research save error:', error.message);
    });
  };

  const startResearch = async (query) => {
    const companyId = `research-${Date.now()}`;
    const now = new Date().toISOString();
    const pendingResearch = {
      companyId,
      name: '정보 수집 중',
      role: query,
      pipeline: ['active', 'pending', 'pending'],
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
    markCollecting(companyId, true);

    runResearch(query).then(researchItem => {
      const completed = {
        ...pendingResearch,
        name: researchItem.company,
        role: researchItem.role,
        researchReport: researchItem,
        status: 'ready',
      };

      setResearches(prev =>
        prev.map(r => (r.companyId === companyId ? completed : r))
      );
      persistResearchInsert(completed);
    }).catch(error => {
      console.warn('Research collect error:', error.message);
      setResearches(prev =>
        prev.map(r => (
          r.companyId === companyId
            ? { ...r, status: 'failed', errorMessage: '정보 수집에 실패했어요. 다시 시도해 주세요.' }
            : r
        ))
      );
    }).finally(() => {
      markCollecting(companyId, false);
    });

    return companyId;
  };

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
      });
    } catch (error) {
      console.warn('Research refresh error:', error.message);
      setResearches(prev =>
        prev.map(r => (
          r.companyId === companyId
            ? { ...r, status: 'ready', errorMessage: '최신정보 업데이트에 실패했어요.' }
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
      const dbPatch = {};
      if (patch.pipeline) dbPatch.pipeline = patch.pipeline;
      if (patch.completedSteps !== undefined) dbPatch.completed_steps = patch.completedSteps;
      if (patch.researchReport !== undefined) dbPatch.research_report = patch.researchReport;
      if (patch.readResult !== undefined) dbPatch.read_result = patch.readResult;
      if (patch.bestFit !== undefined) dbPatch.best_fit = patch.bestFit;
      if (patch.essay !== undefined) dbPatch.essay = patch.essay;

      supabase.from('researches')
        .update(dbPatch)
        .eq('company_id', companyId)
        .eq('user_id', authedUser.id)
        .then(({ error }) => {
          if (error) console.warn('Research update error:', error.message);
        });
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
        ...user,
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
          collectingResearchIds={collectingResearchIds}
          user={user}
          onSignOut={handleSignOut}
          onUpdateUser={updateUserExperiences}
        />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
