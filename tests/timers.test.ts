import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatDuration,
  getCountdownDisplayMs,
  getRunTimerDisplayElapsed,
  getTownTimerDisplayElapsed,
  getTownTimerTotalElapsed,
  getZoneTimerDisplayElapsed
} from '../src/shared/timers';
import { getCurrentActElapsedMsForAct } from '../src/renderer/companion-helpers';
import { loadLogFixtureLines } from './helpers/logFixtures';
import { makeRunTimer, makeTownTimer, withMockedNow } from './helpers/timerTestUtils';
import {
  applyAppLogLine,
  applyAppLogLines,
  createTestAppInstance
} from './helpers/zoneTestUtils';

const MAX_NODE_TIMEOUT_MS = 2_147_483_647;

test('formatDuration safely formats edge values for timer display', () => {
  assert.equal(formatDuration(0), '00:00');
  assert.equal(formatDuration(59_999), '00:59');
  assert.equal(formatDuration(60_000), '01:00');
  assert.equal(formatDuration(3_661_000), '1:01:01');
  assert.equal(formatDuration(36_061_000), '10:01:01');
  assert.equal(formatDuration(-1000), '00:00');
});

test('display timer helpers preserve elapsed time and countdown safety', () => {
  assert.equal(
    getRunTimerDisplayElapsed(makeRunTimer({ status: 'running', elapsedMs: 10_000, resumedAt: 1000 }), 4000),
    13_000
  );
  assert.equal(
    getRunTimerDisplayElapsed(makeRunTimer({ status: 'paused', elapsedMs: 10_000, resumedAt: 1000 }), 4000),
    10_000
  );
  assert.equal(
    getZoneTimerDisplayElapsed(makeRunTimer({ status: 'running', lastZoneEnteredAt: 1000, currentZoneElapsedMs: 5000 }), 3500),
    7500
  );

  const townTimer = makeTownTimer({
    isInTown: true,
    townEnteredAt: 2000,
    currentTownElapsedMs: 3000,
    totalTownElapsedMs: 10_000
  });
  assert.equal(getTownTimerDisplayElapsed(makeRunTimer({ status: 'running' }), townTimer, 5000), 6000);
  assert.equal(getTownTimerTotalElapsed(makeRunTimer({ status: 'running' }), townTimer, 5000), 16_000);

  assert.equal(getCountdownDisplayMs({ leagueStartAt: null } as never, 1000), null);
  assert.equal(getCountdownDisplayMs({ leagueStartAt: 5000 } as never, 1000), 4000);
  assert.equal(getCountdownDisplayMs({ leagueStartAt: 5000 } as never, 6000), 0);
});

test('scheduled auto-start stays armed when max timeout fires before league start', () => {
  const app = createTestAppInstance();
  const startNow = 1_000;
  const leagueStartAt = startNow + MAX_NODE_TIMEOUT_MS + 60_000;
  const originalSetTimeout = global.setTimeout;
  const originalClearTimeout = global.clearTimeout;

  interface CapturedTimeout {
    active: boolean;
    delayMs: number;
    fire: () => void;
  }

  const scheduledTimeouts: CapturedTimeout[] = [];

  global.setTimeout = ((callback: (...args: unknown[]) => void, delay?: number, ...args: unknown[]) => {
    const timeout: CapturedTimeout = {
      active: true,
      delayMs: Number(delay ?? 0),
      fire: () => {
        if (!timeout.active) {
          return;
        }
        timeout.active = false;
        callback(...args);
      }
    };
    scheduledTimeouts.push(timeout);
    return timeout as unknown as ReturnType<typeof setTimeout>;
  }) as typeof setTimeout;

  global.clearTimeout = ((timeout?: ReturnType<typeof setTimeout>) => {
    if (timeout && typeof timeout === 'object' && 'active' in timeout) {
      (timeout as unknown as CapturedTimeout).active = false;
    }
  }) as typeof clearTimeout;

  try {
    withMockedNow(startNow, () => {
      (app as any).config = (app as any).configStore.update({
        runTimer: {
          ...(app as any).config.runTimer,
          status: 'armed'
        },
        runTimerSettings: {
          ...(app as any).config.runTimerSettings,
          autoStartMode: 'scheduled_time',
          autoStart: true,
          leagueStartAt
        }
      });
      (app as any).scheduleRunTimerAutoStart();
    });

    assert.equal(scheduledTimeouts.length, 1);
    assert.equal(scheduledTimeouts[0]?.delayMs, MAX_NODE_TIMEOUT_MS);

    withMockedNow(startNow + MAX_NODE_TIMEOUT_MS, () => {
      scheduledTimeouts[0]?.fire();
    });

    assert.equal((app as any).config.runTimer.status, 'armed');
    assert.equal(scheduledTimeouts.length, 2);
    assert.equal(scheduledTimeouts[1]?.delayMs, 60_000);
    assert.ok((app as any).runTimerStartTimer);
  } finally {
    global.setTimeout = originalSetTimeout;
    global.clearTimeout = originalClearTimeout;
  }
});

