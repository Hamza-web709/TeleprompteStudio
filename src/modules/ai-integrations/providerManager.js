import { AIProviderBase } from './aiProviderBase.js';
import { eventBus } from '../../state/eventBus.js';

export class EyeContactCorrectionAdapter extends AIProviderBase {
  constructor() {
    super('Eye Contact Correction', 'eye-contact');
  }

  async process(videoBlob) {
    if (!this.isConfigured) {
      throw new Error(
        'Eye Contact Correction service is unconfigured. Please configure your AI provider endpoint and credentials in Settings > AI Integrations.'
      );
    }

    // Call server proxy
    const res = await fetch(`${this.endpoint}/api/ai/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'eye-contact', provider: this.name })
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Eye contact processing failed.');
    }
    return data;
  }
}

export class AISegmentationAdapter extends AIProviderBase {
  constructor() {
    super('AI Background Segmentation', 'segmentation');
  }

  async process(imageOrFrame) {
    if (!this.isConfigured) {
      throw new Error(
        'AI Segmentation model is unconfigured. Built-in Chroma Key Green Screen is active as local fallback.'
      );
    }

    const res = await fetch(`${this.endpoint}/api/ai/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'segmentation', provider: this.name })
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Segmentation processing failed.');
    }
    return data;
  }
}

export class CloudTranscriptionAdapter extends AIProviderBase {
  constructor() {
    super('Cloud Whisper Transcription', 'transcription');
  }

  async process(audioBlob) {
    if (!this.isConfigured) {
      throw new Error(
        'Cloud Transcription model is unconfigured. Local Web Speech API transcription is active.'
      );
    }

    const res = await fetch(`${this.endpoint}/api/ai/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'transcription', provider: this.name })
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Transcription failed.');
    }
    return data;
  }
}

class AIProviderManager {
  constructor() {
    this.providers = {
      eyeContact: new EyeContactCorrectionAdapter(),
      segmentation: new AISegmentationAdapter(),
      transcription: new CloudTranscriptionAdapter()
    };
  }

  configureProvider(key, config) {
    if (this.providers[key]) {
      this.providers[key].configure(config);
      eventBus.emit('ai:configured', { key, status: this.providers[key].getStatus() });
    }
  }

  getAllStatuses() {
    const statuses = {};
    for (const [key, provider] of Object.entries(this.providers)) {
      statuses[key] = provider.getStatus();
    }
    return statuses;
  }
}

export const aiProviderManager = new AIProviderManager();
