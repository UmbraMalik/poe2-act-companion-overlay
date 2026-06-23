const LANGUAGE_STORAGE_KEY = 'poe2-act-companion-overlay-site-language';
const SUPPORTED_LANGUAGES = ['ru', 'en'];

const TEXT_TRANSLATIONS_EN = {
  'POE2 Act Companion Overlay — оверлей для актов POE2': 'POE2 Act Companion Overlay — campaign overlay for POE2',
  'Overlay · RU/EN beta': 'Overlay · RU/EN beta',
  'Что умеет': 'Features',
  'Демо': 'Demo',
  'Исходники': 'Source',
  'Скрины': 'Screens',
  'Установка': 'Install',
  'Обновления': 'Updates',
  'Безопасность': 'Safety',
  'Сообщество': 'Community',
  'сообщество': 'community',
  'Поддержать': 'Support',
  'beta · русский и английский клиент · работает по логам игры': 'beta · Russian and English client · works from game logs',
  'Оверлей для быстрого прохождения актов Path of Exile 2': 'A campaign overlay for faster Path of Exile 2 acts',
  'POE2 Act Companion Overlay читает лог-файл игры, определяет текущую зону и показывает памятку “Что в локации”, следующий переход, скипы, бонусы, статус уровня, таймер забега и время актов — без инжекта в клиент игры.': 'POE2 Act Companion Overlay reads the game log, detects your current zone, and shows what matters there: the next transition, skips, bonuses, level status, run timer, and act splits — without injecting into the game client.',
  'Скачать через GitHub': 'Download from GitHub',
  'Как установить': 'How to install',
  'Загрузок приложения и обновлений': 'App and update downloads',
  'Актуальная версия': 'Current version',
  'Последний релиз': 'Latest release',
  'Подробности': 'Details',
  'Подтягиваем изменения с GitHub Releases…': 'Loading changes from GitHub Releases…',
  'Без чтения памяти': 'No memory reading',
  'Без инжекта': 'No injection',
  'Автообновления': 'Auto-updates',
  'зачем оно нужно': 'why it exists',
  'Чтобы не держать всю кампанию в голове': 'Stop keeping the whole campaign in your head',
  'Вся рутина актов собирается в один боевой HUD: что важно в зоне, что забрать, что скипнуть, куда идти дальше, когда добрать уровень и сколько времени ушло на акт.': 'All the campaign routine is packed into one combat HUD: what matters in the zone, what to pick up, what to skip, where to go next, when to catch up on levels, and how much time each act took.',
  'Текущая зона по логам': 'Current zone from logs',
  'Оверлей читает': 'The overlay reads',
  ', распознаёт зоны русского и английского клиента и обновляет локацию без вмешательства в игру.': ', recognizes zones from both Russian and English clients, and updates the location without touching the game.',
  'Памятка “Что в локации”': 'Zone checklist',
  'Не трекер действий, а обычная памятка по зоне: важные награды, боссы, переходы и то, что не стоит забыть.': 'Not an action tracker — just a compact zone memo: important rewards, bosses, exits, and things you should not forget.',
  'Бонусы актов': 'Act bonuses',
  'Отдельная вкладка с постоянными наградами: пассивки оружия, резисты, дух, здоровье, мана и выборные бонусы.': 'A dedicated tab for permanent rewards: weapon passives, resistances, spirit, life, mana, and selectable bonuses.',
  'Таймер забега': 'Run timer',
  'Общее время, время текущего акта, таблица времени актов, итоги забега и режим “Только таймер” для опытных игроков.': 'Total time, current act time, act split table, run summary, and a Timer Only mode for experienced players.',
  'Напоминания по уровням': 'Level reminders',
  'Статус уровня подсвечивается прямо в строке таймера: низкий уровень, ок или неизвестно. Плюс ближайшие важные уровни и power spikes.': 'Level status is highlighted right in the timer row: underleveled, OK, or unknown. It also shows upcoming key levels and power spikes.',
  'Спидран-подсказки': 'Speedrun tips',
  'Городские планы, “если по пути”, навигация, скипы лишней зачистки и короткие заметки для быстрого прохождения.': 'Town plans, “if on the way” notes, navigation, cleanup skips, and short notes for faster campaign runs.',
  'Подробная панель': 'Detailed panel',
  'Отдельное окно с маршрутом, бонусами, таймером, временем актов, напоминаниями и итогами забега.': 'A separate window with the route, bonuses, timer, act splits, reminders, and run summary.',
  'Приложение проверяет GitHub Releases, скачивает обновление внутри приложения и ставит его только после подтверждения.': 'The app checks GitHub Releases, downloads updates inside the app, and installs them only after confirmation.',
  'демонстрация': 'demo',
  'Посмотреть оверлей в действии': 'See the overlay in action',
  'Короткая видео-демонстрация текущей версии POE2 Act Companion Overlay: как выглядит основной overlay, таймер, компактный режим и подробная панель прямо в работе.': 'A short video demo of the current POE2 Act Companion Overlay beta: the main overlay, timer, compact mode, and detailed panel in action.',
  'Демонстрация': 'Demo',
  'Видеообзор текущей beta-версии': 'Current beta video overview',
  'Смотри прямо на сайте или открой ролик на YouTube.': 'Watch it here or open the video on YouTube.',
  'Смотреть на YouTube': 'Watch on YouTube',
  'Открытый исходный код': 'Open source',
  'Исходники POE2 Act Companion Overlay открыты на GitHub: можно посмотреть код, проверить как работает приложение, предложить правки или просто убедиться, что оверлей читает только лог-файлы игры и не лезет в клиент.': 'POE2 Act Companion Overlay is open source on GitHub: you can inspect the code, see how the app works, suggest changes, or verify that the overlay only reads game log files and does not touch the client.',
  'Открыть GitHub': 'Open GitHub',
  'Про безопасность': 'Safety details',
  'как выглядит': 'screenshots',
  'Скриншоты приложения': 'App screenshots',
  'Актуальный вид основного оверлея, подробной панели, бонусов актов, режима “Только таймер” и компактного режима в текущей beta-версии.': 'Current view of the main overlay, detailed panel, act bonuses, Timer Only mode, and compact mode in the current beta.',
  'Основной overlay': 'Main overlay',
  'Только таймер': 'Timer only',
  'Компактный режим': 'Compact mode',
  'Текущая зона, памятка “Что в локации”, следующий переход, скипы, важные подсказки и статус уровня прямо поверх игры.': 'Current zone, zone checklist, next transition, skips, important notes, and level status right over the game.',
  'beta build': 'beta build',
  'Скачать POE2 Act Companion Overlay': 'Download POE2 Act Companion Overlay',
  'Все сборки публикуются на GitHub Releases. Основная кнопка ниже сама подставляет актуальный installer из последнего релиза и ведёт прямо на скачивание': 'All builds are published on GitHub Releases. The main button below automatically picks the latest installer from the newest release and links directly to the',
  '. После установки выбери лог-файл игры в настройках. Дальше приложение само проверит новые версии и предложит обновиться через GitHub Releases.': 'download. After installation, choose the game log file in settings. The app will then check for new versions and offer updates through GitHub Releases.',
  'Последний релиз': 'Latest release',
  'Пост в Telegram': 'Telegram post',
  'обновления': 'updates',
  'Новые версии приходят через GitHub Releases': 'New versions are delivered through GitHub Releases',
  'Приложение само проверяет наличие обновлений. Если новая версия доступна, оно покажет окно, скачает обновление внутри приложения и предложит установить его только после подтверждения.': 'The app checks for updates automatically. When a new version is available, it shows a window, downloads the update inside the app, and installs it only after confirmation.',
  'Проверка': 'Check',
  'При запуске и вручную из настроек приложение проверяет последний релиз на GitHub.': 'On startup and manually from settings, the app checks the latest release on GitHub.',
  'Загрузка': 'Download',
  'Обновление скачивается внутри приложения. Прогресс отображается в окне обновления и настройках.': 'The update is downloaded inside the app. Progress is shown in the update window and settings.',
  'Ничего не ставится молча: установка начинается только после кнопки “Установить и перезапустить”.': 'Nothing is installed silently: installation starts only after you click “Install and restart”.',
  'Важно про VPN': 'Important VPN note',
  'Если открыть приложение, а потом включить VPN, проверка GitHub Releases может отвалиться. В этом случае в блоке обновлений может появиться статус “Не удалось проверить обновления”, а вместо автообновления приложение предложит открыть релиз и скачать установщик вручную. Это не проблема версии: обновлятор просто не смог стабильно достучаться до GitHub через текущий VPN-маршрут. Отключи VPN и нажми “Проверить обновления” ещё раз либо скачай свежий установщик вручную через кнопку “Последний релиз”.': 'If you open the app and then enable a VPN, the GitHub Releases check may fail. In that case, the updates block may show “Could not check for updates”, and instead of auto-updating the app will offer to open the release and download the installer manually. This is not a version issue: the updater simply could not reach GitHub reliably through the current VPN route. Disable the VPN and click “Check for updates” again, or download the fresh installer manually through the “Latest release” button.',
  'установка': 'installation',
  'Запуск за пару минут': 'Get started in a couple of minutes',
  'Скачай установщик': 'Download the installer',
  'Нажми “Скачать через GitHub” — сайт сам подставит installer': 'Click “Download from GitHub” — the site will automatically pick the installer',
  'из последнего GitHub Release.': 'from the latest GitHub Release.',
  'Рекомендуемый файл:': 'Recommended file:',
  'Запусти установщик': 'Run the installer',
  'Открой скачанный файл и пройди обычную установку в Windows.': 'Open the downloaded file and follow the regular Windows installation flow.',
  'Windows SmartScreen может показать предупреждение, потому что приложение пока не подписано платным цифровым сертификатом. Запускай файл только если понимаешь, что скачал его с официального GitHub Releases.': 'Windows SmartScreen may show a warning because the app is not yet signed with a paid code-signing certificate. Run the file only if you understand that you downloaded it from the official GitHub Releases page.',
  'Выбери лог-файл': 'Choose the log file',
  'После первого запуска открой настройки и укажи путь к игровому логу.': 'After the first launch, open settings and select the game log path.',
  'Играй': 'Play',
  'Оверлей начнёт обновляться по логам и сразу покажет нужный контекст по текущей зоне.': 'The overlay will start updating from the logs and immediately show the relevant context for your current zone.',
  'Зоны RU/EN клиента, уровень, маршрут, подсказки, бонусы, таймер и время актов — всё в одном месте.': 'RU/EN client zones, level, route, tips, bonuses, timer, and act splits — all in one place.',
  'безопасность': 'safety',
  'Безопасность и доверие': 'Safety and trust',
  'POE2 Act Companion Overlay — локальный overlay-помощник. Он не вмешивается в клиент Path of Exile 2 и работает через обычный лог-файл игры.': 'POE2 Act Companion Overlay is a local overlay helper. It does not interfere with the Path of Exile 2 client and works through the regular game log file.',
  'что приложение не делает': 'what the app does not do',
  'Без чтения памяти, инжекта и слежки за экраном': 'No memory reading, no injection, no screen watching',
  'Overlay определяет текущую зону по строкам из': 'The overlay detects the current zone from lines in',
  'и показывает подсказки поверх экрана. Он не читает память игры, не перехватывает сеть и не выполняет действия за игрока.': 'and shows tips over the screen. It does not read game memory, intercept network traffic, or perform actions for the player.',
  'Не читает память игры': 'Does not read game memory',
  'Не делает инжект в клиент': 'Does not inject into the client',
  'Не перехватывает сетевой трафик': 'Does not intercept network traffic',
  'Не нажимает кнопки за игрока': 'Does not press buttons for the player',
  'Не скринит экран': 'Does not screenshot the screen',
  'Не использует OCR': 'Does not use OCR',
  'Читает только Client.txt / LatestClient.txt': 'Reads only Client.txt / LatestClient.txt',
  'Определяет зоны по RU/EN названиям из логов': 'Detects zones by RU/EN names from logs',
  'почему Windows может ругаться': 'why Windows may warn you',
  'SmartScreen и антивирусы': 'SmartScreen and antivirus software',
  'Приложение пока не подписано платным цифровым сертификатом. Из-за этого Windows SmartScreen и некоторые антивирусы могут относиться к installer-файлу осторожно, особенно пока проект новый и у файла мало скачиваний.': 'The app is not yet signed with a paid code-signing certificate. Because of that, Windows SmartScreen and some antivirus tools may treat the installer cautiously, especially while the project is new and the file has few downloads.',
  'Это не означает автоматически, что внутри вирус, но я не прошу отключать антивирус или запускать то, чему вы не доверяете. Если есть сомнения — лучше проверить файл самостоятельно, дождаться следующих версий или не использовать приложение.': 'That does not automatically mean there is a virus inside, but I do not ask anyone to disable antivirus software or run something they do not trust. If you have doubts, check the file yourself, wait for later versions, or do not use the app.',
  'откуда скачивать': 'where to download from',
  'Только GitHub Releases': 'GitHub Releases only',
  'Все релизы публикуются через GitHub Releases. Лучше скачивать только верхний релиз с пометкой': 'All releases are published through GitHub Releases. It is better to download only the top release marked',
  'и не использовать перезаливы со сторонних сайтов.': 'and avoid reuploads from third-party sites.',
  'Для каждого релиза можно указывать SHA256-хэш installer-файла, чтобы пользователь мог проверить, что файл не был подменён.': 'Each release may include a SHA256 hash of the installer so users can verify that the file was not replaced.',
  'кто делает проект': 'who makes the project',
  'Один человек + фидбек сообщества': 'One person + community feedback',
  'POE2 Act Companion Overlay — независимый community-проект от UmbraMalik.': 'POE2 Act Companion Overlay is an independent community project by UmbraMalik.',
  'Проект делает один человек. В некоторых случаях я использую AI-инструменты и фидбек игроков, чтобы быстрее находить ошибки, править зоны, структурировать данные и улучшать overlay.': 'The project is made by one person. In some cases, I use AI tools and player feedback to find issues faster, fix zones, structure data, and improve the overlay.',
  'Это не официальный инструмент Grinding Gear Games и не коммерческий продукт.': 'This is not an official Grinding Gear Games tool and not a commercial product.',
  'Отдельное спасибо ♥': 'Special thanks ♥',
  'Твитч стример': 'Twitch streamer',
  'Тестирует overlay, показывает проект на стриме и помогает с продвижением.': 'Tests the overlay, shows the project on stream, and helps spread the word.',
  'Проект уже использовали / упоминали': 'Already used / mentioned',
  'Открыть Telegram-канал Path of Exile 2': 'Open the Path of Exile 2 Telegram channel',
  'Telegram-канал': 'Telegram channel',
  'Ваш канал': 'Your channel',
  'Написать в Telegram': 'Message on Telegram',
  'поддержали проект': 'project supporters',
  'Рамка поддержавших донатом': 'Donation supporters board',
  'Если отправляешь поддержку и хочешь попасть сюда — укажи ник в комментарии к переводу или донату. Добавляю вручную после проверки. Формат в рамке: ник — сумма.': 'If you support the project and want to appear here, include your nickname in the transfer or donation comment. I add entries manually after checking. Board format: nickname — amount.',
  'Ваш ник': 'Your nickname',
  'сумма': 'amount',
  'Новости, релизы и обновления проекта': 'News, releases, and project updates',
  'Чат проекта': 'Project chat',
  'Вопросы, обсуждение и помощь с установкой': 'Questions, discussion, and installation help',
  'Обратная связь': 'Feedback',
  'Баги, фидбек и предложения': 'Bugs, feedback, and suggestions',
  'поддержка': 'support',
  'Если оверлей помог — можно поддержать': 'Support the project if the overlay helped',
  'Доступ к beta не планируется закрывать за донатом. Поддержка — это просто “спасибо” за время, нервы, правки под русский клиент и вечную борьбу с Electron.': 'Beta access is not planned to be locked behind donations. Support is just a “thank you” for the time, nerves, Russian client fixes, and the eternal fight with Electron.',
  'добровольная поддержка': 'voluntary support',
  'Поддержать проект удобным способом': 'Support the project in a convenient way',
  'Можно перевести по QR через Альфа-Банк или отправить донат через DonationAlerts. Это не покупка доступа и не подписка — просто способ сказать “спасибо” и помочь развитию проекта.': 'You can support via Alfa-Bank QR transfer or DonationAlerts. This is not an access purchase or a subscription — just a way to say “thank you” and help the project grow.',
  'Альфа-Банк': 'Alfa-Bank',
  'Перевод по QR': 'QR transfer',
  'Отсканируй QR-код в приложении банка — реквизиты подтянутся автоматически. Любая сумма добровольная.': 'Scan the QR code in your banking app — payment details will be filled in automatically. Any amount is voluntary.',
  'Комментарий:': 'Comment:',
  'Поддержать через донат': 'Support with a donation',
  'Подойдёт, если удобнее поддержать через DonationAlerts. Откроется отдельная страница доната.': 'Use this if DonationAlerts is more convenient. It opens a separate donation page.',
  'Открыть DonationAlerts ↗': 'Open DonationAlerts ↗',
  'Если хочешь попасть в рамку поддержавших проект — укажи свой ник в комментарии к переводу или в сообщении к донату.': 'If you want to appear on the supporters board, include your nickname in the transfer comment or donation message.',
  'Добровольно': 'Voluntary',
  'QR-перевод': 'QR transfer',
  'Проект делает один человек. В некоторых случаях — при поддержке AI-инструментов и фидбека игроков.': 'The project is made by one person. In some cases, with help from AI tools and player feedback.',
  'Неофициальный фанатский инструмент для Path of Exile 2. Проект не связан с Grinding Gear Games, не одобрен и не поддерживается ими.': 'Unofficial fan-made tool for Path of Exile 2. The project is not affiliated with, endorsed by, or supported by Grinding Gear Games.',
  'Path of Exile 2, Path of Exile и связанные названия принадлежат их правообладателям. Сайт и приложение не используют официальные ассеты игры.': 'Path of Exile 2, Path of Exile, and related names belong to their respective rights holders. The site and app do not use official game assets.',
  'POE2 Act Companion Overlay — оверлей для кампании и эндгейма POE2': 'POE2 Act Companion Overlay — campaign and endgame overlay for POE2',
  'v0.4.0': 'v0.4.0',
  'v0.4.0 · RU/EN клиент · кампания + До Т15 · работает по логам игры': 'v0.4.0 · RU/EN client · campaign + To T15 · works from game logs',
  'POE2 Act Companion Overlay читает лог-файл игры, определяет текущую зону и показывает памятку “Что в локации”, следующий переход, скипы, бонусы, статус уровня, таймер забега, время актов, итоги и путь до T15 — без инжекта в клиент игры.': 'POE2 Act Companion Overlay reads the game log file, detects the current zone, and shows a zone checklist, next transition, skips, bonuses, level status, run timer, act splits, summary, and the path to T15 — without injecting into the game client.',
  'До Т15': 'To T15',
  'Вся рутина кампании собирается в один боевой HUD: что важно в зоне, что забрать, что скипнуть, куда идти дальше, когда добрать уровень, сколько времени ушло на акт и как быстро ты дошёл до T15.': 'All campaign routine is gathered into one combat HUD: what matters in the zone, what to pick up, what to skip, where to go next, when to catch up on levels, how long each act took, and how fast you reached T15.',
  'Общее время, текущий акт, сплиты, итоги, история забегов, сравнение с лучшим результатом и отдельный сегмент “До Т15”.': 'Total time, current act, splits, summary, run history, comparison with your best result, and a separate “To T15” segment.',
  'Эндгейм до T15': 'Endgame to T15',
  'После кампании оверлей продолжает отдельный трек “До Т15”, а при входе в карту 79 уровня автоматически останавливает таймер и сохраняет результат.': 'After the campaign, the overlay continues a separate “To T15” track, and when you enter a level 79 map it automatically stops the timer and saves the result.',
  'Настраиваемые блоки': 'Configurable blocks',
  'Можно включать и выключать отдельные карточки оверлея: ближайшее, бонусы, лигу, маршрут, скипы, спидран и важные подсказки.': 'You can turn individual overlay cards on or off: nearest reminders, bonuses, league, route, skips, speedrun notes, and important tips.',
  'Отдельное окно с маршрутом, бонусами, таймером, временем актов, напоминаниями, итогами забега и историей результатов.': 'A separate window with route, bonuses, timer, act splits, reminders, run summary, and result history.',
  'Быстрое сворачивание': 'Quick collapse',
  'Оверлей можно свернуть в компактную строку, быстро освободить место под инвентарь или гемы и развернуть обратно.': 'The overlay can collapse into a compact bar, quickly freeing space for inventory or gems, and then expand back.',
  'Размер текста': 'Text size',
  'Размер полезного текста регулируется отдельно от масштаба интерфейса — удобно для широких и высоких разрешений.': 'Useful text size can be adjusted separately from UI scale — handy for ultrawide and high-resolution displays.',
  'Теперь это не просто подсказки по актам': 'Now it is more than act tips',
  'Версия 0.4.0 превращает оверлей в полноценную панель забега: хаб-гайды, гибкая настройка блоков, путь до T15, автофиниш, история результатов и аккуратные режимы для игры на любом экране.': 'Version 0.4.0 turns the overlay into a full run dashboard: hub guides, flexible block settings, path to T15, auto-finish, result history, and clean modes for any screen.',
  'Кампания больше не заканчивается на Актах': 'The campaign no longer ends at Acts',
  'После входа в эндгейм-хаб запускается отдельный сегмент “До Т15”. Когда в логах появляется карта 79 уровня, таймер останавливается сам, результат сохраняется, а оверлей показывает компактное поздравление.': 'After entering the endgame hub, a separate “To T15” segment starts. When a level 79 map appears in the logs, the timer stops automatically, the result is saved, and the overlay shows a compact congratulations card.',
  'Хабы': 'Hubs',
  'Гайды для ключевых городов': 'Guides for key towns',
  'Добавлены хаб-гайды для Лагеря Клирфелл, Каравана Ардура, Лагеря на зиккурате и Кингсмарша, чтобы порядок прохождения был понятен ещё до выхода в следующую зону.': 'Hub guides were added for Clearfell Encampment, Ardura Caravan, Ziggurat Encampment, and Kingsmarch, so the route order is clear before you leave for the next zone.',
  'Оверлей под себя': 'Overlay your way',
  'Можно скрывать отдельные блоки, менять размер полезного текста и быстро сворачивать панель, когда она мешает инвентарю, гемам или интерфейсу игры.': 'You can hide individual blocks, change useful text size, and quickly collapse the panel when it blocks inventory, gems, or the game UI.',
  'Актуальный вид основного оверлея, подробной панели, бонусов актов, режима “Только таймер” и компактного режима в версии 0.4.0.': 'Current view of the main overlay, detailed panel, act bonuses, Timer Only mode, and compact mode in version 0.4.0.',
  'Текущая зона, памятка “Что в локации”, следующий переход, скипы, важные подсказки, статус уровня и блоки, которые можно включать или скрывать.': 'Current zone, zone checklist, next transition, skips, important notes, level status, and blocks you can show or hide.',
  'Отдельное окно с маршрутом, бонусами, таймером, временем актов, сегментом “До Т15”, напоминаниями, итогами и историей забегов.': 'A separate window with route, bonuses, timer, act splits, the “To T15” segment, reminders, summary, and run history.',
  'Подробная панель · Бонусы': 'Detailed panel · Bonuses',
  'Постоянные награды кампании: пассивки оружия, резисты, дух, здоровье, мана, выборные бонусы и ручные отметки.': 'Permanent campaign rewards: weapon passives, resistances, spirit, life, mana, selectable bonuses, and manual marks.',
  'Подробная панель · Награды': 'Detailed panel · Rewards',
  'Отдельная витрина наград по актам. Этот слайдер уже готов под дополнительные скрины маршрута, таймера, времени актов, напоминаний и итогов.': 'A dedicated reward view by act. This slider is already ready for additional screenshots of the route, timer, act splits, reminders, and summary.',
  'Зоны RU/EN клиента, уровень, маршрут, подсказки, бонусы, таймер, время актов и “До Т15” — всё в одном месте.': 'RU/EN client zones, level, route, tips, bonuses, timer, act splits, and “To T15” — all in one place.',
  'Текущая зона': 'Current Zone',
  'Маршрут': 'Route',
  'Таймер': 'Timer',
  'Время актов': 'Act Times',
  'Напоминания': 'Reminders',
  'Бонусы': 'Bonuses',
  'Итоги': 'Summary',
  'Подробная панель · Текущая зона': 'Detailed panel · Current Zone',
  'Карточка текущей зоны с подсказками, ближайшими уровнями, бонусами, лигой, следующим переходом и важными заметками.': 'Current zone card with tips, nearest level reminders, bonuses, league reward, next transition, and important notes.',
  'Подробная панель · Маршрут': 'Detailed panel · Route',
  'Полный маршрут по актам и interlude-частям: порядок зон, опциональные точки, хабы и переходы между страницами.': 'Full act and interlude route: zone order, optional stops, hubs, and transitions between pages.',
  'Подробная панель · Таймер': 'Detailed panel · Timer',
  'Общее время забега, время текущего акта, статус, паузы, сброс и управление текущим прохождением.': 'Total run time, current act time, status, pauses, reset, and run controls.',
  'Подробная панель · Время актов': 'Detailed panel · Act Times',
  'Сплиты по актам, общий прогресс, завершённые акты и отдельный сегмент эндгейма “До Т15”.': 'Act splits, total progress, completed acts, and the separate endgame “To T15” segment.',
  'Подробная панель · Напоминания': 'Detailed panel · Reminders',
  'Ближайшие проверки торговцев, базы оружия/брони, фласки, камни и важные power-spike подсказки по уровню.': 'Upcoming vendor checks, weapon/armour bases, flasks, gems, and important level-based power-spike reminders.',
  'Финальное время, сравнение с личным рекордом, самые долгие зоны, история забегов и сохранённые результаты.': 'Final time, personal-best comparison, longest zones, run history, and saved results.',
};

