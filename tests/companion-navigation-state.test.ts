import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createDefaultCompanionNavigationState,
  getCompanionSection,
  normalizeCompanionNavigationState,
  updateCompanionNavigationState
} from '../src/renderer/companion-navigation-state';

test('companion navigation restores only valid tabs for each section', () => {
  const normalized = normalizeCompanionNavigationState({
    activeTab: 'reminders',
    lastTabs: {
      zone: 'summary',
      route: 'route',
      progress: 'reminders',
      run: 'actTimes'
    }
  });

  assert.equal(normalized.activeTab, 'reminders');
  assert.equal(normalized.lastTabs.zone, 'zone');
  assert.equal(normalized.lastTabs.route, 'route');
  assert.equal(normalized.lastTabs.progress, 'reminders');
  assert.equal(normalized.lastTabs.run, 'actTimes');
});

test('companion navigation remembers the last nested tab per section', () => {
  const initial = createDefaultCompanionNavigationState();
  const withSummary = updateCompanionNavigationState(initial, 'summary');
  const withReminders = updateCompanionNavigationState(withSummary, 'reminders');

  assert.equal(getCompanionSection(withReminders.activeTab), 'progress');
  assert.equal(withReminders.lastTabs.progress, 'reminders');
  assert.equal(withReminders.lastTabs.run, 'summary');
});

test('companion navigation falls back safely for corrupted persisted data', () => {
  assert.deepEqual(
    normalizeCompanionNavigationState({ activeTab: 'banana', lastTabs: 'broken' }),
    createDefaultCompanionNavigationState()
  );
});
