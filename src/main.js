const { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain } = require('electron');
const path = require('path');
const os = require('os');
const fs = require('fs');

let mainWindow;
let tray;
let isQuitting = false;

app.on('before-quit', () => { isQuitting = true; });

// Log to file for debugging packaged app
const logFile = path.join(os.homedir(), '.xclaud', 'app.log');
function log(msg) {
  try {
    const dir = path.dirname(logFile);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(logFile, `[${new Date().toISOString()}] ${msg}\n`);
  } catch {}
  console.log(msg);
}

app.whenReady().then(() => {
  log('App ready. isPackaged=' + app.isPackaged);
  log('__dirname=' + __dirname);
  log('resourcesPath=' + process.resourcesPath);
  createWindow();
  createTray();
}).catch(err => {
  log('ERROR in whenReady: ' + String(err));
});

// FIX #2: Reabrir ventana desde Dock en macOS
app.on('activate', () => {
  if (mainWindow) mainWindow.show();
});

function createWindow() {
  log('Creating window...');
  mainWindow = new BrowserWindow({
    width: 720,
    height: 560,
    show: true,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#0a0a0a',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  const htmlPath = path.join(__dirname, 'index.html');
  log('Loading HTML from: ' + htmlPath);
  mainWindow.loadFile(htmlPath).catch(err => log('ERROR loading HTML: ' + String(err)));

  mainWindow.on('close', (e) => {
    if (isQuitting) return;
    e.preventDefault();
    mainWindow.hide();
  });

  mainWindow.webContents.on('did-fail-load', (e, code, desc) => {
    log('ERROR did-fail-load: ' + code + ' ' + desc);
  });
}

function createTray() {
  log('Creating tray...');
  try {
    // FIX #1: Icono visible del tray
    // Crear un icono de 1x1 pixel transparente como base
    const icon = nativeImage.createFromDataURL('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==');
    tray = new Tray(icon);
    // Usar emoji como icono visible en la barra de menú
    tray.setTitle('⚡');
    tray.setToolTip('xCLAUDE');
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: 'Open xCLAUDE', click: () => mainWindow?.show() },
      { type: 'separator' },
      { label: 'Quit', click: () => app.exit(0) }
    ]));
    tray.on('click', () => mainWindow?.show());
    log('Tray created OK');
  } catch (err) {
    log('ERROR creating tray: ' + String(err));
  }
}

function checkIsInstalled() {
  const configPath = getClaudeConfigPath();
  if (!fs.existsSync(configPath)) return false;
  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    return !!config?.mcpServers?.xclaude;
  } catch { return false; }
}

function getClaudeConfigPath() {
  if (process.platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
  } else if (process.platform === 'win32') {
    return path.join(process.env.APPDATA || os.homedir(), 'Claude', 'claude_desktop_config.json');
  }
  return path.join(os.homedir(), '.config', 'Claude', 'claude_desktop_config.json');
}

function readAuditLog() {
  const logPath = path.join(os.homedir(), '.xclaud', 'audit.jsonl');
  if (!fs.existsSync(logPath)) return [];
  try {
    return fs.readFileSync(logPath, 'utf8')
      .trim().split('\n').filter(Boolean)
      .map(l => JSON.parse(l))
      .reverse()
      .slice(0, 100);
  } catch { return []; }
}

ipcMain.handle('get-state', async () => ({
  isInstalled: checkIsInstalled(),
  claudeFound: fs.existsSync(getClaudeConfigPath()),
  events: readAuditLog()
}));

ipcMain.handle('get-events', async () => readAuditLog());

ipcMain.handle('run-setup', async () => {
  return new Promise((resolve) => {
    const vendorDir = app.isPackaged
      ? path.join(process.resourcesPath, 'vendor')
      : path.join(__dirname, '..', 'vendor');

    log('Running setup from vendorDir: ' + vendorDir);

    const proc = require('child_process').spawn(process.execPath, [path.join(vendorDir, 'setup.js')], {
      env: { ...process.env, SG_API_KEY: 'sg_dev_local', ELECTRON_RUN_AS_NODE: '1' },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    proc.stdout.on('data', (data) => {
      const text = data.toString();
      log('setup stdout: ' + text);
      mainWindow?.webContents.send('setup-output', text);
      if (text.includes('Proceed?')) {
        proc.stdin?.write('y\n');
      }
    });
    proc.stderr.on('data', (data) => log('setup stderr: ' + data.toString()));
    proc.on('close', (code) => {
      log('setup exited with code: ' + code);
      resolve({ success: code === 0 });
    });
  });
});

ipcMain.handle('open-claude', async () => {
  if (process.platform === 'darwin') {
    require('child_process').execSync('open -a "Claude"');
  }
});
