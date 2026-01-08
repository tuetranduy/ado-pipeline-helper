---
title: 'Pipeline Build Tracker with Cross-Stage Notifications'
slug: 'pipeline-build-tracker-notifications'
created: '2026-01-08T09:19:59.854Z'
status: 'ready-for-dev'
stepsCompleted: [1, 2, 3, 4]
tech_stack: ['Chrome Extension Manifest V3', 'React 19', 'TypeScript', 'Vite', 'Tailwind CSS 4', 'Vitest', 'Chrome APIs (storage, notifications)']
files_to_modify: ['manifest.json', 'src/lib/ado-client.ts', 'src/types/ado.ts', 'src/popup.tsx', 'vite.config.ts']
files_to_create: ['src/background.ts', 'src/content-script.ts', 'src/lib/tracker.ts', 'src/lib/storage.ts', 'src/components/TrackingHistory.tsx']
code_patterns: ['AdoClient with base64 PAT auth', 'Debounced storage writes (500ms)', 'Build matching via regex /(\d+)$/', 'Functional React components with hooks', 'Chrome storage.local for persistence']
test_patterns: ['Vitest with mocked fetch', 'Testing Library for React', 'Test auth/errors/matching logic', 'jsdom environment']
---

# Tech-Spec: Pipeline Build Tracker with Cross-Stage Notifications

**Created:** 2026-01-08T09:19:59.854Z

## Overview

### Problem Statement

Users manually monitor Azure DevOps pipelines across 3 stages. When a Stage 1 build completes successfully, they need to know when matching Stage 2/3 builds start running, but currently have no automated notification system.

### Solution

Extend the Chrome extension to detect "Run Pipeline" clicks in the ADO web interface, offer tracking for Stage 1 builds, and send browser notifications when matching Stage 2/3 builds are detected. After Stage 1 completes successfully, wait 20 minutes then poll every 5 minutes for matching builds.

### Scope

**In Scope:**
- Content script injection to detect "Run Pipeline" button clicks in ADO web UI
- Prompt user to track build after Stage 1 pipeline is triggered
- Background service worker to monitor tracked builds
- Track Stage 1 build completion status via ADO API
- After successful Stage 1 completion: wait 20 mins, then poll every 5 mins
- Check Stage 2 and Stage 3 pipelines for matching build numbers
- Browser notifications when Stage 2/3 builds are found
- Storage for tracked builds (build number, status, timestamps)
- Tracking multiple builds simultaneously
- Historical tracking logs

**Out of Scope:**
- Manual tracking toggle in extension popup
- Badge icon notifications
- In-extension banners/alerts
- Notification customization (sound, priority, etc.)

## Context for Development

### Technical Preferences

- Chrome extension architecture (Manifest V3)
- React + TypeScript for UI
- Existing ADO API client pattern via `ado-client.ts`
- Build matching via final numeric segment regex: `/(\d+)$/`
- Chrome storage API for persistence
- Background service workers for polling

### Codebase Patterns

- **ADO API Client**: `AdoClient` class handles all Azure DevOps API interactions with base64-encoded PAT authentication
- **Storage Pattern**: Configuration auto-saved to `chrome.storage.local` with 500ms debounce to prevent excessive writes
- **Build Matching**: Uses regex `/(\d+)$/` to extract final numeric segment from build names for cross-stage matching
- **Component Architecture**: React functional components with TypeScript interfaces, hooks-based state management
- **Error Handling**: Status code mapping (401/403 auth, 404 not found, 429 rate limit) with user-friendly error messages
- **Testing**: Vitest with mocked `fetch`, Testing Library for React components, jsdom for browser environment

### Files to Reference

| File | Purpose |
| ---- | ------- |
| `manifest.json` | Chrome extension manifest - needs background worker, content scripts, notifications permission |
| `src/lib/ado-client.ts` | ADO API client - add method to get build by ID for polling |
| `src/types/ado.ts` | TypeScript types - add TrackedBuild, BuildHistory interfaces |
| `src/popup.tsx` | Main popup component - add tracking status display |
| `src/components/ConfigForm.tsx` | Config form with debounced storage - reference for storage patterns |
| `src/components/BuildResults.tsx` | Build results display - reference for build status UI patterns |
| `vite.config.ts` | Build config - add new entry points for background/content scripts |
| `src/lib/ado-client.test.ts` | Test patterns reference |

### Technical Decisions

