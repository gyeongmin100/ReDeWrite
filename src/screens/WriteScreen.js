import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { tokens as t } from '../theme/tokens';
import { mockCompanies } from '../data/mockData';

const MOCK_DRAFT = `삼성전자 반도체 공정에 제 강점인 정밀성·꼼꼼함을 더해 스마트팩토리 설비 운영의 안정성을 가장 빠르게 끌어올리는 인재가 되겠습니다.

2학년 때 팀 프로젝트로 1mm 이하 오차를 잡아내는 PCB 조립 작업을 4단계 표준 작업서로 정리했습니다. 4명의 동료가 각자 다른 방식으로 작업하다 보니 불량률이 6%까지 올랐는데, 측정·납땜·1차 검사·2차 검사를 분리해 책임자를 지정한 결과 6주 만에 1.2%로 떨어졌습니다.

또한 NCS 자동차정비 자격증 취득 과정에서 240시간 현장 실습을 진행하며, 정비 매뉴얼을 디지털 체크리스트로 옮겨 같은 반 후배 12명이 실습에 참고할 수 있도록 공유했습니다. 입사 후에도 작업 표준을 빠르게 숙지·개선해 동료와 함께 성과를 만드는 구성원이 되겠습니다.`;

const DEFAULT_QUESTIONS = [
  { id: 'q1', text: '지원 동기 및 입사 후 포부를 작성해 주세요. (최대 800자)' },
  { id: 'q2', text: '본인의 강점과 그것이 직무에 어떻게 기여할 수 있는지 서술해 주세요. (최대 600자)' },
];

