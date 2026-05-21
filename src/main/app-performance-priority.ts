import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { diagnosticInfo, diagnosticWarn } from './diagnostic-logger';

const execFileAsync = promisify(execFile);

type AppPriorityClass = 'Normal' | 'RealTime';

export interface AppPriorityApplyResult {
  ok: boolean;
  priorityClass: AppPriorityClass;
  changed: number;
  failed: number;
  message: string;
}

function parsePriorityScriptOutput(output: string): { changed: number; failed: number } {
  const changedMatch = output.match(/changed=(\d+)/i);
  const failedMatch = output.match(/failed=(\d+)/i);

  return {
    changed: changedMatch ? Number(changedMatch[1]) : 0,
    failed: failedMatch ? Number(failedMatch[1]) : 0
  };
}

async function setCurrentAppProcessesPriority(priorityClass: AppPriorityClass): Promise<AppPriorityApplyResult> {
  if (process.platform !== 'win32') {
    return {
      ok: false,
      priorityClass,
      changed: 0,
      failed: 0,
      message: 'Windows-only priority mode skipped on this platform.'
    };
  }

  const targetProcessPath = process.execPath;
  const script = `
$ErrorActionPreference = 'SilentlyContinue'
$targetPath = [Environment]::GetEnvironmentVariable('POE2_TARGET_PROCESS_PATH')
$priority = [Environment]::GetEnvironmentVariable('POE2_TARGET_PRIORITY_CLASS')
$changed = 0
$failed = 0

if (-not $targetPath -or -not $priority) {
  Write-Output "changed=0;failed=1"
  exit 0
}

[System.Diagnostics.Process]::GetProcesses() | ForEach-Object {
  try {
    $path = $null
    try { $path = $_.Path } catch {}
    if (-not $path) {
      try { $path = $_.MainModule.FileName } catch {}
    }

    if ($path -and [string]::Equals($path, $targetPath, [System.StringComparison]::OrdinalIgnoreCase)) {
      try {
        $_.PriorityClass = $priority
        $changed = $changed + 1
      } catch {
        $failed = $failed + 1
      }
    }
  } catch {
    $failed = $failed + 1
  }
}

Write-Output "changed=$changed;failed=$failed"
`;

  try {
    const { stdout, stderr } = await execFileAsync(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script],
      {
        env: {
          ...process.env,
          POE2_TARGET_PROCESS_PATH: targetProcessPath,
          POE2_TARGET_PRIORITY_CLASS: priorityClass
        },
        timeout: 5000,
        windowsHide: true
      }
    );
    const { changed, failed } = parsePriorityScriptOutput(`${stdout}\n${stderr}`);

    return {
      ok: changed > 0 && failed === 0,
      priorityClass,
      changed,
      failed,
      message: `changed=${changed}; failed=${failed}`
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      priorityClass,
      changed: 0,
      failed: 1,
      message
    };
  }
}

export function runClearPerformancePriorityTimers(this: any) {
  if (!Array.isArray(this.performancePriorityTimers)) {
    this.performancePriorityTimers = [];
    return;
  }

  for (const timer of this.performancePriorityTimers) {
    clearTimeout(timer);
  }
  this.performancePriorityTimers = [];
}

export async function runApplyRealtimePrioritySetting(this: any, enabled: boolean = Boolean(this.config.realtimePriorityEnabled)) {
  const priorityClass: AppPriorityClass = enabled ? 'RealTime' : 'Normal';
  const result = await setCurrentAppProcessesPriority(priorityClass);

  if (result.ok) {
    diagnosticInfo('Performance', `Applied ${priorityClass} priority to ${result.changed} app process(es).`);
  }
  else if (process.platform === 'win32') {
    diagnosticWarn('Performance', `Failed to apply ${priorityClass} priority: ${result.message}`);
  }

  return result;
}

export function runScheduleRealtimePriorityApply(this: any, enabled: boolean = Boolean(this.config.realtimePriorityEnabled)) {
  this.clearPerformancePriorityTimers();

  const delays = enabled ? [0, 500, 1500, 3000] : [0, 500];
  this.performancePriorityTimers = delays.map((delay) => setTimeout(() => {
    void this.applyRealtimePrioritySetting(enabled);
  }, delay));
}
