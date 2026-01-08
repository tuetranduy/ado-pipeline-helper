import { AdoClient } from './lib/ado-client';
import { getTrackerConfig } from './lib/config';
import {
  getTrackedBuilds,
  saveTrackedBuild,
  removeTrackedBuild,
  addToHistory,
  pruneHistory,
  TrackedBuild,
} from './lib/storage';
import {
  createAlarmName,
  parseAlarmName,
  shouldContinueStage1Polling,
  validateBuildNumber,
  ALARM_TYPES,
} from './lib/tracker';

const adoClient = new AdoClient();

// Minimal 16x16 blue PNG icon as base64 (Chrome notifications require PNG, not SVG)
const NOTIFICATION_ICON = chrome.runtime.getURL('../noti.png');

chrome.runtime.onInstalled.addListener(async () => {
  const permission = await chrome.notifications.getPermissionLevel();
  if (permission === 'denied') {
    console.warn('[ADO Tracker] Notification permission denied - tracking features disabled');
    await chrome.storage.local.set({ notificationsDisabled: true });
  } else {
    await chrome.storage.local.set({ notificationsDisabled: false });
  }
  await pruneHistory();
});

chrome.runtime.onStartup.addListener(async () => {
  await pruneHistory();

  const builds = await getTrackedBuilds();
  const config = await getTrackerConfig();
  const now = Date.now();

  for (const [buildNumber, build] of builds) {
    if (build.status === 'monitoring_stage1') {
      const alarmName = createAlarmName(ALARM_TYPES.CHECK_STAGE1, buildNumber);
      chrome.alarms.create(alarmName, { periodInMinutes: config.stage1IntervalMinutes });
    } else if (build.status === 'waiting_stage2_nb' && build.stage1CompletedAt) {
      const delayEnd = build.stage1CompletedAt + config.delayAfterStage1Minutes * 60 * 1000;
      const delayRemaining = Math.max(0, delayEnd - now);

      if (delayRemaining > 0) {
        const alarmName = createAlarmName(ALARM_TYPES.START_POLLING, buildNumber);
        chrome.alarms.create(alarmName, { when: now + delayRemaining });
      } else {
        build.status = 'monitoring_stage2_nb';
        await saveTrackedBuild(buildNumber, build);
        const alarmName = createAlarmName(ALARM_TYPES.POLL_STAGES, buildNumber);
        chrome.alarms.create(alarmName, { periodInMinutes: config.pollingIntervalMinutes });
      }
    } else if (build.status === 'monitoring_stage2_nb' || build.status === 'monitoring_stage3') {
      const alarmName = createAlarmName(ALARM_TYPES.POLL_STAGES, buildNumber);
      chrome.alarms.create(alarmName, { periodInMinutes: config.pollingIntervalMinutes });
    } else if (build.status === 'waiting_stage2_mta' && build.stage3CompletedAt) {
      const delayEnd = build.stage3CompletedAt + config.delayAfterStage1Minutes * 60 * 1000;
      const delayRemaining = Math.max(0, delayEnd - now);

      if (delayRemaining > 0) {
        const alarmName = createAlarmName('wait-mta', buildNumber);
        chrome.alarms.create(alarmName, { when: now + delayRemaining });
      } else {
        build.status = 'monitoring_stage2_mta';
        await saveTrackedBuild(buildNumber, build);
        const alarmName = createAlarmName('poll-mta', buildNumber);
        chrome.alarms.create(alarmName, { periodInMinutes: config.pollingIntervalMinutes });
      }
    } else if (build.status === 'monitoring_stage2_mta') {
      const alarmName = createAlarmName('poll-mta', buildNumber);
      chrome.alarms.create(alarmName, { periodInMinutes: config.pollingIntervalMinutes });
    }
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'START_MANUAL_TRACKING') {
    handleStartManualTracking(message.buildNumber);
  } else if (message.type === 'CLEAR_ALL_TRACKING') {
    handleClearAllTracking();
  }
  sendResponse({ success: true });
  return true;
});

