import { describe, it, expect, vi } from 'vitest';
import {
  createAlarmName,
  parseAlarmName,
  shouldContinueStage1Polling,
  shouldContinueStagePolling,
  validateBuildNumber,
  ALARM_TYPES,
  POLLING_CONFIG,
} from './tracker';
import { TrackedBuild } from './storage';

vi.mock('./config', () => ({
  getTrackerConfig: vi.fn(() => Promise.resolve({
    stage1IntervalMinutes: 2,
    stage1MaxAttempts: 60,
    delayAfterStage1Minutes: 20,
    pollingIntervalMinutes: 5,
    pollingMaxAttempts: 24,
  })),
}));

describe('tracker utilities', () => {
  describe('createAlarmName', () => {
    it('should create alarm name with type and build number', () => {
      const name = createAlarmName(ALARM_TYPES.CHECK_STAGE1, '12345');
      expect(name).toBe('check-stage1-12345');
    });
  });

  describe('parseAlarmName', () => {
    it('should parse valid alarm name', () => {
      const result = parseAlarmName('check-stage1-12345');
      expect(result).toEqual({
        type: 'check-stage1',
        buildNumber: '12345',
      });
    });

    it('should parse poll-stages alarm', () => {
      const result = parseAlarmName('poll-stages-67890');
      expect(result).toEqual({
        type: 'poll-stages',
        buildNumber: '67890',
      });
    });

    it('should return null for invalid alarm name', () => {
      const result = parseAlarmName('invalid-alarm');
      expect(result).toBeNull();
    });
  });

  describe('validateBuildNumber', () => {
    it('should return true for valid build numbers', () => {
      expect(validateBuildNumber('12345')).toBe(true);
      expect(validateBuildNumber('9876543210')).toBe(true);
    });

    it('should return false for invalid build numbers', () => {
      expect(validateBuildNumber('123')).toBe(false);
      expect(validateBuildNumber('abc')).toBe(false);
      expect(validateBuildNumber('12345-retry')).toBe(false);
    });
  });

  describe('shouldContinueStage1Polling', () => {
    it('should return true when within timeout', async () => {
      const build: TrackedBuild = {
        buildNumber: '12345',
        status: 'monitoring_stage1',
        currentStage: 'stage1',
        startedAt: Date.now() - 30 * 60 * 1000,
      };

      expect(await shouldContinueStage1Polling(build)).toBe(true);
    });

    it('should return false when timeout exceeded', async () => {
      const build: TrackedBuild = {
        buildNumber: '12345',
        status: 'monitoring_stage1',
        currentStage: 'stage1',
        startedAt: Date.now() - (POLLING_CONFIG.STAGE1_MAX_ATTEMPTS * POLLING_CONFIG.STAGE1_INTERVAL_MINUTES + 1) * 60 * 1000,
      };

      expect(await shouldContinueStage1Polling(build)).toBe(false);
    });
  });

  describe('shouldContinueStagePolling', () => {
    it('should return true when within timeout', async () => {
      const build: TrackedBuild = {
        buildNumber: '12345',
        status: 'monitoring_stage2_nb',
        currentStage: 'stage2_nb',
        startedAt: Date.now() - 30 * 60 * 1000,
      };

      expect(await shouldContinueStagePolling(build)).toBe(true);
    });

    it('should return false when timeout exceeded', async () => {
      const build: TrackedBuild = {
        buildNumber: '12345',
        status: 'monitoring_stage2_nb',
        currentStage: 'stage2_nb',
        startedAt: Date.now() - (POLLING_CONFIG.POLLING_MAX_ATTEMPTS * POLLING_CONFIG.POLLING_INTERVAL_MINUTES + 1) * 60 * 1000,
      };

      expect(await shouldContinueStagePolling(build)).toBe(false);
    });

    it('should return false when pollingStartedAt is undefined', async () => {
      const build: TrackedBuild = {
        buildNumber: '12345',
        status: 'monitoring_stage1',
        currentStage: 'stage1',
        startedAt: Date.now(),
      };

      expect(await shouldContinueStagePolling(build)).toBe(true);
    });
  });
});
