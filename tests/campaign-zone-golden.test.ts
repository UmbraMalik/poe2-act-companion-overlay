import test from 'node:test';
import assert from 'node:assert/strict';
import { readJson } from './helpers/loadJson';
import { getGuideZones, loadGuideService, normalizeAreaId } from './helpers/zoneTestUtils';

interface LockedCampaignZone {
  id: string;
  act: number;
  zoneRu: string;
  zoneEn: string;
  areaIds: string[];
}

const LOCKED_CAMPAIGN_ZONES: LockedCampaignZone[] = [
  {
    "id": "a0_riverbank_miller",
    "act": 1,
    "zoneRu": "Берег реки",
    "zoneEn": "Riverbank",
    "areaIds": [
      "C_G1_1",
      "G1_1"
    ]
  },
  {
    "id": "a1_clearfell_encampment",
    "act": 1,
    "zoneRu": "Лагерь Клирфелл",
    "zoneEn": "Clearfell Encampment",
    "areaIds": [
      "C_G1_town",
      "G1_town"
    ]
  },
  {
    "id": "a1_clearfell",
    "act": 1,
    "zoneRu": "Клирфелл",
    "zoneEn": "Clearfell",
    "areaIds": [
      "C_G1_2",
      "G1_2"
    ]
  },
  {
    "id": "a1_mud_burrow",
    "act": 1,
    "zoneRu": "Грязевая нора",
    "zoneEn": "Mud Burrow",
    "areaIds": [
      "C_G1_3",
      "G1_3"
    ]
  },
  {
    "id": "a1_grelwood",
    "act": 1,
    "zoneRu": "Грельвуд",
    "zoneEn": "Grelwood",
    "areaIds": [
      "C_G1_4",
      "G1_4"
    ]
  },
  {
    "id": "a1_red_vale",
    "act": 1,
    "zoneRu": "Красная Долина",
    "zoneEn": "The Red Vale",
    "areaIds": [
      "C_G1_5",
      "G1_5"
    ]
  },
  {
    "id": "a1_grim_tangle",
    "act": 1,
    "zoneRu": "Мрачные заросли",
    "zoneEn": "Grim Tangle",
    "areaIds": [
      "C_G1_6",
      "G1_6"
    ]
  },
  {
    "id": "a1_cemetery",
    "act": 1,
    "zoneRu": "Кладбище Вечных",
    "zoneEn": "Cemetery of the Eternals",
    "areaIds": [
      "C_G1_7",
      "G1_7"
    ]
  },
  {
    "id": "a1_tomb_of_the_consort",
    "act": 1,
    "zoneRu": "Супружеская гробница",
    "zoneEn": "Tomb of the Consort",
    "areaIds": [
      "C_G1_9",
      "G1_9"
    ]
  },
  {
    "id": "a1_mausoleum",
    "act": 1,
    "zoneRu": "Мавзолей претора",
    "zoneEn": "Mausoleum of the Praetor",
    "areaIds": [
      "C_G1_8",
      "G1_8"
    ]
  },
  {
    "id": "a1_hunting_grounds",
    "act": 1,
    "zoneRu": "Охотничьи угодья",
    "zoneEn": "Hunting Grounds",
    "areaIds": [
      "C_G1_11",
      "G1_11"
    ]
  },
  {
    "id": "a1_freythorn",
    "act": 1,
    "zoneRu": "Фрейторн",
    "zoneEn": "Freythorn",
    "areaIds": [
      "C_G1_12",
      "G1_12"
    ]
  },
  {
    "id": "a1_ogham_farmlands",
    "act": 1,
    "zoneRu": "Фермерские земли Огама",
    "zoneEn": "Ogham Farmlands",
    "areaIds": [
      "C_G1_13_1",
      "G1_13_1"
    ]
  },
  {
    "id": "a1_ogham_village",
    "act": 1,
    "zoneRu": "Деревня Огам",
    "zoneEn": "Ogham Village",
    "areaIds": [
      "C_G1_13_2",
      "G1_13_2"
    ]
  },
  {
    "id": "a1_manor_ramparts",
    "act": 1,
    "zoneRu": "Стены замка",
    "zoneEn": "Manor Ramparts",
    "areaIds": [
      "C_G1_14",
      "G1_14"
    ]
  },
  {
    "id": "a1_ogham_manor",
    "act": 1,
    "zoneRu": "Замок Огам",
    "zoneEn": "Ogham Manor",
    "areaIds": [
      "C_G1_15",
      "G1_15"
    ]
  },
  {
    "id": "a2_vastiri_outskirts",
    "act": 2,
    "zoneRu": "Окраины Вастири",
    "zoneEn": "Vastiri Outskirts",
    "areaIds": [
      "C_G2_1",
      "G2_1"
    ]
  },
  {
    "id": "a2_ardura_caravan",
    "act": 2,
    "zoneRu": "Караван Ардура",
    "zoneEn": "Ardura Caravan",
    "areaIds": [
      "C_G2_town",
      "G2_town"
    ]
  },
  {
    "id": "a2_mawdun_quarry",
    "act": 2,
    "zoneRu": "Каменоломня Маудун",
    "zoneEn": "Mawdun Quarry",
    "areaIds": [
      "C_G2_10_1",
      "G2_10_1"
    ]
  },
  {
    "id": "a2_mawdun_mine",
    "act": 2,
    "zoneRu": "Шахта Маудун",
    "zoneEn": "Mawdun Mine",
    "areaIds": [
      "C_G2_10_2",
      "G2_10_2"
    ]
  },
  {
    "id": "a2_traitors_passage",
    "act": 2,
    "zoneRu": "Тропа Изменницы",
    "zoneEn": "Traitor's Passage",
    "areaIds": [
      "C_G2_2",
      "G2_2"
    ]
  },
  {
    "id": "a2_halani_gates",
    "act": 2,
    "zoneRu": "Ворота Халани",
    "zoneEn": "Halani Gates",
    "areaIds": [
      "C_G2_3",
      "G2_3"
    ]
  },
  {
    "id": "a2_mastodon_badlands",
    "act": 2,
    "zoneRu": "Бесплодные земли мастодонтов",
    "zoneEn": "Mastodon Badlands",
    "areaIds": [
      "C_G2_5_1",
      "G2_5_1"
    ]
  },
  {
    "id": "a2_lightless_passage",
    "act": 2,
    "zoneRu": "Бессветный проход",
    "zoneEn": "Lightless Passage",
    "areaIds": [
      "Abyss_Intro"
    ]
  },
  {
    "id": "a2_trial_of_the_sekhemas",
    "act": 2,
    "zoneRu": "Испытание Сехем",
    "zoneEn": "Trial of the Sekhemas",
    "areaIds": [
      "C_G2_13",
      "G2_13"
    ]
  },
  {
    "id": "a2_bone_pits",
    "act": 2,
    "zoneRu": "Костяные ямы",
    "zoneEn": "Bone Pits",
    "areaIds": [
      "C_G2_5_2",
      "G2_5_2"
    ]
  },
  {
    "id": "a2_keth",
    "act": 2,
    "zoneRu": "Кет",
    "zoneEn": "Keth",
    "areaIds": [
      "C_G2_4_1",
      "G2_4_1"
    ]
  },
  {
    "id": "a2_lost_city",
    "act": 2,
    "zoneRu": "Затерянный город",
    "zoneEn": "Lost City",
    "areaIds": [
      "C_G2_4_2",
      "G2_4_2"
    ]
  },
  {
    "id": "a2_buried_shrines",
    "act": 2,
    "zoneRu": "Захоронённые святилища",
    "zoneEn": "Buried Shrines",
    "areaIds": [
      "C_G2_4_3",
      "G2_4_3"
    ]
  },
  {
    "id": "a2_valley_titans",
    "act": 2,
    "zoneRu": "Долина Титанов",
    "zoneEn": "Valley of the Titans",
    "areaIds": [
      "C_G2_6",
      "G2_6"
    ]
  },
  {
    "id": "a2_titan_grotto",
    "act": 2,
    "zoneRu": "Грот Титанов",
    "zoneEn": "Titan Grotto",
    "areaIds": [
      "C_G2_7",
      "G2_7"
    ]
  },
  {
    "id": "a2_deshar_early",
    "act": 2,
    "zoneRu": "Дешар",
    "zoneEn": "Deshar",
    "areaIds": [
      "C_G2_8",
      "G2_8"
    ]
  },
  {
    "id": "a2_path_of_mourning",
    "act": 2,
    "zoneRu": "Путь скорби",
    "zoneEn": "Path of Mourning",
    "areaIds": [
      "C_G2_9_1",
      "G2_9_1"
    ]
  },
  {
    "id": "a2_spires_deshar",
    "act": 2,
    "zoneRu": "Шпили Дешара",
    "zoneEn": "Spires of Deshar",
    "areaIds": [
      "C_G2_9_2",
      "C_G2_9_2_",
      "G2_9_2"
    ]
  },
  {
    "id": "a2_dreadnought",
    "act": 2,
    "zoneRu": "Дредноут",
    "zoneEn": "Dreadnought",
    "areaIds": [
      "C_G2_12_1",
      "G2_12_1"
    ]
  },
  {
    "id": "a3_sandswept_marsh",
    "act": 3,
    "zoneRu": "Занесённое песком болото",
    "zoneEn": "Sandswept Marsh",
    "areaIds": [
      "C_G3_1",
      "G3_1"
    ]
  },
  {
    "id": "a3_ziggurat_encampment",
    "act": 3,
    "zoneRu": "Лагерь на зиккурате",
    "zoneEn": "The Ziggurat Encampment",
    "areaIds": [
      "C_G3_town",
      "G3_town"
    ]
  },
  {
    "id": "a3_jungle_ruins",
    "act": 3,
    "zoneRu": "Развалины в джунглях",
    "zoneEn": "Jungle Ruins",
    "areaIds": [
      "C_G3_3",
      "G3_3"
    ]
  },
  {
    "id": "a3_venom_crypts",
    "act": 3,
    "zoneRu": "Ядовитые крипты",
    "zoneEn": "Venom Crypts",
    "areaIds": [
      "C_G3_4",
      "G3_4"
    ]
  },
  {
    "id": "a3_infested_barrens",
    "act": 3,
    "zoneRu": "Заражённые земли",
    "zoneEn": "Infested Barrens",
    "areaIds": [
      "C_G3_2_1",
      "G3_2_1"
    ]
  },
  {
    "id": "a3_azak_bog",
    "act": 3,
    "zoneRu": "Болото Азак",
    "zoneEn": "Azak Bog",
    "areaIds": [
      "C_G3_7",
      "G3_7"
    ]
  },
  {
    "id": "a3_chimera_wetlands",
    "act": 3,
    "zoneRu": "Топи химеридов",
    "zoneEn": "Chimera Wetlands",
    "areaIds": [
      "C_G3_5",
      "G3_5"
    ]
  },
  {
    "id": "a3_temple_of_chaos",
    "act": 3,
    "zoneRu": "Храм Хаоса",
    "zoneEn": "The Temple of Chaos",
    "areaIds": [
      "C_G3_10_Airlock",
      "G3_10_Airlock"
    ]
  },
  {
    "id": "a3_jiquani_machinarium",
    "act": 3,
    "zoneRu": "Машинариум Джиквани",
    "zoneEn": "Jiquani's Machinarium",
    "areaIds": [
      "C_G3_6_1",
      "G3_6_1"
    ]
  },
  {
    "id": "a3_jiquani_sanctum",
    "act": 3,
    "zoneRu": "Святилище Джиквани",
    "zoneEn": "Jiquani's Sanctum",
    "areaIds": [
      "C_G3_6_2",
      "G3_6_2"
    ]
  },
  {
    "id": "a3_matlan_waterways",
    "act": 3,
    "zoneRu": "Водные пути Матлана",
    "zoneEn": "Matlan Waterways",
    "areaIds": [
      "C_G3_2_2",
      "G3_2_2"
    ]
  },
  {
    "id": "a3_drowned_city",
    "act": 3,
    "zoneRu": "Затопленный город",
    "zoneEn": "Drowned City",
    "areaIds": [
      "C_G3_8",
      "G3_8"
    ]
  },
  {
    "id": "a3_molten_vault",
    "act": 3,
    "zoneRu": "Расплавленные залы",
    "zoneEn": "Molten Vault",
    "areaIds": [
      "C_G3_9",
      "G3_9"
    ]
  },
  {
    "id": "a3_apex_of_filth",
    "act": 3,
    "zoneRu": "Осквернённая вершина",
    "zoneEn": "Apex of Filth",
    "areaIds": [
      "C_G3_11",
      "G3_11"
    ]
  },
  {
    "id": "a3_temple_kopec",
    "act": 3,
    "zoneRu": "Храм Копека",
    "zoneEn": "Temple of Kopek",
    "areaIds": [
      "C_G3_12",
      "G3_12"
    ]
  },
  {
    "id": "a3_vaal_heart",
    "act": 3,
    "zoneRu": "Жертвенное сердце",
    "zoneEn": "Sacrificial Heart",
    "areaIds": [
      "C_G3_14",
      "C_G3_16_",
      "G3_14",
      "G3_16"
    ]
  },
  {
    "id": "a3_black_chambers",
    "act": 3,
    "zoneRu": "Чёрные палаты",
    "zoneEn": "Black Chambers",
    "areaIds": [
      "C_G3_17",
      "G3_17"
    ]
  },
  {
    "id": "a4_kingsmarch",
    "act": 4,
    "zoneRu": "Кингсмарш",
    "zoneEn": "Kingsmarch",
    "areaIds": [
      "C_G4_town",
      "G4_town"
    ]
  },
  {
    "id": "a4_kids_bay",
    "act": 4,
    "zoneRu": "Кеджский залив",
    "zoneEn": "Kid's Bay",
    "areaIds": [
      "C_G4_2_1",
      "G4_2_1"
    ]
  },
  {
    "id": "a4_journeys_end",
    "act": 4,
    "zoneRu": "Конец странствия",
    "zoneEn": "Journey's End",
    "areaIds": [
      "C_G4_2_2",
      "G4_2_2"
    ]
  },
  {
    "id": "a4_isle_of_kin",
    "act": 4,
    "zoneRu": "Остров Рода",
    "zoneEn": "Isle of Kin",
    "areaIds": [
      "C_G4_1_1",
      "G4_1_1"
    ]
  },
  {
    "id": "a4_volcanic_warrens",
    "act": 4,
    "zoneRu": "Вулканические лабиринты",
    "zoneEn": "Volcanic Warrens",
    "areaIds": [
      "C_G4_1_2",
      "G4_1_2"
    ]
  },
  {
    "id": "a4_whakapanu_island",
    "act": 4,
    "zoneRu": "Остров Вакапану",
    "zoneEn": "Whakapanu Island",
    "areaIds": [
      "C_G4_3_1",
      "G4_3_1"
    ]
  },
  {
    "id": "a4_singing_caverns",
    "act": 4,
    "zoneRu": "Поющие пещеры",
    "zoneEn": "Singing Caverns",
    "areaIds": [
      "C_G4_3_2",
      "G4_3_2"
    ]
  },
  {
    "id": "a4_abandoned_prison",
    "act": 4,
    "zoneRu": "Заброшенная тюрьма",
    "zoneEn": "Abandoned Prison",
    "areaIds": [
      "C_G4_5_1",
      "G4_5_1"
    ]
  },
  {
    "id": "a4_solitary_chambers",
    "act": 4,
    "zoneRu": "Одиночные камеры",
    "zoneEn": "Solitary Chambers",
    "areaIds": [
      "C_G4_5_2",
      "G4_5_2"
    ]
  },
  {
    "id": "a4_isle_of_screams",
    "act": 4,
    "zoneRu": "Остров криков",
    "zoneEn": "Isle of Screams",
    "areaIds": [
      "C_G4_7",
      "G4_7"
    ]
  },
  {
    "id": "a4_eye_hinekora",
    "act": 4,
    "zoneRu": "Глаз Хинекоры",
    "zoneEn": "Eye of Hinekora",
    "areaIds": [
      "C_G4_4_1",
      "G4_4_1"
    ]
  },
  {
    "id": "a4_halls_of_the_dead",
    "act": 4,
    "zoneRu": "Залы мёртвых",
    "zoneEn": "Halls of the Dead",
    "areaIds": [
      "C_G4_4_2",
      "G4_4_2"
    ]
  },
  {
    "id": "a4_trial_of_ancestors",
    "act": 4,
    "zoneRu": "Испытание предков",
    "zoneEn": "Trial of the Ancestors",
    "areaIds": [
      "C_G4_4_3",
      "G4_4_3"
    ]
  },
  {
    "id": "a4_arastas",
    "act": 4,
    "zoneRu": "Арастас",
    "zoneEn": "Arastas",
    "areaIds": [
      "C_G4_8A",
      "C_G4_8B",
      "G4_8A",
      "G4_8B"
    ]
  },
  {
    "id": "a4_excavation",
    "act": 4,
    "zoneRu": "Раскопки",
    "zoneEn": "Excavation",
    "areaIds": [
      "C_G4_10",
      "G4_10"
    ]
  },
  {
    "id": "a4_plunders_point",
    "act": 4,
    "zoneRu": "Мыс грабителя",
    "zoneEn": "Plunder's Point",
    "areaIds": [
      "C_G4_13",
      "G4_13"
    ]
  },
  {
    "id": "a4_ngakanu",
    "act": 4,
    "zoneRu": "Нгакану",
    "zoneEn": "Ngakanu",
    "areaIds": [
      "C_G4_11_1A",
      "C_G4_11_1B",
      "G4_11_1A",
      "G4_11_1B"
    ]
  },
  {
    "id": "a4_heart_of_the_tribe",
    "act": 4,
    "zoneRu": "Сердце племени",
    "zoneEn": "Heart of the Tribe",
    "areaIds": [
      "C_G4_11_2",
      "G4_11_2"
    ]
  },
  {
    "id": "interlude_khari_bazaar",
    "act": 5,
    "zoneRu": "Кхарийский базар",
    "zoneEn": "Khari Bazaar",
    "areaIds": [
      "C_P2_Town",
      "P2_Town"
    ]
  },
  {
    "id": "interlude_khari_crossing",
    "act": 5,
    "zoneRu": "Кхарийский перевал",
    "zoneEn": "The Khari Crossing",
    "areaIds": [
      "C_P2_1",
      "P2_1"
    ]
  },
  {
    "id": "interlude_pools_of_khatal",
    "act": 5,
    "zoneRu": "Воды Хаталя",
    "zoneEn": "Pools of Khatal",
    "areaIds": [
      "C_P2_2",
      "P2_2"
    ]
  },
  {
    "id": "interlude_selvari_sanctuary",
    "act": 5,
    "zoneRu": "Храм Селари",
    "zoneEn": "Sel Khari Sanctuary",
    "areaIds": [
      "C_P2_3",
      "P2_3"
    ]
  },
  {
    "id": "interlude_galai_gates",
    "act": 5,
    "zoneRu": "Ворота Галаи",
    "zoneEn": "The Galai Gates",
    "areaIds": [
      "C_P2_5",
      "P2_5"
    ]
  },
  {
    "id": "i2_kima",
    "act": 5,
    "zoneRu": "Кима",
    "zoneEn": "Qimah",
    "areaIds": [
      "C_P2_6",
      "P2_6"
    ]
  },
  {
    "id": "i2_kima_reservoir",
    "act": 5,
    "zoneRu": "Водохранилище Кима",
    "zoneEn": "Qimah Reservoir",
    "areaIds": [
      "C_P2_7",
      "P2_7"
    ]
  },
  {
    "id": "interlude_the_glade",
    "act": 5,
    "zoneRu": "Опушка",
    "zoneEn": "The Glade",
    "areaIds": [
      "C_P3_Town",
      "P3_Town"
    ]
  },
  {
    "id": "interlude_ashen_forest",
    "act": 5,
    "zoneRu": "Пепельный лес",
    "zoneEn": "Ashen Forest",
    "areaIds": [
      "C_P3_1",
      "P3_1"
    ]
  },
  {
    "id": "i2_mount_cryer",
    "act": 5,
    "zoneRu": "Деревня Криар",
    "zoneEn": "Kriar Village",
    "areaIds": [
      "C_P3_2",
      "P3_2"
    ]
  },
  {
    "id": "interlude_glacial_tarn",
    "act": 5,
    "zoneRu": "Ледниковое озеро",
    "zoneEn": "Glacial Tarn",
    "areaIds": [
      "C_P3_3",
      "P3_3"
    ]
  },
  {
    "id": "i2_glacial_tarn",
    "act": 5,
    "zoneRu": "Воющие пещеры",
    "zoneEn": "Howling Caves",
    "areaIds": [
      "C_P3_4",
      "P3_4"
    ]
  },
  {
    "id": "i2_kriar_peaks",
    "act": 5,
    "zoneRu": "Пики Криар",
    "zoneEn": "Kriar Peaks",
    "areaIds": [
      "C_P3_5",
      "P3_5"
    ]
  },
  {
    "id": "interlude_etched_ravine",
    "act": 5,
    "zoneRu": "Высеченное ущелье",
    "zoneEn": "Etched Ravine",
    "areaIds": [
      "C_P3_6",
      "P3_6"
    ]
  },
  {
    "id": "interlude_cuachic_vault",
    "act": 5,
    "zoneRu": "Убежище Куачик",
    "zoneEn": "The Cuachic Vault",
    "areaIds": [
      "C_P3_7",
      "P3_7"
    ]
  },
  {
    "id": "interlude_refuge",
    "act": 5,
    "zoneRu": "Пристанище",
    "zoneEn": "The Refuge",
    "areaIds": [
      "C_P1_Town",
      "P1_Town"
    ]
  },
  {
    "id": "interlude_scorched_farmlands",
    "act": 5,
    "zoneRu": "Выжженные фермерские земли",
    "zoneEn": "Scorched Farmlands",
    "areaIds": [
      "C_P1_1",
      "P1_1"
    ]
  },
  {
    "id": "interlude_stones_of_serle",
    "act": 5,
    "zoneRu": "Камни Серли",
    "zoneEn": "Stones of Serle",
    "areaIds": [
      "C_P1_2",
      "P1_2"
    ]
  },
  {
    "id": "i_final_blackwood",
    "act": 5,
    "zoneRu": "Чернолесье",
    "zoneEn": "The Blackwood",
    "areaIds": [
      "C_P1_3",
      "P1_3"
    ]
  },
  {
    "id": "i_final_holten",
    "act": 5,
    "zoneRu": "Холтен",
    "zoneEn": "Holten",
    "areaIds": [
      "C_P1_4",
      "P1_4"
    ]
  },
  {
    "id": "i_final_wolvenholt",
    "act": 5,
    "zoneRu": "Вольфенхолд",
    "zoneEn": "Wolvenhold",
    "areaIds": [
      "C_P1_5",
      "P1_5"
    ]
  },
  {
    "id": "i_final_holten_estate",
    "act": 5,
    "zoneRu": "Поместье Холтен",
    "zoneEn": "Holten Estate",
    "areaIds": [
      "C_P1_6",
      "P1_6"
    ]
  },
  {
    "id": "post_interludes_kingsmarch",
    "act": 5,
    "zoneRu": "Кингсмарш — финал интерлюдий",
    "zoneEn": "Kingsmarch — Interlude Finale",
    "areaIds": []
  }
];