const ATTRIBUTE_TRANSLATIONS_EN = {
  'Безопасный оверлей для Path of Exile 2: адаптирован под русский и английский клиент, читает логи игры, показывает текущую зону, маршрут, таймер, время актов, подсказки и автообновления через GitHub Releases.': 'Safe Path of Exile 2 campaign overlay: supports Russian and English clients, reads game logs, shows the current zone, route, timer, act splits, tips, and auto-updates through GitHub Releases.',
  'Безопасный русский оверлей для кампании Path of Exile 2: подсказки по зонам, таймер, время актов и автообновления.': 'Safe campaign overlay for Path of Exile 2: zone tips, timer, act splits, and auto-updates.',
  'Навигация': 'Navigation',
  'Скачать через GitHub': 'Download from GitHub',
  'Статистика скачиваний и актуального релиза': 'Download stats and current release',
  'Ключевые особенности': 'Key features',
  'Реальный скриншот оверлея': 'Real overlay screenshot',
  'Реальный скриншот POE2 Act Companion Overlay в игре': 'Real POE2 Act Companion Overlay screenshot in-game',
  'Быстрые действия': 'Quick actions',
  'POE2 Act Companion Overlay — демонстрация': 'POE2 Act Companion Overlay — demo',
  'Открыть исходный код POE2 Act Companion Overlay на GitHub': 'Open POE2 Act Companion Overlay source code on GitHub',
  'POE2 Act Companion Overlay — открытый исходный код на GitHub': 'POE2 Act Companion Overlay — open source on GitHub',
  'Переключение скриншотов приложения': 'App screenshot switcher',
  'Основной overlay: текущая зона, памятка Что в локации, следующий переход, скипы и статус уровня': 'Main overlay: current zone, zone checklist, next transition, skips, and level status',
  'Основной overlay': 'Main overlay',
  'Текущая зона, памятка “Что в локации”, следующий переход, скипы, важные подсказки и статус уровня прямо поверх игры.': 'Current zone, zone checklist, next transition, skips, important notes, and level status right over the game.',
  'Подробная панель: маршрут, бонусы, таймер, напоминания и итоги забега': 'Detailed panel: route, bonuses, timer, reminders, and run summary',
  'Подробная панель': 'Detailed panel',
  'Отдельное окно с маршрутом, бонусами, таймером, временем актов, напоминаниями и итогами забега — когда нужен весь контекст сразу.': 'A separate window with the route, bonuses, timer, act splits, reminders, and run summary — when you need full context at once.',
  'Режим только таймер: вид с таймером, уровнем и следующим переходом': 'Timer Only mode: timer, level, and next transition view',
  'Режим “только таймер”': 'Timer Only mode',
  'Режим для тех, кто хочет держать на экране таймер, уровень и ближайший переход без подробной панели.': 'A mode for players who want only the timer, level, and next transition on screen without the detailed panel.',
  'Компактный режим: узкая панель с общим временем, актом, уровнем и рекомендацией': 'Compact mode: narrow panel with total time, act, level, and recommendation',
  'Компактный режим': 'Compact mode',
  'Самый компактный вариант: узкая панель с ключевой информацией для тех, кому нужен минимум визуального шума.': 'The most compact layout: a narrow panel with key information for players who want minimal visual noise.',
  'Ссылки для скачивания': 'Download links',
  'Открыть Twitch-канал 1x1man': 'Open the 1x1man Twitch channel',
  'Если вы стримили с оверлеем, делали пост о проекте или делились им в своём канале — напишите мне. Я могу добавить ваш канал / стрим / сообщество в этот блок как место, где проект уже показывали или упоминали.': 'If you streamed with the overlay, posted about the project, or shared it in your channel — message me. I can add your channel, stream, or community here as a place where the project was shown or mentioned.',
  'Написать в Telegram, чтобы добавить свой канал или стрим': 'Message on Telegram to add your channel or stream',
  'Написать в Telegram': 'Message on Telegram',
  'Где уже показывали или упоминали проект': 'Where the project has already been shown or mentioned',
  'Пользователи, поддержавшие проект переводом': 'Users who supported the project with a transfer',
  'Ссылки сообщества': 'Community links',
  'Способы поддержки проекта': 'Project support methods',
  'Открыть DonationAlerts для поддержки проекта': 'Open DonationAlerts to support the project',
  'Детали поддержки': 'Support details',
  'QR-код для перевода через Альфа-Банк': 'QR code for Alfa-Bank transfer',
  'Безопасный оверлей для Path of Exile 2: RU/EN клиент, маршруты актов, бонусы, таймер, сплиты, итоги забега, гибкие настройки блоков и трекинг эндгейма до T15.': 'Safe Path of Exile 2 overlay: RU/EN client support, act routes, bonuses, timer, splits, run summary, flexible block settings, and endgame tracking to T15.',
  'POE2 Act Companion Overlay: подсказки по зонам, маршруты, бонусы, таймер актов, итоги забега и трекинг до T15.': 'POE2 Act Companion Overlay: zone tips, routes, bonuses, act timer, run summary, and tracking to T15.',
  'Предыдущий экран': 'Previous screen',
  'Следующий экран': 'Next screen',
  'Подробная панель: бонусы актов и постоянные награды кампании': 'Detailed panel: act bonuses and permanent campaign rewards',
  'Подробная панель: вкладка бонусов с наградами по актам': 'Detailed panel: bonuses tab with act rewards',
  'Подробная панель: вкладка текущей зоны': 'Detailed panel: current zone tab',
  'Подробная панель: вкладка маршрута кампании': 'Detailed panel: campaign route tab',
  'Подробная панель: вкладка таймера забега': 'Detailed panel: run timer tab',
  'Подробная панель: вкладка времени актов и До Т15': 'Detailed panel: act times and To T15 tab',
  'Подробная панель: вкладка напоминаний': 'Detailed panel: reminders tab',
  'Подробная панель: вкладка итогов забега': 'Detailed panel: run summary tab',
  'Основной overlay: текущая зона, памятка, следующий переход, скипы, статус уровня и настраиваемые блоки': 'Main overlay: current zone, checklist, next transition, skips, level status, and configurable blocks',
  'Текущая зона, памятка “Что в локации”, следующий переход, скипы, важные подсказки, статус уровня и блоки, которые можно включать или скрывать.': 'Current zone, zone checklist, next transition, skips, important notes, level status, and blocks you can show or hide.',
  'Отдельное окно с маршрутом, бонусами, таймером, временем актов, сегментом “До Т15”, напоминаниями, итогами и историей забегов.': 'A separate window with route, bonuses, timer, act splits, the “To T15” segment, reminders, summary, and run history.',
};