test('timer state broadcast skips windows with destroyed webContents', () => {
  const app = createTestAppInstance();
  const sentChannels: string[] = [];

  (app as any).overlayWindow = {
    isDestroyed: () => false,
    webContents: {
      isDestroyed: () => true,
      send: () => {
        sentChannels.push('destroyed-window');
      }
    }
  };
  (app as any).settingsWindow = {
    isDestroyed: () => false,
    webContents: {
      isDestroyed: () => false,
      send: (channel: string) => {
        sentChannels.push(channel);
      }
    }
  };

  assert.doesNotThrow(() => {
    (app as any).emitRunTimerState();
  });
  assert.deepEqual(sentChannels, ['timer:state-changed']);
});

test('run timer start, pause, resume and reset preserve accumulated elapsed time', () => {
  const app = createTestAppInstance();

  withMockedNow(1_000, () => {
    applyAppLogLine(app as never, '2026/05/16 22:00:10 123 [DEBUG Client] Generating level 6 area "G1_4" with seed 1');
    applyAppLogLine(app as never, '[SCENE] Set Source [Грельвуд]');
    (app as any).startRunTimerFromAnchor(1_000);
  });

  let runTimer = (app as any).config.runTimer;
  assert.equal(runTimer.status, 'running');
  assert.equal(runTimer.startedAt, 1_000);
  assert.equal(runTimer.resumedAt, 1_000);
  assert.equal(runTimer.lastZoneEnteredAt, 1_000);

  withMockedNow(2_500, () => {
    (app as any).pauseRunTimer();
  });
  runTimer = (app as any).config.runTimer;
  assert.equal(runTimer.status, 'paused');
  assert.equal(runTimer.elapsedMs, 1_500);
  assert.equal(runTimer.currentZoneElapsedMs, 1_500);
  assert.equal(runTimer.pauseCount, 1);

  withMockedNow(4_000, () => {
    (app as any).resumeRunTimer();
  });
  runTimer = (app as any).config.runTimer;
  assert.equal(runTimer.status, 'running');
  assert.equal(runTimer.resumedAt, 4_000);
  assert.equal(runTimer.elapsedMs, 1_500);

  withMockedNow(5_000, () => {
    (app as any).pauseRunTimer();
  });
  runTimer = (app as any).config.runTimer;
  assert.equal(runTimer.elapsedMs, 2_500);
  assert.equal(runTimer.pauseCount, 2);

  withMockedNow(6_000, () => {
    (app as any).resetRunTimer();
  });
  runTimer = (app as any).config.runTimer;
  assert.equal(runTimer.status, 'not_started');
  assert.equal(runTimer.elapsedMs, 0);
  assert.equal(runTimer.actSplits.length, 0);
});

