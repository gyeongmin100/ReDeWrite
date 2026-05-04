import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getNextEditingIndexAfterDelete,
  getSavedExperiences,
} from '../src/services/experienceEditorUtils.mjs';

test('getSavedExperiences updates an existing row without adding a separate row', () => {
  const experiences = ['공모전 대상', '인턴 프로젝트'];

  assert.deepEqual(
    getSavedExperiences(experiences, 1, '인턴 프로젝트 매출 분석'),
    ['공모전 대상', '인턴 프로젝트 매출 분석'],
  );
});

test('getSavedExperiences appends a new row only when editing index is null', () => {
  const experiences = ['공모전 대상'];

  assert.deepEqual(
    getSavedExperiences(experiences, null, '동아리 운영'),
    ['공모전 대상', '동아리 운영'],
  );
});

test('getNextEditingIndexAfterDelete clears or shifts stale edit state', () => {
  assert.equal(getNextEditingIndexAfterDelete(2, 2), null);
  assert.equal(getNextEditingIndexAfterDelete(3, 1), 2);
  assert.equal(getNextEditingIndexAfterDelete(0, 2), 0);
});
