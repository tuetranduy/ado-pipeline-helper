# ADO Pipeline Build Tracker

Chrome extension to track Azure DevOps pipeline builds and artifacts across multiple stages.

## Features

- Search for builds across 3 pipelines simultaneously by build ID
- Extract build IDs from build names using regex pattern `/(\d+)$/`
- View build details with direct links to Azure DevOps
- Download artifacts from found builds
- Persistent configuration storage (PAT, org URL, pipeline IDs)
- Both popup and full-page views

## Prerequisites

- Node.js 18+ and npm
- Chrome browser
- Azure DevOps account with Personal Access Token (PAT)
- Read access to target Azure DevOps project and pipelines

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Build Extension

```bash
npm run build
```

This creates a `dist` folder with the compiled extension.

### 3. Load Extension in Chrome

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top-right corner)
3. Click "Load unpacked"
4. Select the `dist` folder from this project

The extension icon should appear in your Chrome toolbar.

## Configuration

### Generate Azure DevOps PAT

1. Go to Azure DevOps: `https://dev.azure.com/{your-org}`
2. Click on User Settings (top-right) → Personal Access Tokens
3. Create new token with these permissions:
   - **Build**: Read
   - **Project and Team**: Read
4. Copy the token (you won't see it again!)

### Configure Extension

1. Click the extension icon in Chrome toolbar
2. Fill in the **Settings** section:
   - **Organization URL**: `https://dev.azure.com/yourorg`
   - **Project**: Your project name
   - **Personal Access Token**: Paste your PAT
   - **Stage 1/2/3 Pipeline IDs**: Pipeline definition IDs (found in ADO pipeline URL)

Settings are auto-saved after 500ms when you change them.

## Usage

### Search for Builds

1. Enter a **Build ID** in the Query section (e.g., `86951`)
2. Click **Search Builds**
3. The extension searches all 3 pipelines for builds whose build number ends with the specified ID
4. Results show:
   - Build number with clickable link to ADO
   - Build status badge
   - List of artifacts with download links

### Build ID Matching

The extension extracts the **final numeric segment** from build names:
- Build name: `"Pipeline - 86951"` → Extracts: `86951`
- Build name: `"Test-86951"` → Extracts: `86951`
- Search for: `86951` → Matches both

Regex pattern used: `/(\d+)$/`

### Full-Page View

Click **"Open Full Page View"** link in popup for expanded layout with more space.

## Development

### Run Development Server

```bash
npm run dev
```

This starts Vite dev server. Load the `dist` folder in Chrome as described above. Changes will hot-reload.

### Run Tests

```bash
npm test
```

Run tests with UI:

```bash
npm run test:ui
```

### Project Structure

```
├── src/
│   ├── components/        # React components
│   │   ├── ui/           # shadcn/ui components
│   │   ├── ConfigForm.tsx
│   │   ├── BuildResults.tsx
│   │   └── ErrorBoundary.tsx
│   ├── lib/              # Utilities
│   │   ├── ado-client.ts # Azure DevOps API client
│   │   └── utils.ts      # shadcn/ui helpers
│   ├── types/            # TypeScript types
│   │   └── ado.ts
│   ├── popup.tsx         # Popup view component
│   ├── fullpage.tsx      # Full-page view component
│   ├── main-popup.tsx    # Popup entry point
│   ├── main-fullpage.tsx # Full-page entry point
│   └── index.css         # Tailwind CSS
├── public/               # Static assets (icons)
├── manifest.json         # Chrome extension manifest
├── popup.html           # Popup HTML
├── fullpage.html        # Full-page HTML
└── vite.config.ts       # Vite configuration
```

## Troubleshooting

### CORS Errors

If you see CORS errors in console:
- Ensure `host_permissions` in `manifest.json` includes your Azure DevOps domain
- Extension includes: `https://dev.azure.com/*` and `https://*.visualstudio.com/*`

### Authentication Failures

- Verify your PAT is valid and not expired
- Ensure PAT has **Build (Read)** permissions
- Check organization URL format: `https://dev.azure.com/yourorg` (no trailing slash)

### No Builds Found

- Verify pipeline IDs are correct (found in ADO pipeline settings or URL)
- Ensure build ID matches final numeric segment of build name
- Check that builds exist in the specified pipelines

### Rate Limiting

Azure DevOps API has rate limits. If you see "429 rate limit exceeded":
- Wait a few minutes before trying again
- Reduce frequency of searches

## Security Notes

- PAT is stored in `chrome.storage.local` (encrypted at rest by Chrome)
- PAT is never sent to any server except Azure DevOps APIs
- Build ID is **not** persisted between sessions (for privacy)
- Always use PAT with minimal required permissions

## Known Limitations

- Single project only (not multi-project)
- Fixed 3-pipeline architecture
- Build ID not saved between sessions
- No offline support
- No automatic refresh of results

## License

ISC
