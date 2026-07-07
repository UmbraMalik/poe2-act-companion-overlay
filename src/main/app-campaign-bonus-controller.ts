import {
  normalizeText,
  parsePermanentReward
} from './services/log-parser';
import { buildChecklistDefinition } from '../shared/checklist';
import type {
  AppConfig,
  CampaignBonusDefinition
} from '../shared/types';
import type { ConfigStore } from './services/config-store';

type CampaignBonusDetectedBy = 'log' | 'manual' | null;

interface CampaignBonusDoneContext {
  campaignBonuses: CampaignBonusDefinition[];
  config: AppConfig;
  configStore: Pick<ConfigStore, 'update'>;
  syncCampaignBonusWithChecklist: (
    bonus: CampaignBonusDefinition,
    detectedBy: CampaignBonusDetectedBy,
    line: string | null
  ) => void;
  broadcastState: () => void;
}


export function runNormalizeCampaignBonusSceneName(this: any, value: any) {
        return normalizeText(value ?? '');
    }

export function runGetCampaignBonusContextGuideIds(this: any) {
        const ids = new Set<string>();
        const currentGuideId = this.currentZone.guide?.id ?? null;
        const lastGameplayGuideId = this.runtime.lastGameplayGuideId ?? null;
        if (this.currentZone.sceneKind === 'town') {
            if (lastGameplayGuideId) {
                ids.add(lastGameplayGuideId);
            }
        }
        else if (currentGuideId) {
            ids.add(currentGuideId);
        }
        if (ids.size === 0 && this.currentZone.sceneKind !== 'town' && lastGameplayGuideId) {
            ids.add(lastGameplayGuideId);
        }
        return ids;
    }

export function runCampaignBonusRuleMatches(this: any, rule: any, line: any) {
        const normalizedLine = normalizeText(line);
        if (rule.all.some((phrase: any) => !normalizedLine.includes(normalizeText(phrase)))) {
            return false;
        }
        if (rule.any && rule.any.length > 0) {
            const hasAny = rule.any.some((phrase: any) => normalizedLine.includes(normalizeText(phrase)));
            if (!hasAny) {
                return false;
            }
        }
        if (rule.none && rule.none.some((phrase: any) => normalizedLine.includes(normalizeText(phrase)))) {
            return false;
        }
        const contextGuideIds = this.getCampaignBonusContextGuideIds();
        if (rule.zoneIds && rule.zoneIds.length > 0) {
            const hasAllowedZone = rule.zoneIds.some((zoneId: any) => contextGuideIds.has(zoneId));
            if (!hasAllowedZone) {
                return false;
            }
        }
        if (rule.sceneNames && rule.sceneNames.length > 0) {
            const currentScene = this.normalizeCampaignBonusSceneName(this.currentZone.rawZoneName);
            const currentGuideName = this.normalizeCampaignBonusSceneName(this.currentZone.guide?.zone_ru);
            const allowedScenes = rule.sceneNames.map((scene: any) => this.normalizeCampaignBonusSceneName(scene));
            if (!allowedScenes.includes(currentScene) && !allowedScenes.includes(currentGuideName)) {
                return false;
            }
        }
        return true;
    }

export function runSetCampaignBonusDone(
        this: unknown,
        bonusId: string,
        detectedBy: CampaignBonusDetectedBy,
        line: string | null = null
    ) {
        const app = this as CampaignBonusDoneContext;
        const matchedBonus = app.campaignBonuses.find((bonus) => bonus.id === bonusId) ?? null;
        if (!matchedBonus) {
            return false;
        }
        const existing = app.config.campaignBonusProgress[bonusId];
        const nextProgress = { ...app.config.campaignBonusProgress };
        if (detectedBy === null) {
            if (!existing) {
                return false;
            }
            delete nextProgress[bonusId];
        }
        else {
            nextProgress[bonusId] = {
                state: 'done',
                timestamp: new Date().toISOString(),
                detectedBy,
                ...(line ? { logLine: line } : {})
            };
        }
        app.config = app.configStore.update({
            campaignBonusProgress: nextProgress
        });
        app.syncCampaignBonusWithChecklist(matchedBonus, detectedBy, line);
        app.broadcastState();
        return true;
    }

