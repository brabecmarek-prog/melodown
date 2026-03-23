const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron')
const path = require('path')
const { spawn } = require('child_process')
const fs = require('fs')
const https = require('https')
const os = require('os')
const { fetchSpotifyPlaylist, fetchYouTubeMusicPlaylist } = require('./lib/playlists')
const { createSettingsStore } = require('./lib/settings')
const { isNewerVersion } = require('./lib/version')
const { getDownloadOutputTemplate, getYtdlpPath } = require('./lib/yt-dlp')

let win
let stopRequested = false
let downloadProcess = null
let settings

const isMac = process.platform === 'darwin'
const isWin = process.platform === 'win32'

function createWindow() {
  win = new BrowserWindow({
    width: 980,
    height: 920,
    minWidth: 820,
    minHeight: 780,
    frame: false,
    backgroundColor: '#f9f8f6',
    titleBarStyle: isMac ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    }
  })

  win.loadFile('index.html')
  win.webContents.on('did-finish-load', () => {
    checkForUpdates()
    const defaultOutput = path.join(os.homedir(), 'Downloads', 'Melodown')
    const outputDir = settings.get('outputDir', defaultOutput)
    win.webContents.send('set-output-dir', outputDir)
    reportYtdlpStatus()
  })
}

app.whenReady().then(() => {
  settings = createSettingsStore(app)
  createWindow()
})