test('act splits survive transitions from Act 1 through Act 5 and finalise correctly', () => {
  const app = createTestAppInstance();
  const lines = loadLogFixtureLines('act-transition.txt');

  withMockedNow(1_000, () => {
    applyAppLogLines(app as never, lines.slice(0, 2));
    (app as any).startRunTimerFromAnchor(1_000);
  });
  withMockedNow(2_000, () => applyAppLogLines(app as never, lines.slice(2, 4)));
  withMockedNow(3_000, () => applyAppLogLines(app as never, lines.slice(4, 6)));
  withMockedNow(4_000, () => applyAppLogLines(app as never, lines.slice(6, 8)));
  withMockedNow(5_000, () => applyAppLogLines(app as never, lines.slice(8, 10)));
  withMockedNow(6_000, () => applyAppLogLines(app as never, lines.slice(10, 12)));
  withMockedNow(7_000, () => applyAppLogLines(app as never, lines.slice(12, 14)));
  withMockedNow(8_000, () => applyAppLogLines(app as never, lines.slice(14, 16)));

  let runTimer = (app as any).config.runTimer;
  assert.deepEqual(runTimer.actSplits.map((split: { act: number }) => split.act), [1, 2, 3, 4]);
  assert.equal((app as any).runtime.lastGameplayAct, 5);
  assert.equal((app as any).currentZone.guide?.act, 5);

  withMockedNow(9_000, () => {
    (app as any).finishRunTimer();
  });

  runTimer = (app as any).config.runTimer;
  assert.equal(runTimer.status, 'finished');
  assert.deepEqual(runTimer.actSplits.map((split: { act: number }) => split.act), [1, 2, 3, 4, 5]);
  assert.equal(runTimer.elapsedMs, 8_000);
});


test('Endgame refuge starts the To T15 segment after Act 5', () => {
  const app = createTestAppInstance();

  withMockedNow(1_000, () => {
    applyAppLogLine(app as never, '2026/05/24 16:50:00 123 [DEBUG Client] Generating level 59 area "P1_6" with seed 1');
    applyAppLogLine(app as never, '[SCENE] Set Source [Поместье Холтен]');
    (app as any).startRunTimerFromAnchor(1_000);
  });

  withMockedNow(2_000, () => {
    applyAppLogLine(app as never, '2026/05/24 16:59:09 123 [DEBUG Client] Generating level 65 area "G_Endgame_Town" with seed 1');
    applyAppLogLine(app as never, '[SCENE] Set Source [(null)]');
    applyAppLogLine(app as never, '[SCENE] Set Source [Убежище в зиккурате]');
  });

  const runTimer = (app as any).config.runTimer;
  assert.equal((app as any).currentZone.sceneKind, 'town');
  assert.equal((app as any).currentZone.rawZoneName, 'Убежище в зиккурате');
  assert.equal((app as any).currentZone.guide, null);
  assert.equal((app as any).currentZone.actHint, 6);
  assert.equal((app as any).runtime.lastGameplayAct, 6);
  assert.deepEqual(runTimer.actSplits.map((split: { act: number }) => split.act), [5]);
  assert.equal(getCurrentActElapsedMsForAct(runTimer, 6, 2_000), 0);
});

test('level 79 map area auto-finishes and saves the To T15 run', () => {
  const app = createTestAppInstance();

  withMockedNow(1_000, () => {
    applyAppLogLine(app as never, '2026/05/24 16:50:00 123 [DEBUG Client] Generating level 59 area "P1_6" with seed 1');
    applyAppLogLine(app as never, '[SCENE] Set Source [Поместье Холтен]');
    (app as any).startRunTimerFromAnchor(1_000);
  });

  withMockedNow(2_000, () => {
    applyAppLogLine(app as never, '2026/05/24 16:59:09 123 [DEBUG Client] Generating level 65 area "G_Endgame_Town" with seed 1');
    applyAppLogLine(app as never, '[SCENE] Set Source [Убежище в зиккурате]');
  });

  withMockedNow(5_000, () => {
    applyAppLogLine(app as never, '2026/05/24 17:47:33 123 [DEBUG Client] Generating level 79 area "MapWorldsT15_Test" with seed 1');
  });

  const runTimer = (app as any).config.runTimer;
  assert.equal(runTimer.status, 'finished');
  assert.equal(runTimer.elapsedMs, 4_000);
  assert.deepEqual(runTimer.actSplits.map((split: { act: number }) => split.act), [5, 6]);
  assert.equal((app as any).config.runHistory.length, 1);
  assert.equal((app as any).config.runHistory[0].status, 'finished');
  assert.equal((app as any).config.runHistory[0].totalElapsedMs, 4_000);
  assert.ok((app as any).runtime.endgameT15CompletionNotice);
  assert.equal((app as any).runtime.endgameT15CompletionNotice.totalElapsedMs, 4_000);
});

