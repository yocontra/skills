---
name: ios-debugging
description: |
  Use when debugging, testing, or interacting with the iOS simulator — launching apps,
  navigating to screens, inspecting UI state, reading logs, or verifying behavior on device.
  Works with any iOS app (Expo, bare React Native, native Swift/UIKit, etc.).
---

# iOS Simulator Debugging

Debug iOS apps on the simulator using deep links for navigation and the accessibility tree for inspection. Never tap through UI when a URL works. Never take screenshots when the component tree answers the question.

## Preference Order

1. **Deep link** (`xcrun simctl openurl`) — jump straight to any screen
2. **Accessibility tree** (idb tools) — inspect UI state, find elements
3. **Screenshots** — fine for visual debugging (layout, styling, animations). Not for general navigation or finding elements. Acceptable as a fallback.

## Recommended Plugin

The [xclaude-plugin](https://github.com/nicklama/xclaude-plugin) provides MCP tools for simulator interaction (launching apps, accessibility tree inspection, screenshots, taps, gestures). Install it in Claude Code:

1. Run `/plugins` and search for `xclaude-plugin`
2. Or add manually to `.claude/settings.json`:
   ```json
   {
     "enabledPlugins": {
       "xclaude-plugin@xclaude-plugin-marketplace": true
     }
   }
   ```

Without the plugin, everything still works via `xcrun simctl` commands -- you just lose accessibility tree inspection and programmatic tap/gesture support.

## Simulator Management

```bash
# List available simulators
xcrun simctl list devices available

# Boot one (pick from the list, don't hardcode a device name)
xcrun simctl boot "<device name from list>"

# Check which simulators are booted
xcrun simctl list devices | grep Booted
```

If an MCP tool like `simulator_launch_app` is available, use it to launch apps by bundle ID. Otherwise:

```bash
# Launch by bundle ID
xcrun simctl launch booted <bundle.id>

# Install an app first if needed
xcrun simctl install booted <path/to/app.app>
```

## Deep Link Navigation

Navigate directly to any screen via the app's URL scheme:

```bash
xcrun simctl openurl booted "<scheme>://<route>"
```

Check the app's `Info.plist` or config for registered URL schemes. For Expo apps, this is typically set in `app.config.ts` or `app.json`.

Always deep link. Never tap through tabs to reach a screen.

**Auth caveat**: If a deep link silently lands on a splash/login screen, the route is likely behind an auth guard. Sign in first (via dev menu, test credentials, or deep link to a login flow), then retry.

## Inspecting UI State

**Use the accessibility tree first.** If idb MCP tools are available (`idb_describe`, `idb_find_element`, `idb_check_quality`), prefer them:

| Tool                | Use For                                                        |
| ------------------- | -------------------------------------------------------------- |
| `idb_describe`      | Dump the full accessibility tree — all visible elements/labels |
| `idb_find_element`  | Search for a specific element by label or identifier           |
| `idb_check_quality` | Verify accessibility data is usable before relying on it       |

### Workflow

1. `idb_describe` — get the component tree, understand what's on screen
2. `idb_find_element` — locate specific elements by label
3. Screenshot for visual debugging (layout, styling, animations) or as a fallback

### Interaction

If deep linking can't reach a state (e.g. mid-flow), use interaction tools if available:

- `idb_tap` — tap an element (use `idb_find_element` for coordinates)
- `idb_input` — type text or press keys
- `idb_gesture` — swipe, hardware button presses

Prefer deep linking over UI interaction. Never chain more than 2-3 taps — if you need more, check if there's a deep link or better approach.

## Reading Logs

Stream filtered app logs:

```bash
# Replace "MyApp" with the app's process name
xcrun simctl spawn booted log stream \
  --predicate 'processImagePath contains "MyApp" AND NOT subsystem BEGINSWITH "com.apple."' \
  --level debug
```

**This command streams forever.** Always run it with `run_in_background: true` or pipe through `head -200` for a snapshot. Never run it in a blocking call.

If you get no output:
- The simulator isn't booted or the app isn't running
- The process name filter doesn't match — try without the predicate first: `xcrun simctl spawn booted log stream --level debug | head -20`

## Hot Reload vs Rebuild

- **JS/TS changes** (Expo / React Native): Hot reload handles it. No action needed.
- **Native changes**: Requires a rebuild. Never start the dev server yourself — ask the user to restart it.

Signs you need a rebuild:
- Added/changed a config plugin
- Modified native code (`ios/` directory)
- Changed native settings (permissions, entitlements, bundle ID)
- Added a package with native code

## Troubleshooting

| Symptom                              | Cause                                   | Fix                                                      |
| ------------------------------------ | --------------------------------------- | -------------------------------------------------------- |
| Deep link lands on splash/login      | Not authenticated                       | Sign in first, then retry the deep link                  |
| Accessibility tree is empty/minimal  | App is loading or on splash             | Wait a few seconds, retry                                |
| Log stream shows nothing             | App not running, or predicate too strict | Remove predicate to test, then narrow                    |
| App launch fails                     | App not installed                       | Ask user to build/install the app first                  |
| Deep link does nothing               | Simulator not booted or app not running | Boot simulator and launch app first                      |
| Black screen after deep link         | Screen requires specific data/params    | Check accessibility tree, navigate to parent screen      |

## Tips

- **Multiple simulators**: Always use `xcrun simctl list devices available` to find names. Never hardcode a device name.
- **GPS spoofing**: `xcrun simctl location booted set <lat> <lng>` to set coordinates, `xcrun simctl location booted clear` to reset.
- **Push notifications**: `xcrun simctl push booted <bundle.id> <payload.json>` to test push handling.
- **Status bar override**: `xcrun simctl status_bar booted override --time "9:41"` for clean screenshots.
- **Accessibility debugging**: If `idb_describe` returns nothing useful, the app may have poor accessibility labels. Fall back to screenshots.
