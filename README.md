# Upromise Survey EPM Extension

A Chrome extension that adds an estimated **earnings per minute (EPM)** value to each survey tile on Upromise.

The extension reads:
- Survey time (for example, `18 Min`)
- Survey payout (for example, `$1.00`)

Then calculates:
- `EPM = payout / minutes`

Example:
- `$1.00 / 18 min = $0.056/min`

## Features

- Injects an EPM badge for each survey tile on the surveys page
- Supports dynamic page updates with a debounced observer
- Uses resilient selectors to tolerate hashed CSS class suffixes

## Prerequisites

- Node.js 18+ (recommended)
- npm
- Google Chrome

## Install dependencies

```bash
npm install
```

## Build the extension

```bash
npm run build
```

Build output is generated in:
- `dist/content.js`
- `dist/manifest.json`

## Load in Chrome (Developer Mode)

1. Open Chrome and go to `chrome://extensions`
2. Turn on **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Select the `dist` folder in this project
5. Open `https://www.upromise.com/surveys` and refresh the page

You should now see an EPM badge under each survey details row.

## Development workflow

Rebuild after changes:

```bash
npm run build
```

Then in `chrome://extensions`:
- Click the refresh icon on this extension
- Refresh the Upromise page

## Screenshots
<img width="471" height="304" alt="upromise" src="https://github.com/user-attachments/assets/db20b0bb-08ae-4b07-862d-053881981814" />



Markdown example:

```md
![Survey list with EPM badge](docs/survey-list-with-epm.png)
```

When screenshot files are added, they will render automatically in this README.

## Notes

- If selectors on Upromise change, EPM rendering may need updates
- If the page appears stale, refresh both the extension and the site tab
