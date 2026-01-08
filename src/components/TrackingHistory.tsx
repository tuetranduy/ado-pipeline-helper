import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { HistoricalBuild } from '../lib/storage';

export function TrackingHistory() {
  const [history, setHistory] = useState<HistoricalBuild[]>([]);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      const result = await chrome.storage.local.get('buildHistory');
      const builds = (result.buildHistory || []) as HistoricalBuild[];
      setHistory(builds.sort((a, b) => b.completedAt - a.completedAt));
    } catch (error: any) {
      if (error.message?.includes('Extension context invalidated')) {
        console.warn('[ADO Tracker] Extension context invalidated. Please refresh.');
      } else {
        console.error('Failed to load tracking history:', error);
      }
    }
  };

  const getStatusColor = (status: string) => {
    if (status === 'completed') return 'bg-green-500/10 text-green-700 border-green-500/20';
    if (status === 'failed') return 'bg-red-500/10 text-red-700 border-red-500/20';
    if (status === 'timeout') return 'bg-yellow-500/10 text-yellow-700 border-yellow-500/20';
    return 'bg-gray-500/10 text-gray-700 border-gray-500/20';
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  const formatDuration = (start: number, end: number) => {
    const minutes = Math.floor((end - start) / 1000 / 60);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  };

  if (history.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No tracking history yet
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {history.map((build) => (
        <Card key={build.buildNumber} className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center justify-between">
              <span>Build {build.buildNumber}</span>
              <Badge className={getStatusColor(build.status)}>{build.status}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Started:</span>
                <span>{formatDate(build.startedAt)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Completed:</span>
                <span>{formatDate(build.completedAt)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Duration:</span>
                <span>{formatDuration(build.startedAt, build.completedAt)}</span>
              </div>
              {build.stage1BuildUrl && (
                <div className="pt-2 border-t">
                  <a
                    href={build.stage1BuildUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline text-sm"
                  >
                    View Stage 1 Build →
                  </a>
                </div>
              )}
            </div>

            {(build.stage2NbBuildUrl || build.stage3BuildUrl || build.stage2MtaBuildUrl) && (
              <div className="pt-2 border-t">
                <span className="text-sm font-medium">Stage URLs:</span>
                <div className="space-y-2 mt-2">
                  {build.stage2NbBuildUrl && (
                    <div className="flex items-center justify-between text-sm">
                      <span>Stage 2 - NB</span>
                      <a
                        href={build.stage2NbBuildUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        View →
                      </a>
                    </div>
                  )}
                  {build.stage3BuildUrl && (
                    <div className="flex items-center justify-between text-sm">
                      <span>Stage 3</span>
                      <a
                        href={build.stage3BuildUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        View →
                      </a>
                    </div>
                  )}
                  {build.stage2MtaBuildUrl && (
                    <div className="flex items-center justify-between text-sm">
                      <span>Stage 2 - MTA</span>
                      <a
                        href={build.stage2MtaBuildUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        View →
                      </a>
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
