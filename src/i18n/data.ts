import cleanDataTranslations from './clean-data-translations.en.json';
import type {
  AppLanguage,
  CampaignBonusDefinition,
  GuideDetails,
  GuideEntry,
  LevelReminder,
  PowerSpike
} from '../shared/types';
import type { CommunityLinkDefinition } from '../shared/community-links';

const CLEAN_DATA_TRANSLATIONS = cleanDataTranslations as Record<string, string>;

const DATA_TRANSLATION_OVERRIDES: Record<string, string> = {
  'мортимер: отличная работа': 'Mortimer: excellent work',
  'камень умения': 'skill gem',
  бейра: 'Beira',
  '[resistances|холоду]': '[Resistances|cold]',
  ариадн: 'Ariadne',
  'камень поддержки': 'support gem',
  'очищенные руки': 'Refined Arms',
  ржав: 'rust',
  регал: 'Regal',
  дрейвен: 'Draven',
  '2 очка пассивных умений для набора оружия': '2 weapon set passive skill points',
  духу: 'spirit',
  'максимуму здоровья': 'maximum life',
  'восстановлению маны': 'mana recovery',
  'восстановления маны': 'mana recovery',
  'максимуму маны': 'maximum mana',
  'Убить Миллера в углу напротив входа': 'Kill Miller in the corner opposite the entrance.',
  'После босса сразу пройти в город': 'Go to town immediately after the boss.',
  'Доступ в Лагерь Клирфелл': 'Access to the Clearfell Encampment',
  'Не чистить берег полностью': 'Do not fully clear the shore',
  'Держать HP выше ~35 перед ударом сверху': 'Keep HP above ~35 before the overhead slam',
  'Главное: камень умения + Бейра': 'Main goal: skill gem + Beira',
  'Пожирателя удобнее держать в движении и не стоять в земле/ядах.': 'Keep the Devourer moving and do not stand in ground effects or poison.',
  'После Миллера: взять камень у Ренли, продать лут с босса, если не нужен второй сет — взять талисман.':
    'After Miller, take the gem from Renly, sell the boss loot, and grab the talisman if you do not need a second weapon set.',
  'Лига-награда тут слабая: сфера превращения, делать только по пути':
    'The league reward here is weak: Orb of Transmutation, so only do it if it is on the way.'
};

