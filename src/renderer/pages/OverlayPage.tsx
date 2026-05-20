import {
  useCallback,
  useEffect,
  useRef,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent
} from 'react';
import { useAppSnapshot, useRunTimerState } from '../hooks';
import { useDocumentTitle, useI18n } from '../useI18n';
import { getSceneDisplayName } from '../companion-helpers';
import { getLevelState } from '../utils';
import { getOverlayMinimumSize } from '../../shared/overlay-layout';
import { shouldStartOverlayDrag } from '../../shared/overlay-drag';
import {
  getOverlayLockButtonIcon,
  getOverlayLockButtonLabel,
  getResizeGripClassName,
  stopOverlayControlPropagation,
  toggleOverlayMovementLock
} from '../overlay-lock';
import { LiveActTimeText, LiveRunTimeText, LiveTimerMeta } from '../overlay/OverlayTimerText';
import {
  formatActTitle,
  formatHotkeyLabel,
  formatTimerOnlyRunStatus,
  getChecklistItemTone,
  getCurrentZoneCampaignBonuses,
  getCurrentZoneLeagueReward,
  getImportantOverlayLines,
  getOverlaySpeedrunLines,
  getOverlayUpcomingReminders
} from '../overlay/overlay-page-model';
import { getCampaignBonusView, getGuideView } from '../../i18n/data';
import { translateSystemText } from '../../i18n/runtime';
import { translate } from '../../i18n/translations';
import type { AppLanguage } from '../../shared/types';

const DEFAULT_OVERLAY_MINIMUM_SIZE = getOverlayMinimumSize('full', 'normal', 90);

function getRendererViewportWidth(): number {
  return Math.round(
    document.documentElement.clientWidth || window.innerWidth || DEFAULT_OVERLAY_MINIMUM_SIZE.width
  );
}

function getRendererViewportHeight(): number {
  return Math.round(
    document.documentElement.clientHeight || window.innerHeight || DEFAULT_OVERLAY_MINIMUM_SIZE.height
  );
}

