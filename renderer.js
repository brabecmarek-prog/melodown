// ── State ─────────────────────────────────────────────────────────────────
let outputDir = ''  // set dynamically from main process
let isDownloading = false
let fileLoaded = null
let songs = []
let updateDownloadUrl = ''

const $ = id => document.getElementById(id)

// ── Single DOMContentLoaded ───────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  $('outputPath').textContent = outputDir
  setupListeners()
  renderSongList()
})

function setupListeners() {
  // Window controls
  $('btnMin').onclick   = () => window.api.minimize()
  $('btnMax').onclick   = () => window.api.maximize()
  $('btnClose').onclick = () => window.api.close()

  // Tabs
  document.querySelectorAll('.tab').forEach(btn => {
    btn.onclick = () => switchTab(btn.dataset.tab)
  })

  // Checklist toolbar
  $('checkAll').onclick   = () => { songs.forEach(s => s.checked = true);  renderSongList() }
  $('uncheckAll').onclick = () => { songs.forEach(s => s.checked = false); renderSongList() }
  $('clearList').onclick  = () => { songs = []; renderSongList() }

  // Inline add
  $('addInput').onkeydown = (e) => {
    if (e.key === 'Enter') {
      const val = $('addInput').value.trim()
      if (val) {
        songs.push({ text: val, checked: true })
        $('addInput').value = ''
        renderSongList()
        scrollListToBottom()
      }
    }
  }

  // Paste → add to list
  $('loadFromPaste').onclick = () => {
    const lines = ($('songInput').value || '').split('\n')
      .map(l => l.trim()).filter(l => l && !l.startsWith('#'))
    if (lines.length) {
      lines.forEach(l => songs.push({ text: l, checked: true }))
      renderSongList()
      switchTab('list')
    }
  }

  // File → add to list
  $('loadFromFile').onclick = () => {
    if (fileLoaded && fileLoaded.songs.length) {
      fileLoaded.songs.forEach(l => songs.push({ text: l, checked: true }))
      renderSongList()
      switchTab('list')
    }
  }

  // File browse
  $('browseFile').onclick = browseFile

  // Output
  $('changeOutput').onclick  = changeOutput
  $('openOutput').onclick    = () => window.api.openFolder(outputDir)
  $('openFolderBtn').onclick = () => window.api.openFolder(outputDir)

  // Import
  $('spImport').onclick = () => importPlaylist('spotify', $('spUrl').value.trim())
  $('ytImport').onclick = () => importPlaylist('ytmusic', $('ytUrl').value.trim())

  // Download / Stop
  $('downloadBtn').onclick = startDownload
  $('stopBtn').onclick     = stopDownload

  // Update banner buttons
  $('updateInstallBtn').onclick = () => window.api.downloadUpdate(updateDownloadUrl)
  $('updateDismissBtn').onclick = () => {
    $('updateBanner').style.display = 'none'
    window.api.dismissUpdate()
  }

  // Events from main process
  window.api.on('download-progress',  onProgress)
  window.api.on('download-song-done', onSongDone)
  window.api.on('download-complete',  onComplete)
  window.api.on('download-stopped',   onStopped)
  window.api.on('download-log',       (msg) => log(msg, 'log-muted'))
  window.api.on('set-output-dir', (dir) => { outputDir = dir; $('outputPath').textContent = dir })
  window.api.on('update-available',   onUpdateAvailable)
  window.api.on('update-dismissed',   () => { $('updateBanner').style.display = 'none' })
}

// ── Update banner ─────────────────────────────────────────────────────────
function onUpdateAvailable({ currentVersion, latestVersion, downloadUrl }) {
  updateDownloadUrl = downloadUrl
  $('updateVersion').textContent = latestVersion
  $('currentVersion').textContent = currentVersion
  $('updateBanner').style.display = 'flex'
}

// ── Tabs ──────────────────────────────────────────────────────────────────
function switchTab(tab) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'))
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'))
  document.querySelector(`[data-tab="${tab}"]`).classList.add('active')
  $('panel' + tab.charAt(0).toUpperCase() + tab.slice(1)).classList.add('active')
}

