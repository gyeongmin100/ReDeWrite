import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, KeyboardAvoidingView, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { tokens as t } from '../theme/tokens';
import {
  getNextEditingIndexAfterDelete,
  getSavedExperiences,
} from '../services/experienceEditorUtils.js';

const CATEGORIES = ['경력', '학업', '대외활동', '자격증·수상', '어학', '기타'];

export default function SpecScreen({ experiences, onUpdateExperiences }) {
  const [activeCategory, setActiveCategory] = useState('경력');
  const [editingIdx, setEditingIdx] = useState(null);
  const [addingExp, setAddingExp] = useState(false);
  const [draftText, setDraftText] = useState('');

  const filteredItems = experiences.filter(e =>
    (typeof e === 'object' ? e.category : null) === activeCategory
  );

  const handleSaveExp = () => {
    if (!draftText.trim()) return;
    const updated = getSavedExperiences(experiences, editingIdx, draftText, activeCategory);
    setAddingExp(false);
    setEditingIdx(null);
    setDraftText('');
    if (onUpdateExperiences) onUpdateExperiences(updated);
  };

  const handleEditExp = (globalIdx) => {
    setEditingIdx(globalIdx);
    setDraftText(experiences[globalIdx].text);
    setAddingExp(false);
  };

  const handleAddExp = () => {
    setAddingExp(true);
    setEditingIdx(null);
    setDraftText('');
  };

  const handleCancelEdit = () => {
    setAddingExp(false);
    setEditingIdx(null);
    setDraftText('');
  };

  const handleDeleteExp = (globalIdx) => {
    Alert.alert('스펙 삭제', '이 항목을 삭제할까요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: () => {
          const updated = experiences.filter((_, i) => i !== globalIdx);
          const nextIdx = getNextEditingIndexAfterDelete(editingIdx, globalIdx);
          setEditingIdx(nextIdx);
          if (nextIdx === null) setDraftText('');
          if (onUpdateExperiences) onUpdateExperiences(updated);
        },
      },
    ]);
  };

  const isEmpty = filteredItems.length === 0 && !addingExp;

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.title}>스펙</Text>
        <TouchableOpacity
          onPress={handleAddExp}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="add" size={26} color={t.primary} />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={s.flex}
        behavior="padding"
      >
        {/* Category filter tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={s.tabsScroll}
          contentContainerStyle={s.tabsContent}
        >
          {CATEGORIES.map(cat => (
            <TouchableOpacity
              key={cat}
              style={[s.tab, activeCategory === cat && s.tabActive]}
              onPress={() => {
                setActiveCategory(cat);
                setAddingExp(false);
                setEditingIdx(null);
                setDraftText('');
              }}
              activeOpacity={0.7}
            >
              <Text style={[s.tabText, activeCategory === cat && s.tabTextActive]}>{cat}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <ScrollView
          style={s.flex}
          contentContainerStyle={isEmpty ? s.scrollEmpty : s.scroll}
          showsVerticalScrollIndicator={false}
        >
          {isEmpty ? (
            <View style={s.emptyState}>
              <Ionicons name="file-tray-outline" size={44} color={t.faint} />
              <Text style={s.emptyTitle}>아직 {activeCategory} 항목이 없어요</Text>
              <Text style={s.emptyDesc}>역할, 성과, 수치를 정리해 두면{'\n'}AI가 더 잘 활용할 수 있어요</Text>
              <TouchableOpacity style={s.emptyBtn} onPress={handleAddExp} activeOpacity={0.8}>
                <Ionicons name="add" size={15} color={t.primary} />
                <Text style={s.emptyBtnText}>추가하기</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {filteredItems.map((e) => {
                const globalIdx = experiences.indexOf(e);
                return (
                  <View key={e.id} style={[s.card, editingIdx === globalIdx && s.cardEditing]}>
                    {editingIdx === globalIdx ? (
                      <>
                        <TextInput
                          style={s.cardInput}
                          value={draftText}
                          onChangeText={setDraftText}
                          multiline
                          autoFocus
                          placeholder="역할, 성과, 수치를 함께 적어주세요"
                          placeholderTextColor={t.faint}
                        />
                        <View style={s.cardActions}>
                          <TouchableOpacity style={s.btnSecondary} onPress={handleCancelEdit}>
                            <Text style={s.btnSecondaryText}>취소</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[s.btnPrimary, !draftText.trim() && s.btnDisabled]}
                            onPress={handleSaveExp}
                            disabled={!draftText.trim()}
                          >
                            <Text style={s.btnPrimaryText}>저장</Text>
                          </TouchableOpacity>
                        </View>
                      </>
                    ) : (
                      <>
                        <Text style={s.cardTitle} numberOfLines={1}>
                          {e.text.length > 30 ? e.text.slice(0, 30) + '…' : e.text}
                        </Text>
                        {e.text.length > 30 && (
                          <Text style={s.cardBody} numberOfLines={2}>{e.text}</Text>
                        )}
                        <View style={s.cardFooter}>
                          <TouchableOpacity
                            style={s.iconBtn}
                            onPress={() => handleEditExp(globalIdx)}
                            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                          >
                            <Ionicons name="pencil-outline" size={16} color={t.muted} />
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={s.iconBtn}
                            onPress={() => handleDeleteExp(globalIdx)}
                            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                          >
                            <Ionicons name="trash-outline" size={16} color={t.danger} />
                          </TouchableOpacity>
                        </View>
                      </>
                    )}
                  </View>
                );
              })}

              {addingExp && (
                <View style={[s.card, s.cardEditing]}>
                  <TextInput
                    style={s.cardInput}
                    placeholder="역할, 성과, 수치를 함께 적어주세요"
                    placeholderTextColor={t.faint}
                    value={draftText}
                    onChangeText={setDraftText}
                    multiline
                    autoFocus
                  />
                  <View style={s.cardActions}>
                    <TouchableOpacity style={s.btnSecondary} onPress={handleCancelEdit}>
                      <Text style={s.btnSecondaryText}>취소</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[s.btnPrimary, !draftText.trim() && s.btnDisabled]}
                      onPress={handleSaveExp}
                      disabled={!draftText.trim()}
                    >
                      <Text style={s.btnPrimaryText}>저장</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  root: { flex: 1, backgroundColor: t.bg },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 14,
  },
  title: { fontSize: 26, fontWeight: '700', color: t.ink, letterSpacing: -0.5 },

  tabsScroll: {
    height: 52,
    flexGrow: 0,
    borderBottomWidth: 1,
    borderBottomColor: t.border,
  },
  tabsContent: {
    minHeight: 52,
    paddingHorizontal: 16,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  tab: {
    height: 32,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: t.surface,
    borderWidth: 1,
    borderColor: t.border,
    justifyContent: 'center',
  },
  tabActive: { backgroundColor: t.ink, borderColor: t.ink },
  tabText: { fontSize: 13, color: t.muted, fontWeight: '500' },
  tabTextActive: { color: '#fff', fontWeight: '600' },

  scroll: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40 },
  scrollEmpty: { flex: 1, paddingHorizontal: 20 },

  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    gap: 12,
  },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: t.muted },
  emptyDesc: { fontSize: 13, color: t.faint, textAlign: 'center', lineHeight: 20 },
  emptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: t.primarySoft,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: t.primaryLight,
    marginTop: 4,
  },
  emptyBtnText: { fontSize: 14, color: t.primary, fontWeight: '600' },

  card: {
    backgroundColor: t.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: t.border,
    padding: 16,
    marginBottom: 12,
  },
  cardEditing: {
    backgroundColor: t.surfaceAlt,
    borderColor: t.borderStrong,
  },
  cardTitle: { fontSize: 15, fontWeight: '600', color: t.ink, marginBottom: 4 },
  cardBody: { fontSize: 13, color: t.muted, lineHeight: 20 },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 2,
    marginTop: 12,
  },
  cardInput: {
    fontSize: 14,
    color: t.ink,
    lineHeight: 22,
    minHeight: 80,
    maxHeight: 160,
    textAlignVertical: 'top',
    padding: 0,
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 12,
  },

  btnSecondary: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: t.surface,
    borderWidth: 1,
    borderColor: t.border,
  },
  btnSecondaryText: { fontSize: 13, color: t.muted, fontWeight: '500' },
  btnPrimary: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: t.primary,
  },
  btnPrimaryText: { fontSize: 13, color: '#fff', fontWeight: '600' },
  btnDisabled: { opacity: 0.4 },
  iconBtn: { padding: 6 },
});
