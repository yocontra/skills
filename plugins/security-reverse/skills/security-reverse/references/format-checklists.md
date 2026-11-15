# Format-specific checklists

Pass the matching section to the hunters as extra context. Each section names the
REA tools that answer its questions; when REA or the provider is unavailable, the
same checks apply to output from [fallback-toolchain.md](fallback-toolchain.md).

## Contents

- [Electron and JavaScript](#electron-and-javascript)
- [Android](#android)
- [iOS and macOS apps](#ios-and-macos-apps)
- [.NET](#net)
- [WebAssembly](#webassembly)
- [Firmware and embedded Linux](#firmware-and-embedded-linux)
- [Kernel modules, drivers, and OS components](#kernel-modules-drivers-and-os-components)

## Electron and JavaScript

REA: `inspect_electron_fuses` on the `.app` or executable,
`analyze_javascript_application` with `detail: "summary"` and `source_paths` for
`package.json`, the main entry, and preload scripts, then `inspect_analysis_view` on
the returned `parent_evidence_id`. `trace_application_feature` with a `channel` seed
follows one IPC channel from renderer to handler; an `api` seed follows a dangerous
API such as `shell.openExternal` back to its callers.

- `nodeIntegration: true` in `BrowserWindow` options: Node access from the renderer,
  so XSS becomes RCE.
- `contextIsolation: false`: the renderer reaches preload globals.
- Preload scripts: what `contextBridge.exposeInMainWorld` hands to web content.
- IPC handlers (`ipcMain.handle`, `ipcMain.on`): which privileged operations the
  renderer can trigger, and whether the sender is checked.
- `shell.openExternal()` with renderer-controlled input: command or protocol injection.
- `webSecurity: false`, `allowRunningInsecureContent`: same-origin policy disabled.
- Custom protocol handlers (`protocol.handle`, deprecated `protocol.register*Protocol`):
  path traversal and SSRF.
- Fuses: `RunAsNode` enabled, `EnableNodeCliInspectArguments` enabled, and ASAR
  integrity validation off each widen local attack paths.
- Hardcoded API keys, OAuth secrets, and update-server URLs in the bundle.
- `.jsc` files are V8 bytecode from `bytenode`; recovery is lossy (see the fallback).

## Android

REA: `inspect_android_package` (summary, then the `manifest` facet through
`inspect_analysis_view`), `search_android_classes`, `inspect_android_class`,
`inspect_android_method`, `trace_android_references`, `decode_android_resources`,
`project_android_application_graph`. The provider needs a caller-supplied JADX MCP
JAR (`REA_JADX_MCP_JAR`) and a JDK 17+; REA setup does not install either.

- Manifest: exported activities, services, receivers, and providers without a
  permission; `android:debuggable`; `android:allowBackup`.
- `res/xml/network_security_config.xml`: cleartext traffic, user-added trust anchors.
- Content providers: missing permission checks, SQL injection in `query()`,
  path traversal in `openFile()`.
- Broadcast receivers and services that perform privileged actions on unvalidated
  intents.
- WebView: `setJavaScriptEnabled(true)` with `addJavascriptInterface`, file access
  from file URLs, `loadUrl` with intent data.
- Native libraries in `lib/`: extract and run through the native route.
- `google-services.json` and Firebase URLs: check the backing rules separately.
- Hardcoded secrets in DEX strings and resources.

## iOS and macOS apps

REA: `open_binary` on the `.ipa`/`.app`, `inspect_artifact`,
`project_apple_application_graph`, `inspect_plist` on each listed `Info.plist`,
`inspect_signature` for entitlements, `inspect_macho` (summary),
`trace_dylib_resolution` for hijackable `@rpath` loads, then `open_binary` on the
main Mach-O with `get_objc_classes`, `analyze_swift_types`, and
`inspect_native_dispatch_metadata`.

- Keychain items stored with weak accessibility (anything looser than
  `kSecAttrAccessibleWhenUnlockedThisDeviceOnly` for secrets).
- Custom URL schemes and universal links: injection in the handler code.
- App Transport Security exceptions (`NSAllowsArbitraryLoads`).
- Sensitive data on the general pasteboard.
- `WKWebView` with JavaScript bridges, `evaluateJavaScript` with external input.
- Certificate pinning: present, absent, or easy to bypass.
- Entitlements broader than the app needs; on macOS, `get-task-allow`, disabled
  library validation, and missing hardened runtime.
- Privileged helpers and XPC services: client validation in the listener.
- Embedded frameworks: each is its own audit target.
- FairPlay-encrypted App Store binaries cannot be decompiled here.

## .NET

REA: `inspect_managed_artifact` (summary), `inspect_managed_members` with
`type_names`, `inspect_managed_native_boundaries` and
`verify_managed_native_boundaries` for P/Invoke. The REA managed inspection is
metadata and IL inventory, not C# source; for full method bodies use `ilspycmd` from
the fallback, then hand the output to `/audit:security`.

- `BinaryFormatter`, `NetDataContractSerializer`, `LosFormatter`, `TypeNameHandling`
  other than `None` in Json.NET: deserialization RCE.
- `Process.Start` with external input; SQL built by string concatenation.
- P/Invoke into native code with caller-controlled lengths.
- Hardcoded connection strings, keys, and license checks in user strings.
- NativeAOT binaries have no IL; analyze them as native code.

## WebAssembly

REA: `inspect_wasm_artifact` with `detail: "summary"`, then the `exports`,
`imports`, and `wat` facets through `inspect_analysis_view`. Needs caller-supplied
WABT 1.0.42 (`REA_WABT_BIN_DIRECTORY`).

- Exported functions: the surface reachable from JavaScript.
- Linear-memory copies without bounds checks: overflows stay inside the module's
  memory but can corrupt its own data and control state.
- Imported host functions: what the module can make the host do.
- Data segments: hardcoded keys and strings.
- Client-side crypto in WASM: weak algorithms or keys shipped to the client.

## Firmware and embedded Linux

REA: `inspect_firmware_regions` (Binwalk 3.1) and `extract_firmware` (Unblob 26.6)
run on Linux with caller-supplied tools and report `provider_missing` elsewhere; in
that case use the fallback extraction route. Open extracted ELF binaries with
`open_binary`; use `inspect_binary_layout` for mitigations.

- Network daemons (`httpd`, `lighttpd`, CGI binaries, `upnpd`, `telnetd`) and their
  request parsers: unbounded copies from headers, query strings, and form fields.
- Command injection: `system`, `popen`, and `exec*` built from request data.
- Authentication bypass: hardcoded credentials, hidden debug accounts, checks done only in
  client-side JavaScript.
- Weak or absent mitigations: no NX, no PIE, no canary, writable GOT.
- Startup scripts and configs in the extracted root filesystem: audit those files
  directly with `/audit:security`.
- Private keys and certificates shared across every device of the model.

## Kernel modules, drivers, and OS components

REA: `open_binary` on the `.ko`, `.sys`, or kext Mach-O; `search_procedures` for
`module_init`, `DriverEntry`, `ioctl`, `IOUserClient`; `inspect_native_api` on the
dispatch function for its jump-table cases; `analyze_function` per handler.

- Linux `.ko`: `file_operations` and `ioctl` handlers, `copy_from_user` and
  `copy_to_user` with caller-controlled sizes, missing locks.
- Windows `.sys`: `IRP_MJ_DEVICE_CONTROL` dispatch, `METHOD_NEITHER` buffers used
  without probing, device objects created without a secure DACL.
- macOS kexts: `IOUserClient` external methods, entitlement checks, argument sizes.
- Windows service DLLs, COM objects (type confusion in `QueryInterface`), and system
  binaries follow the native route; .NET system assemblies follow the .NET route.
