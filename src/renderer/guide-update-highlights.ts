const GUIDE_UPDATE_MARKERS = [
  '0.5:',
  'нажимн',
  'pressure pad',
  'портал-трюк',
  'portal trick',
  'джаманру прямо в дредноуте',
  'jamanra directly in the dreadnought',
  'авангард дредноута удал',
  'dreadnought vanguard has been removed',
  'авангард дредноута больше не является',
  'dreadnought vanguard is no longer',
  'зона удалена из актуального маршрута',
  'removed from the current route',
  'финальная часть уже осуш',
  'final section is already drained',
  'новый выход к болоту азак',
  'new exit toward azak bog',
  'shark fin',
  'акуль',
  'kaom',
  'rakiata',
  'farrow',
  'runes of aldur',
  'runeforging',
  'ancient beacons',
  'fate of the vaal',
  'маяк',
  'маяки',
  'vaal ruins'
];

function isGuideUpdateText(value: string | null | undefined): boolean {
  const normalized = (value ?? '').trim().toLocaleLowerCase('ru');

  return GUIDE_UPDATE_MARKERS.some((marker) => normalized.includes(marker));
}

export function getGuideUpdateClassName(value: string | null | undefined): string {
  return isGuideUpdateText(value) ? ' is-guide-update' : '';
}
