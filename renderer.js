let outputDir = ''
let isDownloading = false
let fileLoaded = null
let songs = []
let updateDownloadUrl = ''

const $ = (id) => document.getElementById(id)

document.addEventListener('DOMContentLoaded', () => {
  $('outputPath').textContent = outputDir
  setupListeners()
  renderSongList()
})

function setupListeners() {
  $('btnMin').onclick = () => window.api.minimize()
  $('btnMax').onclick = () => window.api.maximize()
  $('btnClose').onclick = () => window.api.close()

  document.querySelectorAll('.tab').forEach((button) => {
    button.onclick = () => switchTab(button.dataset.tab)
  })

  $('checkAll').onclick = () => {
    songs.forEach((song) => { song.checked = true })
    renderSongList()
  }
  $('uncheckAll').onclick = () => {
    songs.forEach((song) => { song.checked = false })
    renderSongList()
  }
  $('clearList').onclick = () => {
    songs = []
    renderSongList()
  }

  $('addInput').onkeydown = (event) => {
    if (event.key !== 'Enter') return

    const value = $('addInput').value.trim()
    if (!value) return

    songs.push({ text: value, checked: true })
    $('addInput').value = ''
    renderSongList()
    scrollListToBottom()
  }

  $('loadFromPaste').onclick = addSongsFromPaste
  $('loadFromFile').onclick = addSongsFromFile
  $('browseFile').onclick = browseFile

  $('changeOutput').onclick = changeOutput
  $('openOutput').onclick = () => window.api.openFolder(outputDir)
  $('openFolderBtn').onclick = () => window.api.openFolder(outputDir)

  $('spImport').onclick = () => importPlaylist('spotify', $('spUrl').value.trim())
  $('ytImport').onclick = () => importPlaylist('ytmusic', $('ytUrl').value.trim())

  $('downloadBtn').onclick = startDownload
  $('stopBtn').onclick = stopDownload

  $('updateInstallBtn').onclick = () => window.api.downloadUpdate(updateDownloadUrl)
  $('updateDismissBtn').onclick = () => {
    $('updateBanner').style.display = 'none'
    window.api.dismissUpdate()
  }

  window.api.on('download-progress', onProgress)
  window.api.on('download-song-done', onSongDone)
  window.api.on('download-complete', onComplete)
  window.api.on('download-stopped', onStopped)
  window.api.on('download-log', (message) => log(message, 'log-muted'))
  window.api.on('set-output-dir', (dir) => {
    outputDir = dir
    $('outputPath').textContent = dir
  })
  window.api.on('update-available', onUpdateAvailable)
  window.api.on('update-dismissed', () => {
    $('updateBanner').style.display = 'none'
  })
  window.api.on('ytdlp-status', onYtdlpStatus)
}

function onUpdateAvailable({ currentVersion, latestVersion, downloadUrl }) {
  updateDownloadUrl = downloadUrl
  $('updateVersion').textContent = latestVersion
  $('currentVersion').textContent = currentVersion
  $('updateBanner').style.display = 'flex'
}

