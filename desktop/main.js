// Dobbo desktop-app: een eigen venster rond dobbo.be/app. Updates van de app komen dus vanzelf mee.
const { app, BrowserWindow, Menu, shell, nativeTheme } = require('electron');
const path = require('path');

const START = 'https://dobbo.be/app/';
const isApp = (url) => { try { const u = new URL(url); return u.origin === 'https://dobbo.be' && u.pathname.startsWith('/app'); } catch { return false; } };

if (!app.requestSingleInstanceLock()) app.quit();
nativeTheme.themeSource = 'light';
app.setName('Dobbo');

let win;
function createWindow() {
  win = new BrowserWindow({
    width: 1280, height: 840, minWidth: 380, minHeight: 560,
    title: 'Dobbo', backgroundColor: '#F5F7FC', show: false,
    icon: path.join(__dirname, 'build', process.platform === 'win32' ? 'icon-win.png' : 'icon.png'),
    webPreferences: { contextIsolation: true, sandbox: true, spellcheck: true },
  });
  win.once('ready-to-show', () => win.show());

  // Links buiten de app (je site, een klantensite, mailto) openen in je gewone browser.
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^(https?|mailto|tel):/.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => { if (!isApp(url)) { e.preventDefault(); shell.openExternal(url); } });

  // Geen internet: rustige melding met opnieuw proberen.
  win.webContents.on('did-fail-load', (_e, code, _d, url) => {
    if (code === -3 || !isApp(url)) return; // -3 = afgebroken navigatie
    win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(`<!doctype html><meta charset="utf-8"><body style="margin:0;height:100vh;display:grid;place-items:center;background:#F5F7FC;font:16px system-ui;color:#141A33"><div style="text-align:center"><p style="font-weight:600">Geen verbinding met Dobbo</p><p style="color:#7C859F">Controleer je internet.</p><button onclick="location.href='${START}'" style="margin-top:12px;font:inherit;font-weight:600;border:0;border-radius:12px;padding:10px 18px;background:#2B5CFF;color:#fff;cursor:pointer">Opnieuw proberen</button></div></body>`));
  });

  win.loadURL(START);
}

const isMac = process.platform === 'darwin';
Menu.setApplicationMenu(Menu.buildFromTemplate([
  ...(isMac ? [{ role: 'appMenu', label: 'Dobbo' }] : []),
  { label: 'Bewerk', submenu: [{ role: 'undo', label: 'Ongedaan maken' }, { role: 'redo', label: 'Opnieuw' }, { type: 'separator' }, { role: 'cut', label: 'Knippen' }, { role: 'copy', label: 'Kopiëren' }, { role: 'paste', label: 'Plakken' }, { role: 'selectAll', label: 'Alles selecteren' }] },
  { label: 'Weergave', submenu: [{ role: 'reload', label: 'Vernieuwen' }, { type: 'separator' }, { role: 'resetZoom', label: 'Ware grootte' }, { role: 'zoomIn', label: 'Inzoomen' }, { role: 'zoomOut', label: 'Uitzoomen' }, { type: 'separator' }, { role: 'togglefullscreen', label: 'Volledig scherm' }] },
  { label: 'Venster', submenu: [{ role: 'minimize', label: 'Minimaliseren' }, ...(isMac ? [{ role: 'zoom', label: 'Zoomen' }, { role: 'front', label: 'Alles naar voren' }] : [{ role: 'close', label: 'Sluiten' }])] },
]));

app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
app.whenReady().then(createWindow);
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
app.on('window-all-closed', () => { if (!isMac) app.quit(); });