1. **Background Service Worker**: Use Manifest V3 service worker for polling (not persistent background page)
2. **Content Script Injection**: Inject into `dev.azure.com` pages to detect "Run Pipeline" button clicks
3. **Polling Strategy**: Stage 1 checked every 2 minutes (typical duration 5-15 min). After Stage 1 success, wait 20 minutes, then poll Stage 2/3 every 5 minutes (Stage 2/3 typically appear ~25 min after Stage 1)
4. **Storage Schema**: Separate storage keys for active tracking (`trackedBuilds`) and history (`buildHistory`)
5. **Notification Strategy**: Use Chrome notifications API with clickable links to ADO build pages
6. **Multi-Build Tracking**: Array-based storage to track multiple builds simultaneously
7. **Build Status Check**: Poll Stage 1 until `status === 'completed' && result === 'succeeded'`, max 2 hours timeout
8. **Content Script Detection**: Button XPath `//button[.="Run" and contains(@class, "bolt-focus-treatment")]` on pipeline page, extract `definitionId` from URL, observe builds list for new build after click
9. **Build Number Uniqueness**: Build numbers are globally unique across organization (no collision risk for alarm naming)
10. **Notification Permission**: Request on extension install, handle denial gracefully by disabling tracking with user warning

## Implementation Plan

### Tasks

#### Phase 1: Foundation Setup

- [x] Task 1: Add Chrome extension permissions and manifest configuration
  - File: `manifest.json`
  - Action: Add `notifications` permission, `background` service worker entry, `content_scripts` for `dev.azure.com`
  - Notes: Add `chrome.alarms` permission for persistent polling

- [x] Task 2: Create TypeScript interfaces for tracking data
  - File: `src/types/ado.ts`
  - Action: Add `TrackedBuild`, `BuildHistory`, `TrackingStatus`, `ContentScriptMessage` interfaces
  - Notes: 
    - State machine states: `waiting_stage1`, `waiting_delay`, `polling`, `completed`, `failed`, `timeout`
    - TrackedBuild schema: `{ buildNumber: string, buildId: number, pipelineId: string, stage1PipelineId: string, orgUrl: string, project: string, pat: string, startedAt: number, stage1CompletedAt?: number, waitUntil?: number, lastPolled?: number, status: TrackingStatus, maxPollAttempts: 24, currentAttempts: 0 }`
    - ContentScriptMessage types: `PIPELINE_STARTED`, `TRACK_BUILD`, `IGNORE_BUILD`
    - BuildHistory schema: `{ buildNumber: string, buildId: number, stage1CompletedAt: number, stage2DetectedAt?: number, stage3DetectedAt?: number, notifications: string[], trackedAt: number }`

- [x] Task 3: Extend ADO client with build polling method
  - File: `src/lib/ado-client.ts`
  - Action: Add `getBuildById(orgUrl, project, buildId, pat)` method to fetch single build status
  - Notes: Reuse existing auth and error handling patterns

#### Phase 2: Storage Layer

- [x] Task 4: Create storage utilities module
  - File: `src/lib/storage.ts` (NEW)
  - Action: Create functions for CRUD operations on `trackedBuilds` and `buildHistory` arrays
  - Notes: Functions: `addTrackedBuild()`, `updateTrackedBuild()`, `removeTrackedBuild()`, `getTrackedBuilds()`, `addToHistory()`, `pruneHistory()`, `getHistory()`

#### Phase 3: Content Script Detection

- [x] Task 5: Create content script for ADO page injection
  - File: `src/content-script.ts` (NEW)
  - Action: Detect "Run Pipeline" button clicks using XPath `//button[.="Run" and contains(@class, "bolt-focus-treatment")]`, extract pipeline ID from URL query param `definitionId`, wait for first build to appear in builds list, extract build number from build name using regex `/(\d+)$/`
  - Notes: 
    - Target page: Pipeline details page (URL pattern: `*://dev.azure.com/*/pipelines/*` or `*://_build?definitionId=*`)
    - After "Run" click, observe builds list DOM for new build entry (use MutationObserver)
    - Extract build number from first build's name element
    - Extract buildId from build link href or data attribute
    - Send message: `chrome.runtime.sendMessage({ type: 'PIPELINE_STARTED', buildNumber, buildId, pipelineId })`
    - User stays on pipeline page after clicking Run (no redirect)

#### Phase 4: Background Service Worker

- [x] Task 6: Create tracking state machine logic
  - File: `src/lib/tracker.ts` (NEW)
  - Action: Implement state machine with methods: `startTracking()`, `checkStage1Status()`, `startDelayPhase()`, `pollStage2And3()`, `handleTimeout()`, `handleStage1Failure()`
  - Notes: 
    - Stage 1 polling: Check every 2 minutes (chrome.alarms minimum is 1 min, use 2 for safety)
    - After Stage 1 success: Wait exactly 20 minutes before starting Stage 2/3 polling
    - Stage 2/3 polling: Every 5 minutes with max 24 attempts (2 hours total)
    - Stage 1 typical duration: 5-15 minutes
    - Stage 2/3 typically appear ~25 minutes after Stage 1 success
    - Alarm names: `check-stage1-{buildNumber}`, `start-polling-{buildNumber}`, `poll-stages-{buildNumber}`
    - Build numbers are globally unique (no collision risk)
    - Max wait for Stage 1: 2 hours (timeout after that)

