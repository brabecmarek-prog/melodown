# Melodown

Melodown is a desktop Electron app for importing song lists and downloading matching audio tracks as MP3 files with `yt-dlp`.

## What It Does

- Import public Spotify playlists
- Import public YouTube Music playlists
- Paste songs manually or load them from `.txt` / `.csv`
- Review and curate the final download list before starting
- Download tracks sequentially as tagged MP3 files
- Save the preferred output directory between app launches
- Check GitHub releases for new app versions

## Stack

- Electron 33
- Plain HTML, CSS, and renderer-side JavaScript
- `yt-dlp` for audio downloads
- GitHub Actions + Electron Forge for release packaging

## Local Development

```bash
npm install
npm start
```

## Build Release Archives

```bash
npm run make
```

GitHub releases are built from tags that match `v*` via `.github/workflows/release.yml`.

## Project Structure

- `main.js`: Electron main process, window lifecycle, IPC, downloads, updater
- `preload.js`: safe renderer bridge
- `renderer.js`: UI state, interactions, progress rendering
- `index.html`: app shell
- `style.css`: desktop UI styling
- `lib/playlists.js`: playlist import helpers
- `lib/settings.js`: lightweight persistent settings store
- `lib/version.js`: semantic version comparison helper
- `lib/yt-dlp.js`: `yt-dlp` path and output template helpers

## Dependencies

Melodown expects `yt-dlp` to be installed and available either:

- on `PATH`
- in `%USERPROFILE%\bin\yt-dlp.exe`
- in a supported Windows Python Scripts directory
- in common Homebrew locations on macOS

If `yt-dlp` is missing, downloads will fail until it is installed.

## Known Limitations

- Playlist imports rely on scraping public Spotify and YouTube pages, so upstream markup changes can break imports.
- Download matching is based on `ytsearch1`, so the first result may not always be the intended track.
- Automated coverage is currently limited to a small helper-level Node test suite.
