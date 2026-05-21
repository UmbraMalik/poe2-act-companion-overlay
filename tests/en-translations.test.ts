import test from 'node:test';
import assert from 'node:assert/strict';
import { readJson } from './helpers/loadJson';

const TRANSLITERATION_GARBAGE_RE = new RegExp(
  String.raw`\b(?:voyti|arenu|bossu|dobavit|podkhod(?:yashchie)?|klyuchev(?:oy|ye)?|razborki|bonusov|predznamenovaniya|otdat|lagere|zapustit|monetu|lutom|luta|vzryvchatk\w*|marshrut\w*|uvodit|melkie|garantirovannye|sobral|neede|kapitana|obmenyat|denniga|dennigom|rasstavit|dotyagivaesh|dofarmit|instans|reshyotchatye|vedmu|metle|zhemchuzhinu|ustarevshie|navyki|etomu|ubrat|silnee|farmit|plotnost|kolonn|trete|okeana|ukhodit|dlinnye|tupiki|rutbridzha|barey|nalevo|holtenu|materialy|mashinarium|zhemchuzhinu|ligovuyu)\b`,
  'i'
);

const BROKEN_ENGLISH_PHRASES_RE = new RegExp(
  String.raw`\b(?:can\s+skip,\s+if|can\s+respawn\s+at\s+checkpoint|if\s+on\s+at|to\s+nearby\s+not|not\s+wait\s+loot|return\s+in\s+(?:route|main\s+route|old\s+instans)|checkpoint\s+back\s+in|open\s+gates\s+chapel|gem\s+skill|skill\s+level)\b`,
  'i'
);

test('clean EN guide translations do not contain transliteration leftovers', () => {
  const translations = readJson<Record<string, string>>('src/i18n/clean-data-translations.en.json');

  for (const [source, target] of Object.entries(translations)) {
    assert.equal(
      TRANSLITERATION_GARBAGE_RE.test(target),
      false,
      `EN translation for "${source}" contains transliteration garbage: "${target}"`
    );
    assert.equal(
      BROKEN_ENGLISH_PHRASES_RE.test(target),
      false,
      `EN translation for "${source}" contains broken English phrasing: "${target}"`
    );
  }
});