const UI_MESSAGES = {
  ru: {
    copied: 'Скопировано',
    copyFailed: 'Не скопировано',
    downloadVersion: (version) => `Скачать ${version}`,
    downloadFallback: 'Скачать через GitHub',
    downloadVersionAria: (version) => `Скачать установщик версии ${version}`,
    downloadManualAria: 'Открыть GitHub Releases для ручного скачивания',
    releaseEmpty: 'Описание последнего релиза пока не заполнено.',
    releaseFallbackOne: 'Не удалось подтянуть данные последнего релиза.',
    releaseFallbackTwo: 'Скачай актуальную сборку вручную через GitHub Releases.',
    languageToggleLabel: 'Переключить язык сайта',
    languageToggleTitle: 'Переключить язык сайта'
  },
  en: {
    copied: 'Copied',
    copyFailed: 'Not copied',
    downloadVersion: (version) => `Download ${version}`,
    downloadFallback: 'Download from GitHub',
    downloadVersionAria: (version) => `Download installer version ${version}`,
    downloadManualAria: 'Open GitHub Releases for manual download',
    releaseEmpty: 'The latest release description is not filled in yet.',
    releaseFallbackOne: 'Could not load latest release data.',
    releaseFallbackTwo: 'Download the current build manually from GitHub Releases.',
    languageToggleLabel: 'Switch site language',
    languageToggleTitle: 'Switch site language'
  }
};

