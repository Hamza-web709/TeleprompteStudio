/**
 * Base AI Provider Adapter
 */

export class AIProviderBase {
  constructor(name, type) {
    this.name = name;
    this.type = type; // 'eye-contact' | 'segmentation' | 'transcription'
    this.isConfigured = false;
    this.endpoint = '';
  }

  configure(config) {
    this.endpoint = config.endpoint || '';
    this.isConfigured = Boolean(this.endpoint);
  }

  getStatus() {
    return {
      name: this.name,
      type: this.type,
      isConfigured: this.isConfigured,
      endpoint: this.endpoint
    };
  }

  async process() {
    throw new Error(`process() method must be implemented by ${this.name}`);
  }
}
