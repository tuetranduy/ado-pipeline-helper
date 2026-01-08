---
title: 'ADO Pipeline Build Tracker - Enhanced Configuration & Build Splitting'
slug: 'ado-pipeline-tracker-enhancements'
created: '2026-01-08T07:41:40.494Z'
status: 'ready-for-dev'
stepsCompleted: [1, 2, 3, 4]
tech_stack: ['TypeScript', 'React 18', 'Chrome Extension', 'chrome.storage API']
files_to_modify: ['src/lib/constants.ts', 'src/types/ado.ts', 'src/components/ConfigForm.tsx', 'src/popup.tsx', 'src/fullpage.tsx']
code_patterns: ['React hooks', 'chrome.storage persistence', 'Debounced auto-save', 'Pattern matching for build classification']
test_patterns: ['Manual Chrome extension testing', 'Build classification verification']
---

# Tech-Spec: ADO Pipeline Build Tracker - Enhanced Configuration & Build Splitting

**Created:** 2026-01-08T07:41:40.494Z

## Overview

### Problem Statement

Users need to remember their last-used build ID between sessions for faster repeated searches. Additionally, Stage 2 pipeline contains two distinct build types (NB and MTA&Cancellation) that should be displayed separately for better visibility and clarity when reviewing build results.

### Solution

1. **Persist buildId:** Save buildId to chrome.storage with debounced auto-save (500ms), load on mount
2. **Build type detection:** Add pattern matching logic to classify Stage 2 builds as NB or MTA&Cancellation based on build name
3. **Split Stage 2 display:** Show Stage 2 results as two separate cards: "Stage 2 - NB" and "Stage 2 - MTA&Cancellation"
4. **Constants refactor:** Move pipeline IDs from user config to hardcoded constants file

### Scope

**In Scope:**
- Persist buildId to chrome.storage with debounced auto-save
- Load buildId on component mount from storage
- Add build type classification logic (pattern matching on build name/number)
- Split Stage 2 results into two display sections in BuildResults component
- Create constants file for pipeline IDs
- Remove pipeline ID fields from ConfigForm (make them constants)

**Out of Scope:**
- Adding/removing pipelines dynamically
- Multiple project configurations
- Build history dropdown or search history
- Changing number of pipelines (fixed at 3)

## Context for Development

### Codebase Patterns

**Current Architecture:**
- **React 18:** Functional components with hooks (useState, useEffect, useCallback, useRef)
- **TypeScript:** Strict mode, explicit interfaces for props/state
- **Chrome Extension:** Manifest v3, chrome.storage.local for persistence
- **UI:** Tailwind CSS + shadcn/ui components (Card, Input, Label, Badge, Alert, Button)

**Storage Pattern (Existing):**
```typescript
// Load on mount
chrome.storage.local.get(['keys'], (result: any) => {
  if (chrome.runtime.lastError) {
    console.error('Failed to load:', chrome.runtime.lastError);
    return;
  }
  // Set state
});

// Debounced save
const timersRef = useRef<{ [key: string]: NodeJS.Timeout }>({});
const handleDebouncedSave = (key: string, value: string) => {
  if (timersRef.current[key]) clearTimeout(timersRef.current[key]);
  timersRef.current[key] = setTimeout(() => {
    chrome.storage.local.set({ [key]: value }, () => {
      if (chrome.runtime.lastError) console.error('Failed to save:', chrome.runtime.lastError);
    });
  }, 500);
};
```

**Pipeline Search Pattern (Existing):**
```typescript
const pipelines = [
  { id: config.stage1PipelineId, name: 'Stage 1' },
  { id: config.stage2PipelineId, name: 'Stage 2' },
  { id: config.stage3PipelineId, name: 'Stage 3' },
];
const results = await Promise.all(pipelines.map(async (pipeline) => { /* ... */ }));
```

**BuildResults Component:**
- Maps over `stages` array
- Each stage renders as a Card
- Displays build link, status badge, artifacts list

### Files to Reference

| File | Purpose | Changes Needed |
| ---- | ------- | -------------- |
| `src/lib/constants.ts` | NEW - Pipeline ID constants | Create file with PIPELINE_IDS export |
| `src/types/ado.ts` | TypeScript interfaces | Remove stage1/2/3PipelineId from PipelineConfig |
| `src/components/ConfigForm.tsx` | Form with storage | Remove pipeline ID inputs, add buildId persistence |
| `src/popup.tsx` | Main popup orchestration | Import constants, add Stage 2 classification logic |
| `src/fullpage.tsx` | Full-page view | Same changes as popup.tsx |
| `src/components/BuildResults.tsx` | Stage results display | Handle Stage 2 split (NB, MTA, Other) |

