
const { app, BrowserWindow, dialog, shell, ipcMain } = require("electron");
const { spawn, execFile } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");

const prefixRoot = path.join(app.getPath("appData"), "Kay-Y", "Prefixes");
fs.mkdirSync(prefixRoot, { recursive: true });

function createWindow() {
  const win = new BrowserWindow({
    width: 1180,
    height: 760,
    minWidth: 980,
    minHeight: 650,
    title: "Kay - Y",
    icon: path.join(__dirname, "KayYIcon.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  win.loadFile("index.html");
}

function sanitize(value) {
  return String(value).replace(/[\/\\:?%*|"<>]/g, "_").trim() || "Game";
}

function shellSplit(input) {
  const result = [];
  let current = "";
  let quote = "";
  for (const ch of String(input || "")) {
    if (ch === "'" || ch === '"') {
      if (!quote) quote = ch;
      else if (quote === ch) quote = "";
      else current += ch;
    } else if (ch === " " && !quote) {
      if (current) {
        result.push(current);
        current = "";
      }
    } else {
      current += ch;
    }
  }
  if (current) result.push(current);
  return result;
}

function findWine() {
  const candidates = [
    "/opt/homebrew/bin/wine",
    "/usr/local/bin/wine",
    "/opt/homebrew/bin/wine64",
    "/usr/local/bin/wine64",
    "/Applications/Wine.app/Contents/Resources/wine/bin/wine",
    "/Applications/Wine Stable.app/Contents/Resources/wine/bin/wine"
  ];
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) return p;
    } catch {}
  }
  return null;
}

function findGPTK() {
  const candidates = [
    "/Applications/Game Porting Toolkit.app/Contents/Resources/wine/bin/wine64",
    "/Applications/Game Porting Toolkit.app/Contents/Resources/wine/bin/wine",
    "/opt/homebrew/opt/game-porting-toolkit/bin/wine64",
    "/usr/local/opt/game-porting-toolkit/bin/wine64"
  ];
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) return p;
    } catch {}
  }
  return null;
}

function diagnose(exe) {
  let text = "";
  try {
    text = fs.readFileSync(exe).toString("utf8").toLowerCase();
  } catch {}
  if (text.includes("d3d12.dll")) {
    return {
      api: "Direct3D 12",
      summary: "Direct3D 12 imports detected. Auto mode prefers GPTK when available.",
      recommendedBackend: findGPTK() ? "GPTK" : "Wine"
    };
  }
  if (["d3d11.dll","d3d10.dll","d3d10core.dll","d3d9.dll","dxgi.dll"].some(x => text.includes(x))) {
    return {
      api: "Direct3D",
      summary: "Direct3D imports detected. Auto mode uses a gaming runtime when available.",
      recommendedBackend: findGPTK() ? "GPTK" : "Wine"
    };
  }
  return {
    api: "Unknown / non-D3D",
    summary: "No obvious Direct3D import was detected. Wine is used unless GPTK is selected.",
    recommendedBackend: "Wine"
  };
}

ipcMain.handle("pick-exe", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openFile"],
    filters: [{ name: "Windows applications", extensions: ["exe"] }]
  });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle("diagnose", async (_, exe) => diagnose(exe));

ipcMain.handle("open-folder", async (_, kind) => {
  const target = kind === "prefixes"
    ? prefixRoot
    : path.join(os.homedir(), "Applications");
  fs.mkdirSync(target, { recursive: true });
  await shell.openPath(target);
  return target;
});

ipcMain.handle("gaming-setup", async () => {
  const command = "if [[ \"$(uname -m)\" == \"arm64\" ]]; then softwareupdate --install-rosetta --agree-to-license || true; fi; if command -v brew >/dev/null 2>&1; then brew install --cask gcenx/wine/game-porting-toolkit || true; else echo 'Homebrew is not installed.'; fi; read -n 1 -s -r -p 'Press any key to close...'";
  execFile("/usr/bin/open", ["-a", "Terminal", "--args", "bash", "-lc", command]);
  return true;
});

