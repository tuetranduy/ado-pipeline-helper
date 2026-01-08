
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import { Build, Artifact } from '../types/ado';
import { Loader2 } from 'lucide-react';

interface StageResult {
  stage: string;
  build: Build | null;
  artifacts: Artifact[];
  error?: string;
  loadingArtifacts?: boolean;
}

interface BuildResultsProps {
  stages: StageResult[];
  loading: boolean;
}

export function BuildResults({ stages, loading }: BuildResultsProps) {
  const getStageColor = (stageName: string) => {
    if (stageName.includes('Stage 1')) return 'border-l-4 border-l-blue-500';
    if (stageName.includes('Stage 2 - NB')) return 'border-l-4 border-l-green-500';
    if (stageName.includes('Stage 3')) return 'border-l-4 border-l-purple-500';
    if (stageName.includes('Stage 2 - MTA')) return 'border-l-4 border-l-orange-500';
    return '';
  };

  const getStatusColor = (status: string) => {
    if (status === 'completed') return 'bg-green-500/10 text-green-700 border-green-500/20';
    if (status === 'inProgress') return 'bg-blue-500/10 text-blue-700 border-blue-500/20';
    if (status === 'cancelling') return 'bg-yellow-500/10 text-yellow-700 border-yellow-500/20';
    if (status === 'failed') return 'bg-red-500/10 text-red-700 border-red-500/20';
    return 'bg-gray-500/10 text-gray-700 border-gray-500/20';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (stages.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      {stages.map((stage, index) => (
        <Card key={index} className={getStageColor(stage.stage)}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">{stage.stage}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {stage.error ? (
              <Alert variant="destructive">
                <AlertDescription>{stage.error}</AlertDescription>
              </Alert>
            ) : stage.build ? (
              <>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">Build Number:</span>
                    <a
                      href={stage.build.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:text-blue-800 hover:underline font-medium"
                    >
                      {stage.build.buildNumber}
                    </a>
                    <Badge className={getStatusColor(stage.build.status)}>{stage.build.status}</Badge>
                  </div>
                  {stage.build.name && (
                    <div className="text-sm text-muted-foreground">
                      {stage.build.name}
                    </div>
                  )}
                </div>

                <div className="space-y-2 pt-2 border-t">
                  <span className="text-sm font-medium">Artifacts:</span>
                  {stage.loadingArtifacts ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Loading artifacts...</span>
                    </div>
                  ) : stage.artifacts.length > 0 ? (
                    <ul className="space-y-1">
                      {stage.artifacts.map((artifact) => (
                        <li key={artifact.id}>
                          <a
                            href={artifact.resource.downloadUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
                          >
                            📦 {artifact.name}
                          </a>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">No artifacts</p>
                  )}
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No builds found</p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