const CIS_LANGUAGE_PREFIXES = ['ru', 'be', 'uk', 'kk', 'ky', 'uz', 'az', 'hy', 'ka', 'tg', 'tk', 'mo'];
const CIS_TIMEZONES = [
  'Europe/Moscow', 'Europe/Kaliningrad', 'Europe/Samara', 'Europe/Volgograd', 'Europe/Astrakhan',
  'Europe/Saratov', 'Europe/Ulyanovsk', 'Europe/Kirov', 'Europe/Minsk', 'Europe/Chisinau',
  'Asia/Yekaterinburg', 'Asia/Omsk', 'Asia/Novosibirsk', 'Asia/Barnaul', 'Asia/Tomsk',
  'Asia/Novokuznetsk', 'Asia/Krasnoyarsk', 'Asia/Irkutsk', 'Asia/Chita', 'Asia/Yakutsk',
  'Asia/Vladivostok', 'Asia/Sakhalin', 'Asia/Magadan', 'Asia/Kamchatka', 'Asia/Anadyr',
  'Asia/Almaty', 'Asia/Aqtau', 'Asia/Aqtobe', 'Asia/Atyrau', 'Asia/Oral', 'Asia/Qostanay', 'Asia/Qyzylorda',
  'Asia/Bishkek', 'Asia/Tashkent', 'Asia/Samarkand', 'Asia/Dushanbe', 'Asia/Ashgabat',
  'Asia/Baku', 'Asia/Yerevan', 'Asia/Tbilisi'
];

