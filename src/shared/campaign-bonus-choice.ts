// Permanent Qimah pillar choices. Never assume one reward when only completion is known.
export const QIMAH_BONUS_ID = 'int2_kima_pillar_choice';

export const QIMAH_CHOICE_OPTIONS = [
  { value: 'attributes', ru: '+5 ко всем характеристикам', en: '+5 to all Attributes' },
  { value: 'cooldown', ru: '+12% к скорости восстановления перезарядки', en: '+12% Cooldown Recovery Rate' },
  { value: 'presence', ru: '+20% к области присутствия', en: '+20% Presence Area of Effect' },
  { value: 'defences', ru: '+15% к глобальной защите', en: '+15% Global Defences' },
  { value: 'movement', ru: '+3% к скорости передвижения', en: '+3% Movement Speed' },
  { value: 'resistances', ru: '+5% ко всем стихийным сопротивлениям', en: '+5% to all Elemental Resistances' },
  { value: 'experience', ru: '+5% к опыту (со штрафами)', en: '+5% Experience (with downsides)' }
] as const;

export function isQimahChoice(value: unknown): value is typeof QIMAH_CHOICE_OPTIONS[number]['value'] {
  return QIMAH_CHOICE_OPTIONS.some((option) => option.value === value);
}

/** Contribution to each elemental resistance from the selected permanent Qimah boon. */
export function getQimahResistanceContribution(progress: { selectedChoice?: string } | null | undefined): number {
  return progress?.selectedChoice === 'resistances' ? 5 : 0;
}
