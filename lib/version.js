function parseVersion(version) {
  return version.split('.').map(part => Number.parseInt(part, 10) || 0)
}

function isNewerVersion(latest, current) {
  const [lMaj, lMin, lPatch] = parseVersion(latest)
  const [cMaj, cMin, cPatch] = parseVersion(current)

  if (lMaj !== cMaj) return lMaj > cMaj
  if (lMin !== cMin) return lMin > cMin
  return lPatch > cPatch
}

module.exports = {
  isNewerVersion,
}