function normalizeLanguage(value) {
  return SUPPORTED_LANGUAGES.includes(value) ? value : null;
}

function getLanguageFromUrl() {
  try {
    return normalizeLanguage(new URLSearchParams(window.location.search).get('lang'));
  } catch (error) {
    return null;
  }
}

function detectPreferredLanguage() {
  const urlLanguage = getLanguageFromUrl();
  if (urlLanguage) return urlLanguage;

  let savedLanguage = null;
  try {
    savedLanguage = normalizeLanguage(window.localStorage.getItem(LANGUAGE_STORAGE_KEY));
  } catch (error) {
    savedLanguage = null;
  }
  if (savedLanguage) return savedLanguage;

  const browserLanguages = Array.isArray(navigator.languages) && navigator.languages.length > 0
    ? navigator.languages
    : [navigator.language || ''];

  const hasCisLanguage = browserLanguages.some((language) => {
    const prefix = String(language || '').toLowerCase().split('-')[0];
    return CIS_LANGUAGE_PREFIXES.includes(prefix);
  });

  if (hasCisLanguage) return 'ru';

  try {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (CIS_TIMEZONES.includes(timezone)) return 'ru';
  } catch (error) {
    // ignore timezone detection issues
  }

  return 'en';
}

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function translateText(original, language) {
  if (language === 'ru') return original;
  return TEXT_TRANSLATIONS_EN[normalizeText(original)] || original;
}

function translateAttr(original, language) {
  if (language === 'ru') return original;
  return ATTRIBUTE_TRANSLATIONS_EN[normalizeText(original)] || original;
}

function collectLocalizedTextNodes() {
  const nodes = [];
  const walker = document.createTreeWalker(document, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent || ['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(parent.tagName)) {
        return NodeFilter.FILTER_REJECT;
      }
      return normalizeText(node.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    }
  });

  while (walker.nextNode()) {
    const node = walker.currentNode;
    nodes.push({ node, original: node.nodeValue });
  }

  return nodes;
}

function collectLocalizedAttributes() {
  const localized = [];
  const attrNames = ['aria-label', 'title', 'alt', 'content', 'data-fallback-text', 'data-screen-alt', 'data-screen-title', 'data-screen-text'];

  document.querySelectorAll('*').forEach((element) => {
    attrNames.forEach((attr) => {
      if (element.hasAttribute(attr)) {
        localized.push({ element, attr, original: element.getAttribute(attr) || '' });
      }
    });
  });

  return localized;
}

const localizedTextNodes = collectLocalizedTextNodes();
const localizedAttributes = collectLocalizedAttributes();
let currentLanguage = detectPreferredLanguage();
let latestReleaseCache = null;
let publicStatsCache = null;

function getUiMessage(key, ...args) {
  const message = UI_MESSAGES[currentLanguage]?.[key] || UI_MESSAGES.ru[key];
  return typeof message === 'function' ? message(...args) : message;
}