### Technical Decisions

1. **Build Type Detection:** Use pattern matching on `build.buildNumber` to identify NB vs MTA&Cancellation
   - **NB Pattern:** Contains `" - NB - "` in build number
   - **MTA&Cancellation Pattern:** Contains `" - MTA&Cancellation - "` in build number
   - **Example NB:** `#PremFina_CaroleNash_Van - NB - 86966`
   - **Example MTA:** `#PremFina_CaroleNash_Van - MTA&Cancellation - 86948`
   - **Fallback:** If neither pattern matches, display under "Stage 2 - Other"
   - **Implementation:** Add helper function to classify builds, expand Stage 2 results

2. **Constants Location:** Create `src/lib/constants.ts` for pipeline IDs
   ```typescript
   export const PIPELINE_IDS = {
     STAGE_1: 'xxx', // User will provide actual values
     STAGE_2: 'xxx',
     STAGE_3: 'xxx',
   };
   ```

3. **Storage Key:** Add `'buildId'` to chrome.storage keys list
   - Load in ConfigForm useEffect: `chrome.storage.local.get(['orgUrl', 'project', 'pat', 'buildId'], ...)`
   - Save with debounced handler: `handleDebouncedSave('buildId', value)`

4. **Display Order:** Stage 2 results will show as separate cards:
   - "Stage 2 - NB" (if NB build found)
   - "Stage 2 - MTA&Cancellation" (if MTA build found)
   - "Stage 2 - Other" (if build doesn't match patterns)
   - Each card shows build, artifacts independently

5. **Refactor Approach:**
   - Remove pipeline ID state variables from ConfigForm
   - Remove pipeline ID Input fields from JSX
   - Import PIPELINE_IDS from constants in popup/fullpage
   - Update PipelineConfig interface to only include orgUrl, project, pat
   - Update handleSearch to use constants instead of config.stageXPipelineId

## Implementation Plan

### Tasks

- [ ] Task 1: Create pipeline constants file
  - File: `src/lib/constants.ts`
  - Action: Create new file with PIPELINE_IDS export containing STAGE_1, STAGE_2, STAGE_3 as string constants (user will fill actual values)
  - Notes: Export as const object for type safety

- [ ] Task 2: Update TypeScript interfaces
  - File: `src/types/ado.ts`
  - Action: Remove `stage1PipelineId`, `stage2PipelineId`, `stage3PipelineId` from PipelineConfig interface, keeping only orgUrl, project, pat
  - Notes: SearchParams no longer needs to extend PipelineConfig since pipelines are now constants

- [ ] Task 3: Add buildId persistence to ConfigForm
  - File: `src/components/ConfigForm.tsx`
  - Action: Add `'buildId'` to chrome.storage.local.get() keys array in useEffect, load buildId from storage and set state
  - Action: Update buildId onChange handler to use handleDebouncedSave('buildId', value) instead of plain setState
  - Notes: Follow existing debounce pattern used for other fields

- [ ] Task 4: Remove pipeline ID fields from ConfigForm UI
  - File: `src/components/ConfigForm.tsx`
  - Action: Remove state variables: stage1PipelineId, stage2PipelineId, stage3PipelineId
  - Action: Remove Input fields for Stage 1/2/3 Pipeline IDs from JSX
  - Action: Remove stage fields from handleSubmit onSubmit payload
  - Action: Update isValid check to remove pipeline ID validations
  - Notes: Keep orgUrl, project, pat, buildId fields

- [ ] Task 5: Update popup to use constants and classify Stage 2 builds
  - File: `src/popup.tsx`
  - Action: Import PIPELINE_IDS from '../lib/constants'
  - Action: Replace `config.stage1PipelineId` with `PIPELINE_IDS.STAGE_1` (same for stage2/3)
  - Action: Add helper function `classifyStage2Build(build: Build | null): 'NB' | 'MTA' | 'Other'` that checks buildNumber for " - NB - " or " - MTA&Cancellation - "
  - Action: After Stage 2 search completes, if build found, classify it and create separate result entries for "Stage 2 - NB", "Stage 2 - MTA&Cancellation", or "Stage 2 - Other"
  - Action: Update handleSearch to expand Stage 2 result into multiple entries based on classification
  - Notes: Stage 1 and Stage 3 results remain unchanged, only Stage 2 is split

- [ ] Task 6: Update fullpage to use constants and classify Stage 2 builds
  - File: `src/fullpage.tsx`
  - Action: Apply exact same changes as Task 5 (import constants, classify Stage 2, expand results)
  - Notes: Duplicate logic from popup.tsx to maintain consistency

- [ ] Task 7: Update ConfigForm prop interface
  - File: `src/components/ConfigForm.tsx`
  - Action: Update onSubmit callback type to remove stage1/2/3PipelineId from config parameter, keep only orgUrl, project, pat, buildId
  - Notes: This matches the updated PipelineConfig interface

### Acceptance Criteria

- [ ] AC1: Given user has previously entered buildId "86951", when extension popup is reopened, then buildId field is pre-filled with "86951"

- [ ] AC2: Given user types a new buildId, when 500ms elapses without further typing, then buildId is auto-saved to chrome.storage.local

- [ ] AC3: Given pipeline IDs are defined in constants file as STAGE_1='123', STAGE_2='456', STAGE_3='789', when user performs search, then extension searches those exact pipeline IDs

- [ ] AC4: Given Stage 2 pipeline returns build "#PremFina_CaroleNash_Van - NB - 86966", when results are displayed, then a card labeled "Stage 2 - NB" appears with that build

- [ ] AC5: Given Stage 2 pipeline returns build "#PremFina_CaroleNash_Van - MTA&Cancellation - 86948", when results are displayed, then a card labeled "Stage 2 - MTA&Cancellation" appears with that build

- [ ] AC6: Given Stage 2 pipeline returns a build without "NB" or "MTA&Cancellation" in name, when results are displayed, then a card labeled "Stage 2 - Other" appears with that build

- [ ] AC7: Given user opens ConfigForm, when viewing Settings section, then pipeline ID input fields are NOT visible (removed from UI)

- [ ] AC8: Given constants file has PIPELINE_IDS defined, when importing in popup.tsx or fullpage.tsx, then TypeScript compilation succeeds without errors

- [ ] AC9: Given PipelineConfig interface no longer includes stage fields, when ConfigForm calls onSubmit, then payload contains only orgUrl, project, pat, buildId

- [ ] AC10: Given Stage 1 returns a build, when results display, then "Stage 1" card appears (unchanged behavior)

- [ ] AC11: Given Stage 3 returns a build, when results display, then "Stage 3" card appears (unchanged behavior)

- [ ] AC12: Given fullpage view is used instead of popup, when Stage 2 build classification occurs, then results match popup behavior exactly

## Additional Context

### Dependencies

**No new dependencies required:**
- Using existing chrome.storage.local API
- Using existing TypeScript, React, Tailwind setup
- All changes are refactoring existing code

**Internal Dependencies:**
- Constants file must be created before popup/fullpage can import it
- TypeScript interfaces must be updated before ConfigForm changes
- ConfigForm changes affect popup/fullpage onSubmit handlers

### Testing Strategy

**Unit Tests:**
- No new unit tests required (classifyStage2Build helper could be tested, but manual testing sufficient for v1)
- Existing AdoClient tests remain unchanged

**Manual Testing Checklist:**
1. Load extension in Chrome, verify buildId persists after reload
2. Enter buildId, wait 500ms, reload extension, confirm value saved
3. Search with NB build ID (e.g., 86966), verify "Stage 2 - NB" card appears
4. Search with MTA build ID (e.g., 86948), verify "Stage 2 - MTA&Cancellation" card appears
5. Verify Stage 1 and Stage 3 still display correctly
6. Test full-page view matches popup behavior
7. Verify pipeline ID fields removed from Settings section
8. Run `npm run build` to confirm TypeScript compilation passes

**Edge Cases:**
- Stage 2 build with neither pattern → "Stage 2 - Other" should appear
- No Stage 2 build found → No Stage 2 cards appear (existing behavior)
- Multiple searches in succession → buildId persists correctly

### Notes

**Build Name Patterns (Confirmed):**
- NB builds contain: `" - NB - "` in build number
- MTA&Cancellation builds contain: `" - MTA&Cancellation - "` in build number
- Examples:
  - `#PremFina_CaroleNash_Van - NB - 86966`
  - `#PremFina_CaroleNash_Van - MTA&Cancellation - 86948`

**Pipeline IDs:**
User will provide actual pipeline IDs to replace placeholders in constants file during implementation.

**Implementation Notes:**
- Pipeline ID constants approach prevents accidental user modification
- Stage 2 split is purely display-side - API still searches single Stage 2 pipeline
- BuildId persistence improves UX for repeated searches
- No breaking changes to existing API client logic

**Future Considerations (Out of Scope):**
- Make pipeline IDs configurable via settings UI
- Add build history dropdown
- Support dynamic number of pipelines
- Multi-project configurations
