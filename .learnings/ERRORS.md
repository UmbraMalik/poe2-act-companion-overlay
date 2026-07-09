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