function getAreaToGuideId(): Record<string, string> {
  return readJson<{ areaToGuideId?: Record<string, string> }>('src/data/internal-area-aliases.en.json').areaToGuideId ?? {};
}

function assertResolvesToLockedZone(
  service: ReturnType<typeof loadGuideService>,
  areaId: string,
  expected: LockedCampaignZone,
  extractedZoneName: string
): void {
  const match = service.resolveZoneMatch({
    rawLine: `Generating level 1 area "${areaId}"`,
    extractedInternalAreaId: areaId,
    extractedZoneName
  });
  assert.equal(
    match?.guide?.id,
    expected.id,
    `${areaId} + ${extractedZoneName} must resolve to ${expected.id}, got ${match?.guide?.id ?? 'null'}`
  );
}

test('locked RU/EN campaign guide card list stays unchanged without an intentional fixture update', () => {
  const actualById = new Map(getGuideZones().map((zone) => [zone.id, zone]));
  assert.deepEqual(
    [...actualById.keys()].sort(),
    LOCKED_CAMPAIGN_ZONES.map((zone) => zone.id).sort(),
    'guide.json card ids changed; update this locked full-campaign fixture only after RU+EN smoke verification'
  );

  for (const expected of LOCKED_CAMPAIGN_ZONES) {
    const actual = actualById.get(expected.id);
    assert.ok(actual, `${expected.id} must exist in guide.json`);
    assert.equal(Number(actual.act), expected.act, `${expected.id}: act changed`);
    assert.equal(actual.zone_ru, expected.zoneRu, `${expected.id}: RU name changed`);
    assert.equal(actual.zone_en, expected.zoneEn, `${expected.id}: EN name changed`);
    assert.deepEqual(
      [...(actual.area_ids ?? []), ...(actual.areaIds ?? [])],
      expected.areaIds,
      `${expected.id}: internal area ids changed`
    );
  }
});

