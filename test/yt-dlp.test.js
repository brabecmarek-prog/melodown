const test = require('node:test')
const assert = require('node:assert/strict')
const { getDownloadOutputTemplate } = require('../lib/yt-dlp')

test('escapes yt-dlp output template on windows', () => {
  const template = getDownloadOutputTemplate('C:\\Music', 'win32')
  assert.equal(template, 'C:\\Music\\%(title)s [%(id)s].%(ext)s')
})

test('uses standard yt-dlp output template on non-windows platforms', () => {
  const template = getDownloadOutputTemplate('/tmp/music', 'darwin')
  assert.equal(template, '/tmp/music/%(title)s [%(id)s].%(ext)s')
})
