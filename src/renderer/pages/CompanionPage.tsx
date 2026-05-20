import { useEffect, useState, type ReactElement } from 'react';
import { useAppSnapshot, useLiveRunTimer } from '../hooks';
import { useDocumentTitle, useI18n } from '../useI18n';
import {
  ROUTE_OVERVIEW_VISIBLE_ITEMS,
  type CompanionTab,
  formatActTitle,
  formatBonusAct,
  formatRouteCardTitle,
  formatRunStatus,
  getBonusCategoryLabel,
  getCampaignBonusTotals,
  getCurrentZoneCampaignBonuses,
  getGuideDetailsList,
  getRouteFallbackLabels,
  getRouteStatusLabel,
  renderActTimeTable,
  renderCompactReminderList,
  renderDetails,
  renderStringSection,
  renderSummary
} from '../companion/companion-page-model';
import {
  getActTimeRows,
  getCurrentActElapsedMs,
  getCurrentRouteAct,
  getDismissedReminderHistory,
  getLongestZones,
  getNearestPowerSpike,
  getRequiredRewardLabelsForZone,
  getRouteActs,
  getRouteOverviewForAct,
  getSceneDisplayName,
  getUpcomingVendorReminders,
  getXpStatus
} from '../companion-helpers';
import { formatDuration, formatRecommendedLevelLabel } from '../utils';
import { getCampaignBonusView, getGuideView, translateDataText } from '../../i18n/data';
import { translate } from '../../i18n/translations';
import type { AppLanguage, CampaignBonusDefinition, CampaignBonusProgress, GuideEntry, RunSummary, ZoneAct } from '../../shared/types';

