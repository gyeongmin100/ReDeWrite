import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getNextEditingIndexAfterDelete,
  getSavedExperiences,
} from '../src/services/experienceEditorUtils.mjs';

test('getSavedExperiences updates an existing row without adding a separate row', () => {
  const experiences = [
    { id: 'a', text: '공모전 대상', category: '경력' },
    { id: 'b', text: '인턴 프로젝트', category: '경력' },
  ];

  assert.deepEqual(
    getSavedExperiences(experiences, 1, '인턴 프로젝트 매출 분석', '경력'),
    [
      { id: 'a', text: '공모전 대상', category: '경력' },
      { id: 'b', text: '인턴 프로젝트 매출 분석', category: '경력' },
    ],
  );
});

test('getSavedExperiences appends a new row only when editing index is null', () => {
  const experiences = [{ id: 'a', text: '공모전 대상', category: '경력' }];

  const saved = getSavedExperiences(experiences, null, '동아리 운영', '동업');

  assert.equal(saved.length, 2);
  assert.deepEqual(saved[0], { id: 'a', text: '공모전 대상', category: '경력' });
  assert.equal(saved[1].text, '동아리 운영');
  assert.equal(saved[1].category, '동업');
  assert.ok(saved[1].id);
});

test('getNextEditingIndexAfterDelete clears or shifts stale edit state', () => {
  assert.equal(getNextEditingIndexAfterDelete(2, 2), null);
  assert.equal(getNextEditingIndexAfterDelete(3, 1), 2);
  assert.equal(getNextEditingIndexAfterDelete(0, 2), 0);
});
