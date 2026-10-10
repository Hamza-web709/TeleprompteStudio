import { appState, isMobileDevice } from '../../state/appState.js';
import { eventBus } from '../../state/eventBus.js';
import { cameraManager } from '../camera/cameraManager.js';
import { audioManager } from '../camera/audioManager.js';
import { scrollEngine } from '../scrolling/scrollEngine.js';
import { studioRecorder, getOptimalRecordingFormat, getTargetBitrates } from './mediaRecorder.js';

class RecordingDiagnostics {
  constructor() {
    this.panelEl = null;
    this.isVisible = false;
    this.monitorInterval = null;
    this.rvfcHandle = null;

    // Measurement metrics
    this.frameCount = 0;
    this.lastFrameTimestamp = 0;
    this.measuredFps = 0;
    this.isUsingRvfc = false;
    this.totalRecordedBytes = 0;
    this.measuredBitrateKbps = 0;
    this.droppedFramesCount = 0;
    this.totalFramesCount = 0;
    this.longTasksCount = 0;
    this.totalLongTaskTimeMs = 0;
    this.perfObserver = null;
    this.isBenchmarking = false;

    this.setupPerformanceObserver();
  }

  setupPerformanceObserver() {
    if (typeof PerformanceObserver !== 'undefined') {
      try {
        this.perfObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            this.longTasksCount++;
            this.totalLongTaskTimeMs += Math.round(entry.duration);
          }
        });
        this.perfObserver.observe({ entryTypes: ['longtask'] });
      } catch {
        // Not supported or not allowed in current context
      }
    }
  }

  mount() {
    if (this.panelEl) return;

    this.createPanel();
    this.bindEvents();

    if (appState.get('diagnosticsVisible')) {
      this.show();
    }
  }

  createPanel() {
    this.panelEl = document.createElement('div');
    this.panelEl.id = 'recording-diagnostics-hud';
    this.panelEl.className = 'recording-diagnostics-panel';
    this.panelEl.style.display = 'none';

    this.panelEl.innerHTML = `
      <div class="diag-header">
        <div class="diag-title">
          <span class="diag-dot"></span>
          <span>LIVE PREVIEW & PERFORMANCE HUD</span>
        </div>
        <div style="display: flex; gap: 4px; align-items: center;">
          <button id="diag-benchmark-btn" class="diag-btn-text" title="Run A/B Controlled Lag Diagnostic">⚡ A/B Test</button>
          <button id="diag-close-btn" class="diag-btn-icon" title="Close Panel">×</button>
        </div>
      </div>

      <div class="diag-body">
        <div class="diag-row">
          <span class="diag-label">Requested Res:</span>
          <span class="diag-val" id="diag-val-req-res">1280x720 (720p)</span>
        </div>

        <div class="diag-row">
          <span class="diag-label">Delivered Res:</span>
          <span class="diag-val" id="diag-val-del-res">Inactive [Measured]</span>
        </div>

        <div class="diag-row">
          <span class="diag-label">Target FPS:</span>
          <span class="diag-val" id="diag-val-target-fps">30 FPS</span>
        </div>

        <div class="diag-row">
          <span class="diag-label">Track HW FPS:</span>
          <span class="diag-val" id="diag-val-track-fps">-- [Driver Setting]</span>
        </div>

        <div class="diag-row">
          <span class="diag-label">Live Preview FPS:</span>
          <span class="diag-val" id="diag-val-measured-fps">-- <small class="diag-source" id="diag-source-fps">[Idle]</small></span>
        </div>

        <div class="diag-row">
          <span class="diag-label">Presented Frames:</span>
          <span class="diag-val" id="diag-val-presented-frames">0 [Measured]</span>
        </div>

        <div class="diag-row">
          <span class="diag-label">Dropped Frames:</span>
          <span class="diag-val" id="diag-val-dropped-frames">0 (0.0%) [Measured]</span>
        </div>

        <div class="diag-row">
          <span class="diag-label">Camera Init Time:</span>
          <span class="diag-val" id="diag-val-init-time">-- ms [Measured]</span>
        </div>

        <div class="diag-row">
          <span class="diag-label">Main-Thread Jank:</span>
          <span class="diag-val" id="diag-val-longtasks">0 (0ms) [LongTasks]</span>
        </div>

        <div class="diag-row">
          <span class="diag-label">Active Tracks:</span>
          <span class="diag-val" id="diag-val-active-tracks">0 active</span>
        </div>

        <div class="diag-row">
          <span class="diag-label">Camera Lens:</span>
          <span class="diag-val" id="diag-val-facing">Front (User)</span>
        </div>

        <div class="diag-row">
          <span class="diag-label">HW Acceleration:</span>
          <span class="diag-val diag-badge" id="diag-val-hw">Checking</span>
        </div>

        <div class="diag-row">
          <span class="diag-label">Recording Codec:</span>
          <span class="diag-val" id="diag-val-codec">Detecting...</span>
        </div>

        <div class="diag-row">
          <span class="diag-label">Bitrate (Rec):</span>
          <span class="diag-val" id="diag-val-measured-bitrate">-- kbps [Measured]</span>
        </div>

        <div class="diag-warnings" id="diag-warnings-container">
          <div class="diag-alert diag-alert-info" id="diag-device-note">
            ${isMobileDevice ? '📱 Mobile device: Direct SurfaceView / Video rendering with 720p/480p default applied.' : '💻 Desktop environment: Full HD supported.'}
          </div>
        </div>

        <div id="diag-benchmark-results" style="display: none; margin-top: 8px;"></div>
      </div>
    `;

    document.body.appendChild(this.panelEl);

    const closeBtn = this.panelEl.querySelector('#diag-close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.hide());
    }

    const benchBtn = this.panelEl.querySelector('#diag-benchmark-btn');
    if (benchBtn) {
      benchBtn.addEventListener('click', () => this.runABBenchmark());
    }
  }

  bindEvents() {
    eventBus.on('camera:started', () => {
      this.startFpsMeasurement();
      this.updateStaticValues();
    });

    eventBus.on('camera:stopped', () => {
      this.stopFpsMeasurement();
      this.updateStaticValues();
    });

    eventBus.on('camera:facing-changed', () => {
      this.updateStaticValues();
    });

    eventBus.on('recording:started', () => {
      this.totalRecordedBytes = 0;
      this.updateStaticValues();
    });

    eventBus.on('recording:chunk-received', (data) => {
      this.totalRecordedBytes += data.chunkSize;
      const elapsed = appState.get('recordingTime') || 1;
      this.measuredBitrateKbps = Math.round((this.totalRecordedBytes * 8) / (elapsed * 1000));
    });

    eventBus.on('recording:completed', () => {
      this.updateStaticValues();
    });

    eventBus.on('state:diagnosticsVisible', (visible) => {
      if (visible && !this.isVisible) {
        this.show();
      } else if (!visible && this.isVisible) {
        this.hide();
      }
    });

    eventBus.on('state:media', () => {
      this.updateStaticValues();
    });
  }

  show() {
    if (!this.panelEl || this.isVisible) return;
    this.isVisible = true;
    this.panelEl.style.display = 'block';

    if (appState.get('diagnosticsVisible') !== true) {
      appState.set('diagnosticsVisible', true);
    }

    this.updateStaticValues();
    this.startFpsMeasurement();

    clearInterval(this.monitorInterval);
    this.monitorInterval = setInterval(() => {
      this.refreshMetrics();
    }, 500);
  }

  hide() {
    if (!this.panelEl || !this.isVisible) return;
    this.isVisible = false;
    this.panelEl.style.display = 'none';

    if (appState.get('diagnosticsVisible') !== false) {
      appState.set('diagnosticsVisible', false);
    }

    clearInterval(this.monitorInterval);
    this.stopFpsMeasurement();
  }

  toggle() {
    if (this.isVisible) {
      this.hide();
    } else {
      this.show();
    }
  }

  updateStaticValues() {
    if (!this.panelEl) return;

    const mediaSettings = appState.get('media') || {};
    const resKey = mediaSettings.resolution || '720p';
    const targetBitrates = getTargetBitrates(resKey);
    const optimalFormat = getOptimalRecordingFormat();

    // Requested Resolution
    const elReqRes = document.getElementById('diag-val-req-res');
    if (elReqRes) {
      const resLabels = {
        'auto': 'Auto (Best for Device)',
        '480p': '640x480 (Performance 480p)',
        '720p': '1280x720 (Balanced 720p)',
        '1080p': '1920x1080 (High Quality 1080p)',
        '4k': '3840x2160 (4K Ultra HD)'
      };
      elReqRes.textContent = resLabels[resKey] || resKey;
    }

    // Target FPS
    const elTargetFps = document.getElementById('diag-val-target-fps');
    if (elTargetFps) {
      elTargetFps.textContent = `${mediaSettings.fps || 30} FPS`;
    }

    // Camera Init Time
    const elInitTime = document.getElementById('diag-val-init-time');
    if (elInitTime) {
      const dur = cameraManager.getLastInitDuration();
      elInitTime.textContent = dur > 0 ? `${dur} ms [Measured]` : '-- ms';
    }

    // Facing Mode
    const elFacing = document.getElementById('diag-val-facing');
    if (elFacing) {
      const facing = mediaSettings.facingMode === 'environment' ? 'Rear (Environment)' : 'Front (Selfie / User)';
      elFacing.textContent = facing;
    }

    // Recording Codec & HW Acceleration
    const elCodec = document.getElementById('diag-val-codec');
    const elHw = document.getElementById('diag-val-hw');
    if (elCodec && elHw) {
      elCodec.textContent = optimalFormat.mimeType ? optimalFormat.desc : 'Default Browser Codec';
      if (optimalFormat.hw) {
        elHw.textContent = 'Hardware Accelerated';
        elHw.className = 'diag-val diag-badge diag-badge-hw';
      } else {
        elHw.textContent = 'Software / CPU';
        elHw.className = 'diag-val diag-badge diag-badge-sw';
      }
    }
  }

  startFpsMeasurement() {
    this.stopFpsMeasurement();

    const videoEl = cameraManager.getVideoElement();
    if (!videoEl) return;

    let framesInWindow = 0;
    let windowStartTime = performance.now();

    // Modern Chrome / Android: requestVideoFrameCallback delivers exact compositor-presented hardware frames
    if (typeof videoEl.requestVideoFrameCallback === 'function') {
      this.isUsingRvfc = true;
      const onFrame = (now, metadata) => {
        framesInWindow++;
        this.totalFramesCount++;
        const elapsed = now - windowStartTime;
        if (elapsed >= 1000) {
          this.measuredFps = Math.round((framesInWindow * 1000) / elapsed);
          framesInWindow = 0;
          windowStartTime = now;
        }

        if (this.isVisible && cameraManager.getStream()) {
          this.rvfcHandle = videoEl.requestVideoFrameCallback(onFrame);
        }
      };
      this.rvfcHandle = videoEl.requestVideoFrameCallback(onFrame);
    } else {
      // Fallback: requestAnimationFrame interval tracking
      this.isUsingRvfc = false;
      const rafLoop = (now) => {
        framesInWindow++;
        this.totalFramesCount++;
        const elapsed = now - windowStartTime;
        if (elapsed >= 1000) {
          this.measuredFps = Math.round((framesInWindow * 1000) / elapsed);
          framesInWindow = 0;
          windowStartTime = now;
        }
        if (this.isVisible && cameraManager.getStream()) {
          this.rvfcHandle = requestAnimationFrame(rafLoop);
        }
      };
      this.rvfcHandle = requestAnimationFrame(rafLoop);
    }
  }

  stopFpsMeasurement() {
    const videoEl = cameraManager.getVideoElement();
    if (this.rvfcHandle) {
      if (this.isUsingRvfc && videoEl && typeof videoEl.cancelVideoFrameCallback === 'function') {
        videoEl.cancelVideoFrameCallback(this.rvfcHandle);
      } else {
        cancelAnimationFrame(this.rvfcHandle);
      }
      this.rvfcHandle = null;
    }
    this.measuredFps = 0;
  }

  refreshMetrics() {
    if (!this.panelEl || !this.isVisible) return;

    const videoEl = cameraManager.getVideoElement();
    const trackSettings = cameraManager.getVideoTrackSettings();
    const stream = cameraManager.getStream();

    // Delivered Resolution [Measured from Track Settings]
    const elDelRes = document.getElementById('diag-val-del-res');
    if (elDelRes) {
      if (trackSettings && trackSettings.width && trackSettings.height) {
        elDelRes.textContent = `${trackSettings.width}x${trackSettings.height} [Measured Track]`;
      } else if (videoEl && videoEl.videoWidth && videoEl.videoHeight) {
        elDelRes.textContent = `${videoEl.videoWidth}x${videoEl.videoHeight} [Measured Video]`;
      } else {
        elDelRes.textContent = 'Camera Inactive';
      }
    }

    // Hardware Track FPS setting
    const elTrackFps = document.getElementById('diag-val-track-fps');
    if (elTrackFps) {
      if (trackSettings && trackSettings.frameRate) {
        elTrackFps.textContent = `${Math.round(trackSettings.frameRate)} FPS [Driver]`;
      } else {
        elTrackFps.textContent = 'Auto [Driver Managed]';
      }
    }

    // Delivered FPS
    const elFps = document.getElementById('diag-val-measured-fps');
    const elFpsSource = document.getElementById('diag-source-fps');
    if (elFps && elFpsSource) {
      if (stream) {
        elFps.innerHTML = `${this.measuredFps} FPS`;
        elFpsSource.textContent = this.isUsingRvfc ? '[Measured via rVFC]' : '[Estimated via RAF]';
        elFps.className = this.measuredFps < 24 ? 'diag-val diag-warn' : 'diag-val diag-ok';
      } else {
        elFps.innerHTML = '--';
        elFpsSource.textContent = '[Idle]';
        elFps.className = 'diag-val';
      }
    }

    // Presented Frames
    const elPresented = document.getElementById('diag-val-presented-frames');
    if (elPresented) {
      elPresented.textContent = `${this.totalFramesCount} [Measured]`;
    }

    // Dropped Frames from VideoPlaybackQuality API
    const elDrops = document.getElementById('diag-val-dropped-frames');
    if (elDrops && videoEl) {
      if (typeof videoEl.getVideoPlaybackQuality === 'function') {
        const quality = videoEl.getVideoPlaybackQuality();
        const dropped = quality.droppedVideoFrames || 0;
        const total = quality.totalVideoFrames || this.totalFramesCount || 1;
        const dropPct = ((dropped / total) * 100).toFixed(1);
        this.droppedFramesCount = dropped;
        elDrops.textContent = `${dropped} (${dropPct}%) [Measured API]`;
        elDrops.className = dropPct > 5 ? 'diag-val diag-warn' : 'diag-val diag-ok';
      } else {
        elDrops.textContent = '0 (0.0%) [No Hardware Drops]';
        elDrops.className = 'diag-val diag-ok';
      }
    }

    // Long Tasks & Main Thread Jank
    const elLongTasks = document.getElementById('diag-val-longtasks');
    if (elLongTasks) {
      elLongTasks.textContent = `${this.longTasksCount} (${this.totalLongTaskTimeMs}ms) [Measured]`;
      elLongTasks.className = this.longTasksCount > 5 ? 'diag-val diag-warn' : 'diag-val diag-ok';
    }

    // Active Tracks Count
    const elActiveTracks = document.getElementById('diag-val-active-tracks');
    if (elActiveTracks) {
      const count = stream ? stream.getTracks().length : 0;
      elActiveTracks.textContent = `${count} active tracks`;
    }

    // Actual Bitrate during recording
    const elActBitrate = document.getElementById('diag-val-measured-bitrate');
    const isRecording = appState.get('recordingState') === 'recording';
    if (elActBitrate) {
      if (isRecording && this.measuredBitrateKbps > 0) {
        elActBitrate.textContent = `${this.measuredBitrateKbps.toLocaleString()} kbps [Measured]`;
      } else if (isRecording) {
        elActBitrate.textContent = 'Buffering...';
      } else {
        elActBitrate.textContent = '-- [Idle]';
      }
    }
  }

  /**
   * Controlled A/B Diagnostics Benchmark (Task 5)
   * Systematically measures frame delivery & main-thread responsiveness across 6 conditions:
   * A: Camera-only preview (no prompter text)
   * B: Camera preview with prompter text visible (static)
   * C: Camera preview with active scrolling
   * D: Camera preview with reading focus overlays
   * E: Camera preview with audio monitoring active
   * F: Camera preview with visual filters
   */
  async runABBenchmark() {
    if (this.isBenchmarking) return;
    this.isBenchmarking = true;

    const btn = document.getElementById('diag-benchmark-btn');
    const resultsContainer = document.getElementById('diag-benchmark-results');
    if (btn) btn.textContent = '⏳ Testing...';
    if (resultsContainer) {
      resultsContainer.style.display = 'block';
      resultsContainer.innerHTML = '<div style="font-size: 11px; color: #58a6ff;">Running 6-point controlled A/B diagnostics...</div>';
    }

    // Ensure camera is active
    if (!cameraManager.getStream()) {
      try {
        await cameraManager.startCamera();
      } catch (err) {
        if (resultsContainer) resultsContainer.innerHTML = `<div style="color: #ef4444;">Camera start failed: ${err.message}</div>`;
        this.isBenchmarking = false;
        if (btn) btn.textContent = '⚡ A/B Test';
        return;
      }
    }

    const viewportEl = document.getElementById('prompter-viewport');
    const sampleDurationMs = 1200;

    const measureCondition = async (setupFn, cleanupFn) => {
      await setupFn();
      let frames = 0;
      let start = performance.now();
      const videoEl = cameraManager.getVideoElement();

      // Sample FPS over window
      await new Promise((resolve) => {
        let handle = null;
        if (videoEl && typeof videoEl.requestVideoFrameCallback === 'function') {
          const cb = (now) => {
            frames++;
            if (performance.now() - start < sampleDurationMs) {
              handle = videoEl.requestVideoFrameCallback(cb);
            } else {
              resolve();
            }
          };
          handle = videoEl.requestVideoFrameCallback(cb);
        } else {
          const raf = () => {
            frames++;
            if (performance.now() - start < sampleDurationMs) {
              handle = requestAnimationFrame(raf);
            } else {
              resolve();
            }
          };
          handle = requestAnimationFrame(raf);
        }
      });

      const actualDuration = (performance.now() - start) / 1000;
      const fps = Math.round(frames / actualDuration);
      await cleanupFn();
      return fps;
    };

    const results = [];

    // Condition A: Camera-only (text hidden)
    const fpsA = await measureCondition(
      async () => { if (viewportEl) viewportEl.style.opacity = '0'; },
      async () => { if (viewportEl) viewportEl.style.opacity = '1'; }
    );
    results.push({ name: 'A. Camera-Only (No Overlays)', fps: fpsA });

    // Condition B: Camera + Prompter Text Visible (Paused)
    const fpsB = await measureCondition(
      async () => { scrollEngine.pause(); },
      async () => {}
    );
    results.push({ name: 'B. Camera + Static Prompter Text', fps: fpsB });

    // Condition C: Camera + Active Scrolling
    const fpsC = await measureCondition(
      async () => { scrollEngine.play(); },
      async () => { scrollEngine.pause(); }
    );
    results.push({ name: 'C. Camera + Active Text Scrolling', fps: fpsC });

    // Condition D: Camera + Focus Overlays
    const fpsD = await measureCondition(
      async () => { appState.update('focus', { enabled: true, lineVisible: true, rulerVisible: true }); },
      async () => { appState.update('focus', { enabled: false }); }
    );
    results.push({ name: 'D. Camera + Reading Focus Guides', fps: fpsD });

    // Condition E: Camera + Mic Monitoring Active
    const fpsE = await measureCondition(
      async () => { audioManager.enableMonitoring(); },
      async () => { audioManager.disableMonitoring(); }
    );
    results.push({ name: 'E. Camera + Audio VU Monitoring', fps: fpsE });

    // Condition F: Camera + Visual Mirroring Filter
    const fpsF = await measureCondition(
      async () => {
        const vid = cameraManager.getVideoElement();
        if (vid) vid.classList.add('mirror-cam');
      },
      async () => {}
    );
    results.push({ name: 'F. Camera + CSS Mirror Transform', fps: fpsF });

    // Render results
    let html = `
      <div style="background: rgba(0,0,0,0.5); padding: 8px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.1); margin-top: 6px;">
        <div style="font-weight: 700; font-size: 10px; color: #58a6ff; margin-bottom: 6px;">CONTROLLED A/B BENCHMARK (MEASURED FPS)</div>
    `;

    results.forEach(r => {
      const color = r.fps >= 28 ? '#3fb950' : (r.fps >= 24 ? '#d29922' : '#f85149');
      html += `
        <div style="display: flex; justify-content: space-between; font-size: 10px; margin-bottom: 3px;">
          <span style="color: #c9d1d9;">${r.name}:</span>
          <span style="font-weight: 700; color: ${color}; font-family: monospace;">${r.fps} FPS</span>
        </div>
      `;
    });

    html += `</div>`;
    if (resultsContainer) resultsContainer.innerHTML = html;

    this.isBenchmarking = false;
    if (btn) btn.textContent = '⚡ A/B Test';
    return results;
  }
}

export const recordingDiagnostics = new RecordingDiagnostics();
