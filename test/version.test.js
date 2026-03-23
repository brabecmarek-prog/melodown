const test = require('node:test')
const assert = require('node:assert/strict')
const { isNewerVersion } = require('../lib/version')

test('detects newer patch versions', () => {
  assert.equal(isNewerVersion('1.4.2', '1.4.1'), true)
  assert.equal(isNewerVersion('1.4.1', '1.4.1'), false)
})

test('detects newer minor and major versions', () => {
  assert.equal(isNewerVersion('1.5.0', '1.4.9'), true)
  assert.equal(isNewerVersion('2.0.0', '1.9.9'), true)
  assert.equal(isNewerVersion('1.3.9', '1.4.0'), false)
})
