# POE2 Act Companion Overlay

A lightweight desktop overlay for **Path of Exile 2 campaign routing**.

It shows the current campaign zone, route notes, rewards, reminders, timers, and a detailed campaign panel without reading game memory or touching the game client.

> **Status:** beta / community project  
> **Languages:** Russian and English  
> **Primary platform:** Windows  
> **Website:** https://umbramalik.github.io/poe2-act-companion-overlay/

---

## What it does

POE2 Act Companion Overlay is a small helper for campaign runs:

- detects the current zone from the game log file;
- shows route notes for Acts 1–5;
- shows current-zone tasks and the next zone;
- tracks total time and act time;
- shows reminders for flasks, bases, power spikes, rewards, and campaign bonuses;
- provides a detailed panel with route, timers, act times, reminders, bonuses, and summary;
- supports **RU / EN** interface switching;
- supports Russian and English client log formats where mapped.

The goal is simple: make repeated campaign runs less annoying, especially for new or returning players.

---

## Safety / how it works

This project is designed as a **passive local overlay**.

It does **not**:

- read Path of Exile 2 process memory;
- inject into the game;
- modify the game client;
- intercept or inspect network packets;
- automate gameplay;
- send inputs to the game;
- click, type, or perform actions for the player.

It only:

- reads the game log file, such as `Client.txt` / `LatestClient.txt`, for zone and event detection;
- displays local guide data from the project files;
- draws a desktop overlay window.

The source code is public so users can inspect what the application does before running it.

---

## Important disclaimer

This project is **not affiliated with, endorsed by, or approved by Grinding Gear Games**.

Path of Exile and Path of Exile 2 are trademarks and property of Grinding Gear Games.

This tool is provided as a community-made helper. Use it at your own discretion. Do not present it as officially approved by GGG.

---

## Download

Latest public builds are available on the releases page:

https://github.com/UmbraMalik/poe2-act-companion-overlay/releases

Windows may show a SmartScreen warning because the installer is currently unsigned. This does not automatically mean the file is malicious; it means the executable does not have Microsoft reputation/signing yet. You can inspect the source code and build it yourself if you prefer.

---

## Build from source

Requirements:

- Node.js
- npm
- Windows is the main tested platform

Install dependencies:

```bash
npm install
```

Run in development mode:

```bash
npm run dev
```

Run regression tests:

```bash
npm test
```

Build renderer and Electron files:

```bash
npm run build
```

Create a distributable installer:

```bash
npm run dist:checked
```

Clean old release artifacts and build a fresh release:

```bash
npm run dist:clean
```

---

## Project structure

```text
src/data/       Campaign guide data, bonuses, power spikes, log patterns
src/i18n/       RU/EN UI and guide-data localization
src/main/       Electron main process
src/renderer/   Overlay, settings, detailed panel, UI logic
src/shared/     Shared helpers, timers, report templates, layout logic
tests/          Regression and data integrity tests
assets/         App icons and installer assets
```

Important files:

```text
src/data/guide.json                         Main campaign guide data
src/i18n/translations.ts                    UI localization
src/i18n/clean-data-translations.en.json    English guide-data translations
src/i18n/data.ts                            Guide-data translation layer
src/shared/community-links.ts               Project/community links
```

---

## Localization

The app supports Russian and English UI.

Technical note:

- `zone_en` is used as a stable technical/matching value where needed;
- displayed zone names and guide text are localized through the i18n/data layer;
- English text should be natural English, not transliteration.

If you find text like `bossu`, `klyuchevoy`, `zapustit`, `razborki`, or any other transliteration in EN mode, please report it.

---

## Testing philosophy

The project has regression tests for guide data, log parsing, timers, overlay behavior, settings, links, and safety checks.

Before opening a pull request or publishing a release, run:

```bash
npm test
npm run build
```

For release builds:

```bash
npm run dist:checked
```

---

## Community

- Website: https://umbramalik.github.io/poe2-act-companion-overlay/
- Telegram channel: https://t.me/POE2ActCompanion
- Telegram chat: https://t.me/POE2ActCompanionChat
- Feedback: https://t.me/POE2ActCompanion?direct

Bug reports are especially useful when they include:

- app version;
- client language;
- current act/zone;
- screenshot of the overlay;
- short relevant fragment from `Client.txt` / `LatestClient.txt` if the issue is zone detection.

---

## Russian / Русская версия

**POE2 Act Companion Overlay** — это лёгкий desktop overlay для прохождения кампании Path of Exile 2.

Он показывает текущую зону, маршрут, задачи, награды, напоминания, таймеры и подробную панель по актам.

Приложение:

- не читает память игры;
- не инжектится в клиент;
- не перехватывает сетевые пакеты;
- не автоматизирует геймплей;
- не отправляет ввод в игру;
- работает по логам игры и локальным данным гайда.

Проект не связан с Grinding Gear Games и не одобрен GGG официально.

Скачать актуальную версию можно здесь:

https://github.com/UmbraMalik/poe2-act-companion-overlay/releases

Команды для проверки и сборки:

```bash
npm install
npm test
npm run build
npm run dist:checked
```
