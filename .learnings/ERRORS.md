## [ERR-20260709-001] remove-npm-cache-acl

**Logged**: 2026-07-09T23:37:47+03:00
**Priority**: low
**Status**: resolved
**Area**: frontend

### Summary
Deleting a workspace npm cache created by an escalated npm install can fail inside the sandbox.

### Error
```text
Remove-Item : Access to the path 'E:\POE2ACT\.npm-cache\...' is denied.
```

### Context
- Command attempted: `Remove-Item -LiteralPath '.npm-cache' -Recurse -Force`
- The `.npm-cache` directory was created by an escalated `npm install --cache .\.npm-cache`.
- A normal sandbox cleanup did not have matching permissions for all cache entries.

### Suggested Fix
Use the same external context for cleanup when a temporary workspace npm cache is created by an escalated npm command, then verify `git status` has no `.npm-cache/`.

### Metadata
- Reproducible: yes
- Related Files: package.json, package-lock.json

### Resolution
- **Resolved**: 2026-07-09T23:37:47+03:00
- **Notes**: Removed `.npm-cache` with an escalated cleanup command.

---

## [ERR-20260709-002] sandbox-node-spawn-eperm

**Logged**: 2026-07-09T23:39:09+03:00
**Priority**: medium
**Status**: resolved
**Area**: tests

### Summary
Node test runner and Vite/esbuild can fail with `spawn EPERM` inside the sandbox.

### Error
```text
Error: spawn EPERM
```

### Context
- Commands attempted inside sandbox: `npm run test:regression`, `npm run build`
- `node:test` failed while spawning test workers.
- Vite failed while esbuild tried to start its service process.

### Suggested Fix
When the same command is required for verification, rerun it with approved external execution and report that the sandbox failure was environmental.

### Metadata
- Reproducible: yes
- Related Files: package.json, vite.config.ts

### Resolution
- **Resolved**: 2026-07-09T23:39:09+03:00
- **Notes**: `npm run test:regression` and `npm run build` passed with external execution.

---

## [ERR-20260709-003] direct-tsc-not-in-path

**Logged**: 2026-07-09T23:59:40+03:00
**Priority**: low
**Status**: resolved
**Area**: tests

### Summary
Calling `tsc` directly from PowerShell can fail because the local binary is not on PATH.

### Error
```text
tsc : The term 'tsc' is not recognized as the name of a cmdlet, function, script file, or operable program.
```

### Context
- Command attempted: `tsc -p tsconfig.electron.json --noEmit`
- The project build script still runs TypeScript successfully through npm.

### Suggested Fix
Prefer project scripts such as `npm run build`, or invoke the local binary through `npx tsc` / `node_modules/.bin/tsc` when a direct TypeScript check is needed.

### Metadata
- Reproducible: yes
- Related Files: package.json, tsconfig.electron.json

### Resolution
- **Resolved**: 2026-07-09T23:59:40+03:00
- **Notes**: `npm run build` passed and already includes `tsc -p tsconfig.electron.json`.

---

## [ERR-20260713-001] git-dubious-workspace-ownership

**Logged**: 2026-07-13T01:27:50+03:00
**Priority**: low
**Status**: resolved
**Area**: config

### Summary
Git refused to inspect the workspace because the repository owner differs from the current Windows user.

### Error
```text
fatal: detected dubious ownership in repository at 'E:/POE2ACT'
```

### Context
- Command attempted: `git status --short`
- The workspace is owned by the local Administrators group while commands run as `UmbraMalik`.

### Suggested Fix
Use the command-scoped option `git -c safe.directory=E:/POE2ACT ...` so repository inspection works without mutating global Git configuration.

### Metadata
- Reproducible: yes
- Related Files: .git

### Resolution
- **Resolved**: 2026-07-13T01:27:50+03:00
- **Notes**: Retried successfully with command-scoped `safe.directory`.

---

## [ERR-20260713-002] rg-windows-glob-arguments

**Logged**: 2026-07-13T01:27:50+03:00
**Priority**: low
**Status**: resolved
**Area**: config

### Summary
Passing Windows wildcard paths directly to ripgrep caused invalid path syntax errors.

### Error
```text
rg: src\renderer\*.tsx: Syntax error in file name, directory name, or volume label. (os error 123)
```

### Context
- Command attempted with wildcard path arguments such as `src\renderer\*.tsx`.
- PowerShell did not expand those arguments in a form accepted by ripgrep.

### Suggested Fix
Search the directory and filter with ripgrep glob flags, for example `rg -g '*.tsx' -g '*.css' PATTERN src\renderer`.

### Metadata
- Reproducible: yes
- Related Files: src/renderer

### Resolution
- **Resolved**: 2026-07-13T01:27:50+03:00
- **Notes**: Retried successfully using `-g` filters.

---

## [ERR-20260713-003] companion-preview-missing-electron-guard

**Logged**: 2026-07-13T01:29:49+03:00
**Priority**: medium
**Status**: pending
**Area**: frontend

### Summary
The browser preview of the companion page crashes because one effect calls an Electron-only API without checking whether the preload bridge exists.

### Error
```text
TypeError: Cannot read properties of undefined (reading 'onRunResetConfirmationRequested')
```

### Context
- URL opened: `companion.html?preview=1&demo=1`
- `useAppSnapshot` supports preview mode without `window.poe2Overlay`, but `CompanionPage` still calls `window.poe2Overlay.onRunResetConfirmationRequested` unconditionally.

### Suggested Fix
Skip the subscription when the preload bridge or callback is unavailable, matching the existing preview guards in renderer hooks.

### Metadata
- Reproducible: yes
- Related Files: src/renderer/pages/CompanionPage.tsx, src/renderer/hooks.ts

---
