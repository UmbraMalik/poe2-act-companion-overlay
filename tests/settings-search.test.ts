import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getSettingsGroupLabel,
  getSettingsSearchResult,
  getSettingsSectionLabel,
  normalizeSettingsSearchQuery
} from '../src/renderer/settings-search';

test('settings search normalizes whitespace and casing', () => {
  assert.equal(normalizeSettingsSearchQuery('  TIMER   Overlay  '), 'timer overlay');
});

test('settings search matches user-facing settings by English and Russian keywords', () => {
  const timerResult = getSettingsSearchResult('countdown');
  assert.equal(timerResult.visibleSectionIds.has('settings-timer'), true);
  assert.equal(timerResult.visibleGroupIds.has('timer'), true);

  const logResult = getSettingsSearchResult('лог');
  assert.equal(logResult.visibleSectionIds.has('settings-log-file'), true);
  assert.equal(logResult.visibleGroupIds.has('log_detection'), true);

  const overlayResult = getSettingsSearchResult('пресеты');
  assert.equal(overlayResult.visibleSectionIds.has('settings-overlay'), true);
  assert.equal(overlayResult.visibleGroupIds.has('overlay'), true);
});

test('settings search keeps dev-only sections hidden unless developer settings are available', () => {
  const productionResult = getSettingsSearchResult('debug', false);
  assert.equal(productionResult.visibleSectionIds.has('settings-developer'), false);
  assert.equal(productionResult.visibleSectionIds.has('settings-live-update'), false);

  const devResult = getSettingsSearchResult('debug', true);
  assert.equal(devResult.visibleSectionIds.has('settings-developer'), true);
  assert.equal(devResult.visibleSectionIds.has('settings-live-update'), true);
});

test('settings search routes risky performance controls to advanced settings', () => {
  const result = getSettingsSearchResult('realtime priority');

  assert.equal(result.visibleSectionIds.has('settings-advanced'), true);
  assert.equal(result.visibleGroupIds.has('advanced'), true);
  assert.equal(result.visibleSectionIds.has('settings-overlay'), false);
});

test('settings grouping labels and section labels are localized', () => {
  assert.equal(getSettingsGroupLabel('advanced', 'ru'), 'Расширенные');
  assert.equal(getSettingsGroupLabel('overlay', 'en'), 'Overlay and panel');
  assert.equal(getSettingsSectionLabel('settings-advanced', 'ru'), 'Производительность');
  assert.equal(getSettingsSectionLabel('settings-overlay', 'en'), 'Overlay');
});

test('settings search returns an empty state for unrelated queries', () => {
  const result = getSettingsSearchResult('definitely-not-a-setting');

  assert.equal(result.isFiltering, true);
  assert.equal(result.visibleSectionIds.size, 0);
  assert.equal(result.visibleGroupIds.size, 0);
});