function syncLocalizedImages() {
  document.querySelectorAll('[data-image-ru][data-image-en]').forEach((element) => {
    const nextSrc = element.getAttribute(`data-image-${currentLanguage}`);
    if (nextSrc && element.getAttribute('src') !== nextSrc) {
      element.setAttribute('src', nextSrc);
    }
  });

  document.querySelectorAll('[data-screen-image-ru][data-screen-image-en]').forEach((element) => {
    const nextSrc = element.getAttribute(`data-screen-image-${currentLanguage}`);
    if (nextSrc) {
      element.setAttribute('data-screen-image', nextSrc);
    }
  });
}

function getLocalizedScreenImage(tab) {
  return tab.getAttribute(`data-screen-image-${currentLanguage}`) || tab.getAttribute('data-screen-image');
}

function syncActiveScreenPreview() {
  renderActiveScreenPreview();
}

function renderKnownReleaseState() {
  if (latestReleaseCache) {
    renderLatestReleaseDetails(latestReleaseCache);
    return;
  }

  if (publicStatsCache) {
    renderPublicDownloadStats(publicStatsCache);
    renderReleaseFallback(publicStatsCache);
  }
}

function applyLanguage(language, options = {}) {
  currentLanguage = normalizeLanguage(language) || 'en';

  if (options.persist) {
    try {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, currentLanguage);
    } catch (error) {
      // ignore storage issues
    }
  }

  document.documentElement.lang = currentLanguage;
  document.documentElement.dataset.lang = currentLanguage;

  localizedTextNodes.forEach(({ node, original }) => {
    const leading = original.match(/^\s*/)?.[0] || '';
    const trailing = original.match(/\s*$/)?.[0] || '';
    const translated = translateText(original, currentLanguage);
    node.nodeValue = `${leading}${translated}${trailing}`;
  });

  localizedAttributes.forEach(({ element, attr, original }) => {
    element.setAttribute(attr, translateAttr(original, currentLanguage));
  });

  document.title = currentLanguage === 'ru'
    ? 'POE2 Act Companion Overlay — оверлей для актов POE2'
    : 'POE2 Act Companion Overlay — campaign overlay for POE2';

  const languageToggle = document.querySelector('[data-language-toggle]');
  if (languageToggle) {
    languageToggle.setAttribute('aria-label', getUiMessage('languageToggleLabel'));
    languageToggle.setAttribute('title', getUiMessage('languageToggleTitle'));
  }

  syncLocalizedImages();
  syncActiveScreenPreview();
  renderKnownReleaseState();
}

function setupLanguageToggle() {
  const languageToggle = document.querySelector('[data-language-toggle]');
  if (!languageToggle) return;

  languageToggle.addEventListener('click', () => {
    applyLanguage(currentLanguage === 'ru' ? 'en' : 'ru', { persist: true });
  });
}

const internalLinks = document.querySelectorAll('a[href^="#"]');

internalLinks.forEach((link) => {
  link.addEventListener("click", (event) => {
    const href = link.getAttribute("href");
    if (!href || href === "#") return;

    const target = document.querySelector(href);
    if (!target) return;

    event.preventDefault();
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  });
});

const copyButtons = document.querySelectorAll('[data-copy-target]');

async function copyText(text) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  textarea.style.pointerEvents = 'none';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  textarea.remove();
}

copyButtons.forEach((button) => {
  button.addEventListener('click', async () => {
    const targetId = button.getAttribute('data-copy-target');
    const target = targetId ? document.getElementById(targetId) : null;
    const text = target?.textContent?.trim();
    if (!text) return;

    const initialText = button.textContent;

    try {
      await copyText(text);
      button.textContent = getUiMessage('copied');
      button.classList.add('is-copied');
    } catch (error) {
      button.textContent = getUiMessage('copyFailed');
    }

    window.setTimeout(() => {
      button.textContent = initialText;
      button.classList.remove('is-copied');
    }, 1600);
  });
});

const screenTabs = document.querySelectorAll('.screen-tab');
const screenPreviewImage = document.getElementById('screen-preview-image');
const screenPreviewTitle = document.getElementById('screen-preview-title');
const screenPreviewText = document.getElementById('screen-preview-text');
const screenWindow = document.getElementById('screen-window');
const screenWindowLabel = document.getElementById('screen-window-label');
const screenGalleryPrevButton = document.querySelector('[data-screen-gallery-prev]');
const screenGalleryNextButton = document.querySelector('[data-screen-gallery-next]');
const screenGalleryMeta = document.querySelector('[data-screen-gallery-meta]');
const screenGalleryLabel = document.querySelector('[data-screen-gallery-label]');
const screenGalleryTabs = document.querySelector('[data-screen-gallery-tabs]');

const SCREEN_GALLERIES = {
  'companion-panel': [
    {
      label: 'Текущая зона',
      imageRu: './assets/screens/panel-current-zone-ru.png',
      imageEn: './assets/screens/panel-current-zone-en.png',
      fallbackRu: './assets/screens/companion-panel-reference.png',
      fallbackEn: './assets/screens/en-companion-panel.png',
      alt: 'Подробная панель: вкладка текущей зоны',
      title: 'Подробная панель · Текущая зона',
      text: 'Карточка текущей зоны с подсказками, ближайшими уровнями, бонусами, лигой, следующим переходом и важными заметками.'
    },
    {
      label: 'Маршрут',
      imageRu: './assets/screens/panel-route-ru.png',
      imageEn: './assets/screens/panel-route-en.png',
      fallbackRu: './assets/screens/companion-panel-reference.png',
      fallbackEn: './assets/screens/en-companion-panel.png',
      alt: 'Подробная панель: вкладка маршрута кампании',
      title: 'Подробная панель · Маршрут',
      text: 'Полный маршрут по актам и interlude-частям: порядок зон, опциональные точки, хабы и переходы между страницами.'
    },
    {
      label: 'Таймер',
      imageRu: './assets/screens/panel-timer-ru.png',
      imageEn: './assets/screens/panel-timer-en.png',
      fallbackRu: './assets/screens/companion-panel-reference.png',
      fallbackEn: './assets/screens/en-companion-panel.png',
      alt: 'Подробная панель: вкладка таймера забега',
      title: 'Подробная панель · Таймер',
      text: 'Общее время забега, время текущего акта, статус, паузы, сброс и управление текущим прохождением.'
    },
    {
      label: 'Время актов',
      imageRu: './assets/screens/panel-act-times-ru.png',
      imageEn: './assets/screens/panel-act-times-en.png',
      fallbackRu: './assets/screens/companion-panel-reference.png',
      fallbackEn: './assets/screens/en-companion-panel.png',
      alt: 'Подробная панель: вкладка времени актов и До Т15',
      title: 'Подробная панель · Время актов',
      text: 'Сплиты по актам, общий прогресс, завершённые акты и отдельный сегмент эндгейма “До Т15”.'
    },
    {
      label: 'Напоминания',
      imageRu: './assets/screens/panel-reminders-ru.png',
      imageEn: './assets/screens/panel-reminders-en.png',
      fallbackRu: './assets/screens/companion-panel-reference.png',
      fallbackEn: './assets/screens/en-companion-panel.png',
      alt: 'Подробная панель: вкладка напоминаний',
      title: 'Подробная панель · Напоминания',
      text: 'Ближайшие проверки торговцев, базы оружия/брони, фласки, камни и важные power-spike подсказки по уровню.'
    },
    {
      label: 'Бонусы',
      imageRu: './assets/screens/panel-bonuses-ru.png',
      imageEn: './assets/screens/panel-bonuses-en.png',
      fallbackRu: './assets/screens/act-bonuses-reference.png',
      fallbackEn: './assets/screens/en-companion-panel.png',
      alt: 'Подробная панель: вкладка бонусов с наградами по актам',
      title: 'Подробная панель · Бонусы',
      text: 'Постоянные награды кампании: пассивки оружия, резисты, дух, здоровье, мана, выборные бонусы и ручные отметки.'
    },
    {
      label: 'Итоги',
      imageRu: './assets/screens/panel-summary-ru.png',
      imageEn: './assets/screens/panel-summary-en.png',
      fallbackRu: './assets/screens/act-bonuses-reference.png',
      fallbackEn: './assets/screens/en-companion-panel.png',
      alt: 'Подробная панель: вкладка итогов забега',
      title: 'Подробная панель · Итоги',
      text: 'Финальное время, сравнение с личным рекордом, самые долгие зоны, история забегов и сохранённые результаты.'
    }
  ]
};