export function OverlayPage() {
  const snapshot = useAppSnapshot();
  const { t, language } = useI18n(snapshot?.config.appLanguage);
  const syncedRunTimer = useRunTimerState(snapshot?.config.runTimer);
  const resizeStateRef = useRef<{
    startX: number;
    startWidth: number;
    frame: number | null;
  } | null>(null);
  const overlayDragStateRef = useRef<{
    startMouseScreenX: number;
    startMouseScreenY: number;
    latestMouseScreenX: number;
    latestMouseScreenY: number;
    startWindowX: number | null;
    startWindowY: number | null;
    frame: number | null;
  } | null>(null);
  const overlayMovementLockedRef = useRef(false);
  const overlayPageRef = useRef<HTMLElement | null>(null);
  const overlayShellRef = useRef<HTMLElement | null>(null);
  const autoResizeFrameRef = useRef<number | null>(null);
  const adaptiveOverlayHeightSuspendedUntilRef = useRef(0);
  const autoResizeMinimumHeight = snapshot
    ? getOverlayMinimumSize(
        snapshot.runtime.overlayMode,
        snapshot.config.overlayDensity,
        snapshot.config.overlayScale
      ).height
    : DEFAULT_OVERLAY_MINIMUM_SIZE.height;

  useEffect(() => {
    overlayMovementLockedRef.current = Boolean(snapshot?.config.overlayMovementLocked);
  }, [snapshot?.config.overlayMovementLocked]);

  const isAdaptiveOverlayHeightSuspended = useCallback(() => (
    Date.now() < adaptiveOverlayHeightSuspendedUntilRef.current
  ), []);

  const suspendAdaptiveOverlayHeight = useCallback((durationMs = 900) => {
    adaptiveOverlayHeightSuspendedUntilRef.current = Math.max(
      adaptiveOverlayHeightSuspendedUntilRef.current,
      Date.now() + durationMs
    );
    void window.poe2Overlay?.setOverlayAutoResizeSuspended(true);
  }, []);

  const releaseAdaptiveOverlayHeightSuspension = useCallback((durationMs = 500) => {
    adaptiveOverlayHeightSuspendedUntilRef.current = Math.max(
      adaptiveOverlayHeightSuspendedUntilRef.current,
      Date.now() + durationMs
    );
    void window.poe2Overlay?.setOverlayAutoResizeSuspended(false);
  }, []);

  const scheduleAdaptiveOverlayHeight = useCallback((options?: { allowDuringManualResize?: boolean }) => {
    const allowDuringManualResize = Boolean(options?.allowDuringManualResize);

    if (autoResizeFrameRef.current !== null) {
      cancelAnimationFrame(autoResizeFrameRef.current);
    }

    autoResizeFrameRef.current = requestAnimationFrame(() => {
      autoResizeFrameRef.current = null;

      const page = overlayPageRef.current;
      const shell = overlayShellRef.current;
      const api = window.poe2Overlay;

      if (
        !page ||
        !shell ||
        !api ||
        overlayDragStateRef.current ||
        isAdaptiveOverlayHeightSuspended() ||
        (resizeStateRef.current && !allowDuringManualResize)
      ) {
        return;
      }

      const pageStyle = window.getComputedStyle(page);
      const shellStyle = window.getComputedStyle(shell);
      const dragStrip = page.querySelector<HTMLElement>('.window-drag-strip');
      const pagePaddingY =
        (Number.parseFloat(pageStyle.paddingTop) || 0) +
        (Number.parseFloat(pageStyle.paddingBottom) || 0);
      const shellPaddingBottom = Number.parseFloat(shellStyle.paddingBottom) || 0;
      const shellBorderY =
        (Number.parseFloat(shellStyle.borderTopWidth) || 0) +
        (Number.parseFloat(shellStyle.borderBottomWidth) || 0);
      const contentBottom = Array.from(shell.children).reduce((max, child) => {
        if (!(child instanceof HTMLElement) || child.classList.contains('resize-grip')) {
          return max;
        }

        return Math.max(max, child.offsetTop + child.offsetHeight);
      }, 0);
      const dragStripHeight = dragStrip?.getBoundingClientRect().height ?? 0;
      const desiredHeight = Math.ceil(
        pagePaddingY +
          dragStripHeight +
          contentBottom +
          shellPaddingBottom +
          shellBorderY +
          2
      );
      const nextHeight = Math.max(autoResizeMinimumHeight, desiredHeight);
      const currentHeight = getRendererViewportHeight();

      if (Math.abs(currentHeight - nextHeight) < 8) {
        return;
      }

      // Keep width as the main-process source of truth so adaptive height never widens
      // the overlay while the user is only moving it.
      void api.resizeOverlayHeight(nextHeight);
    });
  }, [autoResizeMinimumHeight, isAdaptiveOverlayHeightSuspended]);

  useEffect(() => {
    const page = overlayPageRef.current;
    const shell = overlayShellRef.current;

    if (!page || !shell) {
      return;
    }

    const observer = new ResizeObserver(() => {
      scheduleAdaptiveOverlayHeight();
    });

    observer.observe(shell);
    observer.observe(page);
    scheduleAdaptiveOverlayHeight();
    const handleWindowResize = () => scheduleAdaptiveOverlayHeight();
    window.addEventListener('resize', handleWindowResize);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', handleWindowResize);

      if (autoResizeFrameRef.current !== null) {
        cancelAnimationFrame(autoResizeFrameRef.current);
        autoResizeFrameRef.current = null;
      }
    };
  }, [
    scheduleAdaptiveOverlayHeight,
    snapshot?.runtime.overlayMode,
    snapshot?.currentGuideEntry?.id,
    snapshot?.currentGuideEntry?.checklist?.length,
    snapshot?.config.overlayScale,
    snapshot?.config.overlayDensity,
    snapshot?.config.mainOverlaySettings.showOverlaySkip,
    snapshot?.config.mainOverlaySettings.showOverlayCriticalImportant,
    snapshot?.config.mainOverlaySettings.showOverlayBossTip,
    snapshot?.config.mainOverlaySettings.showOverlayVendorReminder,
    snapshot?.config.mainOverlaySettings.showOverlayXpStatus,
    snapshot?.config.mainOverlaySettings.showOverlayPowerSpike
  ]);

  const beginOverlayDrag = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    const api = window.poe2Overlay;

    if (
      overlayMovementLockedRef.current ||
      !api?.getOverlayBounds ||
      !api?.setOverlayPosition ||
      !shouldStartOverlayDrag(event.target, {
        button: event.button
      })
    ) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    suspendAdaptiveOverlayHeight(1200);
    void api.setOverlayDragActive?.(true);

    const dragElement = event.currentTarget;
    const pointerId = event.pointerId;

    try {
      dragElement.setPointerCapture(pointerId);
    } catch {
      // Pointer capture is a best-effort helper; window-level listeners below are the fallback.
    }

    overlayDragStateRef.current = {
      startMouseScreenX: event.screenX,
      startMouseScreenY: event.screenY,
      latestMouseScreenX: event.screenX,
      latestMouseScreenY: event.screenY,
      startWindowX: null,
      startWindowY: null,
      frame: null
    };

    const flushAbsoluteMove = () => {
      const state = overlayDragStateRef.current;
      if (!state || state.startWindowX === null || state.startWindowY === null) {
        return;
      }

      state.frame = null;
      const nextX = state.startWindowX + (state.latestMouseScreenX - state.startMouseScreenX);
      const nextY = state.startWindowY + (state.latestMouseScreenY - state.startMouseScreenY);
      suspendAdaptiveOverlayHeight(1200);
      void api.setOverlayPosition(nextX, nextY);
    };

    const scheduleMove = () => {
      const state = overlayDragStateRef.current;
      if (
        !state ||
        state.frame !== null ||
        state.startWindowX === null ||
        state.startWindowY === null
      ) {
        return;
      }

      state.frame = window.requestAnimationFrame(flushAbsoluteMove);
    };

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const state = overlayDragStateRef.current;
      if (!state) {
        return;
      }

      moveEvent.preventDefault();
      moveEvent.stopPropagation();

      if (
        moveEvent.screenX === state.latestMouseScreenX &&
        moveEvent.screenY === state.latestMouseScreenY
      ) {
        return;
      }

      suspendAdaptiveOverlayHeight(1200);
      state.latestMouseScreenX = moveEvent.screenX;
      state.latestMouseScreenY = moveEvent.screenY;
      scheduleMove();
    };

    const stopOverlayDrag = () => {
      const state = overlayDragStateRef.current;

      if (state && state.frame !== null) {
        window.cancelAnimationFrame(state.frame);
        flushAbsoluteMove();
      }

      try {
        dragElement.releasePointerCapture(pointerId);
      } catch {
        // Pointer capture may already be released if the window lost pointer focus.
      }

      overlayDragStateRef.current = null;
      void api.setOverlayDragActive?.(false);
      releaseAdaptiveOverlayHeightSuspension(500);
      window.removeEventListener('pointermove', handlePointerMove, true);
      window.removeEventListener('pointerup', stopOverlayDrag, true);
      window.removeEventListener('pointercancel', stopOverlayDrag, true);
      window.removeEventListener('blur', stopOverlayDrag, true);
      document.body.classList.remove('overlay-window-dragging');
    };

    document.body.classList.add('overlay-window-dragging');
    window.addEventListener('pointermove', handlePointerMove, true);
    window.addEventListener('pointerup', stopOverlayDrag, true);
    window.addEventListener('pointercancel', stopOverlayDrag, true);
    window.addEventListener('blur', stopOverlayDrag, true);
    void api.getOverlayBounds()
      .then((bounds) => {
        const state = overlayDragStateRef.current;

        if (!state) {
          return;
        }

        if (!bounds) {
          stopOverlayDrag();
          return;
        }

        state.startWindowX = bounds.x;
        state.startWindowY = bounds.y;
        scheduleMove();
      })
      .catch(() => {
        stopOverlayDrag();
      });
  }, [releaseAdaptiveOverlayHeightSuspension, suspendAdaptiveOverlayHeight]);

  const toggleTimerOnlyMode = useCallback(() => {
    const switchMode = async () => {
      const api = window.poe2Overlay;
      if (!api) {
        return;
      }

      await api.resizeOverlayHeight(getRendererViewportHeight());
      await api.toggleOverlayMode();
    };

    void switchMode();
  }, []);

  useDocumentTitle(t('titles.overlay'));

  if (!snapshot) {
    return <div className="overlay-shell loading-shell">{t('common.loading')}</div>;
  }

  const { config, currentGuideEntry, currentZone, runtime } = snapshot;
  const displayRunTimer = syncedRunTimer ?? config.runTimer;
  const guide = currentGuideEntry;
  const guideView = getGuideView(guide, language);
  const guideChecklist = guideView?.checklist ?? [];
  const sceneName = getSceneDisplayName(snapshot, language);
  const levelState = getLevelState(snapshot);
  const currentActTimerAct =
    guide && typeof guide.act === 'number'
      ? guide.act
      : typeof currentZone.actHint === 'number'
        ? currentZone.actHint
        : runtime.lastGameplayAct ?? null;
  const currentActTimerLabel =
    currentActTimerAct !== null
      ? translate(language, 'route.act', { act: currentActTimerAct })
      : guide?.act === 'interlude' || currentZone.actHint === 'interlude'
        ? translate(language, 'route.interludes')
        : null;
  const importantLines = getImportantOverlayLines(snapshot, language);
  const zoneBonusItems = getCurrentZoneCampaignBonuses(snapshot);
  const leagueRewardItem = getCurrentZoneLeagueReward(snapshot, sceneName);
  // Always keep near-level vendor/power reminders visible in the main overlay.
  // Rule: show reminders from the current level up to +2 levels, and hide them after the target level is passed.
  const upcomingOverlayReminders = getOverlayUpcomingReminders(snapshot, language);
  const skipLines =
    config.mainOverlaySettings.showOverlaySkip && guide
      ? (guideView?.skip ?? []).slice(0, 3)
      : [];
  const speedrunLines = getOverlaySpeedrunLines(guide, language);
  const actTitle = formatActTitle(currentZone.actHint ?? guide?.act ?? null, language);
  const overlayTitle = guide ? `${actTitle} · ${sceneName}` : sceneName;
  const overlayZoneName = sceneName;
  const overlayActLabel = guide
    ? actTitle
    : currentZone.actHint
      ? formatActTitle(currentZone.actHint, language)
      : t('overlay.currentZoneFallback');
  const isTimerOnlyMode = runtime.overlayMode === 'timer_only';
  const isCompactOverlay = config.overlayDensity === 'compact';
  const visibleChecklist = isCompactOverlay ? guideChecklist.slice(0, 3) : guideChecklist;
  const hiddenChecklistCount = Math.max(0, guideChecklist.length - visibleChecklist.length);
  const hasLogConnection = runtime.logWatcherStatus === 'ready' || Boolean(runtime.watchedLogPath);
  const hasNamedUnknownZone =
    !guide &&
    Boolean(currentZone.rawZoneName) &&
    (
      currentZone.sceneKind === 'unknown' ||
      currentZone.sceneKind === 'gameplay' ||
      currentZone.sceneKind === 'town'
    );
  const shouldShowNoGuideForZone = hasLogConnection && hasNamedUnknownZone;
  const unknownZoneName =
    currentZone.rawZoneName ??
    runtime.lastSceneSource ??
    runtime.lastRawZoneName ??
    t('scene.unknownZone');
  const openCompanionHotkey = formatHotkeyLabel(config.hotkeys.openCompanion, 'F9');
  const timerOnlyShowsCountdown =
    displayRunTimer.status === 'armed' &&
    typeof config.runTimerSettings.leagueStartAt === 'number';
  const minimumSize = getOverlayMinimumSize(
    runtime.overlayMode,
    config.overlayDensity,
    config.overlayScale
  );

  const beginResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();

    if (overlayMovementLockedRef.current) {
      return;
    }

    resizeStateRef.current = {
      startX: event.screenX,
      startWidth: getRendererViewportWidth(),
      frame: null
    };

    const handleMove = (moveEvent: PointerEvent) => {
      const state = resizeStateRef.current;
      if (!state || !window.poe2Overlay) {
        return;
      }

      const nextWidth = Math.max(minimumSize.width, state.startWidth + moveEvent.screenX - state.startX);
      const currentHeight = Math.max(
        minimumSize.height,
        getRendererViewportHeight()
      );

      if (state.frame !== null) {
        cancelAnimationFrame(state.frame);
      }

      state.frame = requestAnimationFrame(() => {
        void window.poe2Overlay.resizeOverlay(nextWidth, currentHeight).then(() => {
          // Manual width resize is expected to reflow text. Let the overlay grow
          // downward to fit the new wrapped content, but keep this separate from
          // normal window dragging where size must stay locked.
          scheduleAdaptiveOverlayHeight({ allowDuringManualResize: true });
        });
      });
    };

    const stopResize = () => {
      const state = resizeStateRef.current;
      if (state && state.frame !== null) {
        cancelAnimationFrame(state.frame);
      }

      resizeStateRef.current = null;
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', stopResize);
      window.removeEventListener('pointercancel', stopResize);

      window.requestAnimationFrame(() => {
        scheduleAdaptiveOverlayHeight({ allowDuringManualResize: true });
      });
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', stopResize);
    window.addEventListener('pointercancel', stopResize);
  };

  const timerOnlyPrimaryLabel =
    timerOnlyShowsCountdown ? t('overlay.timerOnlyCountdownLabel') : t('companion.totalTime');
  const timerOnlyLevelText = `${t('common.level')} ${config.currentLevel ?? '?'} · ${t('common.recommended')}: ${guideView?.recommendedLevelLabel ?? t('common.notAvailable')} · ${levelState.label}`;
  const timerPrimaryIcon = displayRunTimer.status === 'running' ? '⏸' : '▶';
  const timerPrimaryTone = displayRunTimer.status === 'running' ? 'pause' : 'start';
  const timerPrimaryTitle =
    displayRunTimer.status === 'running'
      ? t('overlay.pauseTimer')
      : displayRunTimer.status === 'paused'
        ? t('overlay.resumeTimer')
        : t('overlay.startTimer');
  const handleTimerPrimaryAction = () => {
    if (displayRunTimer.status === 'running') {
      void window.poe2Overlay?.pauseRunTimer();
      return;
    }

    if (displayRunTimer.status === 'paused') {
      void window.poe2Overlay?.resumeRunTimer();
      return;
    }

    void window.poe2Overlay?.startRunTimer();
  };
  const handleTimerReset = () => {
    void window.poe2Overlay?.resetRunTimer();
  };
  const handleCompactOverlayToggle = async () => {
    const api = window.poe2Overlay;
    if (!api) {
      return;
    }

    await api.resizeOverlayHeight(getRendererViewportHeight());

    await api.updateSettings({
      overlayDensity: isCompactOverlay ? 'normal' : 'compact'
    });

    window.setTimeout(scheduleAdaptiveOverlayHeight, 0);
  };

  const handleTimerOnlyExpand = async () => {
    const api = window.poe2Overlay;
    if (!api) {
      return;
    }

    await api.resizeOverlayHeight(getRendererViewportHeight());

    if (config.overlayDensity === 'compact') {
      await api.updateSettings({ overlayDensity: 'normal' });
    }

    await api.setOverlayMode('full');
    window.setTimeout(scheduleAdaptiveOverlayHeight, 0);
  };

  const handleLanguageChange = (nextLanguage: AppLanguage) => {
    if (nextLanguage === language) {
      return;
    }

    void window.poe2Overlay?.updateSettings({
      appLanguage: nextLanguage
    });
  };

  const handleLanguageToggle = () => {
    handleLanguageChange(language === 'en' ? 'ru' : 'en');
  };

  const handleToggleSettings = () => {
    void window.poe2Overlay?.toggleSettings();
  };
  const handleToggleCompanion = () => {
    void window.poe2Overlay?.toggleCompanionPanel();
  };
  const handleCloseOverlay = (event: ReactMouseEvent<HTMLButtonElement>) => {
    stopOverlayControlPropagation(event);
    void window.poe2Overlay?.closeOverlay();
  };
  const handleOverlayMovementLockToggle = (event: ReactMouseEvent<HTMLButtonElement>) => {
    const api = window.poe2Overlay;
    if (!api) {
      stopOverlayControlPropagation(event);
      return;
    }

    void toggleOverlayMovementLock(event, api, config.overlayMovementLocked);
  };
  const overlayLockButtonLabel = getOverlayLockButtonLabel(config.overlayMovementLocked, language);
  const overlayLockButton = (
    <button
      className={`overlay-icon-button overlay-lock-icon-button no-drag${config.overlayMovementLocked ? ' is-locked' : ''}`}
      type="button"
      title={overlayLockButtonLabel}
      aria-label={overlayLockButtonLabel}
      aria-pressed={config.overlayMovementLocked}
      onPointerDown={stopOverlayControlPropagation}
      onMouseDown={stopOverlayControlPropagation}
      onClick={handleOverlayMovementLockToggle}
    >
      <span className={`overlay-icon-glyph overlay-icon-glyph-lock${config.overlayMovementLocked ? ' is-locked' : ' is-unlocked'}`} aria-hidden="true">
        {getOverlayLockButtonIcon(config.overlayMovementLocked)}
      </span>
    </button>
  );
  const overlayOpenCompanionButton = (
    <button
      className="overlay-icon-button no-drag"
      type="button"
      title={t('overlay.openCompanion', { hotkey: openCompanionHotkey })}
      aria-label={t('overlay.openCompanion', { hotkey: openCompanionHotkey })}
      onClick={handleToggleCompanion}
    >
      <span className="overlay-icon-glyph overlay-icon-glyph-menu" aria-hidden="true">☰</span>
    </button>
  );
  const overlayOpenSettingsButton = (
    <button
      className="overlay-icon-button no-drag"
      type="button"
      title={t('overlay.openSettings')}
      aria-label={t('overlay.openSettings')}
      onClick={handleToggleSettings}
    >
      <span className="overlay-icon-glyph overlay-icon-glyph-settings" aria-hidden="true">⚙</span>
    </button>
  );
  const overlayCloseButton = (
    <button
      className="overlay-icon-button overlay-close-button no-drag"
      type="button"
      title={t('overlay.closeWindow')}
      aria-label={t('overlay.closeWindow')}
      onPointerDown={stopOverlayControlPropagation}
      onMouseDown={stopOverlayControlPropagation}
      onClick={handleCloseOverlay}
    >
      <span className="overlay-icon-glyph overlay-icon-glyph-close" aria-hidden="true">×</span>
    </button>
  );
  const overlayLanguageToggle = (
    <div
      className={`overlay-language-toggle is-${language} no-drag`}
      role="group"
      aria-label={t('overlay.languageToggle')}
      data-language={language}
      onPointerDown={stopOverlayControlPropagation}
      onMouseDown={stopOverlayControlPropagation}
    >
      <button
        className="overlay-language-toggle-hitarea"
        type="button"
        title={t(language === 'ru' ? 'overlay.switchToEnglish' : 'overlay.switchToRussian')}
        aria-label={t(language === 'ru' ? 'overlay.switchToEnglish' : 'overlay.switchToRussian')}
        onClick={handleLanguageToggle}
      >
        <span className="overlay-language-toggle-indicator" aria-hidden="true" />
        <span
          className={`overlay-language-option${language === 'ru' ? ' is-active' : ''}`}
          aria-hidden="true"
        >
          RU
        </span>
        <span
          className={`overlay-language-option${language === 'en' ? ' is-active' : ''}`}
          aria-hidden="true"
        >
          EN
        </span>
      </button>
    </div>
  );
  const overlayQuickActions = (
    <div className="overlay-quick-actions no-drag" aria-label={t('overlay.quickActions')}>
      {overlayLanguageToggle}
      {overlayLockButton}
      {overlayOpenCompanionButton}
      {overlayOpenSettingsButton}
      {overlayCloseButton}
    </div>
  );
  const overlayNoGuideBlock = (
    <div className="overlay-onboarding-card overlay-no-guide-card">
      <p className="overlay-onboarding-title">{t('overlay.noGuideTitle')}</p>
      <p className="overlay-onboarding-text">
        {t('overlay.noGuideText', { zone: unknownZoneName })}
      </p>
      <p className="overlay-onboarding-move-hint">{t('overlay.noGuideHint')}</p>
    </div>
  );

  const overlayOnboardingBlock = (
    <div className="overlay-onboarding-card">
      <p className="overlay-onboarding-title">{t('overlay.onboardingTitle')}</p>
      <ol className="overlay-onboarding-list">
        <li>
          <strong>{t('overlay.onboardingStep1Title')}</strong>
          <span>{t('overlay.onboardingStep1Body')}</span>
          <code className="overlay-onboarding-path">{t('overlay.onboardingPath')}</code>
        </li>
        <li>
          <strong>{t('overlay.onboardingStep2Title')}</strong>
          <span>{t('overlay.onboardingStep2Body')}</span>
        </li>
      </ol>
      <div className="overlay-onboarding-actions">
        <button
          className="overlay-timer-control overlay-timer-control-primary no-drag overlay-onboarding-button"
          type="button"
          onClick={() => { void window.poe2Overlay?.openSettings(); }}
        >
          {t('overlay.onboardingButton')}
        </button>
      </div>
      <p className="overlay-onboarding-move-hint">{t('overlay.onboardingMoveHint')}</p>
    </div>
  );
  const timerControls = (
    <div className="overlay-timer-controls no-drag" aria-label={t('overlay.timerControls')}>
      <button
        className={`overlay-timer-control overlay-timer-icon-control overlay-timer-control-${timerPrimaryTone} no-drag`}
        type="button"
        title={timerPrimaryTitle}
        aria-label={timerPrimaryTitle}
        onClick={handleTimerPrimaryAction}
      >
        <span className="timer-button-glyph" aria-hidden="true">{timerPrimaryIcon}</span>
      </button>
      <button
        className="overlay-timer-control overlay-timer-icon-control overlay-timer-control-reset no-drag"
        type="button"
        title={t('overlay.resetTimer')}
        aria-label={t('overlay.resetTimer')}
        onClick={handleTimerReset}
      >
        <span className="timer-button-glyph" aria-hidden="true">↻</span>
      </button>
    </div>
  );

  if (isTimerOnlyMode) {
    return (
      <main
        ref={overlayPageRef}
        className={`overlay-page overlay-page-timer-only density-${config.overlayDensity} scale-${config.overlayScale}`}
        onPointerDownCapture={beginOverlayDrag}
      >
        <section ref={overlayShellRef} className="overlay-shell overlay-hud overlay-timer-only-card">
          <header className="timer-only-header">
            <div className="timer-only-heading">
              <p className="timer-only-kicker">{overlayTitle}</p>
              {currentActTimerAct !== null && (
                <div className="timer-only-state-row">
                  <span className="timer-only-actline">
                    {currentActTimerLabel} ·{' '}
                    <LiveActTimeText
                      runTimer={displayRunTimer}
                      currentAct={currentActTimerAct}
                      snapshotNowMs={runtime.timerNowMs}
                      componentName="timer-only-act-time-text"
                      overlayMode={runtime.overlayMode}
                      zoneName={guide?.zone_ru ?? currentZone.rawZoneName ?? overlayZoneName}
                    />
                  </span>
                </div>
              )}
            </div>
            <div className="overlay-top-control-row timer-only-top-control-row no-drag">
              {overlayQuickActions}
            </div>
          </header>

          <section className="timer-only-main-panel" aria-label={t('overlay.mainTimer')}>
            <p className="timer-only-main-label">{timerOnlyPrimaryLabel}</p>
            <div className="timer-only-time">
              <LiveRunTimeText
                runTimer={displayRunTimer}
                settings={config.runTimerSettings}
                snapshotNowMs={runtime.timerNowMs}
                componentName="timer-only-run-time-text"
                overlayMode={runtime.overlayMode}
                zoneName={guide?.zone_ru ?? currentZone.rawZoneName ?? overlayZoneName}
                act={currentActTimerAct}
              />
            </div>
            <div className="timer-only-controls-row">{timerControls}</div>
          </section>

          <div className="timer-only-info-grid">
            <p className={`timer-only-meta level-${levelState.state}`}>{timerOnlyLevelText}</p>
            <p className="timer-only-next">
              {t('overlay.nextLabel', { zone: guideView?.nextZoneName ?? t('common.notAvailable') })}
            </p>
          </div>
          <footer className="timer-only-footer">
            <button className="timer-only-expand-button no-drag" type="button" onClick={handleTimerOnlyExpand}>
              {t('overlay.expand')}
            </button>
          </footer>

          <div
            className={getResizeGripClassName(config.overlayMovementLocked)}
            aria-label={config.overlayMovementLocked ? t('overlay.resizeLocked') : t('overlay.resize')}
            role="button"
            tabIndex={-1}
            onPointerDown={beginResize}
          />
        </section>
      </main>
    );
  }

  return (
    <main
      ref={overlayPageRef}
      className={`overlay-page density-${config.overlayDensity} scale-${config.overlayScale}`}
      onPointerDownCapture={beginOverlayDrag}
    >
      <section ref={overlayShellRef} className="overlay-shell overlay-hud overlay-main-compact">
        <header className="hud-header">
          <div className="hud-title-row">
            <div className="hud-zone-title-card">
              <div className="hud-zone-kicker-row">
                <span className="hud-zone-act-pill">{overlayActLabel}</span>
              </div>
              <h1 className="hud-zone-name">{overlayZoneName}</h1>
            </div>
            <div className="hud-title-actions no-drag">
              {overlayQuickActions}
            </div>
          </div>
          <div className="hud-header-divider" aria-hidden="true" />
          <div className="overlay-top-control-row no-drag">
            {timerControls}
          </div>
          <p className={`hud-meta level-${levelState.state}`}>
            <LiveTimerMeta
              runTimer={displayRunTimer}
              settings={config.runTimerSettings}
              snapshotNowMs={runtime.timerNowMs}
              overlayMode={runtime.overlayMode}
              zoneName={guide?.zone_ru ?? currentZone.rawZoneName ?? overlayZoneName}
              language={language}
              currentAct={currentActTimerAct}
              currentActLabel={currentActTimerLabel}
              currentLevel={config.currentLevel}
              recommendedLabel={guideView?.recommendedLevelLabel ?? t('common.notAvailable')}
              statusLabel={levelState.label}
            />
          </p>
        </header>

        {runtime.logWatcherStatus !== 'ready' && (
          <section className="hud-banner">
            <strong>{translateSystemText(runtime.logWatcherMessage, language)}</strong>
          </section>
        )}

        {!isCompactOverlay && upcomingOverlayReminders.length > 0 && (
          <section className="hud-block reminder-section upcoming-overlay-section">
            <div className="reminder-header-row">
              <h2>{t('overlay.nearby')}</h2>
              <span className="overlay-upcoming-range">{t('overlay.upcomingRange')}</span>
            </div>
            <ul className="overlay-upcoming-list">
              {upcomingOverlayReminders.map((entry) => (
                <li
                  key={entry.id}
                  className={`overlay-upcoming-item ${entry.level === config.currentLevel ? 'is-current-level' : ''}`}
                >
                  <div className="overlay-upcoming-line">
                    <span className="overlay-upcoming-level">{t('common.level')} {entry.level}</span>
                    <span className="overlay-upcoming-title">{entry.title}</span>
                    {entry.level === config.currentLevel && (
                      <span className="overlay-upcoming-badge">{t('overlay.currentBadge')}</span>
                    )}
                  </div>
                  {entry.items.length > 0 && (
                    <p className="overlay-upcoming-note">{entry.items.slice(0, 2).join(' · ')}</p>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="hud-block checklist-section">
          <h2>{t('overlay.inThisZone')}</h2>
          {guide ? (
            guideChecklist.length > 0 ? (
              <>
                <ul className="checklist-list overlay-checklist-list">
                  {visibleChecklist.map((item) => (
                    <li key={item.id} className={`checklist-item${getChecklistItemTone(item)}`}>
                      {item.text}
                    </li>
                  ))}
                </ul>
                {hiddenChecklistCount > 0 && (
                  <p className="helper-text checklist-more-note">
                    {t('overlay.compactMore', { count: hiddenChecklistCount })}
                  </p>
                )}
              </>
            ) : (
              <p className="hud-empty">{t('overlay.emptyZoneNotes')}</p>
            )
          ) : (
            shouldShowNoGuideForZone ? overlayNoGuideBlock : overlayOnboardingBlock
          )}
        </section>

        {!isCompactOverlay && zoneBonusItems.length > 0 && (
          <section className="hud-block zone-bonuses-section">
            <h2>{t('overlay.zoneBonuses')}</h2>
            <ul className="section-list compact-list overlay-bonus-list">
              {zoneBonusItems.map(({ bonus, done }) => {
                const bonusView = getCampaignBonusView(bonus, language);

                return (
                  <li key={bonus.id} className={done ? 'bonus-line is-done' : 'bonus-line'}>
                    <span className="bonus-state-marker">{done ? '✓' : '○'}</span>
                    <span>{bonusView?.displayTitle ?? bonus.title}</span>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
        {!isCompactOverlay && leagueRewardItem && (
          <section className="hud-block league-reward-section">
            <h2>{t('overlay.league')}</h2>
            <div className="league-reward-line">
              <span className="league-reward-marker">◆</span>
              <span>
                {t('overlay.guaranteedReward', {
                  reward: language === 'en' ? leagueRewardItem.reward_en : leagueRewardItem.reward_ru
                })}
                {leagueRewardItem.uncertain ? ` · ${t('overlay.verify')}` : ''}
              </span>
            </div>
            {leagueRewardItem.oneTimeGuaranteed && (
              <p className="league-reward-note">{t('overlay.oneTimeLeagueReward')}</p>
            )}
          </section>
        )}

        <section className="hud-block hud-next-block">
          <h2>{t('overlay.next')}</h2>
          <p className="hud-next-zone">{guideView?.nextZoneName || t('common.notAvailable')}</p>
        </section>

        {!isCompactOverlay && skipLines.length > 0 && (
          <section className="hud-block skip-section">
            <h2>{t('common.skip')}</h2>
            <ul className="section-list compact-list">
              {skipLines.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        )}

        {!isCompactOverlay && speedrunLines.length > 0 && (
          <section className="hud-block speedrun-section">
            <h2>{t('overlay.speedrun')}</h2>
            <ul className="section-list compact-list">
              {speedrunLines.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        )}

        {!isCompactOverlay && importantLines.length > 0 && (
          <section className="hud-block info-section">
            <h2>{t('common.important')}</h2>
            <ul className="section-list compact-list">
              {importantLines.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        )}

        <div className="hud-footer-row">
          <div className="hud-footer-actions">
            <button className="timer-only-collapse-button compact-mode-button no-drag" type="button" onClick={handleCompactOverlayToggle}>
              {isCompactOverlay ? t('overlay.expand') : t('overlay.compact')}
            </button>
            <button className="timer-only-collapse-button no-drag" type="button" onClick={toggleTimerOnlyMode}>
              {t('overlay.timerOnly')}
            </button>
          </div>
        </div>

        <div
            className={getResizeGripClassName(config.overlayMovementLocked)}
            aria-label={config.overlayMovementLocked ? t('overlay.resizeLocked') : t('overlay.resize')}
            role="button"
            tabIndex={-1}
            onPointerDown={beginResize}
          />
      </section>
    </main>
  );
}
