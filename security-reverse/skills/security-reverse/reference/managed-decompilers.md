# Managed Language Decompilers

Ghidra decompiles native binaries to C. For managed/interpreted languages, use purpose-built decompilers that recover near-original source code — variable names, class hierarchies, string literals, and control flow intact.

## Java (.class / .jar / .war)

### CFR (recommended for headless use)

```bash
# Install
brew install cfr-decompiler
# or download: https://github.com/leibnitz27/cfr/releases

# Decompile a single class
cfr /path/to/Target.class > Target.java

# Decompile entire JAR to directory
cfr /path/to/app.jar --outputdir /tmp/decompiled-java

# Handle obfuscated code
cfr /path/to/app.jar --outputdir /tmp/decompiled-java \
  --decodelambdas true --removeinnerclasssynthetics true
```

Handles Java 6 through 21+, lambdas, switch expressions, records, sealed classes.

### Procyon (better type inference on older bytecode)

```bash
# Install
brew install procyon-decompiler

# Decompile JAR
procyon -jar /path/to/app.jar -o /tmp/decompiled-java
```

### JADX (Android APK/DEX)

```bash
# Install
brew install jadx

# Decompile APK to Java source + resources
jadx /path/to/app.apk -d /tmp/decompiled-apk

# Skip resources, just code
jadx /path/to/app.apk -d /tmp/decompiled-apk --no-res

# Handle obfuscated APKs
jadx /path/to/app.apk -d /tmp/decompiled-apk \
  --deobf --deobf-min 3 --show-bad-code
```

JADX also handles DEX files directly and produces cleaner output than dex2jar + CFR.

### When to use which

| Target | Tool |
|--------|------|
| .jar / .class (server-side Java) | CFR |
| .jar with heavy generics / older bytecode | Procyon |
| Android APK / DEX | JADX |
| Need GUI for browsing | JD-GUI (`brew install jd-gui`) |

## .NET (MSIL / .dll / .exe)

### ILSpy CLI (recommended for headless use)

```bash
# Install
dotnet tool install -g ilspycmd

# Decompile assembly to C# project
ilspycmd /path/to/Assembly.dll -p -o /tmp/decompiled-dotnet

# Decompile to single directory of .cs files
ilspycmd /path/to/Assembly.dll -o /tmp/decompiled-dotnet

# Decompile specific type
ilspycmd /path/to/Assembly.dll -t Namespace.ClassName

# List all types in an assembly
ilspycmd /path/to/Assembly.dll -l
```

Requires .NET SDK: `brew install dotnet`

### ICSharpCode.Decompiler (programmatic C# access)

When you need to script decompilation or extract specific methods:

```csharp
// dotnet script or standalone tool
using ICSharpCode.Decompiler;
using ICSharpCode.Decompiler.CSharp;

var decompiler = new CSharpDecompiler("Assembly.dll", new DecompilerSettings());
string code = decompiler.DecompileWholeModuleAsString();
File.WriteAllText("/tmp/decompiled.cs", code);
```

### dnSpy / dnSpyEx (Windows — use in Windows container)

Best .NET debugger-decompiler, but Windows-only. Run in the dockur/windows container (see `security-pentest` reference `windows-container-setup.md`):

```
# Inside Windows container, download dnSpyEx
# https://github.com/dnSpyEx/dnSpy/releases
# GUI: load assembly, browse types, set breakpoints, edit IL
```

### When to use which

| Target | Tool |
|--------|------|
| .NET DLL/EXE (headless decompilation) | ilspycmd |
| .NET with debugging / IL editing needed | dnSpy in Windows container |
| Unity game assemblies | ilspycmd on Assembly-CSharp.dll |
| .NET Framework (old, Windows-only deps) | dnSpy in Windows container |
| NuGet packages / .NET libraries | ilspycmd |

## JavaScript Deobfuscation

JS obfuscators transform readable source into equivalent but unreadable code. Deobfuscation recovers the original logic.

### js-beautify (formatting only — first pass)

```bash
# Install
npm install -g js-beautify

# Beautify minified/packed JS
js-beautify /path/to/obfuscated.js > /tmp/formatted.js

# Or pipe
cat obfuscated.js | js-beautify > /tmp/formatted.js
```

This only fixes formatting. It doesn't rename variables or simplify logic.

### webcrack (recommended for bundled/obfuscated apps)

```bash
# Install
npm install -g webcrack

# Deobfuscate and unbundle
webcrack /path/to/obfuscated.js -o /tmp/deobfuscated

# Handles:
# - Webpack/Browserify bundle splitting into modules
# - javascript-obfuscator / obfuscator.io reversal
# - String array decoding, control flow unflattening
# - Dead code removal, constant folding
```

### synchrony (javascript-obfuscator specific)

```bash
# Install
npm install -g deobfuscator

# Run
synchrony /path/to/obfuscated.js -o /tmp/deobfuscated.js

# Targets: javascript-obfuscator (obfuscator.io) output specifically
# Handles: string array rotation, control flow flattening, dead code injection,
#          self-defending code, debug protection, domain lock
```

