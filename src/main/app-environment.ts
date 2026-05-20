import { app } from 'electron';

import { inferActHintFromInternalAreaId as inferActHintFromInternalAreaIdFromScene } from './scene-classifier';
import { isAllowedExternalUrl } from '../shared/external-url-policy';

export const forceProductionRenderer = process.env.ELECTRON_RENDERER_MODE === 'production' ||
    process.env.NODE_ENV === 'production';
export const isDev = !app.isPackaged && !forceProductionRenderer;
export const devServerUrl = process.env.VITE_DEV_SERVER_URL ?? 'http://localhost:5173';
export const DEV_SAMPLE_ZONE_LINE = '2026/05/12 12:00:00 Вы вошли в область: Грельвуд';
export const DEFAULT_LOG_STATUS_MESSAGE = 'Ожидание лог-файла';
export const BROADCAST_THROTTLE_MS = 100;
export const UPDATE_CHECK_DELAY_MS = 4000;
export const TIMER_VISUAL_HEARTBEAT_MS = 1000;
export const TIMER_DIAGNOSTICS_TICK_DELAY_THRESHOLD_MS = 500;

export function inferActHintFromInternalAreaId(areaId: any) {
    return inferActHintFromInternalAreaIdFromScene(areaId);
}

export function clampOpacity(value: any) {
    return Math.min(1, Math.max(0.35, value));
}

export function isSafeExternalUrl(url: unknown): url is string {
    return isAllowedExternalUrl(url);
}
