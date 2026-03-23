const fs = require('fs')
const path = require('path')

function createSettingsStore(app) {
  const settingsPath = path.join(app.getPath('userData'), 'settings.json')

  function read() {
    try {
      const raw = fs.readFileSync(settingsPath, 'utf8')
      return JSON.parse(raw)
    } catch (_) {
      return {}
    }
  }

  function write(nextSettings) {
    fs.mkdirSync(path.dirname(settingsPath), { recursive: true })
    fs.writeFileSync(settingsPath, JSON.stringify(nextSettings, null, 2))
  }

  return {
    get(key, fallbackValue) {
      const settings = read()
      return settings[key] ?? fallbackValue
    },
    set(key, value) {
      const settings = read()
      settings[key] = value
      write(settings)
      return value
    },
    path: settingsPath,
  }
}

module.exports = {
  createSettingsStore,
}
