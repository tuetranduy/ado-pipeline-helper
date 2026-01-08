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

type TabType = "search" | "tracking" | "history" | "settings";

function Popup() {
  const [activeTab, setActiveTab] = useState<TabType>("tracking");
  const [stages, setStages] = useState<StageResult[]>([]);
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

    const buildResults = await Promise.all(
      pipelines.map(async (pipeline) => {
        try {
          const build = await client.searchBuildsByName(
            config.orgUrl,
            config.project,
            pipeline.id,
            config.buildId,
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

    const expandedResults = buildResults;

    setStages(expandedResults);
    setLoading(false);

    // Fetch artifacts for found builds
    const artifactResults = await Promise.all(
      expandedResults.map(async (result) => {
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
  };

  return (
    <div className="w-[400px] min-h-[600px] p-4 space-y-4">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">ADO Build Tracker</h1>
        <p className="text-sm text-muted-foreground">
          Track builds and search artifacts
        </p>
      </div>

      <div className="pt-2 border-t">
        <a
          href="fullpage.html"
          target="_blank"
          className="text-sm text-primary hover:underline"
          style={{ color: "blue" }}
        >
          Open Full Page View ↗
        </a>
      </div>

      <div className="flex gap-2 border-b">
        {/* <button
          onClick={() => setActiveTab("tracking")}
          className={`pb-2 px-4 text-sm font-medium transition-colors ${
            activeTab === "tracking"
              ? "border-b-2 border-primary text-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Tracking
        </button> */}
        <button
          onClick={() => setActiveTab("search")}
          className={`pb-2 px-4 text-sm font-medium transition-colors ${
            activeTab === "search"
              ? "border-b-2 border-primary text-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Search
        </button>
        {/* <button
          onClick={() => setActiveTab("history")}
          className={`pb-2 px-4 text-sm font-medium transition-colors ${
            activeTab === "history"
              ? "border-b-2 border-primary text-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          History
        </button> */}
        <button
          onClick={() => setActiveTab("settings")}
          className={`pb-2 px-4 text-sm font-medium transition-colors ${
            activeTab === "settings"
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
        <>
          <ConfigForm onSubmit={handleSearch} loading={loading} />

          {stages.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-lg font-semibold">Results</h2>
              <BuildResults stages={stages} loading={loading} />
            </div>
          )}
        </>
      )}
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <Popup />
    </ErrorBoundary>
  );
}

export default App;