export function runCampaignBonusMatchesChecklistItem(this: any, bonus: any, item: any, normalizedLine: any) {
        const normalizedTitle = normalizeText(bonus.title);
        const normalizedItemText = normalizeText(item.text);
        const normalizedSource = normalizeText(bonus.source);
        const keywordTexts = item.autoCompleteKeywords.map((keyword: any) => normalizeText(keyword));
        if (normalizedTitle && (normalizedItemText.includes(normalizedTitle) ||
            normalizedTitle.includes(normalizedItemText))) {
            return true;
        }
        if (keywordTexts.some((keyword: any) => keyword && (normalizedLine.includes(keyword) ||
            normalizedTitle.includes(keyword) ||
            normalizedItemText.includes(keyword) ||
            normalizedSource.includes(keyword)))) {
            return true;
        }
        if (bonus.category === 'resistance' && item.type === 'resistance') {
            const elementWords = ['холод', 'огн', 'молни'];
            return elementWords.some((word: any) => normalizedTitle.includes(word) && normalizedItemText.includes(word));
        }
        if (bonus.category === 'spirit') {
            return item.type === 'spirit' || normalizedItemText.includes('дух');
        }
        if (bonus.category === 'life') {
            return item.type === 'life' || normalizedItemText.includes('здоров');
        }
        if (bonus.category === 'mana') {
            return item.type === 'mana' || normalizedItemText.includes('ман');
        }
        if (bonus.category === 'weapon_set_passive') {
            return normalizedItemText.includes('пассив') || normalizedItemText.includes('очк');
        }
        return false;
    }

export function runSyncCampaignBonusWithChecklist(this: any, bonus: any, detectedBy: any, line: any) {
        if (!bonus.zoneId) {
            return;
        }
        const guide = this.guideService.findById(bonus.zoneId);
        if (!guide?.checklist?.length) {
            return;
        }
        const checklist = buildChecklistDefinition(guide);
        const normalizedLine = normalizeText(line ?? '');
        const directItemIds = new Set<string>();
        for (const item of checklist) {
            if (this.campaignBonusMatchesChecklistItem(bonus, item, normalizedLine)) {
                directItemIds.add(item.id);
            }
        }
        if (directItemIds.size === 0) {
            return;
        }
        const allItemIds = new Set<string>(directItemIds);
        for (const item of checklist) {
            if (item.linkedChecklistItemIds?.some((linkedId: any) => directItemIds.has(linkedId))) {
                allItemIds.add(item.id);
            }
        }
        const currentProgress = this.config.zoneProgress[guide.id] ?? {
            itemStates: {},
            likelyDoneKeywords: [],
            lastVisitedAt: null
        };
        const nextItemStates = { ...currentProgress.itemStates };
        if (detectedBy === null) {
            for (const itemId of allItemIds) {
                const existing = nextItemStates[itemId];
                if (existing?.detectedBy === 'log' || existing?.detectedBy === 'manual' || existing?.detectedBy === 'linked_reward') {
                    delete nextItemStates[itemId];
                }
            }
        }
        else {
            const timestamp = new Date().toISOString();
            for (const itemId of allItemIds) {
                const item = checklist.find((entry: any) => entry.id === itemId);
                if (!item) {
                    continue;
                }
                const isLinked = !directItemIds.has(itemId);
                nextItemStates[itemId] = {
                    state: 'done',
                    timestamp,
                    detectedBy: isLinked ? 'linked_reward' : detectedBy,
                    originalText: item.text
                };
            }
        }
        this.config = this.configStore.update({
            zoneProgress: {
                ...this.config.zoneProgress,
                [guide.id]: {
                    ...currentProgress,
                    itemStates: nextItemStates,
                    lastVisitedAt: currentProgress.lastVisitedAt ?? new Date().toISOString()
                }
            }
        });
    }

export function runCampaignBonusTextIncludesAny(this: any, bonus: any, keywords: any) {
        const searchText = normalizeText([bonus.title, bonus.source, ...(bonus.details ?? [])].join(' '));
        return keywords.some((keyword: any) => {
            const normalizedKeyword = normalizeText(keyword);
            return normalizedKeyword ? searchText.includes(normalizedKeyword) : false;
        });
    }

export function runCampaignBonusTextIncludesAll(this: any, bonus: any, keywords: any) {
        const searchText = normalizeText([bonus.title, bonus.source, ...(bonus.details ?? [])].join(' '));
        return keywords.every((keyword: any) => {
            const normalizedKeyword = normalizeText(keyword);
            return normalizedKeyword ? searchText.includes(normalizedKeyword) : false;
        });
    }

