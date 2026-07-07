import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { tokens as t } from '../theme/tokens';

const HINT_CHIPS = [
  '네이버 서비스기획 인턴',
  '삼성전자 회로설계',
  '현대차 생산관리',
  '카카오 백엔드 개발',
];

export default function SearchScreen({ navigation, startResearch }) {
  const [query, setQuery] = useState('');
  const [kbHeight, setKbHeight] = useState(0);

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', e => setKbHeight(e.endCoordinates?.height || 0));
    const hideSub = Keyboard.addListener('keyboardDidHide', () => setKbHeight(0));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const handleStart = () => {
    if (!query.trim()) return;
    const companyId = startResearch(query.trim());
    navigation.navigate('Read', { companyId });
  };

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <View style={s.keyboard}>
        <View style={s.inner}>
          {/* 헤더 */}
          <View style={s.header}>
            <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
              <Ionicons name="arrow-back" size={20} color={t.ink} />
            </TouchableOpacity>
            <Text style={s.title}>새 리서치 시작</Text>
          </View>

          {/* 입력 */}
          <View style={s.inputWrap}>
            <Ionicons name="search-outline" size={18} color={t.muted} />
            <TextInput
              style={s.input}
              value={query}
              onChangeText={setQuery}
              placeholder="예: 네이버 서비스기획 인턴"
              placeholderTextColor={t.faint}
              autoFocus
              returnKeyType="done"
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => setQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close-circle" size={18} color={t.faint} />
              </TouchableOpacity>
            )}
          </View>

          {/* 입력 예시 */}
          <Text style={s.label}>입력 예시</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.chipsRow}
            style={s.chipsScroll}
          >
            {HINT_CHIPS.map(chip => (
              <TouchableOpacity
                key={chip}
                style={s.hintChip}
                onPress={() => setQuery(chip)}
                activeOpacity={0.7}
              >
                <Text style={s.hintChipText}>{chip}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* 리서치 시작 버튼 — 하단 탭바 바로 위 고정, 키보드 열리면 그만큼만 위로 */}
        <View style={[s.btnWrap, { paddingBottom: kbHeight > 0 ? kbHeight + 12 : 20 }]}>
          <TouchableOpacity
            style={[s.startBtn, !query.trim() && s.startBtnDisabled]}
            onPress={handleStart}
            activeOpacity={0.85}
            disabled={!query.trim()}
          >
            <Ionicons name="sparkles" size={18} color="#fff" />
            <Text style={s.startBtnText}>리서치 시작</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: t.bg },
  keyboard: { flex: 1 },
  inner: { flex: 1, paddingHorizontal: 20, paddingTop: 14 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20 },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 15, fontWeight: '700', color: t.ink },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14,
    height: 52, backgroundColor: t.surface, borderRadius: 14,
    borderWidth: 1.5, borderColor: t.borderStrong, marginBottom: 18,
  },
  input: { flex: 1, fontSize: 15, color: t.ink },
  label: { fontSize: 11, fontWeight: '700', color: t.muted, letterSpacing: 1, marginBottom: 10 },
  chipsScroll: { flexGrow: 0, marginBottom: 24 },
  chipsRow: { gap: 8, paddingRight: 4 },
  hintChip: {
    paddingHorizontal: 14, height: 34, borderRadius: 999,
    backgroundColor: t.surface, borderWidth: 1, borderColor: t.borderStrong,
    alignItems: 'center', justifyContent: 'center',
  },
  hintChipText: { fontSize: 13, fontWeight: '500', color: t.inkSoft },
  btnWrap: {
    paddingHorizontal: 20,
  },
  startBtn: {
    height: 54, borderRadius: 14, backgroundColor: t.primary,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  startBtnDisabled: { opacity: 0.45 },
  startBtnText: { fontSize: 16, fontWeight: '600', color: '#fff' },
});