const CURATED_DATA_TRANSLATION_OVERRIDES: Record<string, string> = {
  "Сайт проекта": "Project website",
  "Чат проекта": "Project chat",
  "Обратная связь": "Feedback",
  "Исходный код": "Source code",
  "Описание, демо, установка и актуальная версия.": "Description, demo, installation, and the current version.",
  "Новости, релизы и важные объявления по overlay.": "News, releases, and important overlay announcements.",
  "Вопросы, обсуждение, помощь с установкой и живой фидбек.": "Questions, discussion, installation help, and live feedback.",
  "Баги, ошибки в данных, предложения и скриншоты проблем.": "Bugs, data issues, suggestions, and screenshots of problems.",
  "Последние сборки, installer .exe и история релизов.": "Latest builds, the installer .exe, and release history.",
  "Открытый код проекта: можно посмотреть, проверить и собрать самому.": "Open source: you can inspect it, verify it, and build it yourself.",
  "Открыть канал": "Open channel",
  "Написать": "Message us",
  "Открыть релизы": "Open releases",
  "Abyss обычно скипать, если XP хватает; если сильно отстал — можно использовать как догон.": "Usually skip Abyss if XP is fine; if you are far behind, use it to catch up.",
  "Artificer orb вдоль стены и много whetstones/scraps — брать, если по маршруту.": "Artificer\'s Orb along the wall plus lots of Whetstones/Armourer\'s Scraps — take them if they are on the route.",
  "Flame Skin ritual — один из лучших догонов XP: можно чистить, ресаться на чекпоинте и повторять.": "Flame Skin ritual is one of the best XP catch-ups: clear it, respawn at the checkpoint, and repeat.",
  "Lesser Jeweller из лиги очень полезен — если не нашёл по пути, можно специально забрать.": "Lesser Jeweller\'s Orb from the league mechanic is very useful — if you did not find one on the route, it is worth grabbing deliberately.",
  "Pounce можно использовать через завалы; Herald of Ash включить, если есть spirit gem": "Pounce can be used through rubble; enable Herald of Ash if you have a Spirit Gem.",
  "Арастас / основной маршрут Акта 4": "Arastas / Act 4 main route",
  "Бездны обычно скипать, если XP хватает": "Usually skip Abyss if your XP is fine.",
  "В караване: через Ctrl+ЛКМ у Скрытого можно быстро идентифицировать вещи; говори с Асалой и сразу на ворота/карьер.": "In the caravan: Ctrl+click the Hooded One to identify items quickly; talk to Asala and go straight to the gate/quarry.",
  "В финале сначала убить Леди Алсвит": "In the finale, kill Lady Alswith first.",
  "В финале сначала убить Леди Алсвит, потом остальных.": "In the finale, kill Lady Alswith first, then the others.",
  "В центре найти Душу Паромщика": "Find the Ferryman's Soul in the center.",
  "Вернуться и пройти Делириум": "Return and clear Delirium.",
  "Взять чекпоинт у тьмы; убить двух боссов, нажать 6 камней и идти к Сеоре.": "Take the checkpoint near the darkness; kill the two bosses, activate the six stones, and go to Seore.",
  "Взять экзальт из лиги, если точка недалеко": "Take the league Exalted Orb if the encounter is nearby.",
  "Вход из Топей химеридов; после проверки возвращаться к основному маршруту Акта 3.": "Enter from the Chimeral Wetlands; after checking it, return to the Act 3 main route.",
  "Главная цель — найти переход в Убежище Куачик.": "Main goal: find the transition to The Cuachic Vault.",
  "Делириум-валюту сохранить под амулет из Поющих пещер": "Save Delirium currency for the amulet from the Singing Caves.",
  "Делириум-валюту сохранить под амулет из Поющих пещер/дальнейший апгрейд.": "Save Delirium currency for the amulet from the Singing Caves / a later upgrade.",
  "Держать основной урон по боссу, использовать окна после его атак и не забывать про навык для одиночной цели.": "Keep your main damage on the boss, use windows after its attacks, and do not forget your single-target skill.",
  "Держать темп и искать переход дальше по ветке.": "Keep the pace and look for the next transition along the branch.",
  "Держаться правой стены до Воющих пещер": "Hug the right wall until the Howling Caves.",
  "Держаться правой стены до Сердца племени": "Hug the right wall until Heart of the Tribe.",
  "Доступ к Колодцу душ / Abyss-ветке": "Access to the Well of Souls / Abyss branch.",
  "Драться в углу напротив входа: после боя можно быстрее пройти за завал в город.": "Fight in the corner opposite the entrance: after the fight you can get past the rubble into town faster.",
  "Древние клятвы: выбор оберегов": "Ancient Vows: charm choice",
  "Если shrine даёт урон — босс сильно ускоряется": "If the shrine gives damage, the boss becomes much faster.",
  "Если НПЦ уже открыл путь/сработал квестстейт — не ждать, сразу дальше.": "If the NPC has already opened the path or triggered the quest state, do not wait — move on immediately.",
  "Если нашёл большой ритуал/босса раньше трёх малых — активируй чекпоинт, потом вернёшься сразу.": "If you find the big ritual/boss before the three small ones, activate the checkpoint and return later.",
  "Если нашёл могилу — призвать Сервея и взять редкий пояс": "If you find the grave, summon Servi and take the rare belt.",
  "Если нашёл нормальную базу оружия — кинуть сферу превращения; плохую базу не докручивать.": "If you find a decent weapon base, use an Orb of Transmutation; do not overcraft a bad base.",
  "Если нашёл разграбленный лагерь — взять камень поддержки 2 тира": "If you find the raided camp, take the tier 2 support gem.",
  "Если не хватает XP, можно зайти в пещеру/плотные зоны, но не превращать это в полный клир.": "If XP is low, enter the cave or dense zones, but do not turn it into a full clear.",
  "Если нужный переход найден — не добирать лишние круги по озеру.": "If the required transition is found, do not run extra loops around the lake.",
  "Если просел по XP — бездна здесь даёт почти уровень": "If you are behind on XP, Abyss here gives almost a full level.",
  "Если реликвию не нашёл — проверить пропущенные стаи, не reset": "If you did not find the relic, check missed packs; do not reset.",
  "Если уже 14 уровень — обычных мобов почти не трогать; максимум лига ради экзальта.": "If you are already level 14, barely touch normal mobs; at most, do the league encounter for the Exalted Orb.",
  "Если хватает золота, взять руны под финальное оружие/экипировку перед Вольфенхолдом.": "If you have enough gold, buy runes for final weapon and gear upgrades before Wolvenholt.",
  "Зомби чистить так, чтобы задевать Миллера": "Clear zombies while also hitting Miller.",
  "Зона ведёт к Колодцу душ; после проверки возвращаться в основной маршрут Акта 2.": "This zone leads to the Well of Souls; after checking it, return to the Act 2 main route.",
  "Зона опасная: если к финалу не хватает уровня, лучше аккуратно добрать, чем идти к Джаманре совсем низким.": "Dangerous zone: if you are underleveled before the finale, carefully catch up instead of going to Jamanra too low.",
  "Зона плотная и приятная: если немного не хватает до 16, можно быстро добрать уровень.": "Dense and comfortable zone: if you are slightly short of 16, you can catch up quickly here.",
  "Зона простая и почти линейная": "Simple, almost linear zone.",
  "Идти по маршруту без лишнего героизма, проверяя броню/HP/фласки.": "Follow the route without unnecessary heroics, checking armor, HP, and flasks.",
  "Камень поддержки — поставить на основной навык зачистки": "Support gem — link it to your main clear skill.",
  "Камень поддержки — усилить основной навык урона": "Support gem — boost your main damage skill.",
  "Кимах: выбор одного из 7 бонусов": "Kimah: choose one of 7 bonuses",
  "Купить большие руны для gear/weapon": "Buy greater runes for gear and weapons.",
  "Лестница часто не 1/3 рандом: сначала дальний угол": "The stairs are often not a pure 1-in-3 random: check the far corner first.",
  "Лут с Геонора падает долго: после убийства не стоять лишнее, выходить порталом/продолжать переход.": "Geonor's loot takes a while to drop: after the kill, do not stand around; portal out or continue the transition.",
  "Лучше заходить, когда хватает урона, контроля и выживаемости": "Enter when you have enough damage, control, and survivability.",
  "Миллера можно бить почти без пауз: главное не забывать фласку и не уходить в полный клир берега.": "You can hit Miller almost nonstop: just remember your flask and do not fully clear the riverbank.",
  "Мобильностью можно проходить через завалы/блокировки.": "Movement skills can pass through rubble/blockers.",
  "Можно использовать как догон по опыту/луту, если отстал.": "Use it as an XP/loot catch-up if you are behind.",
  "Можно сначала к боссу, потом сброситься, взять shrine и зайти с баффом": "You can go to the boss first, then reset, take the shrine, and enter with the buff.",
  "Можно сначала пробежать к боссу, потом сброситься, взять shrine и зайти в бой с баффом.": "You can run to the boss first, then reset, take the shrine, and enter the fight with the buff.",
  "На 2 этаже сначала проверить дальний угол": "On floor 2, check the far corner first.",
  "На 52: собрать/обновить ключевой сетап, использовать Greater Jeweller при возможности и усилить основной навык подходящими support gems.": "At level 52: assemble/update the key setup, use a Greater Jeweller\'s Orb if available, and boost your main skill with suitable Support Gems.",
  "На втором этаже сначала проверить дальний угол; выход искать со стороны завала по трещине от центрального солнца.": "On the second floor, check the far corner first; look for the exit from the rubble side along the crack from the central sun.",
  "На развилке Балбалу можно определить по жёлтым флажкам/оформлению; обычный путь часто с другой стороны.": "At the fork, Balbala can be recognized by yellow flags/decor; the normal path is often on the other side.",
  "Не выходить в следующий акт с устаревшим уроном": "Do not enter the next act with outdated damage.",
  "Не забыть нажать/забрать главную barrier/награду после босса.": "Do not forget to pick up the main quest item/reward after the boss.",
  "Не забыть нажать/забрать книгу после босса — +2 пассивки.": "Do not forget to click/take the book after the boss — +2 passives.",
  "Не забыть поднять основной атакующий навык до актуального уровня": "Do not forget to level your main attack skill to the current tier.",
  "Не задерживаться: основная цель — путь к Захоронённым святилищам.": "Do not linger: the main goal is the path to the Buried Shrines.",
  "Не полная зачистка, если нужен только переход дальше": "Do not full-clear if you only need the next transition.",
  "Не сбрасывай зону ради реликвии: можно случайно заставить себя чистить всё заново.": "Do not reset the zone for the relic: you may accidentally force yourself to clear everything again.",
  "Не чистить боковые тупики, если переход уже найден": "Do not clear side dead ends if the transition is already found.",
  "Обычно скипается во время быстрого прохождения кампании": "Usually skipped during fast campaign runs.",
  "Одна из лучших optional rewards кампании — не скипать": "One of the best optional campaign rewards — do not skip it.",
  "Опционально: большие руны у Паромщика": "Optional: greater runes from the Ferryman",
  "Опционально: найти сундук, из которого гарантированно выпадает сфера златокузнеца.": "Optional: find the chest that guarantees an Artificer's Orb.",
  "Опционально: пройти боковую зону от Пристанища": "Optional: clear the side zone from the Refuge.",
  "Опционально: предзнаменования": "Optional: omens",
  "Основной навык + усиление урона/перезарядки + подходящие поддержки": "Main skill + damage/cooldown boost + suitable supports.",
  "Открыть путь в Убежище Куачик": "Open the path to The Cuachic Vault.",
  "Переход в Акт 2": "Transition to Act 2",
  "Переход в Акт 3": "Transition to Act 3",
  "Переход в Акт 4": "Transition to Act 4",
  "Переход в интерлюдии": "Transition to the Interludes",
  "Переход дальше": "Next transition",
  "Переход к Дешару": "Transition to Deshar",
  "Переход к Убежищу Куачик": "Transition to The Cuachic Vault",
  "Переход к Холтену": "Transition to Holten",
  "Переход к Храму Кот Пика": "Transition to the Temple of Kopec",
  "Переход к Шпилям": "Transition to the Spires",
  "Переход к амулету": "Transition to the amulet",
  "Переход к капитану Хартлину": "Transition to Captain Hartlin",
  "Переход к святилищам": "Transition to the shrines",
  "Переход по ветке Хаталя / Селхари": "Transition along the Hatal / Sel Khari branch",
  "Подготовить руны под экипировку и следующий weapon upgrade": "Prepare runes for gear and the next weapon upgrade.",
  "Подготовить руны, quality и валюту под новый апгрейд": "Prepare runes, quality, and currency for the next upgrade.",
  "После босса сразу пройти в город": "Go to town immediately after the boss.",
  "После боя: Ренли/Ринли → Акт 4 → Скрытый за пассивками → Ориат → карты.": "After the fight: Renly → Act 4 → Hooded One for passives → Oriath → maps.",
  "После боя: город, Дориани/Альва, переход в Акт 4": "After the fight: town, Doryani/Alva, transition to Act 4.",
  "После боя: город, Дориани/Альва, переход в Акт 4.": "After the fight: town, Doryani/Alva, transition to Act 4.",
  "После возврата искать другую сторону/лавку/путь дальше к Поместью.": "After returning, look for the other side/bench/path onward to the Manor.",
  "После воинов Намаху/Тапуа/Тасалио не скипать колодец/водопадик: там +5% максимум маны.": "After the Namahu/Tapua/Tasalio warriors, do not skip the well/waterfall: it gives +5% maximum mana.",
  "После открытия ворот реснуться на чекпоинте, чтобы быстрее заспавнить/пропустить лишнее ожидание.": "After opening the gates, respawn at the checkpoint to trigger the spawn faster / skip extra waiting.",
  "После проверки/попытки возвращаться в основной маршрут Акта 2.": "After checking/trying it, return to the Act 2 main route.",
  "После фермы/тьмы идти в Чёрный лес, затем налево к Холтену.": "After the farm/darkness, go to the Blackwood, then left toward Holten.",
  "После финального боя и наград сразу возвращаться в маршрут, не чистить лишнее.": "After the final fight and rewards, return to the route immediately; do not clear extra.",
  "Прогресс к финалу акта": "Progress toward the act finale",
  "Прогресс финала акта": "Act finale progress",
  "Пройти к Колодцу душ, если нужна Abyss-ветка": "Go to the Well of Souls if you need the Abyss branch.",
  "Проходная зона: главная задача — быстро найти следующий переход": "Transit zone: the main goal is to quickly find the next transition.",
  "Руны далеко от маршрута": "Runes far off route",
  "Руны с обелисков": "Runes from obelisks",
  "Самое время купить/найти базу оружия 16 уровня и скрафтить основной апгрейд до ~33 уровня.": "This is the time to buy/find a level 16 weapon base and craft the main upgrade that should carry you to about level 33.",
  "Саппорт забрал — дальше по маршруту, лишние тупики и пачки не чистить.": "Once you have the support gem, keep following the route; do not clear extra dead ends or packs.",
  "Сделать лигу за экзальт, если по пути": "Do the league encounter for an Exalted Orb if it is on the route.",
  "Сильное кольцо не скипать, это одна из лучших optional-наград акта.": "Do not skip the strong ring; it is one of the best optional rewards in the act.",
  "Скипать, если не нужен Abyss, осквернение вещей или дополнительный опыт": "Skip it if you do not need Abyss, corrupted items, or extra XP.",
  "Скрытый всё равно откроется в конце Акта 1; кольцо запускает длинную сцену": "The Hooded One unlocks at the end of Act 1 anyway; the ring starts a long scene.",
  "Сначала идти в Расплавленные залы": "Go to the Molten Vault first.",
  "Сначала идти в Расплавленные залы за перековочным верстаком, затем в Осквернённую вершину.": "Go to the Molten Vault first for the reforging bench, then to the Corrupted Summit.",
  "Собрать или обновить главный сетап билда": "Assemble or update the build's main setup.",
  "Собрать яд/бутылку и сдать Серви; выбор постоянного бонуса потом не меняется.": "Collect the venom/bottle and turn it in to Servi; the permanent bonus choice cannot be changed later.",
  "Сразу слева от моста/по маршруту Душа Паромщика продаёт большие руны по ~2000 золота.": "Just left of the bridge / along the route, the Ferryman\'s Soul sells greater runes for about 2000 gold.",
  "Ставь чекпоинты у найденных проходов: Фрейторн и фермы потом быстрее связать маршрутом.": "Use checkpoints at found passages: Freythorn and the farms can be connected faster later.",
  "Тотемы/волны пройти по делу; после монеты не задерживаться.": "Clear the totems/waves efficiently; after the coin, do not linger.",
  "У Паромщика можно купить большие руны.": "You can buy greater runes from the Ferryman.",
  "Убить Миллера в углу напротив входа": "Kill Miller in the corner opposite the entrance.",
  "Убить двух боссов": "Kill the two bosses.",
  "Убить двух големов": "Kill the two golems.",
  "Улучшить основной атакующий навык": "Upgrade your main attack skill.",
  "Фармить хотя бы до 31.5, комфортно до 32+; respawn помогает сбросить темп боя и перезайти безопаснее": "Farm at least to 31.5, ideally to 32+; respawn helps reset the fight tempo and re-enter more safely.",
  "Финальные диалоги пройти по цепочке без лишних возвратов: Дориани/Кингсмарч/Ориат.": "Run the final dialogues in order without extra returns: Doryani / Kingsmarch / Oriath.",
  "Хорошая зона для добора опыта перед Замком: цель — около 12.5+ и дальше выйти к 14 под финал акта.": "Good catch-up XP zone before the Manor: aim for about 12.5+, then leave toward 14 for the act finale.",
  "Цена каждой: 2000 золота.": "Each costs 2000 gold.",
  "Через город поговорить с Уной и пройти блокировку": "Go through town, talk to Una, and clear the blocker.",
  "Чистить тотемы с волнами монстров": "Clear the totems and monster waves.",
  "Экзальт из лиги": "Exalted Orb from the league encounter",
  "Это не обычная боковая экспедиция: в 0.5 здесь закрывается цепочка Фарроу и древние руны.": "This is not a normal side Expedition: in 0.5 it closes Farrow's chain and the Ancient Runes.",
  "Это боковой заход из Бесплодных земель мастодонтов, не основной маршрут акта": "This is a side route from the Mastodon Badlands, not the act's main route.",
  "Это опциональное испытание, а не обязательный маршрут Акта 2": "This is an optional trial, not a required Act 2 route.",
  "уже есть в guide.json/campaign-bonuses: большие руны уже упомянуты": "Already exists in guide.json/campaign-bonuses: greater runes are already mentioned.",
  "уже есть в guide.json: чеклист/награды — экзальт из лиги": "Already exists in guide.json: checklist/rewards — league Exalted Orb.",
  "экзальт": "Exalted Orb",
  "Верстак для разборки": "Salvage bench",
  "Верстак разборки": "Salvage bench",
  "Открывает в лагере верстак для разборки.": "Unlocks the salvage bench in camp.",
  "Выборный постоянный бонус": "Selectable permanent bonus",
  "Камень поддержки": "Support Gem",
  "Большая руна": "Greater Rune",
  "Большие руны": "Greater Runes"
};

