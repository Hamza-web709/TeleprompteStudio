import { appState } from '../../state/appState.js';

let qrCodeModule = null;
async function getQRCode() {
  if (!qrCodeModule) {
    const mod = await import('qrcode');
    qrCodeModule = mod.default || mod;
  }
  return qrCodeModule;
}

class QRPairingManager {
  constructor() {
    this.sessionToken = null;
    this.lastRemoteUrl = '';
  }

  generateSessionToken() {
    this.sessionToken = Math.random().toString(36).substring(2, 8).toUpperCase();
    appState.update('remote', { token: this.sessionToken });
    return this.sessionToken;
  }

  async renderQRCode(canvasElement, customHost = null) {
    if (!canvasElement) return;

    if (!this.sessionToken) {
      this.generateSessionToken();
    }

    const basePath = (typeof window !== 'undefined' ? window.location.pathname.replace(/\/[^/]*$/, '') : '') || '';
    const origin = (typeof window !== 'undefined' ? window.location.origin : '') || '';
    const defaultHost = origin ? (origin + basePath) : 'http://localhost:3100';
    const host = (customHost || defaultHost).replace(/\/+$/, '');
    this.lastRemoteUrl = `${host}/remote.html?session=${this.sessionToken}`;

    try {
      const QRCode = await getQRCode();
      await QRCode.toCanvas(canvasElement, this.lastRemoteUrl, {
        width: 220,
        margin: 2,
        color: {
          dark: '#0f172a',
          light: '#ffffff'
        }
      });
      return this.lastRemoteUrl;
    } catch (err) {
      console.error('[QRPairing] QR generation failed:', err);
      return null;
    }
  }

  getToken() {
    return this.sessionToken || this.generateSessionToken();
  }
}

export const qrPairingManager = new QRPairingManager();
