function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

export function getSavedExperiences(experiences, editingIndex, text, category) {
  const trimmed = String(text || '').trim();
  if (!trimmed) return experiences;

  if (editingIndex === null || editingIndex === undefined) {
    return [...experiences, { id: genId(), text: trimmed, category: category || '기타' }];
  }

  return experiences.map((experience, index) =>
    index === editingIndex ? { ...experience, text: trimmed } : experience
  );
}

export function getNextEditingIndexAfterDelete(editingIndex, deletedIndex) {
  if (editingIndex === null || editingIndex === undefined) return null;
  if (editingIndex === deletedIndex) return null;
  if (editingIndex > deletedIndex) return editingIndex - 1;
  return editingIndex;
}
