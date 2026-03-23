const fs = require('fs')
const os = require('os')
const path = require('path')

function getYtdlpPath(platform = process.platform) {
  if (platform === 'win32') {
    const winPaths = [
      path.join(os.homedir(), 'bin', 'yt-dlp.exe'),
      path.join(os.homedir(), 'AppData', 'Local', 'Programs', 'yt-dlp', 'yt-dlp.exe'),
      path.join(os.homedir(), 'AppData', 'Local', 'Programs', 'Python', 'Scripts', 'yt-dlp.exe'),
      path.join(os.homedir(), 'AppData', 'Local', 'Python', 'pythoncore-3.14-64', 'Scripts', 'yt-dlp.exe'),
      path.join(os.homedir(), 'AppData', 'Roaming', 'Python', 'Scripts', 'yt-dlp.exe'),
      'C:\\Python312\\Scripts\\yt-dlp.exe',
      'C:\\Python311\\Scripts\\yt-dlp.exe',
      'C:\\Python310\\Scripts\\yt-dlp.exe',
    ]

    for (const candidate of winPaths) {
      if (fs.existsSync(candidate)) return candidate
    }

    return 'yt-dlp'
  }

  const unixPaths = [
    '/opt/homebrew/bin/yt-dlp',
    '/usr/local/bin/yt-dlp',
    '/usr/bin/yt-dlp',
  ]

  for (const candidate of unixPaths) {
    if (fs.existsSync(candidate)) return candidate
  }

  return 'yt-dlp'
}

function getDownloadOutputTemplate(outputDir, platform = process.platform) {
  if (platform === 'win32') {
    return path.win32.join(outputDir, '%(title)s [%(id)s].%(ext)s')
  }

  return path.posix.join(outputDir, '%(title)s [%(id)s].%(ext)s')
}

module.exports = {
  getDownloadOutputTemplate,
  getYtdlpPath,
}
