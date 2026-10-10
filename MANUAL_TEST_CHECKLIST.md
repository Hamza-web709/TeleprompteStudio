# Teleprompter Studio Pro - Manual Hardware & Device Verification Checklist

**Document Purpose:**  
This checklist provides instructions for validating hardware-dependent, external-network, and physical device workflows that cannot be executed in automated headless environments.

---

## 1. Physical Webcam & Video Hardware Verification

*Prerequisites: Connect one or more USB or integrated webcams to the host workstation.*

- [ ] **Step 1.1: Camera Permission Prompt**  
  Click **Camera** toggle in the top bar. Verify the browser displays the standard permissions prompt: `"Allow localhost:3000 to use your camera?"`.
- [ ] **Step 1.2: Video Stream Activation**  
  Accept permissions. Verify the live camera feed appears in the `#camera-preview-container` with low latency (<50ms).
- [ ] **Step 1.3: Device Enumeration & Switching**  
  Open the Camera settings tab. Verify all connected video input devices appear in the dropdown (`#select-camera-device`). Select a secondary camera; verify the stream transitions smoothly without freezing.
- [ ] **Step 1.4: Resolution Presets**  
  Switch resolution presets between `720p (HD)`, `1080p (Full HD)`, and `4K (UHD)`. Verify stream dimensions adapt to the camera's hardware capabilities.
- [ ] **Step 1.5: Camera Mirroring**  
  Toggle "Mirror Camera Preview". Verify the video feed flips horizontally while the teleprompter text remains unchanged.
- [ ] **Step 1.6: Clean Video Recording Verification**  
  Start a recording with teleprompter text actively scrolling over the screen. Stop the recording after 10 seconds. In the preview modal, download and play the resulting video. **Confirm: The video contains only the presenter's raw camera feed; zero teleprompter text is burned into the recording.**
- [ ] **Step 1.7: Resource Cleanup**  
  Toggle Camera off. Verify that the hardware webcam LED indicator on the physical device turns off immediately, confirming all `MediaStreamTrack` instances were cleanly stopped (`track.stop()`).

---

## 2. Physical Microphone & Audio Hardware Verification

*Prerequisites: Connect a USB microphone, headset, or built-in audio input.*

- [ ] **Step 2.1: Microphone Permission Prompt**  
  Click **Mic** toggle in the top bar. Verify the browser prompts for audio permission.
- [ ] **Step 2.2: Live VU Meter & Audio Activity**  
  Speak into the microphone. Verify the real-time VU meter bar (`#audio-vu-bar`) moves dynamically in response to voice volume.
- [ ] **Step 2.3: Audio Clipping Detection**  
  Speak loudly or increase gain. Verify the clipping indicator warns when audio levels exceed -1 dBFS.
- [ ] **Step 2.4: Software Gain Control**  
  Adjust the microphone gain slider in the Audio settings tab. Verify the signal amplitude increases or decreases proportionally.
- [ ] **Step 2.5: Multi-Device Selection**  
  Connect an external microphone (e.g. USB podcast mic). Switch between default and external devices in `#select-mic-device`. Verify audio input switches without crashing the Web Audio `AudioContext`.

---

## 3. Real-Time Speech Recognition & Voice Follow

*Prerequisites: Chrome or Edge browser (WebKit/Blink SpeechRecognition engine) with an active internet connection for language models.*

- [ ] **Step 3.1: Voice Tracking Activation**  
  Click **Voice Follow** in the floating control panel. Verify the status badge switches to `Listening...`.
- [ ] **Step 3.2: Voice-Driven Scrolling**  
  Read the active teleprompter script aloud into the microphone at a natural pace. Verify the teleprompter automatically advances and highlights matched words on the reading line.
- [ ] **Step 3.3: Silence Pausing**  
  Pause speaking for 3 seconds. Verify the teleprompter automatically halts scrolling.
- [ ] **Step 3.4: Speech Resumption**  
  Resume speaking the next sentence. Verify scrolling resumes from the correct script position without jumping backwards.
- [ ] **Step 3.5: Voice Command Recognition**  
  Speak `"pause"`, `"resume"`, `"faster"`, `"slower"`, `"restart"`. Verify the scrolling engine responds to each recognized spoken command.
- [ ] **Step 3.6: Multilingual Speech Support**  
  Switch the language selector to Urdu (`ur-PK`) or Hindi (`hi-IN`). Read non-Latin script passages. Verify token alignment and script progression.

---

## 4. Mobile Phone Remote Control & LAN Wi-Fi Verification

*Prerequisites: Smartphone connected to the SAME local Wi-Fi network as the development computer.*

- [ ] **Step 4.1: Identify Workstation LAN IP**  
  On the computer running Teleprompter Studio, determine the local IP address (e.g. `ipconfig` -> `192.168.1.xxx`).
