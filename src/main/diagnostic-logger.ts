export const DIAGNOSTIC_LOG_ENV_FLAG = 'POE2_DIAGNOSTIC_LOGS';
export const DEBUG_LOG_ENV_FLAG = 'POE2_DEBUG_LOGS';

type LogPayload = unknown;

type ConsoleMethod = 'debug' | 'info' | 'warn' | 'error';

function isTruthyEnvValue(value: string | undefined): boolean {
  return /^(1|true|yes|on|debug)$/i.test(String(value ?? '').trim());
}

export function isDiagnosticLoggingEnabled(): boolean {
  return (
    isTruthyEnvValue(process.env[DIAGNOSTIC_LOG_ENV_FLAG]) ||
    isTruthyEnvValue(process.env[DEBUG_LOG_ENV_FLAG])
  );
}

function writeConsole(method: ConsoleMethod, scope: string, message: string, payload?: LogPayload): void {
  const prefix = `[${scope}] ${message}`;

  if (payload === undefined) {
    console[method](prefix);
    return;
  }

  console[method](prefix, payload);
}

export function diagnosticDebug(scope: string, message: string, payload?: LogPayload): void {
  if (!isDiagnosticLoggingEnabled()) {
    return;
  }

  writeConsole('debug', scope, message, payload);
}

export function diagnosticInfo(scope: string, message: string, payload?: LogPayload): void {
  if (!isDiagnosticLoggingEnabled()) {
    return;
  }

  writeConsole('info', scope, message, payload);
}

export function diagnosticWarn(scope: string, message: string, payload?: LogPayload): void {
  writeConsole('warn', scope, message, payload);
}

export function diagnosticError(scope: string, message: string, payload?: LogPayload): void {
  writeConsole('error', scope, message, payload);
}