test('Kingsmarch town scene starts Act 4 timer after Act 3', () => {
  const app = createTestAppInstance();

  withMockedNow(1_000, () => {
    applyAppLogLine(app as never, '2026/05/22 22:59:00 123 [DEBUG Client] Generating level 45 area "G3_17" with seed 1');
    applyAppLogLine(app as never, '[SCENE] Set Source [Black Chambers]');
    (app as any).startRunTimerFromAnchor(1_000);
  });

  withMockedNow(2_000, () => {
    applyAppLogLine(app as never, '[SCENE] Set Source [Kingsmarch]');
  });

  const runTimer = (app as any).config.runTimer;
  assert.equal((app as any).currentZone.sceneKind, 'town');
  assert.equal((app as any).currentZone.rawZoneName, 'Kingsmarch');
  assert.equal((app as any).currentZone.actHint, 4);
  assert.equal((app as any).runtime.lastGameplayAct, 4);
  assert.deepEqual(runTimer.actSplits.map((split: { act: number }) => split.act), [3]);
  assert.equal(getCurrentActElapsedMsForAct(runTimer, 4, 2_000), 0);
});

test('no-guide gameplay zones preserve current act timer and do not create false act splits', () => {
  const app = createTestAppInstance();

  withMockedNow(1_000, () => {
    applyAppLogLine(app as never, '2026/05/16 22:00:10 123 [DEBUG Client] Generating level 11 area "G1_11" with seed 1');
    applyAppLogLine(app as never, '[SCENE] Set Source [Охотничьи угодья]');
    (app as any).startRunTimerFromAnchor(1_000);
  });

  withMockedNow(2_000, () => {
    applyAppLogLine(app as never, '2026/05/16 22:10:10 123 [DEBUG Client] Generating level 12 area "G1_unknown_test" with seed 1');
    applyAppLogLine(app as never, '[SCENE] Set Source [Misty Side Zone]');
  });

  const runTimer = (app as any).config.runTimer;
  assert.equal((app as any).currentZone.guide, null);
  assert.equal((app as any).currentZone.sceneKind, 'gameplay');
  assert.equal((app as any).currentZone.actHint, 1);
  assert.equal(runTimer.actSplits.length, 0);
  assert.equal(getCurrentActElapsedMsForAct(runTimer, 1, 2_000), 1_000);
});


test('Trial of the Sekhemas scene is a guide gameplay zone, not a town scene', () => {
  const app = createTestAppInstance();

  withMockedNow(1_000, () => {
    applyAppLogLine(app as never, '2026/05/17 19:50:08 123 [DEBUG Client] Generating level 22 area "G2_13" with seed 1');
    applyAppLogLine(app as never, '[SCENE] Set Source [Испытание Сехем]');
  });

  assert.equal((app as any).currentZone.sceneKind, 'gameplay');
  assert.equal((app as any).currentZone.guide?.id, 'a2_trial_of_the_sekhemas');
  assert.equal((app as any).currentZone.guide?.zone_ru, 'Испытание Сехем');
});

test('town scenes keep the act timer visible and do not start a false new act', () => {
  const app = createTestAppInstance();

  withMockedNow(1_000, () => {
    applyAppLogLine(app as never, '2026/05/16 22:00:10 123 [DEBUG Client] Generating level 12 area "G1_12" with seed 1');
    applyAppLogLine(app as never, '[SCENE] Set Source [Фрейторн]');
    (app as any).startRunTimerFromAnchor(1_000);
  });

  withMockedNow(2_000, () => {
    applyAppLogLine(app as never, '[SCENE] Set Source [Лагерь Клирфелл]');
  });

  const runTimer = (app as any).config.runTimer;
  assert.equal((app as any).currentZone.sceneKind, 'town');
  assert.equal((app as any).runtime.lastGameplayAct, 1);
  assert.equal(runTimer.actSplits.length, 0);
  assert.equal(getCurrentActElapsedMsForAct(runTimer, 1, 2_000), 1_000);
});
