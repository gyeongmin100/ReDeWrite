import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { tokens as t } from '../theme/tokens';
import { mockCompanies } from '../data/mockData';

export default function ResearchScreen({ navigation, route, researches }) {
  const { companyId } = route.params;
  const research = researches.find(r => r.companyId === companyId);
  // mockCompanies에 없는 AI 생성 리서치는 research 필드로 fallback
  const _mc = mockCompanies.find(c => c.id === companyId);
  const company = _mc ?? {
    name: research?.name ?? '',
    role: research?.role ?? '',
    deadline: null,
  };

  const stages = [
    { phase: 'R', name: 'Read', sub: '인재상 ↔ 내 경험 매칭', screen: 'Read', status: research.pipeline[0] },
    { phase: 'D', name: 'Debate', sub: 'Best Fit 소재 추출', screen: 'Debate', status: research.pipeline[1] },
    { phase: 'W', name: 'Write', sub: '근거 기반 자소서 초안', screen: 'Write', status: research.pipeline[2] },
  ];

  return (
    <SafeAreaView style={s.root}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={20} color={t.ink} />
          </TouchableOpacity>
          {company.deadline ? (
            <View style={s.deadlineChip}>
              <Text style={s.deadlineText}>{company.deadline}</Text>
            </View>
          ) : null}
        </View>

        <Text style={s.tag}>리서치 진행 중</Text>
        <Text style={s.companyName}>{company.name}</Text>
        <Text style={s.role}>{company.role}</Text>

        {/* Progress */}
        <View style={s.progressCard}>
          <View style={s.progressHeader}>
            <Text style={s.progressLabel}>전체 진행도</Text>
            <Text style={s.progressCount}>{research.completedSteps}/6</Text>
          </View>
          <View style={s.progressRow}>
            {Array.from({ length: 6 }).map((_, i) => (
              <View
                key={i}
                style={[s.progressBar, { backgroundColor: i < research.completedSteps ? t.primary : t.surfaceAlt }]}
              />
            ))}
          </View>
        </View>

        {/* Stages */}
        <View style={{ gap: 10 }}>
          {stages.map(stage => {
            const done = stage.status === 'done';
            const active = stage.status === 'active';
            const locked = stage.status === 'pending';
            return (
              <TouchableOpacity
                key={stage.phase}
                style={[s.stageCard, active && s.stageCardActive, locked && s.stageCardLocked]}
                onPress={() => !locked && navigation.navigate(stage.screen, { companyId })}
                activeOpacity={locked ? 1 : 0.75}
                disabled={locked}
              >
                <View style={[s.stageBadge, (done || active) && s.stageBadgeActive]}>
                  {done
                    ? <Ionicons name="checkmark" size={20} color="#fff" />
                    : <Text style={[s.stagePhase, (done || active) && { color: '#fff' }]}>{stage.phase}</Text>
                  }
                </View>
                <View style={{ flex: 1 }}>
                  <View style={s.stageNameRow}>
                    <Text style={s.stageName}>{stage.name}</Text>
                    {done && <View style={s.chipSuccess}><Text style={s.chipSuccessText}>완료</Text></View>}
                    {active && <View style={s.chipPrimary}><Text style={s.chipPrimaryText}>진행 중</Text></View>}
                  </View>
                  <Text style={s.stageSub}>{stage.sub}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={locked ? t.faint : t.ink} />
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: t.bg },
  scroll: { paddingHorizontal: 20, paddingBottom: 32 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 14, marginBottom: 18 },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  deadlineChip: { paddingHorizontal: 10, height: 26, borderRadius: 999, borderWidth: 1, borderColor: t.borderStrong, alignItems: 'center', justifyContent: 'center' },
  deadlineText: { fontSize: 12, color: t.muted, fontWeight: '600' },
  tag: { fontSize: 11, fontWeight: '700', color: t.primary, letterSpacing: 1, marginBottom: 6 },
  companyName: { fontSize: 26, fontWeight: '700', color: t.ink, letterSpacing: -0.5, marginBottom: 6 },
  role: { fontSize: 13, color: t.muted, marginBottom: 18 },
  progressCard: { backgroundColor: t.surface, borderRadius: 16, borderWidth: 1, borderColor: t.border, padding: 16, marginBottom: 18 },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  progressLabel: { fontSize: 12, fontWeight: '700', color: t.ink },
  progressCount: { fontSize: 12, fontWeight: '600', color: t.muted },
  progressRow: { flexDirection: 'row', gap: 4 },
  progressBar: { flex: 1, height: 5, borderRadius: 2.5 },
  stageCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: t.surface, borderRadius: 16, borderWidth: 1, borderColor: t.border, padding: 16,
  },
  stageCardActive: { borderColor: t.primaryLight },
  stageCardLocked: { opacity: 0.5 },
  stageBadge: { width: 44, height: 44, borderRadius: 12, backgroundColor: t.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  stageBadgeActive: { backgroundColor: t.primary },
  stagePhase: { fontSize: 18, fontWeight: '700', color: t.muted },
  stageNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  stageName: { fontSize: 15, fontWeight: '700', color: t.ink },
  stageSub: { fontSize: 12, color: t.muted },
  chipSuccess: { paddingHorizontal: 8, height: 22, borderRadius: 999, backgroundColor: '#F0FDF4', alignItems: 'center', justifyContent: 'center' },
  chipSuccessText: { fontSize: 11, fontWeight: '600', color: t.success },
  chipPrimary: { paddingHorizontal: 8, height: 22, borderRadius: 999, backgroundColor: t.primarySoft, alignItems: 'center', justifyContent: 'center' },
  chipPrimaryText: { fontSize: 11, fontWeight: '600', color: t.primary },
});