function switchTab(tab) {
  document.querySelectorAll('.tab').forEach((item) => item.classList.remove('active'))
  document.querySelectorAll('.tab-panel').forEach((panel) => panel.classList.remove('active'))
  document.querySelector(`[data-tab="${tab}"]`).classList.add('active')
  $(`panel${tab.charAt(0).toUpperCase()}${tab.slice(1)}`).classList.add('active')
}

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

  if (empty && empty.parentNode) empty.parentNode.removeChild(empty)

  list.innerHTML = ''
  songs.forEach((song, index) => {
    const row = createSongRow()
    list.appendChild(row)
    updateSongRow(row, song, index)
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

function updateSongRow(item, song, index) {
  const checkbox = item.querySelector('.song-checkbox')
  const label = item.querySelector('.song-label')
  const status = item.querySelector('.song-status')
  const remove = item.querySelector('.song-remove')

  checkbox.checked = song.checked
  label.textContent = song.text
  status.textContent = song.statusIcon || ''

  item.className = 'song-item'
  if (song.checked) item.classList.add('checked')
  if (song.state === 'downloading') item.classList.add('downloading')
  if (song.state === 'ok') item.classList.add('done-ok')
  if (song.state === 'err') item.classList.add('done-err')

  const freshCheckbox = checkbox.cloneNode(true)
  freshCheckbox.checked = song.checked
  checkbox.replaceWith(freshCheckbox)

  const freshRemove = remove.cloneNode(true)
  remove.replaceWith(freshRemove)

  freshCheckbox.addEventListener('change', () => {
    songs[index].checked = freshCheckbox.checked
    item.classList.toggle('checked', freshCheckbox.checked)
    updateCounts()
  })

  item.onclick = (event) => {
    if (event.target === freshCheckbox || event.target === freshRemove) return
    freshCheckbox.checked = !freshCheckbox.checked
    songs[index].checked = freshCheckbox.checked
    item.classList.toggle('checked', freshCheckbox.checked)
    updateCounts()
  }

  freshRemove.onclick = (event) => {
    event.stopPropagation()
    songs.splice(index, 1)
    renderSongList()
  }
}

function updateCounts() {
  const checked = songs.filter((song) => song.checked).length
  const total = songs.length
  $('songCount').textContent = total ? `${total} song${total !== 1 ? 's' : ''}` : ''
  $('checkedCount').textContent = total ? `${checked} of ${total} selected` : ''
}

function scrollListToBottom() {
  const list = $('songList')
  list.scrollTop = list.scrollHeight
}

function addSongs(entries) {
  entries.forEach((entry) => songs.push({ text: entry, checked: true }))
  renderSongList()
}

function addSongsFromPaste() {
  const lines = ($('songInput').value || '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))

  if (!lines.length) return

  addSongs(lines)
  switchTab('list')
}

function addSongsFromFile() {
  if (!fileLoaded || !fileLoaded.songs.length) return
  addSongs(fileLoaded.songs)
  switchTab('list')
}

async function browseFile() {
  const result = await window.api.pickFile()
  if (!result) return

  fileLoaded = result
  $('fileName').textContent = result.name
  $('filePreview').value = result.songs.slice(0, 30).join('\n') +
    (result.songs.length > 30 ? `\n... and ${result.songs.length - 30} more` : '')
}

async function changeOutput() {
  const folder = await window.api.pickFolder()
  if (!folder) return

  outputDir = folder
  await window.api.setOutputDir(folder)
  $('outputPath').textContent = folder
}

async function importPlaylist(source, url) {
  if (!url) {
    alert(`Please paste a ${source === 'spotify' ? 'Spotify' : 'YouTube Music'} playlist URL first.`)
    return
  }

  setStatus(source === 'spotify' ? 'fetching spotify...' : 'fetching yt music...',
    source === 'spotify' ? 'var(--spotify)' : 'var(--ytred)')
  setProgress(0, `Fetching from ${source === 'spotify' ? 'Spotify' : 'YouTube Music'}...`)

  const result = await window.api.fetchPlaylist({ url, source })

  if (result?.ok && result.songs?.length) {
    addSongs(result.songs)
    switchTab('list')
    setProgress(0, `Imported ${result.songs.length} songs`)
    log(`Imported ${result.songs.length} songs from ${source === 'spotify' ? 'Spotify' : 'YouTube Music'}`, 'log-info')
    setStatus('ready', 'var(--text2)')
    return
  }

  const error = result?.error || 'No songs found. Is the playlist public?'
  setProgress(0, 'Import failed')
  log(`Import failed: ${error}`, 'log-err')
  setStatus('error', 'var(--red)')
}

function startDownload() {
  if (isDownloading) return

  const selected = songs.filter((song) => song.checked).map((song) => song.text)
  if (!selected.length) {
    alert('No songs selected. Please check at least one song.')
    return
  }

  isDownloading = true
  songs.forEach((song) => {
    song.state = null
    song.statusIcon = null
  })

  renderSongList()
  $('downloadBtn').disabled = true
  $('downloadBtn').textContent = 'Downloading...'
  $('stopBtn').disabled = false
  $('logBox').innerHTML = ''
  $('progressFill').className = 'progress-fill'
  $('progressFill').style.width = '0%'
  setProgress(0, `Starting - ${selected.length} songs queued`)
  setStatus(`downloading 0/${selected.length}`, 'var(--amber)')
  window.api.startDownload({ songs: selected, outputDir })
}

function stopDownload() {
  window.api.stopDownload()
  $('stopBtn').disabled = true
  setStatus('stopping...', 'var(--red)')
  setProgress(0, 'Stopping after current song...')
}

function onProgress({ song, index, total }) {
  setProgress(index / total, `[${index + 1}/${total}] ${song}`)
  setStatus(`downloading ${index + 1}/${total}`, 'var(--amber)')

  const currentSong = songs.find((item) => item.text === song)
  if (!currentSong) return

  currentSong.state = 'downloading'
  currentSong.statusIcon = '...'
  renderSongList()
}

function onSongDone({ song, success }) {
  const currentSong = songs.find((item) => item.text === song)
  if (currentSong) {
    currentSong.state = success ? 'ok' : 'err'
    currentSong.statusIcon = success ? 'OK' : 'ERR'
    renderSongList()
  }

  log(success ? `Downloaded: ${song}` : `Failed: ${song}`, success ? 'log-ok' : 'log-err')
}

function onComplete({ completed, total, outputDir: out }) {
  $('progressFill').style.width = '100%'
  $('progressFill').classList.add('complete')
  setProgress(1, `Done - ${completed}/${total} songs downloaded`)
  log(`Finished: ${completed}/${total} saved to ${out}`, 'log-ok')
  setStatus(`done ${completed}/${total}`, 'var(--green)')
  resetButtons()
}

function onStopped({ completed, total }) {
  $('progressFill').classList.add('stopped')
  setProgress(0, `Stopped - ${completed}/${total} saved`)
  log(`Stopped by user - ${completed}/${total} songs saved`, 'log-err')
  setStatus(`stopped ${completed}/${total}`, 'var(--red)')
  resetButtons()
}

function onYtdlpStatus({ ok, path, version, error }) {
  if (ok) {
    log(`yt-dlp ready: ${version} (${path})`, 'log-info')
    setStatus('ready', 'var(--text2)')
    return
  }

  log(`yt-dlp unavailable: ${error || 'unknown error'} (${path})`, 'log-err')
  setStatus('yt-dlp missing', 'var(--red)')
}

function setProgress(frac, label) {
  $('progressFill').style.width = `${Math.min(Math.max(frac, 0), 1) * 100}%`
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
  $('downloadBtn').textContent = 'Download MP3s'
  $('stopBtn').disabled = true
}
