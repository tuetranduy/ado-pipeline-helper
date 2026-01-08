import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Alert, AlertDescription } from './ui/alert';
import { PIPELINE_IDS } from '../lib/constants';

export function SettingsTab() {
  const [orgUrl, setOrgUrl] = useState('');
  const [project, setProject] = useState('');
  const [pat, setPat] = useState('');
  const [pipelineStage1, setPipelineStage1] = useState<string>(PIPELINE_IDS.STAGE_1);
  const [pipelineStage2, setPipelineStage2] = useState<string>(PIPELINE_IDS.STAGE_2);
  const [pipelineStage3, setPipelineStage3] = useState<string>(PIPELINE_IDS.STAGE_3);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');

  const timersRef = useRef<{ [key: string]: NodeJS.Timeout }>({});

  useEffect(() => {
    chrome.storage.local.get(
      ['orgUrl', 'project', 'pat', 'pipelineIds'],
      (result: any) => {
        if (chrome.runtime.lastError) {
          console.error('Failed to load settings:', chrome.runtime.lastError);
          return;
        }
        if (result.orgUrl) setOrgUrl(result.orgUrl);
        if (result.project) setProject(result.project);
        if (result.pat) setPat(result.pat);
        if (result.pipelineIds) {
          setPipelineStage1(result.pipelineIds.stage1 || PIPELINE_IDS.STAGE_1);
          setPipelineStage2(result.pipelineIds.stage2 || PIPELINE_IDS.STAGE_2);
          setPipelineStage3(result.pipelineIds.stage3 || PIPELINE_IDS.STAGE_3);
        }
      }
    );

    return () => {
      Object.values(timersRef.current).forEach(clearTimeout);
    };
  }, []);

  const handlePipelineChange = useCallback((stage: 'stage1' | 'stage2' | 'stage3', value: string) => {
    const setters = { stage1: setPipelineStage1, stage2: setPipelineStage2, stage3: setPipelineStage3 };
    setters[stage](value);
  }, []);

  const handleSave = async () => {
    setSaveStatus('saving');
    
    try {
      const pipelineIds = {
        stage1: pipelineStage1,
        stage2: pipelineStage2,
        stage3: pipelineStage3,
      };

      await chrome.storage.local.set({
        orgUrl,
        project,
        pat,
        pipelineIds,
      });

      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (error) {
      console.error('Failed to save settings:', error);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Azure DevOps Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="orgUrl">Organization URL</Label>
            <Input
              id="orgUrl"
              type="url"
              placeholder="https://dev.azure.com/yourorg"
              value={orgUrl}
              onChange={(e) => setOrgUrl(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="project">Project</Label>
            <Input
              id="project"
              type="text"
              placeholder="MyProject"
              value={project}
              onChange={(e) => setProject(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="pat">Personal Access Token</Label>
            <Input
              id="pat"
              type="password"
              placeholder="PAT"
              value={pat}
              onChange={(e) => setPat(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Pipeline IDs</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pipelineStage1">Stage 1 Pipeline ID</Label>
            <Input
              id="pipelineStage1"
              type="text"
              placeholder="747"
              value={pipelineStage1}
              onChange={(e) => handlePipelineChange('stage1', e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="pipelineStage2">Stage 2 Pipeline ID</Label>
            <Input
              id="pipelineStage2"
              type="text"
              placeholder="712"
              value={pipelineStage2}
              onChange={(e) => handlePipelineChange('stage2', e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="pipelineStage3">Stage 3 Pipeline ID</Label>
            <Input
              id="pipelineStage3"
              type="text"
              placeholder="1172"
              value={pipelineStage3}
              onChange={(e) => handlePipelineChange('stage3', e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {saveStatus === 'success' && (
        <Alert className="bg-green-50 text-green-900 border-green-200">
          <AlertDescription>Settings saved successfully!</AlertDescription>
        </Alert>
      )}

      {saveStatus === 'error' && (
        <Alert variant="destructive">
          <AlertDescription>Failed to save settings. Please try again.</AlertDescription>
        </Alert>
      )}

      <Button 
        onClick={handleSave} 
        disabled={saveStatus === 'saving'}
        className="w-full"
      >
        {saveStatus === 'saving' ? 'Saving...' : 'Save Settings'}
      </Button>
    </div>
  );
}