// ── Song list render ──────────────────────────────────────────────────────
function renderSongList() {
  const list = $('songList')
  const empty = $('emptyState')

  if (songs.length === 0) {
    list.innerHTML = ''
    list.appendChild(empty)
    $('songCount').textContent = ''
    $('checkedCount').textContent = ''
    return
  }

  // Safely remove empty state if present anywhere in DOM
  if (empty && empty.parentNode) empty.parentNode.removeChild(empty)

  // Rebuild list cleanly
  list.innerHTML = ''
  songs.forEach((song, i) => {
    const row = createSongRow()
    list.appendChild(row)
    updateSongRow(row, song, i)
  })

  updateCounts()
}

function createSongRow() {
  const item = document.createElement('div')
  item.className = 'song-item'
  item.innerHTML = `
    <input type="checkbox" class="song-checkbox">
    <span class="song-label"></span>
    <span class="song-status"></span>
    <button class="song-remove" title="Remove">&#10005;</button>
  `
  return item
}

function updateSongRow(item, song, i) {
  const cb     = item.querySelector('.song-checkbox')
  const label  = item.querySelector('.song-label')
  const status = item.querySelector('.song-status')
  const remove = item.querySelector('.song-remove')

  // Update content
  cb.checked = song.checked
  label.textContent  = song.text
  status.textContent = song.statusIcon || ''

  // Update classes
  item.className = 'song-item'
  if (song.checked)            item.classList.add('checked')
  if (song.state === 'downloading') item.classList.add('downloading')
  if (song.state === 'ok')     item.classList.add('done-ok')
  if (song.state === 'err')    item.classList.add('done-err')

  // Clone to remove old listeners
  const newCb = cb.cloneNode(true)
  newCb.checked = song.checked
  cb.replaceWith(newCb)

  const newRemove = remove.cloneNode(true)
  remove.replaceWith(newRemove)

  // Fresh listeners
  newCb.addEventListener('change', () => {
    songs[i].checked = newCb.checked
    item.classList.toggle('checked', newCb.checked)
    updateCounts()
  })

  item.onclick = (e) => {
    if (e.target === newCb || e.target === newRemove) return
    newCb.checked = !newCb.checked
    songs[i].checked = newCb.checked
    item.classList.toggle('checked', newCb.checked)
    updateCounts()
  }

  newRemove.onclick = (e) => {
    e.stopPropagation()
    songs.splice(i, 1)
    renderSongList()
  }
}

function updateCounts() {
  const checked = songs.filter(s => s.checked).length
  const total = songs.length
  $('songCount').textContent = total ? `${total} song${total !== 1 ? 's' : ''}` : ''
  $('checkedCount').textContent = checked ? `${checked} of ${total} selected` : 'none selected'
}

function scrollListToBottom() {
  const list = $('songList')
  list.scrollTop = list.scrollHeight
}

// ── File browse ───────────────────────────────────────────────────────────
async function browseFile() {
  const result = await window.api.pickFile()
  if (!result) return
  fileLoaded = result
  $('fileName').textContent = result.name
  $('filePreview').value = result.songs.slice(0, 30).join('\n') +
    (result.songs.length > 30 ? `\n… and ${result.songs.length - 30} more` : '')
}

// ── Output ────────────────────────────────────────────────────────────────
async function changeOutput() {
  const folder = await window.api.pickFolder()
  if (folder) {
    outputDir = folder
    $('outputPath').textContent = folder
  }
}

// ── Import ────────────────────────────────────────────────────────────────
async function importPlaylist(source, url) {
  if (!url) {
    alert(`Please paste a ${source === 'spotify' ? 'Spotify' : 'YouTube Music'} playlist URL first.`)
    return
  }
  setStatus(source === 'spotify' ? 'fetching spotify…' : 'fetching yt music…',
            source === 'spotify' ? 'var(--spotify)' : 'var(--ytred)')
  setProgress(0, `Fetching from ${source === 'spotify' ? 'Spotify' : 'YouTube Music'}…`)

  const res = await window.api.fetchPlaylist({ url, source })

  if (res && res.ok && res.songs && res.songs.length) {
    res.songs.forEach(s => songs.push({ text: s, checked: true }))
    renderSongList()
    switchTab('list')
    setProgress(0, `Imported ${res.songs.length} songs`)
    log(`✓  Imported ${res.songs.length} songs from ${source === 'spotify' ? 'Spotify' : 'YouTube Music'}`, 'log-info')
    setStatus('ready', 'var(--text2)')
  } else {
    const err = (res && res.error) ? res.error : 'No songs found. Is the playlist public?'
    setProgress(0, 'Import failed')
    log(`✗  ${err}`, 'log-err')
    setStatus('error', 'var(--red)')
  }
}

