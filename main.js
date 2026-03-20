const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron')
const path = require('path')
const { spawn } = require('child_process')
const fs = require('fs')
const https = require('https')
const os = require('os')

let win
let stopRequested = false
let downloadProcess = null
const isMac = process.platform === 'darwin'

function createWindow() {
  win = new BrowserWindow({
    width: 960, height: 860, minWidth: 800, minHeight: 720,
    frame: false,
    backgroundColor: '#f9f8f6',
    titleBarStyle: isMac ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, nodeIntegration: false
    }
  })
  win.loadFile('index.html')
  win.webContents.on('did-finish-load', () => {
    // Send platform info to renderer
    win.webContents.send('platform', process.platform)
    checkForUpdates()
  })
}

app.whenReady().then(createWindow)

// macOS: don't quit when all windows closed
app.on('window-all-closed', () => {
  if (!isMac) app.quit()
})
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

// ── Auto updater ─────────────────────────────────────────────────────────────
function checkForUpdates() {
  const currentVersion = app.getVersion()
  const req = https.get({
    hostname: 'api.github.com',
    path: '/repos/brabecmarek-prog/melodown/releases/latest',
    headers: { 'User-Agent': 'Melodown-App', 'Accept': 'application/vnd.github.v3+json' }
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
            releaseUrl: release.html_url
          })
        }
      } catch (e) {}
    })
  })
  req.on('error', () => {})
  req.setTimeout(8000, () => req.destroy())
}

function isNewerVersion(latest, current) {
  const parse = v => v.split('.').map(Number)
  const [lMaj, lMin, lPatch] = parse(latest)
  const [cMaj, cMin, cPatch] = parse(current)
  if (lMaj !== cMaj) return lMaj > cMaj
  if (lMin !== cMin) return lMin > cMin
  return lPatch > cPatch
}

ipcMain.on('download-update', (_, url) => shell.openExternal(url))
ipcMain.on('dismiss-update', () => win.webContents.send('update-dismissed'))

// ── Window controls ──────────────────────────────────────────────────────────
ipcMain.on('win-minimize', () => win.minimize())
ipcMain.on('win-maximize', () => win.isMaximized() ? win.unmaximize() : win.maximize())
ipcMain.on('win-close', () => win.close())

// ── Dialogs ──────────────────────────────────────────────────────────────────
ipcMain.handle('pick-folder', async () => {
  const res = await dialog.showOpenDialog(win, { properties: ['openDirectory'] })
  return res.canceled ? null : res.filePaths[0]
})

ipcMain.handle('pick-file', async () => {
  const res = await dialog.showOpenDialog(win, {
    filters: [{ name: 'Text/CSV', extensions: ['txt', 'csv'] }],
    properties: ['openFile']
  })
  if (res.canceled) return null
  const filePath = res.filePaths[0]
  const lines = fs.readFileSync(filePath, 'utf-8').split('\n')
    .map(l => l.trim().split(',')[0].trim())
    .filter(l => l && !l.startsWith('#'))
  return { path: filePath, name: path.basename(filePath), songs: lines }
})

ipcMain.on('open-folder', (_, p) => {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true })
  shell.openPath(p)
})

// ── HTTP helper ───────────────────────────────────────────────────────────────
function httpGet(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location)
        return httpGet(res.headers.location).then(resolve).catch(reject)
      let data = ''
      res.setEncoding('utf8')
      res.on('data', chunk => { data += chunk })
      res.on('end', () => resolve(data))
    })
    req.on('error', reject)
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('Timeout')) })
  })
}

async function fetchSpotify(url) {
  const match = url.match(/playlist\/([A-Za-z0-9]+)/)
  if (!match) throw new Error('No playlist ID found in URL')
  const html = await httpGet(`https://open.spotify.com/embed/playlist/${match[1]}`)
  const m = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/)
  if (!m) throw new Error('Could not parse Spotify page')
  const data = JSON.parse(m[1])
  const items = data.props.pageProps.state.data.entity.trackList
  return items.map(i => i.title && i.subtitle ? `${i.subtitle} & ${i.title}` : i.title).filter(Boolean)
}

async function fetchYTMusic(url) {
  const match = url.match(/[?&]list=([A-Za-z0-9_-]+)/)
  if (!match) throw new Error('No playlist ID found in URL')
  const html = await httpGet(`https://www.youtube.com/playlist?list=${match[1]}`)
  const m = html.match(/ytInitialData\s*=\s*(\{[\s\S]*?\});\s*<\/script>/)
  if (!m) throw new Error('Could not parse YouTube page')
  const data = JSON.parse(m[1])
  const contents = data.contents.twoColumnBrowseResultsRenderer.tabs[0]
    .tabRenderer.content.sectionListRenderer.contents[0]
    .itemSectionRenderer.contents[0].playlistVideoListRenderer.contents
  return contents.map(item => {
    const v = item.playlistVideoRenderer || {}
    const t = ((v.title || {}).runs || [{}])[0].text || ''
    const a = ((v.shortBylineText || {}).runs || [{}])[0].text || ''
    return (t && a) ? `${a} & ${t}` : t
  }).filter(Boolean)
}

ipcMain.handle('fetch-playlist', async (_, { url, source }) => {
  try {
    const songs = source === 'spotify' ? await fetchSpotify(url) : await fetchYTMusic(url)
    return { ok: true, songs }
  } catch (e) {
    return { ok: false, error: e.message }
  }
})

// ── Download ──────────────────────────────────────────────────────────────────
ipcMain.handle('start-download', async (_, { songs, outputDir }) => {
  stopRequested = false
  fs.mkdirSync(outputDir, { recursive: true })
  const total = songs.length
  let completed = 0, failed = 0

  for (let i = 0; i < songs.length; i++) {
    if (stopRequested) {
      win.webContents.send('download-stopped', { completed, failed, total })
      return
    }
    const song = songs[i]
    win.webContents.send('download-progress', { song, index: i, total, completed, failed })

    await new Promise((resolve) => {
      // On macOS yt-dlp may be installed via Homebrew at /usr/local/bin or /opt/homebrew/bin
      const ytdlp = isMac ? 'yt-dlp' : 'yt-dlp'
      const args = [
        '-x', '--audio-format', 'mp3', '--audio-quality', '192K',
        '--add-metadata', '--no-playlist', '--quiet', '--no-warnings',
        '-o', path.join(outputDir, '%(title)s [%(id)s].%(ext)s'),
        `ytsearch1:${song} audio`
      ]
      downloadProcess = spawn(ytdlp, args, {
        shell: true,
        env: {
          ...process.env,
          PATH: process.env.PATH + (isMac ? ':/usr/local/bin:/opt/homebrew/bin' : '')
        }
      })
      const done = (code) => {
        if (code === 0) { completed++; win.webContents.send('download-song-done', { song, success: true, completed, failed, total }) }
        else            { failed++;    win.webContents.send('download-song-done', { song, success: false, completed, failed, total }) }
        resolve()
      }
      downloadProcess.on('close', done)
      downloadProcess.on('error', () => done(1))
    })
  }
  win.webContents.send('download-complete', { completed, failed, total, outputDir })
})

ipcMain.on('stop-download', () => {
  stopRequested = true
  if (downloadProcess) downloadProcess.kill()
})
