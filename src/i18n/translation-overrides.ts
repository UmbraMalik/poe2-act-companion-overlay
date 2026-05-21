import type { AppLanguage } from '../shared/types';

type TranslationValue = string | TranslationTree;

interface TranslationTree {
  [key: string]: TranslationValue;
}

export const translationOverrides: Record<AppLanguage, TranslationTree> = {
  ru: {
    settings: {
      firstRunTitle: 'ПЕРВЫЙ ЗАПУСК',
      firstRunStepChoose: 'Нажми “Выбрать лог-файл”.',
      firstRunStepPointTo: 'Укажи файл:',
      firstRunStepEnterZone: 'Запусти игру и зайди в любую игровую зону.',
      firstRunStepMoveOverlay: 'Чтобы передвинуть оверлей — зажми ЛКМ по свободной области окна.',
      logFileNotSelected: 'Лог-файл пока не выбран.',
      fileAvailable: 'Файл доступен',
      readOffset: 'Позиция чтения',
      liveUpdateTitle: 'ПОМОЩНИК LIVE-ОБНОВЛЕНИЯ',
      liveUpdateDescription: 'Быстрая проверка живого обновления оверлея без перезапуска приложения. Строка будет дописана в выбранный лог.',
      liveUpdatePlaceholder: 'Строка для дописывания в лог',
      appendLogLine: 'Добавить строку в лог',
      exampleZone: 'Пример зоны',
      exampleReward: 'Пример награды',
      updateAvailableTitle: 'Доступна новая версия: {version}',
      openingRelease: 'Открываем релиз...',
      targetActMinutes: '{label}, мин'
    },
    companion: {
      take: 'Забрать',
      zoneBonusesHint: 'Полный список и ручные отметки — во вкладке “Бонусы”.',
      sceneTownHub: 'Город / хаб',
      sceneGameplay: 'Игровая зона',
      focusCurrentZone: 'К текущей зоне',
      noGuideKnown: 'Инфы по этой локации нет.'
    },
    main: {
      trayTooltip: 'POE2 Act Companion Overlay',
      showOverlay: 'Показать оверлей',
      hideOverlay: 'Скрыть оверлей',
      openCompanion: 'Открыть подробную панель',
      exit: 'Выход',
      hotkeysPrefix: 'Горячие клавиши:',
      hotkeysManual: '{mark} — отметить, {undo} — отменить.',
      hotkeysTimer: '{hotkey} — пауза/продолжить',
      hotkeysCompanion: '{hotkey} — подробная панель',
      hotkeysOverlayMode: '{hotkey} — режим оверлея',
      chooseLogFileTitle: 'Выберите Client.txt или LatestClient.txt',
      chooseLogFileFilter: 'PoE2 Log',
      allFilesFilter: 'Все файлы',
      guideLoadError: 'Не удалось загрузить guide.json',
      townFallback: 'Город',
      saveTimerErrorTitle: 'Не удалось сохранить таймер',
      saveTimerErrorDetail: 'Приложение останется открытым, чтобы вы не потеряли прогресс забега.'
    },
    data: {
      supportGem: 'Камень поддержки',
      ancientTreasures: 'Древние сокровища',
      essenceOfWater: 'Сущность воды',
      gemrotSkull: 'Череп Гемрота',
      soulCore: 'Ядро души',
      charmRelic: '+1 реликвия оберега'
    },
    autoUpdate: {
      genericError: 'Не удалось проверить обновления. Проверь интернет/VPN или попробуй позже.',
      latestYmlError: 'Не удалось проверить автообновление: в последнем релизе не найден latest.yml. Проверь assets релиза.',
      installerFallback: 'Новая версия найдена, но автоматическое обновление недоступно. Если приложение уже было открыто, а потом включался VPN, отключи VPN и нажми “Проверить обновления” ещё раз. Либо открой релиз и скачай установщик вручную.',
      notFound404: 'Не удалось проверить обновления: GitHub вернул 404 для файла обновления.',
      checkOrDownloadError: 'Не удалось проверить или скачать обновление.',
      downloadError: 'Не удалось скачать обновление.'
    }
  },
  en: {
    settings: {
      firstRunTitle: 'FIRST RUN',
      firstRunStepChoose: 'Click “Choose log file”.',
      firstRunStepPointTo: 'Point it to:',
      firstRunStepEnterZone: 'Launch the game and enter any gameplay zone.',
      firstRunStepMoveOverlay: 'To move the overlay, hold LMB on an empty area of the window.',
      logFileNotSelected: 'Log file is not selected yet.',
      fileAvailable: 'File available',
      readOffset: 'Read offset',
      liveUpdateTitle: 'LIVE UPDATE HELPER',
      liveUpdateDescription: 'Quick check for live overlay updates without restarting the app. The line will be appended to the selected log.',
      liveUpdatePlaceholder: 'Log line to append',
      appendLogLine: 'Append log line',
      exampleZone: 'Example zone',
      exampleReward: 'Example reward',
      updateAvailableTitle: 'New version available: {version}',
      openingRelease: 'Opening release...',
      targetActMinutes: '{label}, min'
    },
    companion: {
      take: 'Take',
      zoneBonusesHint: 'The full list and manual marks live in the “Bonuses” tab.',
      sceneTownHub: 'Town / hub',
      sceneGameplay: 'Gameplay zone',
      focusCurrentZone: 'Go to current zone',
      noGuideKnown: 'No guide card for this zone yet.'
    },
    main: {
      trayTooltip: 'POE2 Act Companion Overlay',
      showOverlay: 'Show overlay',
      hideOverlay: 'Hide overlay',
      openCompanion: 'Open detailed panel',
      exit: 'Exit',
      hotkeysPrefix: 'Hotkeys:',
      hotkeysManual: '{mark} — mark, {undo} — undo.',
      hotkeysTimer: '{hotkey} — pause/resume',
      hotkeysCompanion: '{hotkey} — detailed panel',
      hotkeysOverlayMode: '{hotkey} — overlay mode',
      chooseLogFileTitle: 'Choose Client.txt or LatestClient.txt',
      chooseLogFileFilter: 'PoE2 log',
      allFilesFilter: 'All files',
      guideLoadError: 'Could not load guide.json',
      townFallback: 'Town',
      saveTimerErrorTitle: 'Could not save the timer',
      saveTimerErrorDetail: 'The app will stay open so you do not lose run progress.'
    },
    data: {
      supportGem: 'Support Gem',
      ancientTreasures: 'Ancient Treasures',
      essenceOfWater: 'Essence of Water',
      gemrotSkull: 'Gemrot Skull',
      soulCore: 'Soul Core',
      charmRelic: '+1 charm relic'
    },
    autoUpdate: {
      genericError: 'Could not check for updates. Check your internet/VPN or try again later.',
      latestYmlError: 'Could not check auto-update: latest.yml was not found in the latest release. Check the release assets.',
      installerFallback: 'A new version was found, but automatic update is unavailable. If the app was already open and a VPN was enabled afterwards, disable the VPN and click “Check for updates” again. Or open the release page and download the installer manually.',
      notFound404: 'Could not check for updates: GitHub returned 404 for the update file.',
      checkOrDownloadError: 'Could not check or download the update.',
      downloadError: 'Could not download the update.'
    }
  }
};