const REVERSE_DATA_TRANSLATION_OVERRIDES: Record<string, string> = {
  'Support gem': 'Камень поддержки',
  'Support Gem': 'Камень поддержки',
  'Ancient Treasures': 'Древние сокровища',
  'Essence of Water': 'Сущность воды',
  'Gemrot skull': 'Череп Гемрота',
  'Gemrot Skull': 'Череп Гемрота',
  'Soul core': 'Ядро души',
  'Soul Core': 'Ядро души',
  '+1 charm relic': '+1 реликвия оберега'
};

const SIMPLE_EN_CLEANUPS: Array<[RegExp, string]> = [
  [/\bLeague-reward\b/g, 'League reward'],
  [/\baccess in\b/gi, 'Access to'],
  [/\bdo not full clear\b/gi, 'Do not fully clear'],
  [/\bXP-Рзона\b/gi, 'XP zone'],
  [/\bglavnoe\b/gi, 'Main goal'],
  [/\bPozhiratelya\b/g, 'the Devourer'],
  [/\bproyti\b/gi, 'go'],
  [/\bvzyat\b/gi, 'take'],
  [/\bв town\b/gi, 'to town'],
  [/\brespawn at checkpoint\b/gi, 'respawn at the checkpoint'],
  [/\s{2,}/g, ' ']
];