### AST-based manual deobfuscation (when automated tools fail)

When obfuscation is custom or tools don't fully recover the code, use AST manipulation:

```bash
# Install
npm install -g jscodeshift

# Write a transform (example: rename hex-escaped vars)
cat > /tmp/transform.js << 'EOF'
module.exports = function(fileInfo, api) {
  const j = api.jscodeshift;
  const root = j(fileInfo.source);
  // Replace computed member expressions with dot notation where possible
  root.find(j.MemberExpression, { computed: true })
    .filter(p => p.value.property.type === 'Literal' && /^[a-zA-Z_$][\w$]*$/.test(p.value.property.value))
    .forEach(p => { p.value.computed = false; p.value.property = j.identifier(p.value.property.value); });
  return root.toSource();
};
EOF
jscodeshift -t /tmp/transform.js /path/to/obfuscated.js
```

For deeper analysis, use `@babel/parser` + `@babel/traverse` + `@babel/generator` to write custom visitors that inline constants, resolve string arrays, and simplify control flow.

### When to use which

| Scenario | Tool |
|----------|------|
| Minified but not obfuscated | js-beautify |
| Webpack/Browserify bundle | webcrack |
| obfuscator.io / javascript-obfuscator | synchrony, then webcrack |
| Custom obfuscation | AST transforms (jscodeshift / babel) |
| Packed (eval-based) | Run in Node with hooked eval, then beautify |

### Eval-based unpacking

Some JS is "packed" — the real code is a string that gets `eval()`'d at runtime:

```bash
# Replace eval with console.log to extract the real code
node -e "
  const fs = require('fs');
  let code = fs.readFileSync('/path/to/packed.js', 'utf8');
  const fakeEval = (s) => { fs.writeFileSync('/tmp/unpacked.js', s); return s; };
  const origEval = global.eval;
  global.eval = fakeEval;
  try { origEval(code); } catch(e) {}
"
js-beautify /tmp/unpacked.js > /tmp/unpacked-formatted.js
```

## Electron Apps (.asar / unpacked)

Electron apps bundle a Node.js app inside Chromium. The app source is in an ASAR archive — essentially a tar file.

### Extract ASAR

```bash
# Install
npm install -g @electron/asar

# Extract the app archive
asar extract /path/to/app.asar /tmp/electron-extracted

# Common locations:
# macOS: /Applications/AppName.app/Contents/Resources/app.asar
# Windows: C:\Program Files\AppName\resources\app.asar
# Linux: /opt/appname/resources/app.asar
```

### Deobfuscate extracted JS

Most Electron apps ship minified or webpack-bundled JS:

```bash
# Unbundle and deobfuscate
webcrack /tmp/electron-extracted/dist/main.js -o /tmp/electron-deobf

# Or if it's just minified
js-beautify /tmp/electron-extracted/main.js > /tmp/electron-formatted.js
```

### What to look for

- `nodeIntegration: true` in BrowserWindow options — full Node.js access from renderer (RCE via XSS)
- `contextIsolation: false` — renderer can access Node.js globals
- `preload` scripts — bridge between web and Node contexts, often expose dangerous APIs
- IPC handlers (`ipcMain.handle`, `ipcMain.on`) — check what privileged operations the renderer can trigger
- `shell.openExternal()` with user input — command injection
- Hardcoded API keys, tokens, OAuth secrets in the JS bundle
- `webSecurity: false` — disables same-origin policy
- Custom protocol handlers (`protocol.registerHttpProtocol`) — SSRF, path traversal

### V8 bytecode (compiled Electron apps)

Some Electron apps compile JS to V8 bytecode (.jsc files) using `bytenode`:

```bash
# Check for .jsc files
find /tmp/electron-extracted -name "*.jsc"

# Decompile V8 bytecode (partial recovery)
# No perfect decompiler exists — use v8-bytecode-analyzer for structure
npm install -g v8-bytecode-analyzer
# Then analyze with Ghidra + V8 processor module for deep analysis
```

V8 bytecode decompilation is lossy. Focus on string extraction, API call patterns, and IPC channel names rather than full source recovery.

## iOS Apps (.ipa)

IPA files are ZIP archives containing a Mach-O binary plus resources.

### Extract and decrypt

```bash
# Extract IPA
unzip /path/to/app.ipa -d /tmp/ios-extracted

# The binary is at:
# /tmp/ios-extracted/Payload/AppName.app/AppName

# App Store binaries are encrypted (FairPlay DRM)
# If encrypted, you need a jailbroken device + frida-ios-dump or bagbak to dump decrypted binary
# For testing your own apps or already-decrypted binaries, proceed directly
```

### Swift / Objective-C class dump

```bash
# Install
brew install class-dump

# Dump ObjC headers (works on non-Swift or mixed binaries)
class-dump /tmp/ios-extracted/Payload/AppName.app/AppName > /tmp/ios-headers.h

# For Swift-heavy binaries, class-dump may miss Swift classes
# Use dsdump instead:
brew install dsdump
dsdump --swift /tmp/ios-extracted/Payload/AppName.app/AppName
```

