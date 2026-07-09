## [FEAT-20260709-001] resizable_settings_window

**Logged**: 2026-07-09T23:58:11+03:00
**Priority**: medium
**Status**: resolved
**Area**: frontend

### Requested Capability
Make the Settings window easier to resize down and open at a more comfortable initial size.

### User Context
The frameless Settings window could be enlarged, but felt impossible to shrink enough, and the initial window size was too tall for comfortable use.

### Complexity Estimate
simple

### Suggested Implementation
Keep the existing custom resize handles, lower the BrowserWindow minimum size, clamp the initial window size to the current display work area, and add compact CSS guards for narrow or short Settings windows.

### Metadata
- Frequency: first_time
- Related Features: settings-window, electron-window-resize

### Resolution
- **Resolved**: 2026-07-09T23:58:11+03:00
- **Commit/PR**: current workspace
- **Notes**: Settings BrowserWindow now uses compact explicit sizing constants and responsive Settings shell CSS for smaller dimensions.

---