let activeScreenGalleryKey = null;
let activeScreenGalleryIndex = 0;

function getActiveScreenTab() {
  return document.querySelector('.screen-tab.is-active');
}

function getScreenGalleryForTab(tab) {
  const key = tab?.getAttribute('data-screen-key');
  const gallery = key ? SCREEN_GALLERIES[key] : null;
  return Array.isArray(gallery) && gallery.length > 0 ? { key, gallery } : null;
}

function getLocalizedGalleryImage(item) {
  return currentLanguage === 'en'
    ? item.imageEn || item.imageRu || item.image
    : item.imageRu || item.imageEn || item.image;
}

function getLocalizedGalleryFallbackImage(item) {
  return currentLanguage === 'en'
    ? item.fallbackEn || item.fallbackRu || item.fallbackImage
    : item.fallbackRu || item.fallbackEn || item.fallbackImage;
}

function renderScreenGalleryTabs(gallery = null, index = 0) {
  if (!screenGalleryTabs) return;

  if (!Array.isArray(gallery) || gallery.length <= 1) {
    screenGalleryTabs.hidden = true;
    screenGalleryTabs.innerHTML = '';
    return;
  }

  screenGalleryTabs.hidden = false;
  screenGalleryTabs.innerHTML = gallery.map((item, itemIndex) => {
    const label = translateText(item.label || item.title || `#${itemIndex + 1}`, currentLanguage);
    const selected = itemIndex === index;
    return `<button class="screen-gallery-tab${selected ? ' is-active' : ''}" type="button" data-screen-gallery-index="${itemIndex}" aria-selected="${selected ? 'true' : 'false'}">${label}</button>`;
  }).join('');
}

function setScreenGalleryControls(isVisible, index = 0, total = 0, gallery = null) {
  const shouldShow = Boolean(isVisible && total > 1);
  [screenGalleryPrevButton, screenGalleryNextButton].forEach((button) => {
    if (!button) return;
    button.hidden = !shouldShow;
    button.setAttribute('aria-hidden', shouldShow ? 'false' : 'true');
  });

  renderScreenGalleryTabs(shouldShow ? gallery : null, index);

  if (screenGalleryMeta) screenGalleryMeta.hidden = !shouldShow;
  if (screenGalleryLabel && shouldShow) {
    screenGalleryLabel.textContent = currentLanguage === 'ru'
      ? `Экран ${index + 1} из ${total}`
      : `Screen ${index + 1} of ${total}`;
  }
}
function renderScreenPreviewFromData(data, options = {}) {
  if (!data || !screenPreviewImage || !screenPreviewTitle || !screenPreviewText) return;

  const nextImage = data.image || getLocalizedGalleryImage(data);
  const nextAlt = data.alt;
  const nextTitle = data.title;
  const nextText = data.text;
  const nextVariant = data.variant || 'landscape';

  if (nextImage) {
    const fallbackImage = getLocalizedGalleryFallbackImage(data);
    screenPreviewImage.onerror = fallbackImage && fallbackImage !== nextImage
      ? () => {
          screenPreviewImage.onerror = null;
          screenPreviewImage.src = fallbackImage;
        }
      : null;
    screenPreviewImage.src = nextImage;
  }
  if (nextAlt) screenPreviewImage.alt = translateAttr(nextAlt, currentLanguage);
  if (nextTitle) {
    const localizedTitle = translateText(nextTitle, currentLanguage);
    screenPreviewTitle.textContent = localizedTitle;
    if (screenWindowLabel) screenWindowLabel.textContent = localizedTitle;
  }
  if (nextText) screenPreviewText.textContent = translateText(nextText, currentLanguage);
  if (screenWindow) screenWindow.dataset.variant = nextVariant;

  setScreenGalleryControls(Boolean(options.galleryTotal), options.galleryIndex || 0, options.galleryTotal || 0, options.gallery || null);
}

function renderActiveScreenPreview() {
  const activeTab = getActiveScreenTab();
  if (!activeTab) return;

  const galleryContext = getScreenGalleryForTab(activeTab);
  if (galleryContext) {
    activeScreenGalleryKey = galleryContext.key;
    activeScreenGalleryIndex = Math.min(activeScreenGalleryIndex, galleryContext.gallery.length - 1);
    const activeSlide = galleryContext.gallery[activeScreenGalleryIndex];
    renderScreenPreviewFromData(activeSlide, {
      galleryIndex: activeScreenGalleryIndex,
      galleryTotal: galleryContext.gallery.length,
      gallery: galleryContext.gallery
    });
    return;
  }

  activeScreenGalleryKey = null;
  activeScreenGalleryIndex = 0;
  renderScreenPreviewFromData({
    image: getLocalizedScreenImage(activeTab),
    alt: activeTab.getAttribute('data-screen-alt'),
    title: activeTab.getAttribute('data-screen-title'),
    text: activeTab.getAttribute('data-screen-text'),
    variant: activeTab.getAttribute('data-screen-variant') || 'landscape'
  });
}

screenTabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    screenTabs.forEach((item) => {
      item.classList.remove('is-active');
      item.setAttribute('aria-selected', 'false');
    });

    tab.classList.add('is-active');
    tab.setAttribute('aria-selected', 'true');
    activeScreenGalleryIndex = 0;
    renderActiveScreenPreview();
  });
});

function moveScreenGallery(direction) {
  const activeTab = getActiveScreenTab();
  const galleryContext = getScreenGalleryForTab(activeTab);
  if (!galleryContext) return;

  const total = galleryContext.gallery.length;
  activeScreenGalleryKey = galleryContext.key;
  activeScreenGalleryIndex = (activeScreenGalleryIndex + direction + total) % total;
  renderActiveScreenPreview();
}

screenGalleryPrevButton?.addEventListener('click', () => moveScreenGallery(-1));
screenGalleryNextButton?.addEventListener('click', () => moveScreenGallery(1));

screenGalleryTabs?.addEventListener('click', (event) => {
  const button = event.target.closest('[data-screen-gallery-index]');
  if (!button) return;

  const activeTab = getActiveScreenTab();
  const galleryContext = getScreenGalleryForTab(activeTab);
  if (!galleryContext) return;

  const nextIndex = Number(button.getAttribute('data-screen-gallery-index'));
  if (!Number.isInteger(nextIndex) || nextIndex < 0 || nextIndex >= galleryContext.gallery.length) return;

  activeScreenGalleryKey = galleryContext.key;
  activeScreenGalleryIndex = nextIndex;
  renderActiveScreenPreview();
});

const RELEASES_REPO = "UmbraMalik/poe2-act-companion-overlay";
const DOWNLOAD_STATS_URL = './stats/downloads.json';
const latestDownloadButtons = Array.from(document.querySelectorAll('[data-latest-download]'));
const installerDownloadsTotalEls = Array.from(document.querySelectorAll('[data-installer-downloads-total]'));
const latestReleaseVersionEls = Array.from(document.querySelectorAll('[data-latest-release-version]'));
const latestReleaseNotesEls = Array.from(document.querySelectorAll('[data-latest-release-notes]'));
const latestReleaseLinkEls = Array.from(document.querySelectorAll('[data-latest-release-link]'));