### Decompile with Ghidra

For the actual implementation (not just headers), use the standard Ghidra pipeline on the Mach-O binary. Ghidra handles ARM64 Mach-O natively.

### What to look for

- **Keychain usage** — are secrets stored with appropriate protection levels (`kSecAttrAccessibleWhenUnlockedThisDeviceOnly`)?
- **URL schemes** — custom URL handlers in Info.plist, check for injection in handler code
- **Universal Links** — associated domains, AASA file validation
- **App Transport Security** — exceptions in Info.plist (`NSAllowsArbitraryLoads`)
- **Pasteboard usage** — sensitive data copied to shared pasteboard
- **WebView configuration** — `WKWebView` with JS enabled, `evaluateJavaScript` with user input
- **Certificate pinning** — check for TrustKit, URLSession delegate, or no pinning at all
- **Embedded frameworks** — third-party dylibs in `Frameworks/` directory, each a separate audit target
- **Entitlements** — `ldid -e binary` or `codesign -d --entitlements - binary` to see capabilities

## Android Apps (expanded)

Beyond JADX (covered above), additional tools for thorough Android RE:

### Smali (low-level DEX disassembly)

```bash
# Install
brew install apktool

# Disassemble APK to smali + resources
apktool d /path/to/app.apk -o /tmp/android-smali

# Reassemble (for patching)
apktool b /tmp/android-smali -o /tmp/patched.apk
```

Smali is useful when JADX can't decompile a method — you get the raw Dalvik instructions.

### What to look for

- **AndroidManifest.xml** — exported components, permissions, `android:debuggable`, `android:allowBackup`
- **Network security config** — `res/xml/network_security_config.xml`, cleartext traffic, custom trust anchors
- **Content providers** — exported providers without permission checks, SQL injection in query()
- **Broadcast receivers** — exported receivers that trigger privileged actions
- **WebView** — `setJavaScriptEnabled(true)` + `addJavascriptInterface` = RCE on older Android
- **Native libraries** — `.so` files in `lib/` directories, decompile with Ghidra (ARM/ARM64 ELF)
- **Firebase config** — `google-services.json` with project IDs, check for open Firestore/RTDB rules
- **Hardcoded secrets** — `strings` on DEX, grep for API keys, tokens, URLs

## WebAssembly (.wasm)

### Decompile to readable form

```bash
# Install WebAssembly Binary Toolkit
brew install wabt

# Disassemble to WAT (WebAssembly Text Format)
wasm2wat /path/to/module.wasm -o /tmp/module.wat

# Decompile to pseudo-C (more readable)
wasm-decompile /path/to/module.wasm -o /tmp/module.dcmp

# Convert to C source (compilable, but verbose)
wasm2c /path/to/module.wasm -o /tmp/module.c
```

### Ghidra for WASM

Ghidra supports WASM via the `ghidra-wasm-plugin`. After loading, you get the standard Ghidra decompilation to C with function names (if not stripped).

### What to look for

- **Exported functions** — the attack surface visible to JavaScript
- **Memory operations** — WASM has linear memory; buffer overflows are possible
- **Imported functions** — what host APIs does the WASM module call?
- **String constants** — extract with `strings` or search in WAT for `data` segments
- **Crypto implementations** — WASM is often used for client-side crypto; check for weak algorithms

## OS Internals

### Windows PE / System DLLs

Use Ghidra for native PE analysis. For .NET system assemblies, use ilspycmd. Key targets:

- **System services** — `C:\Windows\System32\svchost.dll` and service DLLs
- **Drivers** — `.sys` files in `C:\Windows\System32\drivers\`
- **COM objects** — registered in registry, implement `IUnknown`; type confusion in `QueryInterface`
- **WinAPI wrappers** — `ntdll.dll`, `kernel32.dll`, `advapi32.dll`

### Linux kernel modules

```bash
# Decompile .ko file with Ghidra (standard ELF pipeline)
# Key functions to find: module_init, module_exit, ioctl handlers, file_operations structs
# Look for: copy_from_user/copy_to_user without bounds checks, missing lock acquisition
```

### macOS kexts / System Extensions

```bash
# Kexts are Mach-O bundles
# Extract from /System/Library/Extensions/ or /Library/Extensions/
# Modern macOS uses System Extensions (userspace) instead of kexts
# Decompile with Ghidra (Mach-O)
# Focus on: IOKit UserClient methods, entitlement checks, sandbox policy
```

## Pipeline Integration

After decompiling managed code, hand off to `security-audit` the same way as Ghidra-decompiled C:

1. Decompile to source files in `/tmp/decompiled-{target}/`
2. Run `security-audit` against the output directory
3. The adversarial trio (finders, disprovers, referees) works on recovered source the same way it works on original source

Recovered source from managed languages is typically higher quality than Ghidra's C output — you get real class names, method signatures, string literals, and exception handling. This makes the audit more effective.