export default function WriteScreen({ navigation, route, researches, updateResearch, user }) {
  const { companyId } = route.params;
  const mockCompany = mockCompanies.find(c => c.id === companyId);
  const research = researches.find(r => r.companyId === companyId);
  const company = mockCompany || {
    name: research?.name || '기업',
    questions: DEFAULT_QUESTIONS,
  };
  const [stage, setStage] = useState(research?.essay ? 'result' : 'select');
  const [qIdx, setQIdx] = useState(0);
  const [essay, setEssay] = useState(research?.essay);
  const q = company.questions[qIdx];

  const run = async () => {
    setStage('writing');
    await new Promise(r => setTimeout(r, 2500));
    const result = { draft: MOCK_DRAFT, questionId: q.id, questionText: q.text };
    setEssay(result);
    setStage('result');
    updateResearch(companyId, {
      essay: result,
      pipeline: ['done', 'done', 'done'],
      completedSteps: 6,
    });
  };

  return (
    <SafeAreaView style={s.root}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={20} color={t.ink} />
          </TouchableOpacity>
          <Text style={s.tag}>WRITE · 자소서</Text>
          {essay && <View style={s.savedChip}><Text style={s.savedChipText}>저장됨</Text></View>}
        </View>
        <Text style={s.title}>{company.name} 자소서</Text>
        <Text style={s.sub}>{q.id} · AI 초안 생성됨</Text>

        {stage === 'select' && (
          <>
            <Text style={s.label}>자소서 항목 선택</Text>
            {company.questions.map((cq, i) => (
              <TouchableOpacity
                key={cq.id}
                style={[s.questionCard, qIdx === i && s.questionCardActive]}
                onPress={() => setQIdx(i)}
                activeOpacity={0.8}
              >
                <Text style={s.qNum}>Q{i + 1}</Text>
                <Text style={s.qText}>{cq.text}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={s.primaryBtn} onPress={run} activeOpacity={0.85}>
              <Ionicons name="sparkles" size={18} color="#fff" />
              <Text style={s.primaryBtnText}>AI 초안 생성</Text>
            </TouchableOpacity>
          </>
        )}

        {stage === 'writing' && (
          <View style={s.analyzing}>
            <View style={s.analyzeOrb} />
            <Text style={s.analyzeText}>초안 작성 중...</Text>
            {['Read 결과 인용', 'Debate Best Fit 적용', 'STAR 구조 작성'].map((step, i) => (
              <View key={i} style={s.stepRow}>
                <View style={s.stepDot} />
                <Text style={s.stepText}>{step}</Text>
              </View>
            ))}
          </View>
        )}

        {stage === 'result' && essay && (
          <>
            {/* Question box */}
            <View style={s.questionBox}>
              <Text style={s.questionBoxLabel}>QUESTION</Text>
              <Text style={s.questionBoxText}>{essay.questionText}</Text>
            </View>

            {/* Citation cards */}
            <View style={s.citationCard}>
              <Text style={[s.citationLabel, { color: t.primary }]}>● Read · 인재상 인용</Text>
              <Text style={s.citationText}>삼성전자 반도체 공정에 제 강점인 <Text style={{ fontWeight: '700' }}>정밀성·꼼꼼함</Text>을 더해 스마트팩토리 설비 운영의 안정성을 가장 빠르게 끌어올리는 인재가 되겠습니다.</Text>
            </View>

            <View style={s.citationCard}>
              <Text style={[s.citationLabel, { color: '#A77B0E' }]}>● Debate · Best Fit 인용</Text>
              <Text style={s.citationText}>2학년 때 PCB 조립 작업을 4단계 표준 작업서로 정리해 불량률을 6%에서 <Text style={{ fontWeight: '700' }}>1.2%</Text>로 낮췄습니다.</Text>
            </View>

            <View style={s.citationCard}>
              <Text style={[s.citationLabel, { color: t.primary }]}>● 입사 후 포부</Text>
              <Text style={s.citationText}>NCS 자동차정비 자격증 취득 과정에서 240시간 현장 실습을 진행하며, 정비 매뉴얼을 디지털 체크리스트로 공유했습니다.</Text>
            </View>

            {/* Actions */}
            <View style={s.actions}>
              <TouchableOpacity style={s.secondaryBtn} onPress={run} activeOpacity={0.8}>
                <Ionicons name="refresh" size={16} color={t.ink} />
                <Text style={s.secondaryBtnText}>다시 생성</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.darkBtn} activeOpacity={0.85}>
                <Ionicons name="download-outline" size={16} color="#fff" />
                <Text style={s.darkBtnText}>PDF 내보내기</Text>
              </TouchableOpacity>
            </View>
            <Text style={s.charCount}>총 {essay.draft.length}자 · 권장 600~700자</Text>
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
  title: { fontSize: 22, fontWeight: '700', color: t.ink, letterSpacing: -0.5, marginBottom: 6 },
  sub: { fontSize: 12, color: t.muted, marginBottom: 18 },
  label: { fontSize: 12, fontWeight: '700', color: t.muted, marginBottom: 10 },
  questionCard: {
    backgroundColor: t.surface, borderRadius: 14, borderWidth: 2, borderColor: t.border, padding: 14, marginBottom: 8,
  },
  questionCardActive: { borderColor: t.primary },
  qNum: { fontSize: 11, fontWeight: '700', color: t.muted, marginBottom: 4 },
  qText: { fontSize: 13, color: t.ink, lineHeight: 20 },
  primaryBtn: {
    height: 52, borderRadius: 14, backgroundColor: t.primary,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 10,
  },
  primaryBtnText: { fontSize: 15, fontWeight: '600', color: '#fff' },
  analyzing: { alignItems: 'center', paddingVertical: 40 },
  analyzeOrb: { width: 56, height: 56, borderRadius: 28, backgroundColor: t.primary, opacity: 0.2, marginBottom: 20 },
  analyzeText: { fontSize: 15, fontWeight: '700', color: t.ink, marginBottom: 18 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  stepDot: { width: 16, height: 16, borderRadius: 8, backgroundColor: t.primary },
  stepText: { fontSize: 13, color: t.ink },
  questionBox: { backgroundColor: t.primarySoft, borderRadius: 14, padding: 14, marginBottom: 10 },
  questionBoxLabel: { fontSize: 11, fontWeight: '700', color: t.primary, letterSpacing: 0.8, marginBottom: 6 },
  questionBoxText: { fontSize: 13, color: t.ink, lineHeight: 20 },
  citationCard: { backgroundColor: t.surface, borderRadius: 14, borderWidth: 1, borderColor: t.border, padding: 14, marginBottom: 10 },
  citationLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginBottom: 8 },
  citationText: { fontSize: 12, color: t.inkSoft, lineHeight: 20 },
  actions: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  secondaryBtn: {
    flex: 1, height: 44, borderRadius: 14, backgroundColor: t.surface,
    borderWidth: 1, borderColor: t.borderStrong,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  secondaryBtnText: { fontSize: 14, fontWeight: '600', color: t.ink },
  darkBtn: {
    flex: 1, height: 44, borderRadius: 14, backgroundColor: t.ink,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  darkBtnText: { fontSize: 14, fontWeight: '600', color: '#fff' },
  charCount: { fontSize: 11, color: t.faint, textAlign: 'center', marginTop: 4 },
});
