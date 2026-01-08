import { useState } from "react";
import { ConfigForm } from "./components/ConfigForm";
import { BuildResults } from "./components/BuildResults";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { TrackingTab } from "./components/TrackingTab";
import { TrackingHistory } from "./components/TrackingHistory";
import { SettingsTab } from "./components/SettingsTab";
import { AdoClient } from "./lib/ado-client";
import { Build, Artifact } from "./types/ado";
import "./index.css";

interface StageResult {
  stage: string;
  build: Build | null;
  artifacts: Artifact[];
  error?: string;
  loadingArtifacts?: boolean;
}

interface BuildColumn {
  buildId: string;
  stages: StageResult[];
}

type TabType = "search" | "tracking" | "history" | "settings";

function FullPage() {
  const [activeTab, setActiveTab] = useState<TabType>("search");
  const [stages, setStages] = useState<StageResult[]>([]);
  const [buildColumns, setBuildColumns] = useState<BuildColumn[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async (config: {
    orgUrl: string;
    project: string;
    pat: string;
    buildId: string;
    pipelineIds: { stage1: string; stage2: string; stage3: string };
  }) => {
    setLoading(true);
    setStages([]);
    setBuildColumns([]);

    const client = new AdoClient();
    const pipelines = [
      {
        id: config.pipelineIds.stage1,
        name: "Stage 1",
        stage: 1,
        buildTypeFilter: null,
      },
      {
        id: config.pipelineIds.stage2,
        name: "Stage 2 - NB",
        stage: 2,
        buildTypeFilter: " - NB - ",
      },
      {
        id: config.pipelineIds.stage3,
        name: "Stage 3",
        stage: 3,
        buildTypeFilter: null,
      },
      {
        id: config.pipelineIds.stage2,
        name: "Stage 2 - MTA",
        stage: 2,
        buildTypeFilter: " - MTA&Cancellation - ",
      },
    ];

    // Parse build IDs (comma-separated)
    const buildIds = config.buildId
      .split(',')
      .map(id => id.trim())
      .filter(id => id.length > 0);

    if (buildIds.length === 1) {
      // Single build - use original layout
      const buildResults = await Promise.all(
        pipelines.map(async (pipeline) => {
          try {
            const build = await client.searchBuildsByName(
              config.orgUrl,
              config.project,
              pipeline.id,
              buildIds[0],
              config.pat,
              pipeline.buildTypeFilter
            );

            return {
              stage: pipeline.name,
              stageNum: pipeline.stage,
              build,
              artifacts: [],
              loadingArtifacts: build !== null,
            };
          } catch (error) {
            return {
              stage: pipeline.name,
              stageNum: pipeline.stage,
              build: null,
              artifacts: [],
              error: error instanceof Error ? error.message : "Unknown error",
            };
          }
        })
      );

      setStages(buildResults);
      setLoading(false);

      // Fetch artifacts for found builds
      const artifactResults = await Promise.all(
        buildResults.map(async (result) => {
          if (result.build) {
            try {
              const artifacts = await client.getArtifacts(
                config.orgUrl,
                config.project,
                result.build.id,
                config.pat
              );
              return {
                ...result,
                artifacts,
                loadingArtifacts: false,
              };
            } catch (error) {
              return {
                ...result,
                artifacts: [],
                loadingArtifacts: false,
              };
            }
          }
          return result;
        })
      );

      setStages(artifactResults);
    } else {
      // Multiple builds - use column layout
      const columnsData = await Promise.all(
        buildIds.map(async (buildId) => {
          const buildResults = await Promise.all(
            pipelines.map(async (pipeline) => {
              try {
                const build = await client.searchBuildsByName(
                  config.orgUrl,
                  config.project,
                  pipeline.id,
                  buildId,
                  config.pat,
                  pipeline.buildTypeFilter
                );

                return {
                  stage: pipeline.name,
                  stageNum: pipeline.stage,
                  build,
                  artifacts: [],
                  loadingArtifacts: build !== null,
                };
              } catch (error) {
                return {
                  stage: pipeline.name,
                  stageNum: pipeline.stage,
                  build: null,
                  artifacts: [],
                  error: error instanceof Error ? error.message : "Unknown error",
                };
              }
            })
          );

          return {
            buildId,
            stages: buildResults,
          };
        })
      );

      setBuildColumns(columnsData);
      setLoading(false);

      // Fetch artifacts for all columns
      const updatedColumns = await Promise.all(
        columnsData.map(async (column) => {
          const artifactResults = await Promise.all(
            column.stages.map(async (result) => {
              if (result.build) {
                try {
                  const artifacts = await client.getArtifacts(
                    config.orgUrl,
                    config.project,
                    result.build.id,
                    config.pat
                  );
                  return {
                    ...result,
                    artifacts,
                    loadingArtifacts: false,
                  };
                } catch (error) {
                  return {
                    ...result,
                    artifacts: [],
                    loadingArtifacts: false,
                  };
                }
              }
              return result;
            })
          );

          return {
            ...column,
            stages: artifactResults,
          };
        })
      );

      setBuildColumns(updatedColumns);
    }
  };

  return (
    <div className="container max-w-4xl mx-auto p-8 space-y-6">
      <div className="space-y-3">
        <h1 className="text-3xl font-bold">PremFina Build Tracker</h1>
        <p className="text-muted-foreground">
          Track builds and search artifacts
        </p>
      </div>

      <div className="flex gap-2 border-b">
        {/* <button
          onClick={() => setActiveTab('tracking')}
          className={`pb-2 px-4 text-sm font-medium transition-colors ${
            activeTab === 'tracking'
              ? 'border-b-2 border-primary text-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Tracking
        </button> */}
        <button
          onClick={() => setActiveTab("search")}
          className={`pb-2 px-4 text-sm font-medium transition-colors ${activeTab === "search"
              ? "border-b-2 border-primary text-primary"
              : "text-muted-foreground hover:text-foreground"
            }`}
        >
          Search
        </button>
        {/* <button
          onClick={() => setActiveTab('history')}
          className={`pb-2 px-4 text-sm font-medium transition-colors ${
            activeTab === 'history'
              ? 'border-b-2 border-primary text-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          History
        </button> */}
        <button
          onClick={() => setActiveTab("settings")}
          className={`pb-2 px-4 text-sm font-medium transition-colors ${activeTab === "settings"
              ? "border-b-2 border-primary text-primary"
              : "text-muted-foreground hover:text-foreground"
            }`}
        >
          Settings
        </button>
      </div>

      {activeTab === "tracking" ? (
        <TrackingTab />
      ) : activeTab === "history" ? (
        <TrackingHistory />
      ) : activeTab === "settings" ? (
        <SettingsTab />
      ) : (
        <div className="space-y-6">
          <ConfigForm onSubmit={handleSearch} loading={loading} />

          {stages.length > 0 || buildColumns.length > 0 ? (
            <div className="space-y-3">
              <h2 className="text-xl font-semibold">Results</h2>
              {buildColumns.length > 0 ? (
                <div className="space-y-4">
                  <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${buildColumns.length}, minmax(0, 1fr))` }}>
                    {buildColumns.map((column, idx) => (
                      <div key={idx} className="text-center">
                        <h3 className="text-sm font-semibold border-b pb-2">Build: {column.buildId}</h3>
                      </div>
                    ))}
                  </div>
                  <BuildResults columns={buildColumns} loading={false} />
                </div>
              ) : (
                <BuildResults stages={stages} loading={loading} />
              )}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <FullPage />
    </ErrorBoundary>
  );
}

export default App;
