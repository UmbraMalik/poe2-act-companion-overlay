import { Fragment, memo, useCallback, useRef, type ReactNode } from 'react';
import {
  type LiveRunTimerState,
  type LiveRunTimerTextFrame,
  useLiveRunTimerText
} from '../hooks';
import {
  getCurrentActElapsedMs,
  getCurrentActElapsedMsForAct,
  getRunElapsedMs
} from '../companion-helpers';
import { formatDuration } from '../utils';
import { translate } from '../../i18n/translations';
import type { AppLanguage, RunTimerSettings, RunTimerState } from '../../shared/types';

interface LiveRunTimeTextProps {
  runTimer: RunTimerState;
  settings: RunTimerSettings | null | undefined;
  snapshotNowMs: number | null | undefined;
  componentName: string;
  overlayMode?: string | null;
  zoneName?: string | null;
  act?: number | null;
}

export const LiveRunTimeText = memo(function LiveRunTimeText({
  runTimer,
  settings,
  snapshotNowMs,
  componentName,
  overlayMode,
  zoneName,
  act
}: LiveRunTimeTextProps) {
  const textRef = useRef<HTMLSpanElement | null>(null);
  const formatTimerText = useCallback(
    (liveRunTimer: LiveRunTimerState): LiveRunTimerTextFrame => {
      const liveTimer = liveRunTimer.runTimer ?? runTimer;
      const displayedElapsedMs =
        liveTimer.status === 'armed' && liveRunTimer.countdownMs !== null
          ? liveRunTimer.countdownMs
          : liveRunTimer.runElapsedMs;

      return {
        text: formatDuration(displayedElapsedMs),
        displayedElapsedMs
      };
    },
    [runTimer]
  );

  useLiveRunTimerText(
    textRef,
    runTimer,
    settings,
    snapshotNowMs,
    formatTimerText,
    32,
    {
      overlayMode: overlayMode ?? null,
      zoneName: zoneName ?? null,
      act,
      component: componentName
    }
  );

  return <span ref={textRef}>{formatTimerText({
    nowMs: snapshotNowMs ?? Date.now(),
    runTimer,
    runElapsedMs: getRunElapsedMs(runTimer, snapshotNowMs ?? Date.now()),
    countdownMs: null
  }).text}</span>;
});

interface LiveActTimeTextProps {
  runTimer: RunTimerState;
  currentAct: number | null;
  snapshotNowMs: number | null | undefined;
  componentName: string;
  overlayMode?: string | null;
  zoneName?: string | null;
}

export const LiveActTimeText = memo(function LiveActTimeText({
  runTimer,
  currentAct,
  snapshotNowMs,
  componentName,
  overlayMode,
  zoneName
}: LiveActTimeTextProps) {
  const textRef = useRef<HTMLSpanElement | null>(null);
  const formatActText = useCallback(
    (liveRunTimer: LiveRunTimerState): LiveRunTimerTextFrame => {
      if (currentAct === null) {
        return {
          text: null,
          displayedElapsedMs: null
        };
      }

      const liveTimer = liveRunTimer.runTimer ?? runTimer;
      const actElapsedMs = getCurrentActElapsedMsForAct(
        liveTimer,
        currentAct,
        liveRunTimer.nowMs
      );

      return {
        text: actElapsedMs === null ? '' : formatDuration(actElapsedMs),
        displayedElapsedMs: actElapsedMs
      };
    },
    [currentAct, runTimer]
  );

  useLiveRunTimerText(
    textRef,
    runTimer,
    null,
    snapshotNowMs,
    formatActText,
    32,
    {
      overlayMode: overlayMode ?? null,
      zoneName: zoneName ?? null,
      act: currentAct,
      component: componentName
    }
  );

  if (currentAct === null) {
    return null;
  }

  return <span ref={textRef}>{formatActText({
    nowMs: snapshotNowMs ?? Date.now(),
    runTimer,
    runElapsedMs: getRunElapsedMs(runTimer, snapshotNowMs ?? Date.now()),
    countdownMs: null
  }).text}</span>;
});

interface LiveTimerMetaProps {
  language: AppLanguage;
  runTimer: RunTimerState;
  settings: RunTimerSettings | null | undefined;
  snapshotNowMs: number | null | undefined;
  overlayMode: string | null | undefined;
  zoneName?: string | null;
  currentAct: number | null;
  currentActLabel: string | null;
  currentLevel: number | null;
  recommendedLabel: string;
  statusLabel: string;
}