- [x] Task 7: Create background service worker
  - File: `src/background.ts` (NEW)
  - Action: Set up message listeners for content script, alarm listeners for polling, notification click handlers, notification button action handlers
  - Notes: 
    - Message handlers: `PIPELINE_STARTED` (show tracking prompt notification), `TRACK_BUILD` (start tracking), `IGNORE_BUILD` (dismiss)
    - Alarm handlers: `check-stage1-*` (poll Stage 1 status), `start-polling-*` (begin Stage 2/3 polling), `poll-stages-*` (poll Stage 2/3)
    - Notification IDs: Use `track-prompt-{buildNumber}`, `stage1-success-{buildNumber}`, `stage-detected-{buildNumber}-{stage}`, `timeout-{buildNumber}`
    - On service worker restart: Re-register alarms from storage using `chrome.alarms.create()` with stored `waitUntil` times
    - Request notification permission on extension install via `chrome.runtime.onInstalled`

- [x] Task 8: Implement notification system
  - File: `src/background.ts`
  - Action: Create notifications with action buttons for tracking prompts and stage detection alerts, handle notification clicks to open ADO build pages
  - Notes: 
    - Notification types with IDs:
      - Tracking prompt: `track-prompt-{buildNumber}` with actions ["Track Build", "Ignore"]
      - Stage 1 success: `stage1-success-{buildNumber}` (no actions, informational)
      - Stage 2/3 detected: `stage-detected-{buildNumber}-{stageNum}` with click to open build URL
      - Timeout: `timeout-{buildNumber}` (no actions, informational)
    - Notification click handler: Open `build.url` from stored TrackedBuild data in new tab
    - Build URL construction: Use ADO build.url from API response (already includes correct buildId)
    - Handle notification permission denial: Log warning, disable tracking feature gracefully

#### Phase 5: UI Components

- [x] Task 9: Create tracking history component
  - File: `src/components/TrackingHistory.tsx` (NEW)
  - Action: Display historical tracking logs with timeline view, status badges, quick actions
  - Notes: Show Stage 1 → Stage 2 → Stage 3 progression with timestamps

- [x] Task 10: Update popup with tracking status
  - File: `src/popup.tsx`
  - Action: Add section to display active tracked builds and link to tracking history
  - Notes: 
    - Show build number, current status badge, elapsed time calculation
    - Elapsed time: Calculate from `Date.now() - trackedBuild.startedAt` for display in human-readable format (e.g., "5m ago", "1h 23m ago")
    - Status badges: Use color coding matching BuildResults component patterns
    - Link to TrackingHistory component or separate history page

#### Phase 6: Build Configuration

- [x] Task 11: Update Vite config for new entry points
  - File: `vite.config.ts`
  - Action: Add `background.ts` and `content-script.ts` to rollup input with proper output configuration
  - Notes: 
    - Service worker requires ES module format with `type: "module"` in manifest
    - Content script can be IIFE or ES module (use IIFE for compatibility)
    - Output paths: `dist/background.js`, `dist/content-script.js`
    - Ensure Chrome API types are available (already in devDependencies)

#### Phase 7: Testing

- [x] Task 12: Write tests for storage utilities
  - File: `src/lib/storage.test.ts` (NEW)
  - Action: Test CRUD operations, history pruning, edge cases
  - Notes: Mock chrome.storage.local API

- [x] Task 13: Write tests for tracker state machine
  - File: `src/lib/tracker.test.ts` (NEW)
  - Action: Test state transitions, timeout handling, notification triggers
  - Notes: Mock chrome.alarms and chrome.notifications

- [x] Task 14: Write tests for ADO client additions
  - File: `src/lib/ado-client.test.ts`
  - Action: Add tests for `getBuildById` method
  - Notes: Follow existing test patterns with mocked fetch

- [x] Task 15: Write tests for TrackingHistory component
  - File: `src/components/TrackingHistory.test.tsx` (NEW)
  - Action: Test rendering, status displays, user interactions
  - Notes: Use Testing Library patterns from existing component tests

### Acceptance Criteria

#### Core Tracking Flow

