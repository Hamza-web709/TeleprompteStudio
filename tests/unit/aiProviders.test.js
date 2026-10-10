import { describe, it, expect } from 'vitest';
import { EyeContactCorrectionAdapter, AISegmentationAdapter, CloudTranscriptionAdapter } from '../../src/modules/ai-integrations/providerManager.js';

describe('AI Provider Adapters & Gateway Genuine Requests', () => {
  it('strictly rejects when adapter is unconfigured', async () => {
    const eyeAdapter = new EyeContactCorrectionAdapter();
    const segAdapter = new AISegmentationAdapter();
    const whisperAdapter = new CloudTranscriptionAdapter();

    expect(eyeAdapter.getStatus().isConfigured).toBe(false);
    expect(segAdapter.getStatus().isConfigured).toBe(false);
    expect(whisperAdapter.getStatus().isConfigured).toBe(false);

    await expect(eyeAdapter.process()).rejects.toThrow('unconfigured');
    await expect(segAdapter.process()).rejects.toThrow('unconfigured');
    await expect(whisperAdapter.process()).rejects.toThrow('unconfigured');
  });

  it('performs genuine HTTP request to server and catches PROVIDER_UNCONFIGURED (503)', async () => {
    const eyeAdapter = new EyeContactCorrectionAdapter();
    eyeAdapter.configure({ endpoint: 'http://localhost:8080' });
    expect(eyeAdapter.getStatus().isConfigured).toBe(true);

    // Live fetch against real server running on port 8080
    await expect(eyeAdapter.process()).rejects.toThrow(/AI_PROVIDER_KEY is not configured/);
  });

  it('performs genuine HTTP transcription request and catches missing cloud key', async () => {
    const whisperAdapter = new CloudTranscriptionAdapter();
    whisperAdapter.configure({ endpoint: 'http://localhost:8080' });

    await expect(whisperAdapter.process()).rejects.toThrow(/AI_PROVIDER_KEY is not configured/);
  });
});
