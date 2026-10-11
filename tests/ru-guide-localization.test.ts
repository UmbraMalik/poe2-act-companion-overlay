import test from 'node:test';
import assert from 'node:assert/strict';
import { readJson } from './helpers/loadJson';

type VisibleGuideZone = {
  zone_ru: string;
  checklist?: Array<{ text: string }>;
  rewards?: string[];
  skip?: string[];
  important?: string[];
  after?: string[];
  boss_tips?: string[];
  xp_notes?: string[];
  crafting_tips?: string[];
  details?: Record<string, string[]>;
};

const ENGLISH_WORD = /[A-Za-z]{2,}/g;
const KEYBOARD_KEYS = new Set(['Ctrl', 'Alt']);

function checkRussianGuideText(text: string, context: string): void {
  const unexpected = (text.match(ENGLISH_WORD) ?? []).filter((word) => !KEYBOARD_KEYS.has(word));
  assert.deepEqual(unexpected, [], `${context}: non-localized terms in RU copy: ${text}`);
}

test('RU campaign guide does not mix English words into visible instructions', () => {
  const guide = readJson<{
    zones: VisibleGuideZone[];
    global_reminders?: Record<string, Array<{ title?: string; items?: string[] }>>;
  }>('src/data/guide.json');

  for (const zone of guide.zones) {
    checkRussianGuideText(zone.zone_ru, 'zone name');
    for (const item of zone.checklist ?? []) {
      checkRussianGuideText(item.text, 'checklist');
    }
    for (const field of ['rewards', 'skip', 'important', 'after', 'boss_tips', 'xp_notes', 'crafting_tips'] as const) {
      for (const line of zone[field] ?? []) {
        checkRussianGuideText(line, field);
      }
    }
    for (const [field, lines] of Object.entries(zone.details ?? {})) {
      for (const line of lines) {
        checkRussianGuideText(line, `details.${field}`);
      }
    }
  }

  for (const reminders of Object.values(guide.global_reminders ?? {})) {
    for (const reminder of reminders) {
      if (reminder.title) checkRussianGuideText(reminder.title, 'reminder title');
      for (const line of reminder.items ?? []) checkRussianGuideText(line, 'reminder item');
    }
  }
});

test('RU campaign rewards and level reminders use Russian player-facing wording', () => {
  const bonuses = readJson<{ bonuses: Array<{
    zone_ru: string; title: string; source: string; details?: string[];
  }> }>('src/data/campaign-bonuses.json');
  const spikes = readJson<Array<{ title: string; items?: string[] }>>('src/data/power-spikes.json');

  for (const bonus of bonuses.bonuses) {
    for (const line of [bonus.zone_ru, bonus.title, bonus.source, ...(bonus.details ?? [])]) {
      checkRussianGuideText(line, 'campaign bonus');
    }
  }
  for (const spike of spikes) {
    checkRussianGuideText(spike.title, 'level reminder');
    for (const line of spike.items ?? []) checkRussianGuideText(line, 'level reminder');
  }
});

test('updated RU navigation tip keeps its EN counterpart', () => {
  const translations = readJson<Record<string, string>>('src/i18n/clean-data-translations.en.json');
  const ru = 'Лютня Уны обычно находится прямо за тележками. Редкий монстр у круга посевов может дать камень умения 4-го уровня.';
  assert.match(translations[ru] ?? '', /Una.s lute/i);
  assert.match(translations[ru] ?? '', /crop circle/i);
});