function isInstallerAsset(asset) {
  const name = String(asset?.name || '').toLowerCase();

  return (
    name.endsWith('.exe') &&
    !name.endsWith('.blockmap') &&
    (name.includes('setup') || name.includes('act-companion') || name.includes('act companion'))
  );
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString(currentLanguage === 'ru' ? 'ru-RU' : 'en-US');
}

function normalizeVersionTag(tagName) {
  if (!tagName) return '—';
  return String(tagName).replace(/^v/i, '');
}

function setTextAll(elements, value) {
  elements.forEach((element) => {
    element.textContent = value;
  });
}

function replaceLegacyBranding(text) {
  const legacyNoun = ['Co', 'dex'].join('');
  const legacySlug = ['poe2', 'campaign', legacyNoun.toLowerCase()].join('-');
  const legacyCompact = ['POE2', 'Campaign', legacyNoun].join('');

  return String(text || '')
    .replace(new RegExp(['POE2', 'Campaign', legacyNoun, 'Overlay'].join(' '), 'g'), 'POE2 Act Companion Overlay')
    .replace(new RegExp(['PoE2', 'Campaign', legacyNoun, 'Overlay'].join(' '), 'g'), 'POE2 Act Companion Overlay')
    .replace(new RegExp(['POE2', 'Campaign', legacyNoun].join(' '), 'g'), 'POE2 Act Companion')
    .replace(new RegExp(['PoE2', 'Campaign', legacyNoun].join(' '), 'g'), 'POE2 Act Companion')
    .replace(new RegExp(`${legacySlug}-releases`, 'g'), 'poe2-act-companion-overlay')
    .replace(new RegExp(legacySlug, 'g'), 'poe2-act-companion-overlay')
    .replace(new RegExp(legacyCompact, 'g'), 'POE2ActCompanion');
}

function normalizeReleaseLine(line) {
  return replaceLegacyBranding(line)
    .replace(/<[^>]*>/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
    .replace(/^#{1,6}\s+/g, '')
    .replace(/^[-*]\s+/g, '')
    .replace(/^—\s*/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractReleaseNoteLines(markdown, maxLines = 4) {
  const raw = String(markdown || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/\r/g, '');

  const lines = raw
    .split('\n')
    .map(normalizeReleaseLine)
    .filter(Boolean)
    .filter((line) => !/^исправлено:?$/i.test(line))
    .filter((line) => !/^добавлено:?$/i.test(line))
    .filter((line) => !/^важно:?$/i.test(line))
    .filter((line) => !/^en[- ]?клиент:?$/i.test(line))
    .filter((line) => !/^fixed:?$/i.test(line))
    .filter((line) => !/^added:?$/i.test(line))
    .filter((line) => !/^important:?$/i.test(line));

  if (lines.length === 0) {
    return [getUiMessage('releaseEmpty')];
  }

  return lines.slice(0, maxLines);
}

function renderReleaseNotes(elements, notes) {
  const noteLines = Array.isArray(notes) ? notes : extractReleaseNoteLines(notes);

  elements.forEach((element) => {
    element.innerHTML = '';

    noteLines.forEach((note) => {
      const item = document.createElement('li');
      item.textContent = note;
      element.appendChild(item);
    });
  });
}

async function loadPublicDownloadStats() {
  const cacheBuster = `v=${Date.now()}`;
  const separator = DOWNLOAD_STATS_URL.includes('?') ? '&' : '?';
  const response = await fetch(`${DOWNLOAD_STATS_URL}${separator}${cacheBuster}`, {
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Download stats request failed: ${response.status}`);
  }

  return response.json();
}

function renderPublicDownloadStats(stats) {
  publicStatsCache = stats;
  const totalDownloads = Number(stats?.totalDownloads || 0);
  const latestVersion = normalizeVersionTag(stats?.latestVersion);

  setTextAll(installerDownloadsTotalEls, formatNumber(totalDownloads));

  if (latestVersion !== '—') {
    setTextAll(latestReleaseVersionEls, latestVersion);
  }
}

async function loadLatestReleaseDetails() {
  const latestUrl = `https://api.github.com/repos/${RELEASES_REPO}/releases/latest`;
  const latestResponse = await fetch(latestUrl, { headers: { Accept: 'application/vnd.github+json' } });

  if (!latestResponse.ok) {
    throw new Error(`GitHub latest release request failed: ${latestResponse.status}`);
  }

  return latestResponse.json();
}

function renderLatestReleaseDetails(latestRelease) {
  latestReleaseCache = latestRelease;
  const latestInstaller = (latestRelease.assets || []).find(isInstallerAsset);
  const versionLabel = normalizeVersionTag(latestRelease.tag_name || latestRelease.name);

  setTextAll(latestReleaseVersionEls, versionLabel);
  renderReleaseNotes(latestReleaseNotesEls, extractReleaseNoteLines(latestRelease.body || latestRelease.name));

  latestReleaseLinkEls.forEach((link) => {
    link.href = latestRelease.html_url || `https://github.com/${RELEASES_REPO}/releases/latest`;
  });

  latestDownloadButtons.forEach((button) => {
    if (latestInstaller) {
      button.href = latestInstaller.browser_download_url;
      button.textContent = getUiMessage('downloadVersion', versionLabel);
      button.setAttribute('aria-label', getUiMessage('downloadVersionAria', versionLabel));
    } else {
      button.href = `https://github.com/${RELEASES_REPO}/releases/latest`;
      button.textContent = versionLabel !== '—' ? getUiMessage('downloadVersion', versionLabel) : getUiMessage('downloadFallback');
      button.setAttribute('aria-label', getUiMessage('downloadManualAria'));
    }
  });
}

function renderReleaseFallback(stats) {
  const statsVersion = normalizeVersionTag(stats?.latestVersion);

  if (statsVersion !== '—') {
    setTextAll(latestReleaseVersionEls, statsVersion);
  } else {
    setTextAll(latestReleaseVersionEls, '—');
  }

  renderReleaseNotes(latestReleaseNotesEls, [
    getUiMessage('releaseFallbackOne'),
    getUiMessage('releaseFallbackTwo')
  ]);

  latestReleaseLinkEls.forEach((link) => {
    link.href = `https://github.com/${RELEASES_REPO}/releases/latest`;
  });

  latestDownloadButtons.forEach((button) => {
    button.textContent = statsVersion !== '—' ? getUiMessage('downloadVersion', statsVersion) : getUiMessage('downloadFallback');
    button.href = `https://github.com/${RELEASES_REPO}/releases/latest`;
    button.setAttribute('aria-label', getUiMessage('downloadManualAria'));
  });
}

async function loadGithubReleaseStats() {
  if (
    latestDownloadButtons.length === 0 &&
    installerDownloadsTotalEls.length === 0 &&
    latestReleaseVersionEls.length === 0 &&
    latestReleaseNotesEls.length === 0
  ) {
    return;
  }

  let publicStats = null;

  try {
    publicStats = await loadPublicDownloadStats();
    renderPublicDownloadStats(publicStats);
  } catch (error) {
    console.warn('Не удалось загрузить накопительную статистику скачиваний', error);
    setTextAll(installerDownloadsTotalEls, '—');
  }

  try {
    const latestRelease = await loadLatestReleaseDetails();
    renderLatestReleaseDetails(latestRelease);
  } catch (error) {
    console.warn('Не удалось загрузить данные последнего релиза GitHub', error);
    renderReleaseFallback(publicStats);
  }
}

latestDownloadButtons.forEach((button) => {
  button.addEventListener('click', () => {
    if (window.ym) {
      window.ym(109210180, 'reachGoal', 'download_installer_click');
    }
  });
});

setupLanguageToggle();
applyLanguage(currentLanguage);

loadGithubReleaseStats().catch((error) => {
  console.warn('Не удалось загрузить данные релиза и статистики', error);
  setTextAll(installerDownloadsTotalEls, '—');
  renderReleaseFallback(null);
});