// ── Download ──────────────────────────────────────────────────────────────
function startDownload() {
  if (isDownloading) return
  const selected = songs.filter(s => s.checked).map(s => s.text)
  if (!selected.length) {
    alert('No songs selected. Please check at least one song.')
    return
  }
  isDownloading = true
  songs.forEach(s => { s.state = null; s.statusIcon = null })
  renderSongList()
  $('downloadBtn').disabled = true
  $('downloadBtn').textContent = '⏳ Downloading…'
  $('stopBtn').disabled = false
  $('logBox').innerHTML = ''
  $('progressFill').className = 'progress-fill'
  $('progressFill').style.width = '0%'
  setProgress(0, `Starting — ${selected.length} songs queued`)
  setStatus(`downloading 0/${selected.length}`, 'var(--amber)')
  window.api.startDownload({ songs: selected, outputDir })
}

function stopDownload() {
  window.api.stopDownload()
  $('stopBtn').disabled = true
  setStatus('stopping…', 'var(--red)')
  setProgress(0, 'Stopping after current song…')
}

// ── Download events ───────────────────────────────────────────────────────
function onProgress({ song, index, total }) {
  setProgress(index / total, `[${index + 1}/${total}]  ${song}`)
  setStatus(`downloading ${index + 1}/${total}`, 'var(--amber)')
  const s = songs.find(x => x.text === song)
  if (s) { s.state = 'downloading'; s.statusIcon = '⏳'; renderSongList() }
}

function onSongDone({ song, success }) {
  const s = songs.find(x => x.text === song)
  if (s) { s.state = success ? 'ok' : 'err'; s.statusIcon = success ? '✓' : '✗'; renderSongList() }
  log(success ? `✓  ${song}` : `✗  ${song}`, success ? 'log-ok' : 'log-err')
}

function onComplete({ completed, failed, total, outputDir: out }) {
  $('progressFill').style.width = '100%'
  $('progressFill').classList.add('complete')
  setProgress(1, `Done — ${completed}/${total} songs downloaded`)
  log(`\n✓  Finished: ${completed}/${total} saved to ${out}`, 'log-ok')
  setStatus(`done  ${completed}/${total}`, 'var(--green)')
  resetButtons()
}

function onStopped({ completed, total }) {
  $('progressFill').classList.add('stopped')
  setProgress(0, `Stopped — ${completed}/${total} saved`)
  log(`\n■  Stopped by user — ${completed}/${total} songs saved`, 'log-err')
  setStatus(`stopped  ${completed}/${total}`, 'var(--red)')
  resetButtons()
}

// ── Helpers ───────────────────────────────────────────────────────────────
function setProgress(frac, label) {
  $('progressFill').style.width = (Math.min(Math.max(frac, 0), 1) * 100) + '%'
  $('progressLabel').textContent = label
}

function setStatus(text, color) {
  const pill = $('statusPill')
  if (!pill) return
  pill.textContent = text
  pill.style.color = color || 'var(--text2)'
  if (text === 'idle' || text === 'ready') {
    pill.classList.add('idle')
  } else {
    pill.classList.remove('idle')
  }
}

function log(text, cls) {
  const line = document.createElement('div')
  line.className = cls || 'log-muted'
  line.textContent = text
  $('logBox').appendChild(line)
  $('logBox').scrollTop = $('logBox').scrollHeight
}

function resetButtons() {
  isDownloading = false
  $('downloadBtn').disabled = false
  $('downloadBtn').textContent = '↓ Download MP3s'
  $('stopBtn').disabled = true
}