const TIMER_META_TOTAL_TOKEN = '__POE2_TIMER_TOTAL__';
const TIMER_META_ACT_PART_TOKEN = '__POE2_TIMER_ACT_PART__';

function renderTimerMetaTemplate(
  template: string,
  replacements: Array<{ token: string; node: ReactNode }>
) {
  let parts: ReactNode[] = [template];

  for (const replacement of replacements) {
    const nextParts: ReactNode[] = [];

    for (const part of parts) {
      if (typeof part !== 'string') {
        nextParts.push(part);
        continue;
      }

      const segments = part.split(replacement.token);
      segments.forEach((segment, index) => {
        if (segment) {
          nextParts.push(segment);
        }

        if (index < segments.length - 1) {
          nextParts.push(replacement.node);
        }
      });
    }

    parts = nextParts;
  }

  return parts.map((part, index) => <Fragment key={index}>{part}</Fragment>);
}

export const LiveTimerMeta = memo(function LiveTimerMeta({
  language,
  runTimer,
  settings,
  snapshotNowMs,
  overlayMode,
  zoneName,
  currentAct,
  currentActLabel,
  currentLevel,
  recommendedLabel,
  statusLabel
}: LiveTimerMetaProps) {
  const levelPart = `${translate(language, 'common.level')} ${currentLevel ?? '?'} · ${translate(language, 'common.recommended')}: ${recommendedLabel} · ${statusLabel}`;
  const hasActTime =
    currentAct !== null &&
    getCurrentActElapsedMsForAct(
      runTimer,
      currentAct,
      snapshotNowMs ?? Date.now()
    ) !== null;
  const totalNode = (
    <LiveRunTimeText
      runTimer={runTimer}
      settings={settings}
      snapshotNowMs={snapshotNowMs}
      componentName="overlay-run-time-text"
      overlayMode={overlayMode}
      zoneName={zoneName}
      act={currentAct}
    />
  );
  const actPartNode = hasActTime ? (
    <>
      {' · '}
      {currentActLabel ?? translate(language, 'route.interludes')}
      {' '}
      <LiveActTimeText
        runTimer={runTimer}
        currentAct={currentAct}
        snapshotNowMs={snapshotNowMs}
        componentName="overlay-act-time-text"
        overlayMode={overlayMode}
        zoneName={zoneName}
      />
    </>
  ) : null;

  if (runTimer.status === 'armed') {
    return (
      <>
        {renderTimerMetaTemplate(
          translate(language, 'overlay.timerStartIn', {
            duration: TIMER_META_TOTAL_TOKEN
          }),
          [{ token: TIMER_META_TOTAL_TOKEN, node: totalNode }]
        )}
      </>
    );
  }

  if (runTimer.status === 'paused') {
    return (
      <>
        {renderTimerMetaTemplate(
          translate(language, 'overlay.timerPaused', {
            total: TIMER_META_TOTAL_TOKEN,
            actPart: actPartNode ? TIMER_META_ACT_PART_TOKEN : '',
            levelPart
          }),
          [
            { token: TIMER_META_TOTAL_TOKEN, node: totalNode },
            { token: TIMER_META_ACT_PART_TOKEN, node: actPartNode ?? null }
          ]
        )}
      </>
    );
  }

  if (runTimer.status === 'finished') {
    return (
      <>
        {renderTimerMetaTemplate(
          translate(language, 'overlay.timerFinished', {
            total: TIMER_META_TOTAL_TOKEN,
            actPart: actPartNode ? TIMER_META_ACT_PART_TOKEN : '',
            levelPart
          }),
          [
            { token: TIMER_META_TOTAL_TOKEN, node: totalNode },
            { token: TIMER_META_ACT_PART_TOKEN, node: actPartNode ?? null }
          ]
        )}
      </>
    );
  }

  if (runTimer.status === 'running') {
    return (
      <>
        {renderTimerMetaTemplate(
          translate(language, 'overlay.timerRunning', {
            total: TIMER_META_TOTAL_TOKEN,
            actPart: actPartNode ? TIMER_META_ACT_PART_TOKEN : '',
            levelPart
          }),
          [
            { token: TIMER_META_TOTAL_TOKEN, node: totalNode },
            { token: TIMER_META_ACT_PART_TOKEN, node: actPartNode ?? null }
          ]
        )}
      </>
    );
  }

  return translate(language, 'overlay.timerIdle', {
    levelPart
  });
});