function cleanEnglishText(text: string): string {
  let result = text;

  for (const [pattern, replacement] of SIMPLE_EN_CLEANUPS) {
    result = result.replace(pattern, replacement);
  }

  return result.trim();
}

function normalizeTranslationKey(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

const DATA_TRANSLATIONS_TO_EN = new Map<string, string>();
const DATA_TRANSLATIONS_TO_RU = new Map<string, string>();

function registerTranslationPair(source: string, target: string) {
  const normalizedSource = normalizeTranslationKey(source);
  const normalizedTarget = normalizeTranslationKey(target);

  if (!normalizedSource || !normalizedTarget) {
    return;
  }

  DATA_TRANSLATIONS_TO_EN.set(normalizedSource, cleanEnglishText(normalizedTarget));
  if (!DATA_TRANSLATIONS_TO_RU.has(normalizedTarget)) {
    DATA_TRANSLATIONS_TO_RU.set(normalizedTarget, normalizedSource);
  }
}


for (const [source, target] of Object.entries(CLEAN_DATA_TRANSLATIONS)) {
  registerTranslationPair(source, target);
}

for (const [source, target] of Object.entries(DATA_TRANSLATION_OVERRIDES)) {
  registerTranslationPair(source, target);
}

for (const [source, target] of Object.entries(CURATED_DATA_TRANSLATION_OVERRIDES)) {
  registerTranslationPair(source, target);
}

for (const [source, target] of Object.entries(REVERSE_DATA_TRANSLATION_OVERRIDES)) {
  const normalizedSource = normalizeTranslationKey(source);
  const normalizedTarget = normalizeTranslationKey(target);
  DATA_TRANSLATIONS_TO_RU.set(normalizedSource, normalizedTarget);
  if (!DATA_TRANSLATIONS_TO_EN.has(normalizedTarget)) {
    DATA_TRANSLATIONS_TO_EN.set(normalizedTarget, cleanEnglishText(normalizedSource));
  }
}

function translateExactText(
  value: string,
  language: AppLanguage
): string {
  const trimmedValue = normalizeTranslationKey(value);

  if (!trimmedValue) {
    return trimmedValue;
  }

  if (language === 'ru') {
    return DATA_TRANSLATIONS_TO_RU.get(trimmedValue) ?? trimmedValue;
  }

  return DATA_TRANSLATIONS_TO_EN.get(trimmedValue) ?? trimmedValue;
}

export function translateDataText(
  value: string | null | undefined,
  language: AppLanguage
): string {
  const rawValue = String(value ?? '');
  if (!rawValue.trim()) {
    return rawValue;
  }

  if (language === 'ru') {
    return translateExactText(rawValue, language);
  }

  const exactTranslation = translateExactText(rawValue, language);
  if (exactTranslation !== normalizeTranslationKey(rawValue)) {
    return exactTranslation;
  }

  if (!/[А-Яа-яЁё]/.test(rawValue)) {
    return rawValue;
  }

  return exactTranslation;
}

function translateStringArray(values: string[] | undefined, language: AppLanguage): string[] {
  return (values ?? []).map((item) => translateDataText(item, language));
}

function translateGuideDetails(
  details: GuideDetails | string[] | null | undefined,
  language: AppLanguage
): GuideDetails | string[] | null | undefined {
  if (!details) {
    return details ?? null;
  }

  if (Array.isArray(details)) {
    return translateStringArray(details, language);
  }

  const translated: GuideDetails = {};
  for (const [key, value] of Object.entries(details)) {
    translated[key] = Array.isArray(value)
      ? translateStringArray(value.filter((item): item is string => typeof item === 'string'), language)
      : value;
  }

  return translated;
}

export interface LocalizedGuideEntryView {
  zoneName: string;
  nextZoneName: string;
  recommendedLevelLabel: string;
  checklist: Array<NonNullable<GuideEntry['checklist']>[number]>;
  rewards: string[];
  skip: string[];
  important: string[];
  after: string[];
  bossTips: string[];
  xpNotes: string[];
  craftingTips: string[];
  details: GuideDetails | string[] | null | undefined;
}

export function getGuideView(
  guide: GuideEntry | null | undefined,
  language: AppLanguage
): LocalizedGuideEntryView | null {
  if (!guide) {
    return null;
  }

  return {
    zoneName: language === 'en' ? guide.zone_en : guide.zone_ru,
    nextZoneName: translateDataText(guide.next_zone_ru, language),
    recommendedLevelLabel: translateDataText(guide.recommended_level_label, language),
    checklist: (guide.checklist ?? []).map((item) => ({
      ...item,
      text: translateDataText(item.text, language)
    })),
    rewards: translateStringArray(guide.rewards, language),
    skip: translateStringArray(guide.skip, language),
    important: translateStringArray(guide.important, language),
    after: translateStringArray(guide.after, language),
    bossTips: translateStringArray(guide.boss_tips ?? [], language),
    xpNotes: translateStringArray(guide.xp_notes ?? [], language),
    craftingTips: translateStringArray(guide.crafting_tips ?? [], language),
    details: translateGuideDetails(guide.details, language)
  };
}

export interface LocalizedLevelReminderView extends LevelReminder {
  displayTitle: string;
  displayItems: string[];
}

export function getLevelReminderView(
  reminder: LevelReminder | null | undefined,
  language: AppLanguage
): LocalizedLevelReminderView | null {
  if (!reminder) {
    return null;
  }

  return {
    ...reminder,
    displayTitle: translateDataText(reminder.title, language),
    displayItems: translateStringArray(reminder.items, language)
  };
}

export interface LocalizedPowerSpikeView extends PowerSpike {
  displayTitle: string;
  displayItems: string[];
}

export function getPowerSpikeView(
  powerSpike: PowerSpike | null | undefined,
  language: AppLanguage
): LocalizedPowerSpikeView | null {
  if (!powerSpike) {
    return null;
  }

  return {
    ...powerSpike,
    displayTitle: translateDataText(powerSpike.title, language),
    displayItems: translateStringArray(powerSpike.items, language)
  };
}

export interface LocalizedCampaignBonusView extends CampaignBonusDefinition {
  displayZoneName: string;
  displayTitle: string;
  displaySource: string;
  displayDetails: string[];
}

export function getCampaignBonusView(
  bonus: CampaignBonusDefinition | null | undefined,
  language: AppLanguage
): LocalizedCampaignBonusView | null {
  if (!bonus) {
    return null;
  }

  return {
    ...bonus,
    displayZoneName: translateDataText(bonus.zone_ru, language),
    displayTitle: translateDataText(bonus.title, language),
    displaySource: translateDataText(bonus.source, language),
    displayDetails: translateStringArray(bonus.details, language)
  };
}

export interface LocalizedCommunityLinkView extends CommunityLinkDefinition {
  displayTitle: string;
  displayDescription: string;
  displayAction: string;
}

export function getCommunityLinkView(
  link: CommunityLinkDefinition,
  language: AppLanguage
): LocalizedCommunityLinkView {
  return {
    ...link,
    displayTitle: translateDataText(link.title, language),
    displayDescription: translateDataText(link.description, language),
    displayAction: translateDataText(link.action, language)
  };
}