ipcMain.handle("launch", async (_, config) => {
  const diagnosis = diagnose(config.exe);
  const useGPTK = config.backend === "GPTK" ||
    (config.backend === "Auto" && diagnosis.recommendedBackend === "GPTK");
  const wine = useGPTK ? findGPTK() : findWine();
  if (!wine) {
    throw new Error(useGPTK
      ? "Game Porting Toolkit was not found. Use Gaming Setup first."
      : "Wine was not found. Install Wine or use Gaming Setup.");
  }

  const prefix = path.join(prefixRoot, sanitize(config.prefix || path.basename(config.exe, ".exe")));
  fs.mkdirSync(prefix, { recursive: true });

  const env = { ...process.env };
  env.WINEPREFIX = prefix;
  env.WINEARCH = "win64";
  env.WINEESYNC = "1";
  env.WINEFSYNC = "1";
  env.WINEDEBUG = "fixme-all";
  if (process.arch === "arm64") env.ROSETTA_ADVERTISE_AVX = "1";
  if (useGPTK) {
    env.WINEDLLOVERRIDES = "d3d11,d3d12,d3d12core,dxgi=n,b";
    env.MTL_HUD_ENABLED = "0";
  }

  const child = spawn(wine, [config.exe, ...shellSplit(config.arguments)], {
    cwd: config.workingDirectory || path.dirname(config.exe),
    env,
    detached: false
  });

  return await new Promise((resolve) => {
    let output = "";
    child.stdout?.on("data", d => { output += d.toString(); });
    child.stderr?.on("data", d => { output += d.toString(); });
    child.on("error", e => resolve({ ok: false, message: e.message }));
    child.on("close", code => resolve({
      ok: true,
      code,
      output: `Backend: ${useGPTK ? "Game Porting Toolkit / D3DMetal" : "Wine"}\nDetected API: ${diagnosis.api}\nPrefix: ${prefix}\n\n${output}`
    }));
  });
});

ipcMain.handle("install-app", async (_, config) => {
  const appsDir = path.join(os.homedir(), "Applications");
  const displayName = path.basename(config.exe, path.extname(config.exe));
  const safe = sanitize(displayName);
  const appPath = path.join(appsDir, `${safe}.app`);
  fs.mkdirSync(path.join(appPath, "Contents", "MacOS"), { recursive: true });
  fs.mkdirSync(path.join(appPath, "Contents", "Resources"), { recursive: true });

  const launcher = `#!/bin/bash
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
CONFIG="$ROOT/Resources/Game.json"
EXE="$(/usr/bin/python3 -c 'import json; print(json.load(open("'"$CONFIG"'"))["exePath"])')"
PREFIX="$(/usr/bin/python3 -c 'import json; print(json.load(open("'"$CONFIG"'"))["prefixName"])')"
WINE="$(command -v wine64 || command -v wine)"
export WINEPREFIX="$HOME/Library/Application Support/Kay-Y/Prefixes/$PREFIX"
export WINEARCH=win64
export WINEESYNC=1
export WINEFSYNC=1
exec "$WINE" "$EXE"
`;
  const launcherPath = path.join(appPath, "Contents", "MacOS", "KayY");
  fs.writeFileSync(launcherPath, launcher);
  fs.chmodSync(launcherPath, 0o755);

  fs.writeFileSync(
    path.join(appPath, "Contents", "Resources", "Game.json"),
    JSON.stringify({
      exePath: config.exe,
      prefixName: sanitize(config.prefix || displayName)
    }, null, 2)
  );

  fs.writeFileSync(
    path.join(appPath, "Contents", "Info.plist"),
    `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>CFBundleDisplayName</key><string>${displayName}</string>
<key>CFBundleName</key><string>${displayName}</string>
<key>CFBundleExecutable</key><string>KayY</string>
<key>CFBundleIdentifier</key><string>com.viratk.kayy.game.${Date.now()}</string>
<key>CFBundlePackageType</key><string>APPL</string>
<key>CFBundleShortVersionString</key><string>1.0</string>
<key>CFBundleVersion</key><string>1</string>
</dict></plist>`
  );
  await shell.openPath(appPath);
  return appPath;
});

app.whenReady().then(createWindow);
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