export function runCampaignBonusRewardMatchesParsedReward(this: any, bonus: any, reward: any) {
        if (!reward) {
            return false;
        }
        const value = Number(bonus.reward.value) || 0;
        const amount = reward.amount ?? value;
        const element = normalizeText(reward.element ?? reward.matchedKeywords.join(' '));
        switch (reward.rewardKey) {
            case 'passivePoints':
                return false;
            case 'weaponSetPassivePoints':
                return bonus.reward.type === 'weapon_set_passive_points' && value === amount;
            case 'coldResistance10':
                return bonus.reward.type === 'cold_resistance' && value === amount;
            case 'lightningResistance10':
                return bonus.reward.type === 'lightning_resistance' && value === amount;
            case 'fireResistance10':
                return bonus.reward.type === 'fire_resistance' && value === amount;
            case 'resistance5':
                if (element.includes('всем') || element.includes('стих')) {
                    return bonus.reward.type === 'all_elemental_resistance' && value === amount;
                }
                if (element.includes('холод') || element.includes('cold')) {
                    return bonus.reward.type === 'cold_resistance' && value === amount;
                }
                if (element.includes('молн') || element.includes('lightning')) {
                    return bonus.reward.type === 'lightning_resistance' && value === amount;
                }
                if (element.includes('огн') || element.includes('fire')) {
                    return bonus.reward.type === 'fire_resistance' && value === amount;
                }
                return bonus.reward.type === 'all_elemental_resistance' && value === amount;
            case 'spirit30':
            case 'spirit40':
                return bonus.reward.type === 'spirit' && value === amount;
            case 'life20':
                return bonus.reward.type === 'flat_life' && value === amount;
            case 'life5':
                return bonus.reward.type === 'increased_life' && value === amount;
            case 'mana5':
                return bonus.reward.type === 'increased_mana' && value === amount;
            case 'flatMana':
                return bonus.category === 'mana' && value === amount;
            case 'charmSlot':
                return (this.campaignBonusTextIncludesAll(bonus, ['charm', 'slot']) ||
                    this.campaignBonusTextIncludesAll(bonus, ['\u043e\u0431\u0435\u0440\u0435\u0433', '\u044f\u0447\u0435\u0439']));
            case 'charmChargeGain':
                return (this.campaignBonusTextIncludesAny(bonus, ['charm', '\u043e\u0431\u0435\u0440\u0435\u0433']) &&
                    this.campaignBonusTextIncludesAny(bonus, ['charge', 'duration', '\u0437\u0430\u0440\u044f\u0434', '\u0434\u043b\u0438\u0442\u0435\u043b']));
            case 'flaskLifeRecovery':
                return (this.campaignBonusTextIncludesAny(bonus, ['flask', '\u0444\u043b\u0430\u043a\u043e\u043d']) &&
                    this.campaignBonusTextIncludesAny(bonus, ['life recovery', '\u0432\u043e\u0441\u0441\u0442\u0430\u043d\u043e\u0432\u043b', '\u0437\u0434\u043e\u0440\u043e\u0432']));
            case 'stunThreshold':
                return this.campaignBonusTextIncludesAny(bonus, ['stun', '\u043e\u0433\u043b\u0443\u0448']);
            case 'elementalAilmentThreshold':
                return this.campaignBonusTextIncludesAny(bonus, ['elemental ailment', 'ailment', '\u0441\u0442\u0438\u0445\u0438\u0439\u043d', '\u0441\u043e\u0441\u0442\u043e\u044f\u043d']);
            default:
                return false;
        }
    }

export function runGetCampaignBonusRewardFallbackScore(this: any, bonus: any) {
        let score = 0;
        const contextGuideIds = this.getCampaignBonusContextGuideIds();
        const currentAct = this.currentZone.sceneKind === 'town'
            ? (this.runtime.lastGameplayAct ?? this.currentZone.actHint ?? null)
            : (this.currentZone.guide?.act ?? this.currentZone.actHint ?? null);
        const currentScene = this.normalizeCampaignBonusSceneName(this.currentZone.rawZoneName);
        const currentGuideName = this.currentZone.sceneKind === 'town'
            ? ''
            : this.normalizeCampaignBonusSceneName(this.currentZone.guide?.zone_ru);
        const bonusScene = this.normalizeCampaignBonusSceneName(bonus.zone_ru);
        if (contextGuideIds.has(bonus.zoneId)) {
            score += 100;
        }
        if (bonusScene && (bonusScene === currentScene || bonusScene === currentGuideName)) {
            score += 60;
        }
        if (currentAct && bonus.act === currentAct) {
            score += 20;
        }
        if (bonus.needsVerification) {
            score -= 2;
        }
        return score;
    }