app.on('window-all-closed', () => {
  if (!isMac) app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

function checkForUpdates() {
  const currentVersion = app.getVersion()
  const req = https.get({
    hostname: 'api.github.com',
    path: '/repos/brabecmarek-prog/melodown/releases/latest',
    headers: {
      'User-Agent': 'Melodown-App',
      'Accept': 'application/vnd.github.v3+json',
    }
  }, (res) => {
    let data = ''
    res.on('data', chunk => { data += chunk })
    res.on('end', () => {
      try {
        const release = JSON.parse(data)
        const latestVersion = release.tag_name.replace(/^v/, '')

        if (isNewerVersion(latestVersion, currentVersion)) {
          const platform = isMac ? 'darwin' : 'win32'
          const asset = release.assets.find(a => a.name.includes(platform) && a.name.endsWith('.zip'))
          win.webContents.send('update-available', {
            currentVersion,
            latestVersion,
            downloadUrl: asset ? asset.browser_download_url : release.html_url,
            releaseUrl: release.html_url,
          })
        }
      } catch (_) {}
    })
  })

  req.on('error', () => {})
  req.setTimeout(8000, () => req.destroy())
}

function reportYtdlpStatus() {
  const ytdlpPath = getYtdlpPath(process.platform)
  const versionProcess = spawn(ytdlpPath, ['--version'], {
    shell: false,
    env: {
      ...process.env,
      PATH: isWin
        ? process.env.PATH
        : `/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:${process.env.PATH || ''}`,
    }
  })

  let stdout = ''
  let stderr = ''

  versionProcess.stdout.on('data', data => { stdout += data.toString() })
  versionProcess.stderr.on('data', data => { stderr += data.toString() })

  versionProcess.on('close', (code) => {
    if (!win || win.isDestroyed()) return

    if (code === 0) {
      win.webContents.send('ytdlp-status', {
        ok: true,
        path: ytdlpPath,
        version: stdout.trim(),
      })
      return
    }

    win.webContents.send('ytdlp-status', {
      ok: false,
      path: ytdlpPath,
      error: stderr.trim() || `exit code ${code}`,
    })
  })

  versionProcess.on('error', (error) => {
    if (!win || win.isDestroyed()) return
    win.webContents.send('ytdlp-status', {
      ok: false,
      path: ytdlpPath,
      error: error.message,
    })
  })
}

ipcMain.on('download-update', (_, url) => shell.openExternal(url))
ipcMain.on('dismiss-update', () => win.webContents.send('update-dismissed'))

ipcMain.on('win-minimize', () => win.minimize())
ipcMain.on('win-maximize', () => win.isMaximized() ? win.unmaximize() : win.maximize())
ipcMain.on('win-close', () => win.close())

ipcMain.handle('pick-folder', async () => {
  const res = await dialog.showOpenDialog(win, { properties: ['openDirectory'] })
  return res.canceled ? null : res.filePaths[0]
})

ipcMain.handle('set-output-dir', async (_, outputDir) => {
  settings.set('outputDir', outputDir)
  return outputDir
})

ipcMain.handle('pick-file', async () => {
  const res = await dialog.showOpenDialog(win, {
    filters: [{ name: 'Text/CSV', extensions: ['txt', 'csv'] }],
    properties: ['openFile']
  })

  if (res.canceled) return null

  const filePath = res.filePaths[0]
  const lines = fs.readFileSync(filePath, 'utf-8').split('\n')
    .map(line => line.trim().split(',')[0].trim())
    .filter(line => line && !line.startsWith('#'))

  return { path: filePath, name: path.basename(filePath), songs: lines }
})

ipcMain.on('open-folder', (_, targetPath) => {
  if (!fs.existsSync(targetPath)) fs.mkdirSync(targetPath, { recursive: true })
  shell.openPath(targetPath)
})

ipcMain.handle('fetch-playlist', async (_, { url, source }) => {
  try {
    const songs = source === 'spotify'
      ? await fetchSpotifyPlaylist(url)
      : await fetchYouTubeMusicPlaylist(url)
    return { ok: true, songs }
  } catch (error) {
    return { ok: false, error: error.message }
  }
})

ipcMain.handle('start-download', async (_, { songs, outputDir }) => {
  stopRequested = false
  fs.mkdirSync(outputDir, { recursive: true })

  const total = songs.length
  let completed = 0
  let failed = 0

  for (let i = 0; i < songs.length; i += 1) {
    if (stopRequested) {
      win.webContents.send('download-stopped', { completed, failed, total })
      return
    }

    const song = songs[i]
    win.webContents.send('download-progress', { song, index: i, total, completed, failed })

    await new Promise((resolve) => {
      const ytdlpCmd = getYtdlpPath(process.platform)
      const outtmpl = getDownloadOutputTemplate(outputDir, process.platform)
      const args = [
        '-x',
        '--audio-format', 'mp3',
        '--audio-quality', '192K',
        '--add-metadata',
        '--no-playlist',
        '--js-runtime', 'node',
        '-o', outtmpl,
        `ytsearch1:${song} audio`,
      ]

      win.webContents.send('download-log', `Using yt-dlp: ${ytdlpCmd}`)
      downloadProcess = spawn(ytdlpCmd, args, {
        shell: false,
        env: {
          ...process.env,
          PATH: isWin
            ? process.env.PATH
            : `/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:${process.env.PATH || ''}`,
        }
      })

      let stderr = ''
      downloadProcess.stderr.on('data', data => { stderr += data.toString() })
      downloadProcess.stdout.on('data', data => {
        win.webContents.send('download-log', data.toString().trim())
      })

      const finish = (code) => {
        if (code === 0) {
          completed += 1
          win.webContents.send('download-song-done', {
            song,
            success: true,
            completed,
            failed,
            total,
          })
        } else {
          failed += 1
          win.webContents.send('download-song-done', {
            song,
            success: false,
            completed,
            failed,
            total,
            error: stderr,
          })
          win.webContents.send('download-log', `Error: ${stderr || `exit code ${code}`}`)
        }

        resolve()
      }

      downloadProcess.on('close', finish)
      downloadProcess.on('error', (error) => {
        win.webContents.send('download-log', `Spawn error: ${error.message}`)
        finish(1)
      })
    })
  }

  win.webContents.send('download-complete', { completed, failed, total, outputDir })
})

ipcMain.on('stop-download', () => {
  stopRequested = true
  if (downloadProcess) downloadProcess.kill()
})
