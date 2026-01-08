
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
        <Card key={index}>
          <CardHeader>
            <CardTitle className="text-base">{stage.stage}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {stage.error ? (
              <Alert variant="destructive">
                <AlertDescription>{stage.error}</AlertDescription>
              </Alert>
            ) : stage.build ? (
              <>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Build Number:</span>
                    <a
                      href={stage.build.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary hover:underline"
                    >
                      {stage.build.buildNumber}
                    </a>
                    <Badge variant="secondary">{stage.build.status}</Badge>
                  </div>
                  {stage.build.name && (
                    <div className="text-sm text-muted-foreground">
                      {stage.build.name}
                    </div>
                  )}
                </div>

                <div className="space-y-2 pt-2">
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
                            className="text-sm text-primary hover:underline"
                          >
                            {artifact.name}
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
