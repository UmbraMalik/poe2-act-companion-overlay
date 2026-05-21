import test from 'node:test';
import assert from 'node:assert/strict';
import {
  inferActHintFromInternalAreaId,
  isActLabelScene,
  isLoginLikeScene,
  isTownSceneWithGuide,
  isUnknownOrNullScene,
  isValidGameplaySceneSource,
  normalizeSceneText,
  shouldKeepPendingZoneAreaId
} from '../src/main/scene-classifier';

test('scene classifier normalizes scene text consistently', () => {
  assert.equal(normalizeSceneText('  ЛОГИН  '), 'логин');
  assert.equal(normalizeSceneText('Ёж'), 'еж');
  assert.equal(normalizeSceneText(null), '');
});

test('scene classifier infers campaign act from internal area ids', () => {
  assert.equal(inferActHintFromInternalAreaId('G1_1'), 1);
  assert.equal(inferActHintFromInternalAreaId('c_G4_2'), 4);
  assert.equal(inferActHintFromInternalAreaId('P3_EndgameBridge'), 5);
  assert.equal(inferActHintFromInternalAreaId('unknown'), null);
});

test('scene classifier separates town/login/act-label scenes from gameplay scenes', () => {
  assert.equal(isUnknownOrNullScene('(null)'), true);
  assert.equal(isActLabelScene('Акт 3'), true);
  assert.equal(isLoginLikeScene('Character Selection'), true);

  assert.equal(isTownSceneWithGuide('Clearfell Encampment', null), true);
  assert.equal(isValidGameplaySceneSource('Clearfell Encampment', null), false);
  assert.equal(isValidGameplaySceneSource('The Riverbank', null), true);
  assert.equal(isValidGameplaySceneSource('Акт 2', null), false);
});

test('scene classifier keeps pending generated area ids through non-gameplay scene labels', () => {
  assert.equal(shouldKeepPendingZoneAreaId('(unknown)'), true);
  assert.equal(shouldKeepPendingZoneAreaId('act 5'), true);
  assert.equal(shouldKeepPendingZoneAreaId('Интерлюдия'), true);
  assert.equal(shouldKeepPendingZoneAreaId('The Riverbank'), false);
});
