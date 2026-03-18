const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const fsPromises = require('fs').promises;

const { pipeline } = require('stream/promises');

let mainWindow;
let fileIdCounter = 0;
let copyAbortController = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'Turbo Copy Pro',
    backgroundColor: '#f3f3f3',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile('index.html');

  // Log any renderer errors to the terminal
  mainWindow.webContents.on('did-fail-load', (e, code, desc) => {
    console.error('Failed to load:', code, desc);
  });
  mainWindow.webContents.on('render-process-gone', (e, details) => {
    console.error('Render process gone:', details);
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// Window controls
ipcMain.on('window-minimize', () => mainWindow.minimize());
ipcMain.on('window-maximize', () => {
  if (mainWindow.isMaximized()) mainWindow.unmaximize();
  else mainWindow.maximize();
});
ipcMain.on('window-close', () => mainWindow.close());

// Folder picker
ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
  });
  if (result.canceled) return null;
  return result.filePaths[0];
});

// Scan files from source folders matching patterns
ipcMain.handle('scan-files', async (event, { sourceFolders, patterns, recursive }) => {
  const files = [];
  const regexPatterns = patterns
    .split('\n')
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  function scanDir(folder, sourceRoot) {
    if (!fs.existsSync(folder)) return;
    try {
      const entries = fs.readdirSync(folder, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory() && recursive) {
          scanDir(path.join(folder, entry.name), sourceRoot);
          continue;
        }
        if (!entry.isFile()) continue;
        const fileName = entry.name;
        const matched = regexPatterns.some((pattern) => {
          try {
            const regex = new RegExp(pattern, 'i');
            return regex.test(fileName);
          } catch {
            return fileName.toLowerCase() === pattern.toLowerCase();
          }
        });
        if (matched) {
          const fullPath = path.join(folder, fileName);
          try {
            const stats = fs.statSync(fullPath);
            fileIdCounter++;
            files.push({
              id: fileIdCounter,
              name: fileName,
              source: folder,
              sourceRoot,
              relativePath: path.relative(sourceRoot, fullPath),
              fullPath,
              size: stats.size,
              modified: stats.mtime.toISOString(),
              status: 'pending',
            });
          } catch (statErr) {
            console.error(`Cannot stat ${fullPath}:`, statErr.message);
          }
        }
      }
    } catch (err) {
      console.error(`Error scanning folder ${folder}:`, err.message);
    }
  }

  for (const folder of sourceFolders) {
    scanDir(folder, folder);
  }
  return files;
});

// Abort copy
ipcMain.on('abort-copy', () => {
  if (copyAbortController) {
    copyAbortController.abort();
  }
});

// Copy a single file using streams with abort support.
// We do NOT pass the signal directly to pipeline because on Windows
// aborting a pipeline-in-progress can hang or produce unhandled stream
// errors that freeze the main process.  Instead we listen for 'abort'
// and manually destroy both streams, which makes pipeline reject with
// a normal stream-destroyed error that we then normalise to AbortError.
async function copyFileWithAbort(src, dest, signal) {
  if (signal.aborted) {
    const err = new Error('Aborted');
    err.name = 'AbortError';
    err.code = 'ABORT_ERR';
    throw err;
  }

  const readStream = fs.createReadStream(src);
  const writeStream = fs.createWriteStream(dest);

  const onAbort = () => {
    readStream.destroy();
    writeStream.destroy();
  };
  signal.addEventListener('abort', onAbort, { once: true });

  try {
    await pipeline(readStream, writeStream);
  } catch (err) {
    // Clean up partial file on any error (abort or otherwise)
    await fsPromises.unlink(dest).catch(() => {});
    if (signal.aborted) {
      const abortErr = new Error('Aborted');
      abortErr.name = 'AbortError';
      abortErr.code = 'ABORT_ERR';
      throw abortErr;
    }
    throw err;
  } finally {
    signal.removeEventListener('abort', onAbort);
  }
}

// Copy files to destination folders
ipcMain.handle('copy-files', async (event, { files, destFolders, overwrite, recursive }) => {
  const results = [];
  const totalOps = files.length * destFolders.length;
  let completed = 0;

  copyAbortController = new AbortController();
  const { signal } = copyAbortController;

  for (const file of files) {
    if (signal.aborted) break;
    for (const dest of destFolders) {
      if (signal.aborted) break;
      const copyName = file.renameTo || file.name;
      let destPath;
      if (recursive && file.relativePath) {
        const relDir = path.dirname(file.relativePath);
        destPath = relDir === '.' ? path.join(dest, copyName) : path.join(dest, relDir, copyName);
      } else {
        destPath = path.join(dest, copyName);
      }
      const destDir = path.dirname(destPath);
      try {
        // Use async I/O so the main-process event loop stays free for
        // IPC messages (including abort-copy) and window message pumping.
        await fsPromises.mkdir(destDir, { recursive: true });

        if (!overwrite) {
          try {
            await fsPromises.access(destPath);
            // File exists – skip
            completed++;
            mainWindow.webContents.send('copy-progress', {
              fileId: file.id,
              dest,
              progress: Math.round((completed / totalOps) * 100),
              completed,
              total: totalOps,
              status: 'skipped',
            });
            results.push({ fileId: file.id, dest, status: 'skipped' });
            continue;
          } catch {
            // File does not exist – proceed with copy
          }
        }

        // Yield to event loop so IPC abort messages can be processed
        await new Promise(resolve => setImmediate(resolve));
        if (signal.aborted) break;

        await copyFileWithAbort(file.fullPath, destPath, signal);
        completed++;
        mainWindow.webContents.send('copy-progress', {
          fileId: file.id,
          dest,
          progress: Math.round((completed / totalOps) * 100),
          completed,
          total: totalOps,
          status: 'copied',
        });
        results.push({ fileId: file.id, dest, status: 'copied' });
      } catch (err) {
        if (err.name === 'AbortError' || err.code === 'ABORT_ERR') break;
        completed++;
        mainWindow.webContents.send('copy-progress', {
          fileId: file.id,
          dest,
          progress: Math.round((completed / totalOps) * 100),
          completed,
          total: totalOps,
          status: 'error',
          error: err.message,
        });
        results.push({ fileId: file.id, dest, status: 'error', error: err.message });
      }
    }
  }

  if (signal.aborted) {
    mainWindow.webContents.send('copy-aborted');
  }
  copyAbortController = null;

  return results;
});