async function handleStartManualTracking(buildNumber: string): Promise<void> {
  if (!validateBuildNumber(buildNumber)) {
    console.warn(`[ADO Tracker] Invalid build number format: ${buildNumber}`);
    return;
  }

  const configData = await chrome.storage.local.get(['orgUrl', 'project', 'pat', 'stage1PipelineId', 'stage2PipelineId', 'stage3PipelineId']);

  if (!configData.orgUrl || !configData.project || !configData.pat || !configData.stage1PipelineId || !configData.stage2PipelineId || !configData.stage3PipelineId) {
    await chrome.notifications.create(`config-missing-${buildNumber}`, {
      type: 'basic',
      iconUrl: NOTIFICATION_ICON,
      title: 'Tracking Configuration Missing',
      message: 'Please configure the extension settings before tracking builds.',
      requireInteraction: true,
    });
    return;
  }

  const trackedBuild: TrackedBuild = {
    buildNumber,
    status: 'monitoring_stage1',
    currentStage: 'stage1',
    startedAt: Date.now(),
  };

  await saveTrackedBuild(buildNumber, trackedBuild);

  const trackerConfig = await getTrackerConfig();
  const alarmName = createAlarmName(ALARM_TYPES.CHECK_STAGE1, buildNumber);
  chrome.alarms.create(alarmName, { periodInMinutes: trackerConfig.stage1IntervalMinutes });
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  const parsed = parseAlarmName(alarm.name);
  if (!parsed) {
    if (alarm.name.startsWith('wait-mta-')) {
      const buildNumber = alarm.name.replace('wait-mta-', '');
      await handleStartMtaMonitoring(buildNumber);
    } else if (alarm.name.startsWith('poll-mta-')) {
      const buildNumber = alarm.name.replace('poll-mta-', '');
      await handlePollMta(buildNumber);
    }
    return;
  }

  const { type, buildNumber } = parsed;

  if (type === ALARM_TYPES.CHECK_STAGE1) {
    await handleCheckStage1(buildNumber);
  } else if (type === ALARM_TYPES.START_POLLING) {
    await handleStartStage2NbMonitoring(buildNumber);
  } else if (type === ALARM_TYPES.POLL_STAGES) {
    await handlePollStagesSequential(buildNumber);
  }
});

async function handleCheckStage1(buildNumber: string): Promise<void> {
  const builds = await getTrackedBuilds();
  const build = builds.get(buildNumber);

  if (!build || build.status !== 'monitoring_stage1') {
    chrome.alarms.clear(createAlarmName(ALARM_TYPES.CHECK_STAGE1, buildNumber));
    return;
  }

  if (!(await shouldContinueStage1Polling(build))) {
    build.status = 'timeout';
    await saveTrackedBuild(buildNumber, build);
    await addToHistory(build);
    await removeTrackedBuild(buildNumber);
    chrome.alarms.clear(createAlarmName(ALARM_TYPES.CHECK_STAGE1, buildNumber));

    await chrome.notifications.create(`timeout-${buildNumber}`, {
      type: 'basic',
      iconUrl: NOTIFICATION_ICON,
      title: 'Build Timeout',
      message: `Stage 1 monitoring for build ${buildNumber} timed out.`,
    });
    return;
  }

  try {
    const config = await chrome.storage.local.get(['orgUrl', 'project', 'pat', 'pipelineIds']);
    const pipelineIds = config.pipelineIds as { stage1: string; stage2: string; stage3: string } | undefined;
    if (!config.orgUrl || !config.project || !config.pat || !pipelineIds?.stage1) {
      console.error('[ADO Tracker] Missing configuration');
      return;
    }

    const stage1Builds = await adoClient.searchBuildsByName(
      config.orgUrl as string,
      config.project as string,
      pipelineIds.stage1,
      buildNumber,
      config.pat as string,
      null
    );

    if (stage1Builds) {
      build.stage1BuildName = stage1Builds.buildNumber;
      build.stage1BuildStatus = stage1Builds.status;
      build.stage1BuildResult = stage1Builds.result;
      await saveTrackedBuild(buildNumber, build);
    }

    if (stage1Builds && stage1Builds.status === 'completed') {
      build.status = 'waiting_stage2_nb';
      build.currentStage = 'stage2_nb';
      build.stage1BuildId = stage1Builds.id;
      build.stage1BuildUrl = stage1Builds.url;
      build.stage1BuildName = stage1Builds.buildNumber;
      build.stage1BuildStatus = stage1Builds.status;
      build.stage1BuildResult = stage1Builds.result;
      build.stage1CompletedAt = Date.now();
      await saveTrackedBuild(buildNumber, build);

      chrome.alarms.clear(createAlarmName(ALARM_TYPES.CHECK_STAGE1, buildNumber));

      const trackerConfig = await getTrackerConfig();
      const delayEnd = build.stage1CompletedAt + trackerConfig.delayAfterStage1Minutes * 60 * 1000;
      chrome.alarms.create(createAlarmName(ALARM_TYPES.START_POLLING, buildNumber), { when: delayEnd });

      await chrome.notifications.create(`stage1-complete-${buildNumber}`, {
        type: 'basic',
        iconUrl: NOTIFICATION_ICON,
        title: 'Stage 1 Complete',
        message: `Build ${buildNumber} Stage 1 completed. Will start monitoring Stage 2 - NB in 20 minutes.`,
      });
    }
  } catch (error) {
    console.error(`[ADO Tracker] Error checking Stage 1 for build ${buildNumber}:`, error);
  }
}

