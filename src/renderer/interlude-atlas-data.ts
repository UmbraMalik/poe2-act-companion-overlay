/** Interlude chapters are independent branches. IDs are the existing guide IDs;
 * diagram coordinates below are illustrative, NOT in-game geography. */
export type InterludeChapterId = 'khari' | 'kriar' | 'ogham';
export type InterludeAtlasBranch = InterludeChapterId;

export interface InterludeChapter {
  id: InterludeChapterId;
  titleRu: string;
  titleEn: string;
  zoneIds: readonly string[];
  positions: Readonly<Record<string, readonly [number, number]>>;
}

export const INTERLUDE_CHAPTERS: readonly InterludeChapter[] = [
  {
    id: 'khari', titleRu: 'Кхарийский базар', titleEn: 'Khari Bazaar',
    zoneIds: [
      'interlude_khari_bazaar', 'interlude_khari_crossing', 'interlude_pools_of_khatal',
      'interlude_selvari_sanctuary', 'interlude_galai_gates', 'i2_kima', 'i2_kima_reservoir'
    ],
    positions: {
      interlude_khari_bazaar: [17, 79],
      interlude_khari_crossing: [30, 63],
      interlude_pools_of_khatal: [22, 44],
      interlude_selvari_sanctuary: [41, 33],
      interlude_galai_gates: [58, 47],
      i2_kima: [69, 28],
      i2_kima_reservoir: [84, 17]
    }
  },
  {
    id: 'kriar', titleRu: 'Гора Криар', titleEn: 'Mount Kriar',
    zoneIds: [
      'interlude_the_glade', 'interlude_ashen_forest', 'i2_mount_cryer',
      'interlude_glacial_tarn', 'i2_glacial_tarn', 'i2_kriar_peaks',
      'interlude_etched_ravine', 'interlude_cuachic_vault'
    ],
    positions: {
      interlude_the_glade: [14, 80],
      interlude_ashen_forest: [26, 64],
      i2_mount_cryer: [40, 76],
      interlude_glacial_tarn: [50, 55],
      i2_glacial_tarn: [37, 42],
      i2_kriar_peaks: [54, 27],
      interlude_etched_ravine: [72, 38],
      interlude_cuachic_vault: [84, 18]
    }
  },
  {
    id: 'ogham', titleRu: 'Огам', titleEn: 'Ogham',
    zoneIds: [
      'interlude_refuge', 'interlude_scorched_farmlands', 'interlude_stones_of_serle',
      'i_final_blackwood', 'i_final_holten', 'i_final_wolvenholt', 'i_final_holten_estate'
    ],
    positions: {
      interlude_refuge: [15, 76],
      interlude_scorched_farmlands: [34, 67],
      interlude_stones_of_serle: [25, 45],
      i_final_blackwood: [44, 41],
      i_final_holten: [56, 56],
      i_final_wolvenholt: [72, 35],
      i_final_holten_estate: [84, 17]
    }
  }
] as const;

export const INTERLUDE_FINALE_ID = 'post_interludes_kingsmarch';

export function findInterludeChapter(zoneId: string | null | undefined): InterludeChapter | undefined {
  return INTERLUDE_CHAPTERS.find((chapter) => zoneId && chapter.zoneIds.includes(zoneId));
}