export function runGetCampaignBonusRewardFallbackMinScore(this: any, parsedReward: any) {
        switch (parsedReward?.rewardKey) {
            case 'weaponSetPassivePoints':
                // There are several identical +2 weapon-set rewards inside the same act.
                // Mark them only when the current/last gameplay zone points to the exact reward zone.
                return 80;
            case 'spirit30':
            case 'spirit40':
            case 'resistance5':
            case 'coldResistance10':
            case 'lightningResistance10':
            case 'fireResistance10':
            case 'life20':
            case 'life5':
            case 'mana5':
            case 'flatMana':
            case 'charmSlot':
            case 'charmChargeGain':
            case 'flaskLifeRecovery':
            case 'stunThreshold':
            case 'elementalAilmentThreshold':
                // For non-weapon permanent rewards the act context is enough, but a zero-score
                // fallback is too risky: a repeated +30 Spirit line could otherwise tick the next
                // uncompleted +30 Spirit bonus in another act.
                return 20;
            default:
                return 1;
        }
    }

export function runFindCampaignBonusFromParsedReward(this: any, line: any, parsedReward: any) {
        const reward = parsedReward ?? parsePermanentReward(line);
        if (!reward) {
            return null;
        }
        const candidates = this.campaignBonuses
            .map((bonus: any, index: any) => ({ bonus, index, score: this.getCampaignBonusRewardFallbackScore(bonus) }))
            .filter(({ bonus }: any) => !this.config.campaignBonusProgress[bonus.id])
            .filter(({ bonus }: any) => this.campaignBonusRewardMatchesParsedReward(bonus, reward))
            .sort((left: any, right: any) => right.score - left.score || left.index - right.index);
        const best = candidates[0] ?? null;
        if (!best) {
            return null;
        }
        if (best.score < this.getCampaignBonusRewardFallbackMinScore(reward)) {
            return null;
        }
        return best.bonus;
    }

export function runGetCampaignBonusLogLineDedupeKey(this: any, line: any, parsedReward: any) {
        const normalizedLine = normalizeText(line);
        const rewardPart = parsedReward
            ? [parsedReward.rewardKey, parsedReward.amount ?? '', parsedReward.element ?? '', parsedReward.sourceText ?? ''].join('|')
            : normalizedLine;
        return `${rewardPart}|${normalizedLine}`;
    }

export function runRememberCampaignBonusLogLineKey(this: any, key: any) {
        if (!key) {
            return;
        }
        this.processedCampaignRewardLogLineKeys.add(key);
        this.processedCampaignRewardLogLineOrder.push(key);
        const maxSize = 250;
        while (this.processedCampaignRewardLogLineOrder.length > maxSize) {
            const oldest = this.processedCampaignRewardLogLineOrder.shift();
            if (oldest) {
                this.processedCampaignRewardLogLineKeys.delete(oldest);
            }
        }
    }

export function runApplyCampaignBonusMatchesFromLogLine(this: any, line: any, source: any) {
        // Old log tail must not resurrect progress after reset. Only live appended
        // lines are allowed to softly tick campaign bonuses.
        if (source !== 'append') {
            return;
        }
        const parsedReward = parsePermanentReward(line);
        const dedupeKey = this.getCampaignBonusLogLineDedupeKey(line, parsedReward);
        if (this.processedCampaignRewardLogLineKeys.has(dedupeKey)) {
            return;
        }
        // PoE2 can write two neighbouring lines for one weapon-set reward:
        // 1) generic passive points, 2) weapon-set passive points.
        // The generic line must not complete the next/nearby weapon-set bonus.
        if (parsedReward?.rewardKey === 'passivePoints') {
            this.rememberCampaignBonusLogLineKey(dedupeKey);
            return;
        }
        const matchedByExplicitRule = this.campaignBonuses.find((bonus: any) => {
            if (this.config.campaignBonusProgress[bonus.id]) {
                return false;
            }
            return bonus.eventRules.some((rule: any) => this.campaignBonusRuleMatches(rule, line));
        });
        const matchedBonus = matchedByExplicitRule ?? this.findCampaignBonusFromParsedReward(line, parsedReward);
        if (!matchedBonus) {
            return;
        }
        const changed = this.setCampaignBonusDone(matchedBonus.id, 'log', line);
        if (changed) {
            this.rememberCampaignBonusLogLineKey(dedupeKey);
        }
    }