- [x] AC1: Given user clicks "Run Pipeline" on Stage 1 in ADO, when extension detects the click, then Chrome notification appears with "Track Build" and "Ignore" action buttons
- [x] AC2: Given user clicks "Track Build" notification action, when background worker receives message, then build is added to `trackedBuilds` storage with status `waiting_stage1`
- [x] AC3: Given build is in `waiting_stage1` status, when background worker polls ADO API, then it checks build status every 2 minutes until `status === 'completed'` (max 2 hours timeout)
- [x] AC4: Given Stage 1 build completes with `result === 'succeeded'`, when status changes, then tracking status updates to `waiting_delay` and 20-minute alarm is scheduled
- [x] AC5: Given 20-minute delay expires, when alarm fires, then tracking status updates to `polling` and 5-minute recurring alarm is scheduled
- [x] AC6: Given build is in `polling` status, when background worker polls Stage 2 and Stage 3 pipelines, then it searches for builds matching the tracked build number using regex `/(\d+)$/`
- [x] AC7: Given matching Stage 2 or Stage 3 build is found, when detected, then Chrome notification is sent with build link and build is added to history
- [x] AC8: Given build has been polling for 24 attempts (2 hours), when max attempts reached, then timeout notification is sent and build status updates to `timeout`

#### Multi-Build Tracking

- [x] AC9: Given multiple builds are being tracked, when background worker processes alarms, then each build is processed independently without interference
- [x] AC10: Given user tracks a new build, when added to storage, then it does not affect existing tracked builds

#### Notification Behavior

- [x] AC11: Given Stage 2 NB and Stage 2 MTA builds both match, when detected, then separate notifications are sent for each build
- [x] AC12: Given user clicks notification for Stage 2/3 detection, when clicked, then browser opens the detected build's ADO page (build.url from API) in new tab

#### History and Persistence

- [x] AC13: Given build completes successfully (Stage 2/3 detected or timeout), when completed, then build is moved from `trackedBuilds` to `buildHistory` with all timestamps
- [x] AC14: Given history contains entries older than 30 days, when extension loads, then old entries are automatically pruned
- [x] AC15: Given Chrome browser restarts, when service worker reactivates, then active tracking resumes from stored state using chrome.alarms

#### UI Display

- [x] AC16: Given user opens extension popup, when opened, then active tracked builds are displayed with current status and elapsed time
- [x] AC17: Given user views TrackingHistory component, when rendered, then historical logs show timeline view with Stage 1 → Stage 2 → Stage 3 progression

#### Error Handling

- [x] AC18: Given ADO API returns 401/403 error, when polling fails, then tracking continues and retries on next alarm interval
- [x] AC19: Given Stage 1 build fails (`result === 'failed'`), when detected, then tracking status updates to `failed` and no further polling occurs
- [x] AC20: Given network error occurs during polling, when error happens, then error is logged and tracking continues on next interval

## Additional Context

### Dependencies

- Chrome Extension APIs: `chrome.storage`, `chrome.alarms`, `chrome.notifications`, `chrome.runtime`
- Existing ADO API patterns in `ado-client.ts`
- React 19 and TypeScript for UI components
- Vitest for testing framework
- No new external npm packages required

### Testing Strategy

**Unit Tests:**
- Storage utilities: Test all CRUD operations, pruning logic
- Tracker state machine: Test state transitions, timeout handling
- ADO client: Test new `getBuildById` method with mocked fetch
- Components: Test TrackingHistory rendering and interactions

**Integration Tests:**
- End-to-end tracking flow: Mock chrome APIs and ADO responses
- Notification flow: Test message passing between content script and background worker

**Manual Testing:**
- Test in live ADO environment with real pipelines
- Verify notifications appear correctly across Chrome restart
- Validate history pruning after 30 days
- Test multiple simultaneous builds

### Notes

**High-Risk Items:**
- Content script detection relies on XPath `//button[.="Run" and contains(@class, "bolt-focus-treatment")]` - if ADO changes button text or classes, detection will break
- Build number extraction from builds list DOM after "Run" click - requires MutationObserver and precise selector for build name element (needs testing in live ADO)
- Manifest V3 service worker lifecycle requires careful alarm management to prevent lost tracking state - must persist alarm schedule to storage
- Chrome alarms have minimum 1-minute intervals (using 2-minute interval for Stage 1 polling for safety margin)
- Notification permission denial will silently disable tracking - need graceful UX handling

**Known Limitations:**
- Polling intervals are fixed (not user-configurable)
- Content script only works on `dev.azure.com` (not on-prem ADO servers)
- History limited to 30 days (not configurable)

**Future Considerations:**
- Add manual tracking toggle in popup UI
- Badge icon with active tracking count
- Configurable polling intervals
- Export history to CSV
- Support for on-premises Azure DevOps Server
