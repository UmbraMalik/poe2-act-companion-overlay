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

## [ERR-20260713-011] browser-audit-unsupported-networkidle

**Logged**: 2026-07-13T02:39:00+03:00
**Priority**: low
**Status**: resolved
**Area**: tooling

### Summary
The in-app browser backend rejected `networkidle` even though it appears in the generic API type list.

### Error
```text
playwright_wait_for_load_state does not support networkidle
```

### Suggested Fix
Use the supported `domcontentloaded` state for local visual fixtures.

### Resolution
- **Resolved**: 2026-07-13T02:39:00+03:00
- **Notes**: The fixture loaded and its DOM was verified with `domcontentloaded`.

---

## [ERR-20260713-010] test-tsconfig-tsx-type-import

**Logged**: 2026-07-13T02:31:00+03:00
**Priority**: low
**Status**: resolved
**Area**: tests

### Summary
The test TypeScript config rejected a type-only import from `UiIcon.tsx` in the non-JSX `overlay-lock.ts` module.

### Error
```text
TS6142: Module './UiIcon' was resolved to 'UiIcon.tsx', but '--jsx' is not set.
```

### Suggested Fix
Keep non-renderer helper modules independent from TSX and return a narrow literal union.

### Resolution
- **Resolved**: 2026-07-13T02:31:00+03:00
- **Notes**: Replaced the TSX type import with the return type `'lock' | 'unlock'`.

---

## [ERR-20260713-009] powershell-npm-script-policy

**Logged**: 2026-07-13T02:25:00+03:00
**Priority**: low
**Status**: resolved
**Area**: tooling

### Summary
PowerShell blocked `npm.ps1` while running the renderer typecheck.

### Error
```text
npm.ps1 cannot be loaded because running scripts is disabled on this system
```

### Suggested Fix
Invoke `npm.cmd` directly for package scripts in this Windows workspace.

### Resolution
- **Resolved**: 2026-07-13T02:25:00+03:00
- **Notes**: `npm.cmd run typecheck:renderer` completed successfully.

---

## [ERR-20260713-008] powershell-regex-quote-conflict

**Logged**: 2026-07-13T02:18:00+03:00
**Priority**: low
**Status**: resolved
**Area**: tooling

### Summary
A combined PowerShell `rg` inventory command produced an unclosed regex character class because nested quote escaping changed the pattern.

### Error
```text
rg: regex parse error: unclosed character class
```

### Suggested Fix
Use single-quoted PowerShell regex arguments and split complex source and CSS searches.

### Resolution
- **Resolved**: 2026-07-13T02:18:00+03:00
- **Notes**: Re-ran as two simple searches and completed the inventory.

---

## [ERR-20260709-002] sandbox-node-spawn-eperm

**Logged**: 2026-07-09T23:39:09+03:00
**Priority**: high
**Status**: pending
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

## [ERR-20260713-004] windows-temp-config-rename-eperm

**Logged**: 2026-07-13T01:36:00+03:00
**Priority**: medium
**Status**: resolved
**Area**: tests

### Summary
A regression fixture intermittently failed while atomically renaming a temporary config file on Windows.

### Error
```text
EPERM: operation not permitted, rename '.tmp-tests/.../config.json.tmp' -> '.tmp-tests/.../config.json'
```

### Context
- Command attempted: `npm test`
- The new Current-zone Settings chevron regression passed before the unrelated log-parser fixture failed.
- The test runner cleaned `.tmp-tests` after the failure.

### Suggested Fix
Retry after cleanup. If the failure recurs, investigate transient Windows file locking around `ConfigStore.save` test fixtures.

### Metadata
- Reproducible: yes
- Related Files: src/main/services/config-store.ts, tests/log-parser.test.ts

### Recurrence
- **Observed**: 2026-07-13T01:51:00+03:00
- **Notes**: The same rename contention affected two unrelated fixtures during a serialized `--test-concurrency=1` run, so concurrency reduction alone is not a complete fix.

---

## [ERR-20260713-005] node-options-test-concurrency-disallowed

**Logged**: 2026-07-13T01:38:00+03:00
**Priority**: low
**Status**: resolved
**Area**: tests

### Summary
Node rejects `--test-concurrency` when supplied through `NODE_OPTIONS`.

### Error
```text
node.exe: --test-concurrency= is not allowed in NODE_OPTIONS
```

### Context
- Command attempted: `NODE_OPTIONS=--test-concurrency=1 npm test`
- The intent was to serialize Windows filesystem-heavy regression fixtures.

### Suggested Fix
Pass `--test-concurrency=1` directly to a `node --test` invocation after compiling the test tree.

### Metadata
- Reproducible: yes
- Related Files: scripts/run-regression-tests.cjs

### Resolution
- **Resolved**: 2026-07-13T01:38:00+03:00
- **Notes**: Switched to a direct Node test-runner invocation for serialized verification.

---

## [ERR-20260713-006] powershell-icon-inventory-quoting

**Logged**: 2026-07-13T02:00:00+03:00
**Priority**: low
**Status**: resolved
**Area**: config

### Summary
A combined PowerShell icon-inventory command failed because nested quote characters left a string unterminated.

### Error
```text
The string is missing the terminator: ".
```

### Context
- Command combined several ripgrep patterns for JSX glyphs, Unicode symbols, and CSS `content` declarations.
- The CSS quote pattern conflicted with the enclosing PowerShell string.

### Suggested Fix
Run the inventory as separate ripgrep commands with single-quoted PowerShell arguments.

### Metadata
- Reproducible: yes
- Related Files: src/renderer

### Resolution
- **Resolved**: 2026-07-13T02:00:00+03:00
- **Notes**: Split the inventory into independently quoted searches.

---

## [ERR-20260713-007] atomic-patch-readme-encoding-context

**Logged**: 2026-07-13T02:06:00+03:00
**Priority**: low
**Status**: resolved
**Area**: docs

### Summary
A multi-file icon-system patch was rejected because a README context line used a differently decoded dash sequence.

### Error
```text
apply_patch verification failed: Failed to find expected lines in src/renderer/styles/README.md
```

### Context
- The patch combined new TSX/CSS files, stylesheet registration, and a README update.
- The README contains legacy mojibake around the em dash, so the expected context did not match byte-for-byte.
- The atomic patch wrote no partial changes.

### Suggested Fix
Apply source changes independently, then patch documentation using stable ASCII-only context.

### Metadata
- Reproducible: yes
- Related Files: src/renderer/styles/README.md

### Resolution
- **Resolved**: 2026-07-13T02:06:00+03:00
- **Notes**: Split implementation and documentation into separate patches.

---
