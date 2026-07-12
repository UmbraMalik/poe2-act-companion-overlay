# POE2 Act Companion Overlay — regression autotests

## Что покрывает suite

- `guide.json` целиком:
  - все `guide entries`;
  - все Acts 1-5;
  - все `areaId`;
  - RU/EN names;
  - aliases;
  - `next_zone_ru` и route-переходы;
  - обязательные checklist/details blocks;
  - защита от `undefined` / `null` / `[object Object]` / `NaN` / mojibake в пользовательских текстах.
- `campaign-bonuses.json` целиком:
  - уникальность bonus id;
  - coverage по всем актам;
  - valid categories/rewards/eventRules;
  - repeated reward families с жёстким контекстом;
  - manual-only bonuses.
- Zone mapping и log/runtime regressions:
  - areaId priority над fuzzy matching;
  - RU/EN alias resolution;
  - похожие зоны и конфликтные пары;
  - no-guide / unknown zones;
  - fallback act context;
  - восстановление guide card после no-guide.
- Log parser:
  - RU и EN log lines;
  - `[SCENE] Set Source [...]`;
  - `Generating level ... area "AREA_ID"`;
  - town/gameplay/unknown transitions;
  - level up;
  - death;
  - reward lines;
  - focus noise.
- Timers:
  - общий таймер;
  - act splits;
  - переходы Act 1 → Act 2 → Act 3 → Act 4 → Act 5;
  - no-guide/town handling;
  - timer formatting;
  - visual heartbeat.
- Overlay / settings / preload / main static regressions:
  - safe drag guard;
  - hotkey/settings UI guards;
  - IPC exposure;
  - external link safety checks;
  - `contextIsolation: true`;
  - `nodeIntegration: false`;
  - отсутствие `powerSaveBlocker`, `setPriority`, `eval`, `new Function`, raw `ipcRenderer` exposure.
- Support/community/report problem:
  - project links;
  - report templates;
  - Telegram direct feedback link;
  - support/community separation from settings.

## Как запускать

```bat
cd /d E:\POE2ACT
npm test
```

## Перед билдом

```bat
npm run build:checked
```

## Перед релизом

```bat
npm run dist:checked
```

## Где лежат fixtures

- log fixtures: `E:\POE2ACT\tests\fixtures\logs`
- test helpers: `E:\POE2ACT\tests\helpers`

## Как добавить новый regression test

1. Сначала воспроизвести баг минимальным unit/static/data-driven тестом.
2. Добавить fixture, если для бага нужен логовый сценарий.
3. Зафиксировать ожидаемое поведение тестом.
4. Только потом минимально править код.
5. Проверить `npm test`.

## Правило проекта

Каждый найденный баг сначала фиксируем тестом, потом правим код.

## Release readiness guards

`npm test` также проверяет:

- наличие содержательных `README.md`, `CHANGELOG.md` и `RELEASE_SMOKE.md`;
- наличие актуальных ключевых скриншотов;
- удаление retired CSS-селекторов и переводов после переработки интерфейса;
- наличие версии схемы конфигурации и безопасной нормализации старых настроек;
- наличие сохранения вложенной навигации подробной панели.
