const https = require('https')

function httpGet(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      }
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return httpGet(res.headers.location).then(resolve).catch(reject)
      }

      let data = ''
      res.setEncoding('utf8')
      res.on('data', chunk => { data += chunk })
      res.on('end', () => resolve(data))
    })

    req.on('error', reject)
    req.setTimeout(15000, () => {
      req.destroy()
      reject(new Error('Timeout'))
    })
  })
}

async function fetchSpotifyPlaylist(url) {
  const match = url.match(/playlist\/([A-Za-z0-9]+)/)
  if (!match) throw new Error('No playlist ID found in URL')

  const html = await httpGet(`https://open.spotify.com/embed/playlist/${match[1]}`)
  const nextDataMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/)
  if (!nextDataMatch) throw new Error('Could not parse Spotify page')

  const data = JSON.parse(nextDataMatch[1])
  const items = data.props?.pageProps?.state?.data?.entity?.trackList || []

  return items
    .map(item => item.title && item.subtitle ? `${item.subtitle} & ${item.title}` : item.title)
    .filter(Boolean)
}

async function fetchYouTubeMusicPlaylist(url) {
  const match = url.match(/[?&]list=([A-Za-z0-9_-]+)/)
  if (!match) throw new Error('No playlist ID found in URL')

  const html = await httpGet(`https://www.youtube.com/playlist?list=${match[1]}`)
  const initialDataMatch = html.match(/ytInitialData\s*=\s*(\{[\s\S]*?\});\s*<\/script>/)
  if (!initialDataMatch) throw new Error('Could not parse YouTube page')

  const data = JSON.parse(initialDataMatch[1])
  const contents = data.contents?.twoColumnBrowseResultsRenderer?.tabs?.[0]
    ?.tabRenderer?.content?.sectionListRenderer?.contents?.[0]
    ?.itemSectionRenderer?.contents?.[0]
    ?.playlistVideoListRenderer?.contents || []

  return contents
    .map(item => {
      const video = item.playlistVideoRenderer || {}
      const title = (video.title?.runs || [{}])[0].text || ''
      const artist = (video.shortBylineText?.runs || [{}])[0].text || ''
      return (title && artist) ? `${artist} & ${title}` : title
    })
    .filter(Boolean)
}

module.exports = {
  fetchSpotifyPlaylist,
  fetchYouTubeMusicPlaylist,
}