test('locked RU and EN zone names resolve to the same guide cards across all acts', () => {
  const service = loadGuideService();
  for (const expected of LOCKED_CAMPAIGN_ZONES) {
    assert.equal(service.findByZoneName(expected.zoneRu)?.id, expected.id, `${expected.zoneRu} must resolve to ${expected.id}`);
    assert.equal(service.findByZoneName(expected.zoneEn)?.id, expected.id, `${expected.zoneEn} must resolve to ${expected.id}`);
  }
});

test('locked internal area ids resolve to audited RU and EN guide cards across all acts', () => {
  const service = loadGuideService();
  for (const expected of LOCKED_CAMPAIGN_ZONES) {
    for (const areaId of expected.areaIds) {
      assertResolvesToLockedZone(service, areaId, expected, expected.zoneRu);
      assertResolvesToLockedZone(service, areaId, expected, expected.zoneEn);
    }
  }
});

test('internal EN area alias table stays aligned with locked campaign guide cards', () => {
  const areaToGuideId = getAreaToGuideId();
  for (const expected of LOCKED_CAMPAIGN_ZONES) {
    for (const areaId of expected.areaIds) {
      const normalized = normalizeAreaId(areaId);
      assert.equal(
        areaToGuideId[areaId] ?? areaToGuideId[areaId.toLowerCase()] ?? areaToGuideId[normalized],
        expected.id,
        `${areaId} must point to ${expected.id} in internal-area-aliases.en.json`
      );
    }
  }
});
