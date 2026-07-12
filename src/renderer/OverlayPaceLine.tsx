import { memo, useCallback, useRef } from 'react';
import { translate } from '../i18n/translations';
import { getRunTimerDisplayElapsed, getZoneTimerDisplayElapsed } from '../shared/timers';
import type {
  AppLanguage,
  RunTimerSettings,
  RunTimerState,
  SavedRunHistoryEntry,
  ZoneAct
} from '../shared/types';
import { getCurrentActElapsedMsForAct } from './companion-helpers';
import {
  useLiveRunTimerText,
  type LiveRunTimerState,
  type LiveRunTimerTextFrame
} from './hooks';
import { formatSignedPaceDuration, getRunPaceSnapshot } from './run-pace';
import { formatDuration } from './utils';

interface OverlayPaceLineProps {
  runTimer: RunTimerState;
  settings: RunTimerSettings;
  snapshotNowMs: number;
  runHistory: SavedRunHistoryEntry[];
  zoneId: string | null;
  currentAct: ZoneAct | null;
  language: AppLanguage;
  overlayMode: string | null;
  zoneName: string | null;
}

function formatPaceLine(
  liveRunTimer: LiveRunTimerState,
  props: OverlayPaceLineProps
): LiveRunTimerTextFrame {
  const liveTimer = liveRunTimer.runTimer ?? props.runTimer;
  const numericAct = typeof props.currentAct === 'number' ? props.currentAct : null;
  const currentActElapsedMs = getCurrentActElapsedMsForAct(
    liveTimer,
    numericAct,
    liveRunTimer.nowMs
  );
  const pace = getRunPaceSnapshot({
    runHistory: props.runHistory,
    zoneId: props.zoneId,
    currentRunElapsedMs: liveRunTimer.runElapsedMs,
    currentZoneElapsedMs: getZoneTimerDisplayElapsed(liveTimer, liveRunTimer.nowMs),
    currentAct: props.currentAct,
    currentActElapsedMs,
    targetRunTimeMs: props.settings.targetRunTimeMs,
    timerStatus: liveTimer.status
  });

  if (pace.checkpointDeltaMs === null || pace.projectedFinishMs === null) {
    return { text: '', displayedElapsedMs: liveRunTimer.runElapsedMs };
  }

  const pieces = [
    translate(props.language, 'overlay.livePacePb', {
      delta: formatSignedPaceDuration(pace.checkpointDeltaMs)
    }),
    translate(props.language, 'overlay.livePaceProjection', {
      time: formatDuration(pace.projectedFinishMs)
    })
  ];

  if (pace.targetDeltaMs !== null) {
    pieces.push(translate(props.language, 'overlay.livePaceTarget', {
      delta: formatSignedPaceDuration(pace.targetDeltaMs)
    }));
  }

  return {
    text: pieces.join(' · '),
    displayedElapsedMs: liveRunTimer.runElapsedMs
  };
}

export const OverlayPaceLine = memo(function OverlayPaceLine(props: OverlayPaceLineProps) {
  const textRef = useRef<HTMLSpanElement | null>(null);
  const formatText = useCallback(
    (liveRunTimer: LiveRunTimerState) => formatPaceLine(liveRunTimer, props),
    [props]
  );

  useLiveRunTimerText(
    textRef,
    props.runTimer,
    props.settings,
    props.snapshotNowMs,
    formatText,
    250,
    {
      overlayMode: props.overlayMode,
      zoneName: props.zoneName,
      act: typeof props.currentAct === 'number' ? props.currentAct : null,
      component: 'overlay-live-pace-line'
    }
  );

  const initial = formatText({
    nowMs: props.snapshotNowMs,
    runTimer: props.runTimer,
    runElapsedMs: getRunTimerDisplayElapsed(props.runTimer, props.snapshotNowMs),
    countdownMs: null
  });

  return <span ref={textRef} className="overlay-live-pace-line">{initial.text}</span>;
});
