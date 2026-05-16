# POE2 Campaign Codex Overlay

**POE2 Campaign Codex Overlay** — бесплатный desktop-оверлей для прохождения кампании **Path of Exile 2**.

Оверлей читает лог-файл игры, определяет текущую зону и показывает короткую памятку по прохождению: что важно в локации, какие бонусы можно забрать, куда идти дальше, какой рекомендованный уровень и сколько времени идёт забег.

> Проект фанатский и неофициальный. Не связан с Grinding Gear Games и не поддерживается ими.

## Что умеет

- Определяет текущую зону по `Client.txt` / `LatestClient.txt`.
- Поддерживает русский и английский клиент POE2.
- Показывает подсказки по текущей зоне.
- Показывает блок **«Бонусы зоны»** с важными наградами кампании.
- Показывает ближайшие напоминания по уровню.
- Показывает следующий переход по маршруту.
- Есть общий таймер и таймер текущего акта.
- Есть режимы: основной overlay, компактный режим и **«Только таймер»**.
- Есть подробная панель с маршрутом, бонусами и временем актов.
- Есть окно **«Сообщить о проблеме»** с шаблонами и диагностикой.
- Есть автообновления через GitHub Releases.

## Безопасность

Оверлей работает максимально спокойно и прозрачно:

- не читает память игры;
- не делает инжект в клиент;
- не перехватывает пакеты;
- не отправляет игровые команды;
- не автоматизирует ввод;
- читает только выбранный лог-файл игры;
- показывает обычное desktop-окно поверх игры.

Основной источник данных — лог игры, например:

```text
Path of Exile 2/logs/Client.txt
Path of Exile 2/logs/LatestClient.txt
```

## Скачать

Актуальные сборки публикуются в GitHub Releases:

https://github.com/UmbraMalik/poe2-campaign-codex-releases/releases

Сайт проекта:

https://umbramalik.github.io/poe2-campaign-codex/

Telegram-канал:

https://t.me/POE2CampaignCodex

Фидбек и баги:

https://t.me/POE2CampaignCodex?direct

## Установка для обычного пользователя

1. Скачай актуальный `.exe` из GitHub Releases.
2. Установи приложение.
3. Открой настройки.
4. Выбери лог-файл POE2: `Client.txt` или `LatestClient.txt`.
5. Запусти игру и перейди в локацию.
6. Оверлей сам определит зону и покажет подсказки.

## Разработка

### Требования

- Windows.
- Node.js и npm.
- Установленная Path of Exile 2 для проверки на реальных логах.

### Установка зависимостей

```bash
npm install
```

### Dev-запуск

```bash
npm run dev
```

Команда запускает TypeScript watcher, Vite dev server и Electron.

### Проверочная сборка

```bash
npm run build
```

### Сборка установщика

```bash
npm run dist
```

Готовые файлы появятся в папке `release/`.

Для чистой релизной сборки:

```bash
npm run dist:clean
```

Ожидаемые релизные файлы:

```text
PoE2-Campaign-Codex-Overlay-Setup-<version>.exe
PoE2-Campaign-Codex-Overlay-Setup-<version>.exe.blockmap
latest.yml
```

## Структура проекта

```text
src/main/                 Electron main process
src/main/services/        сервисы логов, конфига, автообновлений и runtime-paths
src/renderer/             React UI
src/renderer/pages/       страницы overlay, settings, companion, update, report issue
src/shared/               общие типы, таймеры, checklist logic
src/data/                 guide.json, бонусы, league rewards, patterns, aliases
assets/                   иконки и NSIS-ассеты установщика
scripts/                  release helper scripts
```

## Данные кампании

Главные файлы данных:

- `src/data/guide.json` — основной маршрут и подсказки по зонам.
- `src/data/campaign-bonuses.json` — постоянные бонусы кампании.
- `src/data/league-mechanic-rewards.json` — одноразовые награды механик.
- `src/data/log-patterns.ru.json` — паттерны логов для RU-клиента.
- `src/data/log-patterns.en.json` — паттерны логов для EN-клиента.
- `src/data/internal-area-aliases.en.json` — mapping internal area id для EN-клиента.
- `src/data/power-spikes.json` — ближайшие важные уровни / напоминания.

## Сообщить о проблеме

В приложении есть окно **«Сообщить о проблеме»**.

Оно не отправляет данные автоматически. Пользователь выбирает шаблон, при необходимости редактирует текст, копирует сообщение с диагностикой и отправляет его в Telegram.

Так проще разбирать баги без сервера, бота и скрытой отправки данных.

## Автообновления

Автообновления завязаны на GitHub Releases репозитория:

```text
UmbraMalik/poe2-campaign-codex-releases
```

Для корректного обновления в релизе должны быть `.exe`, `.exe.blockmap` и `latest.yml`.

## Дисклеймер

POE2 Campaign Codex Overlay — fan-made tool.

Path of Exile 2, Path of Exile и связанные названия принадлежат их правообладателям. Проект не использует официальные игровые ассеты и не является официальным продуктом Grinding Gear Games.

## Лицензия

Лицензия пока не указана.

Если планируется принимать внешние PR или разрешить свободное использование кода, стоит отдельно добавить файл `LICENSE`.
