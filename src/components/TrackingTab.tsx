import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Alert, AlertDescription } from './ui/alert';
import { Badge } from './ui/badge';
import { getTrackedBuilds, TrackedBuild } from '../lib/storage';

export function TrackingTab() {
  const [buildNumber, setBuildNumber] = useState('');
  const [trackedBuilds, setTrackedBuilds] = useState<Map<string, TrackedBuild>>(new Map());
  const [error, setError] = useState('');
  const [clearStatus, setClearStatus] = useState<'idle' | 'clearing'>('idle');

  useEffect(() => {
    loadTrackedBuilds();
  }, []);

  const loadTrackedBuilds = async () => {
    try {
      const builds = await getTrackedBuilds();
      setTrackedBuilds(builds);
    } catch (err: any) {
      if (!err.message?.includes('Extension context invalidated')) {
        console.error('Failed to load tracked builds:', err);
      }
    }
  };

  const handleStartTracking = async () => {
    const trimmed = buildNumber.trim();

    if (!trimmed) {
      setError('Please enter a build number');
      return;
    }

    if (!/^\d{4,}$/.test(trimmed)) {
      setError('Build number must be at least 4 digits');
      return;
    }

    try {
      if (!chrome?.runtime?.sendMessage) {
        setError('Chrome extension API not available');
        return;
      }

      await chrome.runtime.sendMessage({
        type: 'START_MANUAL_TRACKING',
        buildNumber: trimmed,
      });

      setBuildNumber('');
      setError('');
      await loadTrackedBuilds();

      chrome.notifications.create(`tracking-started-${trimmed}`, {
        type: 'basic',
        iconUrl: chrome.runtime.getURL('public/icon-128.svg'),
        title: 'Tracking Started',
        message: `Build ${trimmed} has been added to tracking successfully. Monitoring Stage 1.`,
      });
    } catch (err: any) {
      if (err.message?.includes('Extension context invalidated')) {
        setError('Extension reloaded. Please close and reopen the popup.');
      } else {
        setError('Failed to start tracking. Please check configuration.');
      }
    }
  };

  const handleClearAll = async () => {
    if (!confirm('Are you sure you want to clear all tracking? This will abort all active builds.')) {
      return;
    }

    setClearStatus('clearing');
    
    try {
      await chrome.runtime.sendMessage({
        type: 'CLEAR_ALL_TRACKING',
      });

      setTrackedBuilds(new Map());
      setClearStatus('idle');

      chrome.notifications.create('tracking-cleared', {
        type: 'basic',
        iconUrl: chrome.runtime.getURL('public/icon128.png'),
        title: 'Tracking Cleared',
        message: 'All build tracking has been cleared and aborted.',
      });
    } catch (err: any) {
      console.error('Failed to clear tracking:', err);
      setError('Failed to clear tracking. Please try again.');
      setClearStatus('idle');
    }
  };

  const getStatusColor = (status: string) => {
    if (status === 'completed') return 'bg-green-500/10 text-green-700 border-green-500/20';
    if (status === 'failed') return 'bg-red-500/10 text-red-700 border-red-500/20';
    if (status === 'timeout') return 'bg-yellow-500/10 text-yellow-700 border-yellow-500/20';
    if (status.includes('monitoring')) return 'bg-blue-500/10 text-blue-700 border-blue-500/20';
    if (status.includes('waiting')) return 'bg-purple-500/10 text-purple-700 border-purple-500/20';
    return 'bg-gray-500/10 text-gray-700 border-gray-500/20';
  };

  const getStageLabel = (currentStage: string) => {
    if (currentStage === 'stage1') return 'Stage 1';
    if (currentStage === 'stage2_nb') return 'Stage 2 - NB';
    if (currentStage === 'stage3') return 'Stage 3';
    if (currentStage === 'stage2_mta') return 'Stage 2 - MTA';
    return 'Done';
  };

  const getNextStage = (currentStage: string) => {
    if (currentStage === 'stage1') return 'Stage 2 - NB';
    if (currentStage === 'stage2_nb') return 'Stage 3';
    if (currentStage === 'stage3') return 'Stage 2 - MTA';
    if (currentStage === 'stage2_mta') return 'Complete';
    return 'N/A';
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Start Build Tracking</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="buildNumber">Build Number</Label>
            <Input
              id="buildNumber"
              type="text"
              placeholder="e.g., 12345"
              value={buildNumber}
              onChange={(e) => setBuildNumber(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleStartTracking()}
            />
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button onClick={handleStartTracking} className="w-full">
            Start Tracking
          </Button>

          <div className="text-xs text-muted-foreground space-y-1">
            <p>Tracking sequence:</p>
            <ol className="list-decimal list-inside space-y-1 ml-2">
              <li>Monitor Stage 1 until completed</li>
              <li>Wait 20 minutes</li>
              <li>Monitor Stage 2 - NB until completed</li>
              <li>Monitor Stage 3 until completed</li>
              <li>Wait 20 minutes</li>
              <li>Monitor Stage 2 - MTA until completed</li>
            </ol>
          </div>
        </CardContent>
      </Card>

      {trackedBuilds.size > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Active Builds</h3>
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleClearAll}
              disabled={clearStatus === 'clearing'}
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              {clearStatus === 'clearing' ? 'Clearing...' : 'Clear All'}
            </Button>
          </div>
          
          <div className="space-y-2">
            {Array.from(trackedBuilds.values()).map((build) => (
              <Card key={build.buildNumber} className="border-l-4 border-l-blue-500">
                <CardContent className="py-3 px-4">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-muted-foreground">Build Number:</span>
                      <p className="font-medium">{build.buildNumber}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Time Triggered:</span>
                      <p className="font-medium">{new Date(build.startedAt).toLocaleString()}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Stage 1 Build Name:</span>
                      <p className="font-medium">{build.stage1BuildName || 'Searching...'}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Stage 1 Status:</span>
                      <p className="font-medium">{build.stage1BuildStatus || 'Pending'}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Stage 1 Result:</span>
                      <p className="font-medium">{build.stage1BuildResult || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Current Stage:</span>
                      <Badge className={getStatusColor(build.status)}>{getStageLabel(build.currentStage)}</Badge>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Next Stage:</span>
                      <p className="font-medium">{getNextStage(build.currentStage)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