export function CompanionPage() {
  const snapshot = useAppSnapshot();
  const { t, language } = useI18n(snapshot?.config.appLanguage);
  const liveRunTimer = useLiveRunTimer(
    snapshot?.config.runTimer,
    snapshot?.config.runTimerSettings,
    snapshot?.runtime.timerNowMs,
    32,
    snapshot ? {
      overlayMode: snapshot.runtime.overlayMode,
      zoneName: snapshot.currentGuideEntry?.zone_ru ?? snapshot.currentZone.rawZoneName ?? null,
      act: snapshot.currentGuideEntry?.act ?? snapshot.currentZone.actHint ?? null,
      component: 'companion-live-timer'
    } : undefined
  );
  const [activeTab, setActiveTab] = useState<CompanionTab>('zone');
  const [selectedAct, setSelectedAct] = useState<ZoneAct | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useDocumentTitle(t('titles.companion'));

  useEffect(() => {
    if (!snapshot) {
      return;
    }

    const currentAct = getCurrentRouteAct(snapshot);
    const availableActs = new Set(getRouteActs(snapshot, language).map((entry) => entry.act));
    if (selectedAct === null || !availableActs.has(selectedAct)) {
      setSelectedAct(currentAct);
    }
  }, [snapshot, selectedAct, language]);

  if (!snapshot) {
    return <div className="settings-shell">{t('companion.loading')}</div>;
  }

  const { config, currentGuideEntry, currentZone, activeLevelReminder } =
    snapshot;
  const displayRunTimer = liveRunTimer.runTimer ?? config.runTimer;
  const nowAct = getCurrentRouteAct(snapshot);
  const guide = currentGuideEntry;
  const guideView = getGuideView(guide, language);
  const guideChecklist = guideView?.checklist ?? [];
  const sceneName = getSceneDisplayName(snapshot, language);
  const routeActs = getRouteActs(snapshot, language);
  const routeZones = getRouteOverviewForAct(snapshot, selectedAct ?? nowAct, language);
  const xpStatus = getXpStatus(snapshot, language);
  const countdownMs = liveRunTimer.countdownMs;
  const currentActElapsed = getCurrentActElapsedMs(
    displayRunTimer,
    guide,
    liveRunTimer.nowMs
  );
  const currentRunElapsed = liveRunTimer.runElapsedMs;
  const nearestPowerSpike = getNearestPowerSpike(
    snapshot.powerSpikes,
    config.currentLevel,
    config.guideProfile,
    99
  );
  const upcomingVendorReminders = getUpcomingVendorReminders(
    snapshot.vendorCheckpoints,
    config.currentLevel
  );
  const dismissedReminders = getDismissedReminderHistory(
    snapshot.vendorCheckpoints,
    config.levelRemindersState.dismissed
  );
  const longestZones = getLongestZones(config.zoneTimeHistory);
  const campaignBonusProgress = config.campaignBonusProgress ?? {};
  const campaignBonusTotals = getCampaignBonusTotals(
    snapshot.campaignBonuses,
    campaignBonusProgress
  );
  const currentZoneBonuses = getCurrentZoneCampaignBonuses(snapshot);
  const localizedCurrentZoneBonuses = currentZoneBonuses.map(({ bonus, done }) => ({
    bonus: getCampaignBonusView(bonus, language)!,
    done
  }));
  const actTimeRows = getActTimeRows(displayRunTimer, guide, liveRunTimer.nowMs);
  const hasNoGuideForKnownZone =
    !guide &&
    Boolean(currentZone.rawZoneName) &&
    (
      currentZone.sceneKind === 'unknown' ||
      currentZone.sceneKind === 'gameplay' ||
      currentZone.sceneKind === 'town'
    );

  const runTask = async (name: string, action: () => Promise<unknown>) => {
    try {
      setBusy(name);
      await action();
    } finally {
      setBusy(null);
    }
  };

  const openExternalLink = async (name: string, url: string) => {
    await runTask(name, async () => {
      await window.poe2Overlay.openExternal(url);
    });
  };

  const focusCurrentZone = () => {
    if (nowAct !== null) {
      setSelectedAct(nowAct);
    }

    window.requestAnimationFrame(() => {
      const currentZoneId = snapshot.currentGuideEntry?.id;
      if (!currentZoneId) {
        return;
      }

      document.getElementById(`route-zone-${currentZoneId}`)?.scrollIntoView({
        block: 'nearest',
        behavior: 'smooth'
      });
    });
  };

  const zoneTab = (
    <div className="companion-tab-layout">
      <section className="companion-block companion-overview-card">
        <h3>{guide ? `${formatActTitle(guide.act, language)} · ${sceneName}` : sceneName}</h3>
        <dl className="info-grid companion-info-grid">
          <div className="info-cell">
            <dt>{t('companion.nextZone')}</dt>
            <dd>{guideView?.nextZoneName ?? t('common.notAvailable')}</dd>
          </div>
          <div className="info-cell">
            <dt>{t('companion.levelRec')}</dt>
            <dd>{t('common.level')} {config.currentLevel ?? '?'} · {guideView?.recommendedLevelLabel ?? t('common.notAvailable')}</dd>
          </div>
          <div className="info-cell">
            <dt>{t('companion.experience')}</dt>
            <dd>{xpStatus.longLabel}</dd>
          </div>
          <div className="info-cell">
            <dt>{t('companion.sceneLabel')}</dt>
            <dd>{currentZone.sceneKind === 'town' ? t('companion.sceneTownHub') : t('companion.sceneGameplay')}</dd>
          </div>
        </dl>
      </section>

      <div className="companion-zone-dashboard">
        <div className="companion-column">
          <section className="companion-block">
            <h3>{t('overlay.inThisZone')}</h3>
            {guideChecklist.length > 0 ? (
              <ul className="checklist-list companion-checklist-list">
                {guideChecklist.map((item) => (
                  <li key={item.id} className="checklist-item">
                    {item.text}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="helper-text">
                {hasNoGuideForKnownZone ? t('companion.noGuideKnown') : t('overlay.emptyZoneNotes')}
              </p>
            )}
          </section>


          {localizedCurrentZoneBonuses.length > 0 && (
            <section className="companion-block zone-bonuses-card">
              <h3>{t('overlay.zoneBonuses')}</h3>
              <ul className="details-list zone-bonus-details-list">
                {localizedCurrentZoneBonuses.map(({ bonus, done }) => (
                  <li key={bonus.id} className={done ? 'bonus-line is-done' : 'bonus-line'}>
                    <span className="bonus-state-marker">{done ? '✓' : '○'}</span>
                    <span>{bonus.displayTitle}</span>
                  </li>
                ))}
              </ul>
              <p className="helper-text compact-helper-text">{t('companion.zoneBonusesHint')}</p>
            </section>
          )}

          {renderStringSection(t('common.next'), guideView?.nextZoneName ? [guideView.nextZoneName] : [])}
          {renderStringSection(t('common.skip'), guideView?.skip ?? [], 'skip-section')}
        </div>

        <div className="companion-column">
          {renderStringSection(t('companion.take'), guideView?.rewards ?? [])}
          {renderStringSection(t('common.important'), guideView?.important ?? [])}
          {renderStringSection(t('common.bossTips'), guideView?.bossTips ?? [])}
        </div>

        <div className="companion-column">
          {renderStringSection(t('common.xpNotes'), guideView?.xpNotes ?? [])}
          {renderStringSection(t('common.craftingTips'), guideView?.craftingTips ?? [])}
          {renderStringSection(t('common.after'), guideView?.after ?? [])}
          {renderDetails(guideView?.details ?? guide?.details, language)}
        </div>
      </div>
    </div>
  );

  const routeTab = (
    <div className="companion-tab-layout">
      <section className="companion-block companion-route-toolbar">
        <div className="companion-tab-row">
          {routeActs.map((entry) => (
            <button
              key={entry.key}
              type="button"
              className={selectedAct === entry.act ? 'button-primary' : 'button-secondary'}
              onClick={() => setSelectedAct(entry.act)}
            >
              {entry.label}
            </button>
          ))}
        </div>
        <div className="button-row">
          <button type="button" className="button-secondary" onClick={focusCurrentZone}>
            {t('companion.focusCurrentZone')}
          </button>
        </div>
      </section>

      <section className="companion-block companion-route-list-card">
        <h3>{formatActTitle(selectedAct ?? nowAct, language)}</h3>
        <div className="route-overview-list route-overview-grid">
          {routeZones.map((entry, index) => {
            const rewardLabels = getRequiredRewardLabelsForZone(entry.guide, snapshot, language);
            const fallbackLabels = rewardLabels.length > 0 ? [] : getRouteFallbackLabels(entry.guide, language);
            const routeLabels = rewardLabels.length > 0 ? rewardLabels : fallbackLabels;
            const visibleRouteLabels = routeLabels.slice(0, ROUTE_OVERVIEW_VISIBLE_ITEMS);
            const hiddenRouteLabelsCount = Math.max(0, routeLabels.length - visibleRouteLabels.length);
            const statusLabel = getRouteStatusLabel(entry.status, language);
            const routeCardTitle = formatRouteCardTitle(entry.guide, language);
            const routeGuideView = getGuideView(entry.guide, language);

            return (
              <article
                id={`route-zone-${entry.guide.id}`}
                key={entry.guide.id}
                className={`route-overview-card status-${entry.status}`}
              >
                <div className="route-overview-header">
                  <span className="route-step-index">{String(index + 1).padStart(2, '0')}</span>
                  <strong className="route-zone-name">{routeCardTitle}</strong>
                  <span className="route-rec-badge">{t('companion.routeCardLevel', { level: routeGuideView?.recommendedLevelLabel ?? formatRecommendedLevelLabel(entry.guide, language) })}</span>
                  {statusLabel && <span className="route-state-pill">{statusLabel}</span>}
                </div>

                {visibleRouteLabels.length > 0 ? (
                  <>
                    <ul className="details-list compact-reward-list">
                      {visibleRouteLabels.map((item) => (
                        <li key={`${entry.guide.id}-${item}`}>{item}</li>
                      ))}
                    </ul>
                    {hiddenRouteLabelsCount > 0 && (
                      <p className="route-more-note">{t('companion.routeMore', { count: hiddenRouteLabelsCount })}</p>
                    )}
                  </>
                ) : (
                  <p className="route-empty-note">{t('companion.routeEmpty')}</p>
                )}

                {entry.missedItems.length > 0 && (
                  <p className="warning-inline route-warning-inline">
                    {t('companion.missedInline', {
                      items: entry.missedItems
                        .slice(0, 2)
                        .map((item) => translateDataText(item.text, language))
                        .join(', ')
                    })}
                  </p>
                )}
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );

  const timerTab = (
    <div className="companion-tab-layout">
      <section className="companion-block">
        <h3>{t('companion.timerTitle')}</h3>
        <dl className="info-grid companion-info-grid">
          <div className="info-cell">
            <dt>{t('companion.totalTime')}</dt>
            <dd>{formatDuration(currentRunElapsed)}</dd>
          </div>
          <div className="info-cell">
            <dt>{t('settings.actTime')}</dt>
            <dd>{currentActElapsed === null ? t('common.notAvailable') : formatDuration(currentActElapsed)}</dd>
          </div>
          <div className="info-cell">
            <dt>{t('common.status')}</dt>
            <dd>{formatRunStatus(displayRunTimer.status, language)}</dd>
          </div>
          <div className="info-cell">
            <dt>{t('settings.countdown')}</dt>
            <dd>{countdownMs === null ? t('common.notAvailable') : formatDuration(countdownMs)}</dd>
          </div>
        </dl>
        <p className="helper-text">{t('companion.timerDescription')}</p>
        <div className="button-row">
          {displayRunTimer.status === 'running' ? (
            <button
              type="button"
              className="button-secondary"
              disabled={busy !== null}
              onClick={() =>
                runTask('pause-run', async () => {
                  await window.poe2Overlay.pauseRunTimer();
                })
              }
            >
              {t('common.pause')}
            </button>
          ) : displayRunTimer.status === 'paused' ? (
            <button
              type="button"
              className="button-primary"
              disabled={busy !== null}
              onClick={() =>
                runTask('resume-run', async () => {
                  await window.poe2Overlay.resumeRunTimer();
                })
              }
            >
              {t('common.resume')}
            </button>
          ) : (
            <button
              type="button"
              className="button-primary"
              disabled={busy !== null}
              onClick={() =>
                runTask('start-run', async () => {
                  await window.poe2Overlay.startRunTimer();
                })
              }
            >
              {t('common.start')}
            </button>
          )}
          <button
            type="button"
            className="button-secondary"
            disabled={busy !== null}
            onClick={() =>
              runTask('finish-run', async () => {
                await window.poe2Overlay.finishRunTimer();
              })
            }
          >
            {t('common.finish')}
          </button>
          <button
            type="button"
            className="button-danger"
            disabled={busy !== null}
            onClick={() =>
              runTask('reset-run', async () => {
                await window.poe2Overlay.resetRunTimer();
              })
            }
          >
            {t('common.reset')}
          </button>
        </div>
      </section>
    </div>
  );

  const actTimesTab = (
    <div className="companion-tab-layout">
      <section className="companion-block companion-table-card">
        <h3>{t('common.actTimes')}</h3>
        {renderActTimeTable(
          actTimeRows,
          displayRunTimer.status === 'finished'
            ? t('companion.actTimesEmptyFinished')
            : t('companion.actTimesEmptyRunning'),
          language
        )}
      </section>
    </div>
  );

  const reminderFlasks = snapshot.vendorCheckpoints.filter((entry) => entry.type === 'flasks');
  const reminderBases = snapshot.vendorCheckpoints.filter((entry) => entry.type === 'weapon_armor_bases');
  const filteredPowerSpikes = snapshot.powerSpikes.filter(
    (entry) => !entry.profiles || entry.profiles.includes(config.guideProfile)
  );

  const remindersTab = (
    <div className="companion-tab-layout reminders-tab-layout">
      <div className="reminders-dashboard-grid">
        <section className="companion-block reminders-card reminders-card-nearest">
          <h3>{t('companion.nearest')}</h3>
          {renderCompactReminderList([
            ...(activeLevelReminder ? [activeLevelReminder] : []),
            ...upcomingVendorReminders.slice(0, 2),
            ...(nearestPowerSpike ? [nearestPowerSpike] : [])
          ], language, 4)}
        </section>

        <section className="companion-block reminders-card">
          <h3>{t('companion.flasks')}</h3>
          {renderCompactReminderList(reminderFlasks, language)}
        </section>

        <section className="companion-block reminders-card reminders-card-wide">
          <h3>{t('companion.gearBases')}</h3>
          <div className="reminder-chip-grid">
            {reminderBases.map((entry) => (
              <div key={entry.id} className="reminder-chip">
                <span>{t('common.level')} {entry.level}</span>
                <strong>{translateDataText(entry.title, language)}</strong>
              </div>
            ))}
          </div>
        </section>

        <section className="companion-block reminders-card reminders-card-wide">
          <h3>{t('companion.powerSpikes')}</h3>
          {renderCompactReminderList(filteredPowerSpikes, language)}
        </section>
      </div>

      {dismissedReminders.length > 0 && (
        <section className="companion-block reminders-dismissed-card">
          <h3>{t('companion.dismissedReminders')}</h3>
          {renderCompactReminderList(dismissedReminders, language)}
        </section>
      )}
    </div>
  );

  const bonusGroups = snapshot.campaignBonuses.reduce<Record<string, CampaignBonusDefinition[]>>(
    (groups, bonus) => {
      const key = bonus.act === 'interlude' ? 'interlude' : String(bonus.act);
      groups[key] = [...(groups[key] ?? []), bonus];
      return groups;
    },
    {}
  );

  const bonusGroupOrder = Object.keys(bonusGroups).sort((left, right) => {
    if (left === 'interlude') return 1;
    if (right === 'interlude') return -1;
    return Number(left) - Number(right);
  });

  const bonusesTab = (
    <div className="companion-tab-layout bonuses-tab-layout">
      <section className="companion-block bonuses-summary-card">
        <h3>{t('companion.bonusesTitle')}</h3>
        <dl className="info-grid companion-info-grid bonuses-summary-grid">
          <div className="info-cell">
            <dt>{t('companion.bonusCategories.weapon_set_passive')}</dt>
            <dd>{campaignBonusTotals.weaponSetPassivePoints} / 24</dd>
          </div>
          <div className="info-cell">
            <dt>{t('common.cold')}</dt>
            <dd>{campaignBonusTotals.coldResistance} / 20%</dd>
          </div>
          <div className="info-cell">
            <dt>{t('common.fire')}</dt>
            <dd>{campaignBonusTotals.fireResistance} / 20%</dd>
          </div>
          <div className="info-cell">
            <dt>{t('common.lightning')}</dt>
            <dd>{campaignBonusTotals.lightningResistance} / 20%</dd>
          </div>
          <div className="info-cell">
            <dt>{t('companion.bonusCategories.spirit')}</dt>
            <dd>{campaignBonusTotals.spirit} / 100</dd>
          </div>
          <div className="info-cell">
            <dt>{t('companion.bonusCategories.life')}</dt>
            <dd>{t('companion.lifeSummary', {
              flat: campaignBonusTotals.flatLife,
              percent: campaignBonusTotals.increasedLife
            })}</dd>
          </div>
          <div className="info-cell">
            <dt>{t('companion.bonusCategories.mana')}</dt>
            <dd>{t('companion.manaSummary', {
              percent: campaignBonusTotals.increasedMana
            })}</dd>
          </div>
          <div className="info-cell">
            <dt>{t('common.summary')}</dt>
            <dd>{campaignBonusTotals.done} / {campaignBonusTotals.total}</dd>
          </div>
        </dl>
        <p className="helper-text">{t('companion.bonusSummaryHelp')}</p>
        <div className="button-row">
          <button
            type="button"
            className="button-secondary"
            disabled={busy !== null}
            onClick={() =>
              runTask('reset-campaign-bonuses', async () => {
                await window.poe2Overlay.resetCampaignBonuses();
              })
            }
          >
            {t('companion.resetBonusMarks')}
          </button>
        </div>
      </section>

      <div className="bonuses-act-grid">
        {bonusGroupOrder.map((groupKey) => {
          const bonuses = bonusGroups[groupKey] ?? [];
          const title = groupKey === 'interlude' ? t('companion.interludes') : t('route.act', { act: groupKey });

          return (
            <section key={groupKey} className="companion-block bonuses-act-card">
              <h3>{title}</h3>
              <div className="bonuses-list">
                {bonuses.map((bonus) => {
                  const progress = campaignBonusProgress[bonus.id];
                  const done = Boolean(progress);
                  const bonusView = getCampaignBonusView(bonus, language);

                  return (
                    <article key={bonus.id} className={`bonus-row ${done ? 'is-done' : 'is-pending'}`}>
                      <div className="bonus-status-marker" aria-hidden="true">
                        {done ? '✓' : '○'}
                      </div>
                      <div className="bonus-main">
                        <div className="bonus-title-line">
                          <strong>{bonusView?.displayTitle ?? bonus.title}</strong>
                          <span className="bonus-category-pill">{getBonusCategoryLabel(bonus.category, language)}</span>
                          {bonus.needsVerification && (
                            <span className="bonus-verify-pill">{t('companion.verify')}</span>
                          )}
                        </div>
                        <p className="bonus-meta">
                          {bonusView?.displayZoneName ?? bonus.zone_ru} · {bonusView?.displaySource ?? bonus.source}
                        </p>
                        {bonus.details.length > 0 && (
                          <ul className="bonus-details-list">
                            {(bonusView?.displayDetails ?? bonus.details).slice(0, 2).map((detail) => (
                              <li key={`${bonus.id}-${detail}`}>{detail}</li>
                            ))}
                          </ul>
                        )}
                        {progress && (
                          <p className="bonus-detected-line">
                            {t('companion.markedBy', {
                              method: progress.detectedBy === 'manual' ? t('companion.markedManually') : t('companion.markedByLog'),
                              time: new Date(progress.timestamp).toLocaleTimeString(language === 'en' ? 'en-US' : 'ru-RU')
                            })}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        className={done ? 'button-secondary bonus-toggle-button' : 'button-primary bonus-toggle-button'}
                        disabled={busy !== null}
                        onClick={() =>
                          runTask(`campaign-bonus-${bonus.id}`, async () => {
                            await window.poe2Overlay.setCampaignBonusDone(bonus.id, !done);
                          })
                        }
                      >
                        {done ? t('companion.clearMark') : t('companion.markDone')}
                      </button>
                    </article>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );

  const summaryTab = (
    <div className="companion-tab-layout">
      {displayRunTimer.status === 'finished'
        ? renderSummary(config.lastRunSummary, language)
        : <p className="helper-text">{t('companion.summaryEmpty')}</p>}

      <section className="companion-block">
        <h3>{t('companion.bestRun')}</h3>
        {config.bestRun ? (
          <ul className="details-list">
            <li>{t('companion.bestTime', { time: formatDuration(config.bestRun.totalElapsedMs) })}</li>
            <li>{t('companion.bestDate', { date: new Date(config.bestRun.finishedAt).toLocaleString(language === 'en' ? 'en-US' : 'ru-RU') })}</li>
          </ul>
        ) : (
          <p className="helper-text">{t('companion.bestRunEmpty')}</p>
        )}
      </section>

      <section className="companion-block">
        <h3>{t('companion.longestZones')}</h3>
        {longestZones.length > 0 ? (
          <ul className="details-list">
            {longestZones.map((entry) => (
              <li key={`${entry.zoneId}-${entry.enteredAt}`}>
                {translateDataText(entry.zone_ru, language)} · {formatDuration(entry.elapsedMs)}
              </li>
            ))}
          </ul>
        ) : (
          <p className="helper-text">{t('companion.zoneHistoryEmpty')}</p>
        )}
      </section>
    </div>
  );

  const tabContent = {
    zone: zoneTab,
    route: routeTab,
    timer: timerTab,
    actTimes: actTimesTab,
    reminders: remindersTab,
    bonuses: bonusesTab,
    summary: summaryTab
  } satisfies Record<CompanionTab, ReactElement>;

  return (
    <main className="settings-page companion-page">
      <header className="settings-header window-drag-strip">
        <div className="settings-header-copy">
          <p className="eyebrow">{t('common.appName')}</p>
          <h1>{t('companion.title')}</h1>
          <p className="helper-text settings-intro">{t('companion.intro')}</p>
        </div>
        <div className="button-row no-drag companion-header-actions">
          <button
            className="button-secondary"
            type="button"
            onClick={() =>
              runTask('open-info', async () => {
                await window.poe2Overlay.openInfo();
              })
            }
          >
            {t('common.info')}
          </button>
          <button
            className="button-secondary"
            type="button"
            onClick={() =>
              runTask('open-community', async () => {
                await window.poe2Overlay.openCommunity();
              })
            }
          >
            {t('common.community')}
          </button>
          <button
            className="button-secondary"
            type="button"
            onClick={() =>
              runTask('open-support', async () => {
                await window.poe2Overlay.openSupport();
              })
            }
          >
            {t('common.support')}
          </button>
          <button
            className="button-secondary"
            type="button"
            onClick={() =>
              runTask('open-settings', async () => {
                await window.poe2Overlay.openSettings();
              })
            }
          >
            {t('common.settings')}
          </button>
          <button
            className="button-secondary"
            type="button"
            onClick={() =>
              runTask('open-report-issue', async () => {
                await window.poe2Overlay.openReportIssue();
              })
            }
          >
            {t('common.reportIssue')}
          </button>
          <button
            className="button-secondary"
            type="button"
            onClick={() => window.close()}
          >
            {t('common.close')}
          </button>
        </div>
      </header>

      <section className="settings-shell companion-shell">
        <section className="settings-card companion-card">
          <div className="companion-tab-row">
            {([
              ['zone', t('companion.tabs.zone')],
              ['route', t('companion.tabs.route')],
              ['timer', t('companion.tabs.timer')],
              ['actTimes', t('companion.tabs.actTimes')],
              ['reminders', t('companion.tabs.reminders')],
              ['bonuses', t('companion.tabs.bonuses')],
              ['summary', t('companion.tabs.summary')]
            ] as const).map(([tab, label]) => (
              <button
                key={tab}
                type="button"
                className={tab === activeTab ? 'button-primary' : 'button-secondary'}
                onClick={() => setActiveTab(tab)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="companion-tab-body">{tabContent[activeTab]}</div>
        </section>
      </section>
    </main>
  );
}