async function handleStartStage2NbMonitoring(buildNumber: string): Promise<void> {
  const builds = await getTrackedBuilds();
  const build = builds.get(buildNumber);

  if (!build || build.status !== 'waiting_stage2_nb') {
    chrome.alarms.clear(createAlarmName(ALARM_TYPES.START_POLLING, buildNumber));
    return;
  }

  build.status = 'monitoring_stage2_nb';
  await saveTrackedBuild(buildNumber, build);

  const trackerConfig = await getTrackerConfig();
  chrome.alarms.create(createAlarmName(ALARM_TYPES.POLL_STAGES, buildNumber), {
    periodInMinutes: trackerConfig.pollingIntervalMinutes,
  });

  chrome.alarms.clear(createAlarmName(ALARM_TYPES.START_POLLING, buildNumber));
}

async function handlePollStagesSequential(buildNumber: string): Promise<void> {
  const builds = await getTrackedBuilds();
  const build = builds.get(buildNumber);

  if (!build) {
    chrome.alarms.clear(createAlarmName(ALARM_TYPES.POLL_STAGES, buildNumber));
    return;
  }

  try {
    const config = await chrome.storage.local.get(['orgUrl', 'project', 'pat', 'pipelineIds']);
    const pipelineIds = config.pipelineIds as { stage1: string; stage2: string; stage3: string };
    if (!config.orgUrl || !config.project || !config.pat || !pipelineIds) {
      console.error('[ADO Tracker] Missing configuration');
      return;
    }

    if (build.status === 'monitoring_stage2_nb') {
      const stage2Nb = await adoClient.searchBuildsByName(
        config.orgUrl as string,
        config.project as string,
        pipelineIds.stage2,
        buildNumber,
        config.pat as string,
        ' - NB - '
      );

      if (stage2Nb && stage2Nb.status === 'completed' && stage2Nb.result === 'succeeded') {
        build.status = 'monitoring_stage3';
        build.currentStage = 'stage3';
        build.stage2NbBuildId = stage2Nb.id;
        build.stage2NbBuildUrl = stage2Nb.url;
        build.stage2NbCompletedAt = Date.now();
        await saveTrackedBuild(buildNumber, build);

        await chrome.notifications.create(`stage2nb-complete-${buildNumber}`, {
          type: 'basic',
          iconUrl: NOTIFICATION_ICON,
          title: 'Stage 2 - NB Complete',
          message: `Build ${buildNumber} Stage 2 - NB completed. Now monitoring Stage 3.`,
        });
      }
    } else if (build.status === 'monitoring_stage3') {
      const stage3 = await adoClient.searchBuildsByName(
        config.orgUrl as string,
        config.project as string,
        pipelineIds.stage3,
        buildNumber,
        config.pat as string,
        null
      );

      if (stage3 && stage3.status === 'completed' && stage3.result === 'succeeded') {
        build.status = 'waiting_stage2_mta';
        build.currentStage = 'stage2_mta';
        build.stage3BuildId = stage3.id;
        build.stage3BuildUrl = stage3.url;
        build.stage3CompletedAt = Date.now();
        await saveTrackedBuild(buildNumber, build);

        chrome.alarms.clear(createAlarmName(ALARM_TYPES.POLL_STAGES, buildNumber));

        const trackerConfig = await getTrackerConfig();
        const delayEnd = build.stage3CompletedAt + trackerConfig.delayAfterStage1Minutes * 60 * 1000;
        chrome.alarms.create(createAlarmName('wait-mta', buildNumber), { when: delayEnd });

        await chrome.notifications.create(`stage3-complete-${buildNumber}`, {
          type: 'basic',
          iconUrl: NOTIFICATION_ICON,
          title: 'Stage 3 Complete',
          message: `Build ${buildNumber} Stage 3 completed. Will start monitoring Stage 2 - MTA in 20 minutes.`,
        });
      }
    }
  } catch (error) {
    console.error(`[ADO Tracker] Error polling stages for build ${buildNumber}:`, error);
  }
}

