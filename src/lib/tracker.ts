import { TrackedBuild } from './storage';
import { getTrackerConfig } from './config';

export const ALARM_TYPES = {
  CHECK_STAGE1: 'check-stage1',
  START_POLLING: 'start-polling',
  POLL_STAGES: 'poll-stages',
} as const;

export const POLLING_CONFIG = {
  STAGE1_INTERVAL_MINUTES: 2,
  STAGE1_MAX_ATTEMPTS: 60,
  DELAY_AFTER_STAGE1_MINUTES: 20,
  POLLING_INTERVAL_MINUTES: 5,
  POLLING_MAX_ATTEMPTS: 24,
} as const;

export function createAlarmName(type: string, buildNumber: string): string {
  const sanitized = buildNumber.replace(/[^a-zA-Z0-9-]/g, '');
  return `${type}-${sanitized}`;
}

export function parseAlarmName(alarmName: string): { type: string; buildNumber: string } | null {
  const match = alarmName.match(/^(check-stage1|start-polling|poll-stages)-(.+)$/);
  if (!match) return null;
  return { type: match[1], buildNumber: match[2] };
}

export function validateBuildNumber(buildNumber: string): boolean {
  return /^\d{4,}$/.test(buildNumber);
}

export async function shouldContinueStage1Polling(build: TrackedBuild): Promise<boolean> {
  const config = await getTrackerConfig();
  const elapsedMinutes = (Date.now() - build.startedAt) / 1000 / 60;
  return elapsedMinutes < config.stage1IntervalMinutes * config.stage1MaxAttempts;
}

export async function shouldContinueStagePolling(build: TrackedBuild): Promise<boolean> {
  const config = await getTrackerConfig();
  const elapsedMinutes = (Date.now() - build.startedAt) / 1000 / 60;
  return elapsedMinutes < config.pollingIntervalMinutes * config.pollingMaxAttempts;
}
