'use strict';
// London 2100 desktop app.
// A window onto the live site. Nothing of the app itself is bundled here, so
// every update pushed to main shows up in the desktop app too. Needs internet
// (the OSM map is online anyway).

const { app, BrowserWindow, Menu, shell, nativeTheme, session } = require('electron');
const path = require('path');

const HOME = process.env.L2100_URL || 'https://haowang310.github.io/london-2100-generative-system/';
const HOME_URL = new URL(HOME);
const SITE_PREFIX = HOME_URL.origin + HOME_URL.pathname;   // pages under this path open inside the app
const isMac = process.platform === 'darwin';

// Inside = part of this app's site. Anything else (OSM credits, data sources…)
// opens in the system browser.
function isInside(url) {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && (u.origin + u.pathname).startsWith(SITE_PREFIX);
  } catch (e) { return false; }
}
function isLocalScheme(url) { return /^(blob|data|about):/.test(url); }
function openOutside(url) { if (/^(https?|mailto):/.test(url)) shell.openExternal(url); }

function windowOptions(child) {
  return {
    width: 1440,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: 'London 2100',
    backgroundColor: '#000000',
    show: !!child,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
      autoplayPolicy: 'no-user-gesture-required'   // opening films play without a click
    }
  };
}

function wire(win) {
  const wc = win.webContents;

  // window.open / target=_blank: the app's own pages get a real app window
  // (Tensor Studio → Structure Studio talks to it through window.opener);
  // everything else goes to the system browser.
  wc.setWindowOpenHandler(({ url }) => {
    if (isInside(url)) return { action: 'allow', overrideBrowserWindowOptions: windowOptions(true) };
    openOutside(url);
    return { action: 'deny' };
  });
  wc.on('did-create-window', child => wire(child));

  wc.on('will-navigate', (e, url) => {
    if (isInside(url) || isLocalScheme(url)) return;
    e.preventDefault();
    openOutside(url);
  });

  // No connection (or the site is down): show the offline page with a retry.
  wc.on('did-fail-load', (e, code, desc, url, isMainFrame) => {
    if (!isMainFrame || code === -3) return;            // -3: aborted by a newer navigation
    win.loadFile(path.join(__dirname, 'offline.html'), {
      query: { u: isInside(url) ? url : HOME, e: String(code) }
    });
  });
}

let mainWin = null;
function createMain() {
  mainWin = new BrowserWindow(windowOptions(false));
  wire(mainWin);
  const show = () => { if (mainWin && !mainWin.isDestroyed() && !mainWin.isVisible()) mainWin.show(); };
  mainWin.once('ready-to-show', show);
  setTimeout(show, 4000);
  mainWin.on('closed', () => { mainWin = null; });
  mainWin.loadURL(HOME).catch(() => {});                // failures are handled by did-fail-load
}

function goBack(w) { const h = w && w.webContents.navigationHistory; if (h && h.canGoBack()) h.goBack(); }
function goForward(w) { const h = w && w.webContents.navigationHistory; if (h && h.canGoForward()) h.goForward(); }

function buildMenu() {
  const template = [
    ...(isMac ? [{ role: 'appMenu' }] : []),
    { role: 'editMenu' },
    {
      label: 'View',
      submenu: [
        { label: 'Home', accelerator: 'CmdOrCtrl+Shift+H', click: (_, w) => w && w.loadURL(HOME).catch(() => {}) },
        { label: 'Back', accelerator: isMac ? 'Cmd+[' : 'Alt+Left', click: (_, w) => goBack(w) },
        { label: 'Forward', accelerator: isMac ? 'Cmd+]' : 'Alt+Right', click: (_, w) => goForward(w) },
        {
          label: 'Open in Browser', accelerator: 'CmdOrCtrl+Shift+O',
          click: (_, w) => { const u = w ? w.webContents.getURL() : ''; shell.openExternal(isInside(u) ? u : HOME); }
        },
        { type: 'separator' },
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    { role: 'windowMenu' }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWin) return createMain();
    if (mainWin.isMinimized()) mainWin.restore();
    mainWin.focus();
  });

  app.whenReady().then(() => {
    nativeTheme.themeSource = 'dark';                   // black title bar, like the app
    // Permissions (e.g. geolocation) only for the app's own pages.
    session.defaultSession.setPermissionRequestHandler((wc, permission, callback, details) => {
      callback(isInside(details.requestingUrl || wc.getURL()));
    });
    buildMenu();
    createMain();
    app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createMain(); });
  });

  app.on('window-all-closed', () => { if (!isMac) app.quit(); });
}
