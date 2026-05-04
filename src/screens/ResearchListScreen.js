import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { tokens as t } from '../theme/tokens';

const PIPELINE_LABELS = ['R', 'D', 'W'];

function PipelineDots({ pipeline }) {
  return (
    <View style={s.dots}>
      {PIPELINE_LABELS.map((label, i) => {
        const status = pipeline[i];
        const done = status === 'done';
        const active = status === 'active';
        return (
          <View key={i} style={s.dotItem}>
            <View
              style={[
                s.dot,
                done && s.dotDone,
                active && s.dotActive,
              ]}
            >
              {done
                ? <Ionicons name="checkmark" size={10} color="#fff" />
                : <Text style={[s.dotLabel, (done || active) && s.dotLabelActive]}>{label}</Text>
              }
            </View>
            {i < PIPELINE_LABELS.length - 1 && (
              <View style={[s.connector, done && s.connectorDone]} />
            )}
          </View>
        );
      })}
    </View>
  );
}

export default function ResearchListScreen({ navigation, researches, user }) {
  return (
    <SafeAreaView style={s.root}>
      <View style={s.inner}>
        {/* 헤더 */}
        <View style={s.header}>
          <Text style={s.title}>리서치</Text>
          <TouchableOpacity
            style={s.newBtn}
            onPress={() => navigation.navigate('Search')}
            activeOpacity={0.8}
          >
            <Ionicons name="add" size={18} color="#fff" />
            <Text style={s.newBtnText}>새 리서치</Text>
          </TouchableOpacity>
        </View>

        {researches.length === 0 ? (
          <View style={s.emptyWrap}>
            <View style={s.emptyIcon}>
              <Ionicons name="layers-outline" size={32} color={t.faint} />
            </View>
            <Text style={s.emptyTitle}>아직 리서치한 기업이 없어요</Text>
            <Text style={s.emptyDesc}>관심 있는 기업을 AI로 분석해 보세요</Text>
            <TouchableOpacity
              style={s.emptyBtn}
              onPress={() => navigation.navigate('Search')}
              activeOpacity={0.8}
            >
              <Ionicons name="add" size={16} color={t.primary} />
              <Text style={s.emptyBtnText}>새 리서치 시작하기</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingBottom: 32 }}>
            {researches.map(r => (
              <TouchableOpacity
                key={r.companyId}
                style={s.card}
                onPress={() => navigation.navigate('Research', { companyId: r.companyId })}
                activeOpacity={0.75}
              >
                <View style={s.cardTop}>
                  <View style={s.logoWrap}>
                    <Text style={s.logoText}>{r.name.charAt(0)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.companyName}>{r.name}</Text>
                    <Text style={s.roleText} numberOfLines={1}>{r.role}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={t.faint} />
                </View>
                <View style={s.pipelineWrap}>
                  <PipelineDots pipeline={r.pipeline} />
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: t.bg },
  inner: { flex: 1, paddingHorizontal: 20, paddingTop: 14 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 22, fontWeight: '700', color: t.ink, letterSpacing: -0.5 },
  newBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: t.primary, paddingHorizontal: 14, height: 36, borderRadius: 10,
  },
  newBtnText: { fontSize: 13, fontWeight: '600', color: '#fff' },

  // 카드
  card: {
    backgroundColor: t.surface, borderRadius: 16, borderWidth: 1, borderColor: t.border, padding: 14,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  logoWrap: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: t.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  logoText: { fontSize: 16, fontWeight: '700', color: t.primary },
  companyName: { fontSize: 14, fontWeight: '700', color: t.ink, marginBottom: 2 },
  roleText: { fontSize: 12, color: t.muted },

  // 파이프라인 dots
  pipelineWrap: { paddingTop: 4, borderTopWidth: 1, borderTopColor: t.border },
  dots: { flexDirection: 'row', alignItems: 'center', paddingTop: 10 },
  dotItem: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  dot: {
    width: 26, height: 26, borderRadius: 8, backgroundColor: t.surfaceAlt,
    alignItems: 'center', justifyContent: 'center',
  },
  dotDone: { backgroundColor: t.primary },
  dotActive: { backgroundColor: t.primaryDark },
  dotLabel: { fontSize: 11, fontWeight: '700', color: t.faint },
  dotLabelActive: { color: '#fff' },
  connector: { flex: 1, height: 2, backgroundColor: t.border, marginHorizontal: 4 },
  connectorDone: { backgroundColor: t.primary },

  // 빈 상태
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 60 },
  emptyIcon: {
    width: 64, height: 64, borderRadius: 20, backgroundColor: t.surfaceAlt,
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: t.ink, marginBottom: 6 },
  emptyDesc: { fontSize: 13, color: t.muted, marginBottom: 20 },
  emptyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1.5, borderColor: t.primary, borderRadius: 10, paddingHorizontal: 16, height: 40,
  },
  emptyBtnText: { fontSize: 13, fontWeight: '600', color: t.primary },
});