async function handleStartMtaMonitoring(buildNumber: string): Promise<void> {
  const builds = await getTrackedBuilds();
  const build = builds.get(buildNumber);

  if (!build || build.status !== 'waiting_stage2_mta') {
    chrome.alarms.clear(createAlarmName('wait-mta', buildNumber));
    return;
  }

  build.status = 'monitoring_stage2_mta';
  await saveTrackedBuild(buildNumber, build);

  const trackerConfig = await getTrackerConfig();
  chrome.alarms.create(createAlarmName('poll-mta', buildNumber), {
    periodInMinutes: trackerConfig.pollingIntervalMinutes,
  });

  chrome.alarms.clear(createAlarmName('wait-mta', buildNumber));
}

async function handlePollMta(buildNumber: string): Promise<void> {
  const builds = await getTrackedBuilds();
  const build = builds.get(buildNumber);

  if (!build || build.status !== 'monitoring_stage2_mta') {
    chrome.alarms.clear(createAlarmName('poll-mta', buildNumber));
    return;
  }

  try {
    const config = await chrome.storage.local.get(['orgUrl', 'project', 'pat', 'pipelineIds']);
    const pipelineIds = config.pipelineIds as { stage1: string; stage2: string; stage3: string };
    if (!config.orgUrl || !config.project || !config.pat || !pipelineIds) {
      console.error('[ADO Tracker] Missing configuration');
      return;
    }

    const stage2Mta = await adoClient.searchBuildsByName(
      config.orgUrl as string,
      config.project as string,
      pipelineIds.stage2,
      buildNumber,
      config.pat as string,
      ' - MTA&Cancellation - '
    );

    if (stage2Mta && stage2Mta.status === 'completed' && stage2Mta.result === 'succeeded') {
      build.status = 'completed';
      build.currentStage = 'done';
      build.stage2MtaBuildId = stage2Mta.id;
      build.stage2MtaBuildUrl = stage2Mta.url;
      build.stage2MtaCompletedAt = Date.now();
      await saveTrackedBuild(buildNumber, build);
      await addToHistory(build);
      await removeTrackedBuild(buildNumber);
      chrome.alarms.clear(createAlarmName('poll-mta', buildNumber));

      await chrome.notifications.create(`all-complete-${buildNumber}`, {
        type: 'basic',
        iconUrl: NOTIFICATION_ICON,
        title: 'All Stages Complete',
        message: `Build ${buildNumber} completed all stages! (Stage 1 → Stage 2 NB → Stage 3 → Stage 2 MTA)`,
      });
    }
  } catch (error) {
    console.error(`[ADO Tracker] Error polling MTA for build ${buildNumber}:`, error);
  }
}

async function handleClearAllTracking(): Promise<void> {
  const builds = await getTrackedBuilds();
  
  for (const buildNumber of builds.keys()) {
    chrome.alarms.clear(createAlarmName(ALARM_TYPES.CHECK_STAGE1, buildNumber));
    chrome.alarms.clear(createAlarmName(ALARM_TYPES.START_POLLING, buildNumber));
    chrome.alarms.clear(createAlarmName(ALARM_TYPES.POLL_STAGES, buildNumber));
    chrome.alarms.clear(createAlarmName('wait-mta', buildNumber));
    chrome.alarms.clear(createAlarmName('poll-mta', buildNumber));
    
    await removeTrackedBuild(buildNumber);
  }
  
  console.log('[ADO Tracker] All tracking cleared');
}
