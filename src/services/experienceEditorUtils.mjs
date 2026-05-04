export function getSavedExperiences(experiences, editingIndex, text) {
  const trimmed = String(text || '').trim();
  if (!trimmed) return experiences;

  if (editingIndex === null || editingIndex === undefined) {
    return [...experiences, trimmed];
  }

  return experiences.map((experience, index) =>
    index === editingIndex ? trimmed : experience
  );
}

export function getNextEditingIndexAfterDelete(editingIndex, deletedIndex) {
  if (editingIndex === null || editingIndex === undefined) return null;
  if (editingIndex === deletedIndex) return null;
  if (editingIndex > deletedIndex) return editingIndex - 1;
  return editingIndex;
}
