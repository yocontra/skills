---
name: ios-debugging
description: Drive and inspect an app in the iOS simulator — xcrun simctl boot/install/launch, deep-link to a screen, idb accessibility tree, simulator screenshots, log streaming, GPS, push and status-bar overrides. For Expo, React Native and Swift apps. Not for general root-cause debugging.
effort: medium
---

$ARGUMENTS

# iOS simulator debugging

Reproduce, inspect and check app behavior in the iOS simulator. Reach screens by deep
link, read UI state from the accessibility tree, and keep screenshots for visual
questions. Do the work, then report what was observed on which simulator, and anything
that needs a native rebuild.

This skill is the simulator tooling: reproduce and observe the bug here, then fix the
root cause in code.

## Preference order

1. **Deep link** (`xcrun simctl openurl`): jump straight to the screen. Do not tap
   through tabs when a URL reaches it.
2. **Accessibility tree** (idb): read UI state and find elements.
3. **Screenshots**: for layout, styling and animation questions, or as a fallback when
   the tree is empty. Not for navigation or finding elements.

## Tooling

`xcrun simctl` ships with Xcode and covers boot, install, launch, deep links, logs,
screenshots and overrides. The accessibility tree and programmatic taps need
[idb](https://fbidb.io): `brew install facebook/fb/idb-companion` plus `pip install fb-idb`.
If an MCP server such as [xc-mcp](https://github.com/conorluddy/xc-mcp) is connected, its
`idb-ui-describe`, `idb-ui-find-element` and `idb-ui-tap` tools wrap the same commands; use
whichever is present. Without idb, deep links, logs and screenshots still work; report
that tree inspection was unavailable.

## Simulator management

```bash
xcrun simctl list devices available        # pick a device from this list
xcrun simctl boot "<device name from list>"
xcrun simctl list devices | grep Booted    # what is running now
```

Take device names from the list; never hardcode one, since installed runtimes differ per
machine. With several booted simulators, address one by UDID instead of `booted`.

```bash
xcrun simctl install booted <path/to/App.app>   # if not installed yet
xcrun simctl launch booted <bundle.id>
```

## Deep link navigation

```bash
xcrun simctl openurl booted "<scheme>://<route>"
```

Find the URL scheme in the app's `Info.plist` (`CFBundleURLTypes`), or for Expo in the
`scheme` field of `app.config.ts` / `app.json`.

If a deep link lands on a splash or login screen, the route is behind an auth guard. Sign
in first (dev menu, test credentials, or a deep link into the login flow), then retry.

## Inspecting UI state

Use the accessibility tree first:

```bash
# Every visible element as JSON; filter it rather than reading the whole dump
idb ui describe-all --udid <udid> | grep -oE '"AXLabel": ?"[^"]*"' | head -50
idb ui describe-point --udid <udid> <x> <y>    # the element at one point
```

Workflow: `describe-all` (or the MCP `idb-ui-describe`) to see what is on screen, filter
for the label or identifier you need (`idb-ui-find-element` does this in the MCP), then a
screenshot only for visual questions or when the tree is empty. A thin
tree usually means the app is still loading, or has poor accessibility labels; wait a few
seconds and retry, then fall back to screenshots.

### Interaction

When no deep link reaches a state (mid-flow, say), interact through idb:

- `idb ui tap --udid <udid> <x> <y>`: tap, with coordinates from the element's frame
- `idb ui text --udid <udid> "<text>"`: type into the focused field
- `idb ui swipe --udid <udid> <x1> <y1> <x2> <y2>` and `idb ui button --udid <udid> HOME`:
  gestures and hardware buttons

Keep tap chains to two or three steps. Needing more is the signal to look for a deep link
or another route into that state.

## Reading logs

```bash
# Replace MyApp with the app's process name
xcrun simctl spawn booted log stream \
  --predicate 'processImagePath contains "MyApp" AND NOT subsystem BEGINSWITH "com.apple."' \
  --level debug
```

`log stream` never exits. Run it with `run_in_background: true` and stop it when done. For
a bounded look at what already happened, use `log show`, which returns:

```bash
xcrun simctl spawn booted log show --last 2m --info --debug \
  --predicate 'processImagePath contains "MyApp"' | tail -200
```

Do not bound a stream with `| head -N`: if the app logs fewer than N lines, it blocks
forever. A blocking call on `log stream` hangs the session.

No output usually means the simulator is not booted, the app is not running, or the
predicate does not match. Drop the predicate to confirm logging works, then narrow:

```bash
xcrun simctl spawn booted log show --last 1m | tail -20
```

## Hot reload or rebuild

- JS/TS changes in Expo or React Native: hot reload picks them up; nothing to do.
- Native changes need a rebuild: a new or changed config plugin, edits under `ios/`,
  native settings (permissions, entitlements, bundle ID), or a package with native code.

Do not start or restart the dev server yourself; it is the user's long-running process.
Make the change, and say in the report that a native rebuild is needed and which change
requires it.

## Simulator overrides

| Task | Command | Reset |
|------|---------|-------|
| Spoof GPS | `xcrun simctl location booted set <lat>,<lng>` | `xcrun simctl location booted clear` |
| Test push handling | `xcrun simctl push booted <bundle.id> <payload.json>` | none |
| Clean status bar for screenshots | `xcrun simctl status_bar booted override --time "9:41"` | `xcrun simctl status_bar booted clear` |
| Screenshot | `xcrun simctl io booted screenshot <file.png>` | delete the file if it was scratch |

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| Deep link lands on splash/login | Not authenticated | Sign in, then retry the link |
| Deep link does nothing | Simulator not booted or app not running | Boot and launch first |
| Black screen after deep link | Screen needs data or params | Check the tree; navigate to the parent screen |
| Accessibility tree empty or minimal | App loading or on splash | Wait a few seconds and retry |
| Log stream shows nothing | App not running, or predicate too strict | Drop the predicate, then narrow |
| App launch fails | App not installed | Install a built `.app` with `simctl install`; if none exists, report that a build is needed |

## Cleanup

Before reporting, undo what this session started: stop any background `log stream`,
clear location and status-bar overrides you set, delete scratch screenshots, and shut
down a simulator you booted only for this task (`xcrun simctl shutdown <udid>`). Leave
simulators and dev servers the user already had running as they were.