- [ ] **Step 4.2: Open Remote Pairing Modal**  
  Click **Remote Control** in the top bar or settings panel. Enter your workstation's LAN IP into the **Host / LAN IP** input field.
- [ ] **Step 4.3: Scan QR Code with Phone**  
  Use the smartphone camera or QR reader to scan the generated QR code. Verify the phone navigates to `http://<LAN-IP>:3000/remote.html?session=<TOKEN>`.
- [ ] **Step 4.4: WebSocket Companion Connection**  
  Observe the phone remote screen. Verify the status indicator turns green (`Connected to Session <TOKEN>`).
- [ ] **Step 4.5: Mobile Remote Control Actions**  
  - Tap **Play / Pause**: Verify the main prompter starts or stops scrolling immediately (<50ms latency).
  - Tap **+ / - Speed**: Verify the main prompter speed changes and updates on both screens.
  - Tap **Rewind 5s / Forward 5s**: Verify the prompter jumps forward and backward accurately.
  - Tap **Reset**: Verify the prompter returns to the beginning.
- [ ] **Step 4.6: Bidirectional State Sync**  
  Click Play on the desktop prompter. Verify the mobile remote Play button toggles to Pause in real time.
- [ ] **Step 4.7: Network Reconnection Resilience**  
  Temporarily toggle Airplane Mode on the phone, then turn it off. Verify the remote automatically reconnects to the existing session without requiring a re-scan.

---

## 5. Bluetooth Presentation Remotes & Foot Pedals

*Prerequisites: Standard 2.4GHz USB wireless clicker or Bluetooth presentation remote / foot pedal.*

- [ ] **Step 5.1: PageUp / PageDown Keys**  
  Press PageUp and PageDown on the physical clicker. Verify the prompter scrolls up and down smoothly.
- [ ] **Step 5.2: Arrow Up / Arrow Down Keys**  
  Press Arrow Up and Arrow Down. Verify speed increments and decrements by 0.5.
- [ ] **Step 5.3: Play / Pause (Space / Enter)**  
  Press the central clicker button. Verify prompter toggles play and pause.
- [ ] **Step 5.4: Blackout / Blank Screen (Key 'B')**  
  Press the blackout button on the clicker. Verify distraction-free display blanking behaves appropriately.

---

## 6. Dual-Screen Hardware & Glass Teleprompter Verification

*Prerequisites: External HDMI/DisplayPort monitor or 70/30 beam splitter teleprompter glass.*

- [ ] **Step 6.1: Launch Presenter Popout**  
  Click **Dual Screen / Presenter Window** in the top bar. Verify a clean, full-viewport popout opens without toolbars.
- [ ] **Step 6.2: Move to Secondary Display**  
  Drag the popout window onto the second physical monitor. Press `F` to enter Fullscreen.
- [ ] **Step 6.3: Optical Mirror Alignment**  
  In the main control window, select **Horizontal Mirror (Flip X)** or **Combined Mirror (Flip X+Y)**. Verify the popout prompter mirrors for glass reflection while the operator's primary control interface remains standard.
- [ ] **Step 6.4: Cross-Window Synchronization**  
  Scroll or jump in the operator window. Verify the presenter display follows frame-for-frame via `BroadcastChannel`.

---

## 7. Cloud AI Integration (Optional External Provider)

*Prerequisites: Valid OpenAI or cloud AI API key.*

- [ ] **Step 7.1: Configure Environment Variables**  
  In `server/.env`, set:
  ```bash
  AI_PROVIDER=openai
  AI_PROVIDER_KEY=sk-...your-actual-api-key...
  ```
- [ ] **Step 7.2: Restart Backend Service**  
  Restart the Node.js server (`npm run server`).
- [ ] **Step 7.3: Test AI Gateway**  
  In the Teleprompter Studio AI tab, click **Test AI Gateway Connection**. Verify status updates from `503 PROVIDER_UNCONFIGURED` to `200 Online / Configured`.
- [ ] **Step 7.4: Cloud AI Services**  
  Test cloud transcription and eye-contact post-processing tasks through the secure proxy.

---

## 8. Secure Context & HTTPS Notice

> [!IMPORTANT]
> **Mobile Browser Security Restriction**: Modern mobile browsers (iOS Safari, Android Chrome) restrict `getUserMedia` (camera/mic) and the Web Speech API to **Secure Contexts** (`https://` or `localhost`).
> When running over local Wi-Fi (`http://192.168.x.x:3000`), the **Remote Control** functions normally because it only uses standard WebSockets. However, to access the camera or microphone directly on a mobile device, you must serve the application over HTTPS (e.g. via mkcert, local reverse proxy, or ngrok/cloudflared tunnel).
