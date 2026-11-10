import './style.css';

const byId = <T extends HTMLElement>(id: string) => {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing element: ${id}`);
  return element as T;
};

const display = byId<HTMLDivElement>('display');
const marquee = byId<HTMLDivElement>('marquee');
const messageInput = byId<HTMLTextAreaElement>('messageInput');
const startBtn = byId<HTMLButtonElement>('startBtn');
const stopBtn = byId<HTMLButtonElement>('stopBtn');
const speedInput = byId<HTMLInputElement>('speedInput');
const speedOutput = byId<HTMLOutputElement>('speedOutput');
const sizeInput = byId<HTMLInputElement>('sizeInput');
const sizeOutput = byId<HTMLOutputElement>('sizeOutput');
const blinkToggle = byId<HTMLInputElement>('blinkToggle');
const blinkSpeedInput = byId<HTMLInputElement>('blinkSpeedInput');
const blinkSpeedOutput = byId<HTMLOutputElement>('blinkSpeedOutput');
const statusText = byId<HTMLSpanElement>('statusText');
const statusDot = byId<HTMLSpanElement>('statusDot');
const fullscreenBtn = byId<HTMLButtonElement>('fullscreenBtn');
const sensorStartBtn = byId<HTMLButtonElement>('sensorStartBtn');
const sensorStopBtn = byId<HTMLButtonElement>('sensorStopBtn');
const sensorStatus = byId<HTMLSpanElement>('sensorStatus');
const sensorMessage = byId<HTMLParagraphElement>('sensorMessage');
const povPreviewToggle = byId<HTMLInputElement>('povPreviewToggle');
const povSensitivityInput = byId<HTMLInputElement>('povSensitivityInput');
const povSensitivityOutput = byId<HTMLOutputElement>('povSensitivityOutput');
const povCalibrateBtn = byId<HTMLButtonElement>('povCalibrateBtn');
const sensorValues = {
  vector: byId<HTMLElement>('accelVector'),
  magnitude: byId<HTMLElement>('accelMagnitude'),
  alpha: byId<HTMLElement>('orientAlpha'),
  beta: byId<HTMLElement>('orientBeta'),
  gamma: byId<HTMLElement>('orientGamma'),
};


type ScreenWakeLock = {
  release: () => Promise<void>;
  addEventListener: (type: 'release', listener: () => void) => void;
};

type WakeLockNavigator = Navigator & {
  wakeLock?: {
    request: (type: 'screen') => Promise<ScreenWakeLock>;
  };
};

let screenWakeLock: ScreenWakeLock | null = null;
let wakeLockRequestInProgress = false;

// Keep the display awake while WaveMe is open and visible. Browsers release
// the lock when the page is hidden, so request it again when the app returns.
async function keepScreenAwake(): Promise<void> {
  const wakeLockApi = (navigator as WakeLockNavigator).wakeLock;
  if (!wakeLockApi || document.visibilityState !== 'visible' || screenWakeLock || wakeLockRequestInProgress) return;

  wakeLockRequestInProgress = true;
  try {
    screenWakeLock = await wakeLockApi.request('screen');
    screenWakeLock.addEventListener('release', () => {
      screenWakeLock = null;
      if (document.visibilityState === 'visible') void keepScreenAwake();
    });
  } catch {
    // Wake Lock requires a supported browser, a visible page, and a secure context.
    // The app remains usable if the platform does not grant the request.
    screenWakeLock = null;
  } finally {
    wakeLockRequestInProgress = false;
  }
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') void keepScreenAwake();
  else screenWakeLock = null;
});

window.addEventListener('pagehide', () => {
  const lock = screenWakeLock;
  screenWakeLock = null;
  if (lock) void lock.release();
});

let running = false;
let offset = 0;
let previousFrame = 0;
let animationId = 0;
let color = '#49f5d0';
let povScrollOffset = 0;
let gravityCorrectedMagnitude: number | null = null;
let povScrollDirection = 1;
let previousAlphaDirection: number | null = null;
let povWaitingForDirectionChange = false;
// Physical volume keys mark the outer scroll positions in fullscreen mode.
let povLeftEndpoint: number | null = null;
let povRightEndpoint: number | null = null;

function normalizedMessage(): string {
  return messageInput.value.trim() || 'WAVE ME';
}

function updateMessage(): void {
  const text = normalizedMessage();
  // Spacing makes the end-to-start loop easier to read.
  marquee.textContent = `${text}　　 ${text}　　 `;
  offset = 0;
  marquee.style.transform = 'translateX(var(--pov-shift, 0px))';
}

function updateStatus(isRunning: boolean): void {
  running = isRunning;
  statusText.textContent = isRunning ? 'Läuft' : 'Bereit';
  statusDot.classList.toggle('active', isRunning);
  startBtn.disabled = isRunning;
  stopBtn.disabled = !isRunning;
}

function frame(now: number): void {
  if (!running) return;
  if (!previousFrame) previousFrame = now;
  const elapsed = Math.min((now - previousFrame) / 1000, 0.05);
  previousFrame = now;

  if (document.body.classList.contains('pov-mode')) {
    // Volume + marks the leftmost position; volume - marks the rightmost.
    // One measured sway interval is the available travel time between endpoints.
    const firstTextWidth = marquee.scrollWidth / 2;
    const defaultTravelDistance = firstTextWidth + display.clientWidth;
    const hasEndpoints = povLeftEndpoint !== null && povRightEndpoint !== null;
    const lowerBound = hasEndpoints ? Math.min(povLeftEndpoint!, povRightEndpoint!) : 0;
    const upperBound = hasEndpoints ? Math.max(povLeftEndpoint!, povRightEndpoint!) : defaultTravelDistance;
    const travelDistance = Math.max(0, upperBound - lowerBound);
    // The gravity-corrected acceleration controls speed directly, scaled to
    // visible display movement. Negative/noisy values are clamped to zero.
    const pixelsPerSecond = gravityCorrectedMagnitude === null
      ? Number(speedInput.value)
      : Math.max(0, gravityCorrectedMagnitude) * 60;

    // Alpha controls direction only. Scroll speed above depends only on
    // the acceleration-vector magnitude minus gravity (9.81 m/s²).
    const alpha = smoothedOrientation.alpha;
    const relativeAlpha = alpha !== null ? alpha - (neutralAlpha ?? 0) : 0;
    if (sensorsActive && alpha !== null && Math.abs(relativeAlpha) > POV_DEAD_ZONE_DEGREES) {
      const alphaDirection = relativeAlpha > 0 ? -1 : 1;
      if (alphaDirection !== previousAlphaDirection) {
        povScrollDirection = alphaDirection;
        povWaitingForDirectionChange = false;
        previousAlphaDirection = alphaDirection;
      }
    }

    if (!povWaitingForDirectionChange) {
      povScrollOffset += povScrollDirection * pixelsPerSecond * elapsed;
      if (povScrollOffset >= upperBound) {
        povScrollOffset = upperBound;
        povWaitingForDirectionChange = true;
        sensorMessage.textContent = 'Linker Endpunkt erreicht. Drehe das Gerät in die Gegenrichtung (Alpha), um weiterzuscrollen.';
      } else if (povScrollOffset <= lowerBound) {
        povScrollOffset = lowerBound;
        povWaitingForDirectionChange = true;
        sensorMessage.textContent = 'Rechter Endpunkt erreicht. Drehe das Gerät in die Gegenrichtung (Alpha), um weiterzuscrollen.';
      }
    }
    marquee.style.transform = `translateX(${-povScrollOffset}px)`;
  } else {
    offset += Number(speedInput.value) * elapsed;
    const firstTextWidth = marquee.scrollWidth / 2;
    if (firstTextWidth > 0 && offset >= firstTextWidth) offset -= firstTextWidth;
    marquee.style.transform = `translateX(calc(${-offset}px + var(--pov-shift, 0px)))`;
  }
  animationId = requestAnimationFrame(frame);
}

function start(): void {
  updateMessage();
  if (running) return;
  previousFrame = 0;
  updateStatus(true);
  animationId = requestAnimationFrame(frame);
}

function stop(): void {
  running = false;
  cancelAnimationFrame(animationId);
  previousFrame = 0;
  updateStatus(false);
}

let sensorsActive = false;
let motionEventsSeen = 0;
let orientationEventsSeen = 0;
let smoothedAcceleration = { x: null as number | null, y: null as number | null, z: null as number | null };
let smoothedOrientation = { alpha: null as number | null, beta: null as number | null, gamma: null as number | null };
const SENSOR_SMOOTHING = 0.22;

function smoothValue(previous: number | null, next: number | null): number | null {
  if (typeof next !== 'number' || !Number.isFinite(next)) return previous;
  return previous === null ? next : previous + SENSOR_SMOOTHING * (next - previous);
}

let neutralGamma: number | null = null;
let neutralAlpha: number | null = null;
let displayedPovShift = 0;
const POV_DEAD_ZONE_DEGREES = 1.2;
const POV_SHIFT_SMOOTHING = 0.18;

function updatePovPreview(): void {
  const gamma = smoothedOrientation.gamma;
  const sensitivity = Number(povSensitivityInput.value);
  const relativeGamma = gamma !== null ? gamma - (neutralGamma ?? 0) : 0;
  const outsideDeadZone = Math.abs(relativeGamma) <= POV_DEAD_ZONE_DEGREES
    ? 0
    : Math.sign(relativeGamma) * (Math.abs(relativeGamma) - POV_DEAD_ZONE_DEGREES);
  const targetShift = sensorsActive && povPreviewToggle.checked && gamma !== null
    ? Math.max(-70, Math.min(70, -outsideDeadZone * sensitivity))
    : 0;
  displayedPovShift += POV_SHIFT_SMOOTHING * (targetShift - displayedPovShift);
  if (Math.abs(targetShift - displayedPovShift) < 0.15) displayedPovShift = targetShift;
  marquee.style.setProperty('--pov-shift', `${displayedPovShift.toFixed(1)}px`);
}

function updatePovSensitivityLabel(): void {
  povSensitivityOutput.value = `${Number(povSensitivityInput.value).toLocaleString('de-DE', { maximumFractionDigits: 1 })}×`;
}

function calibratePovNeutralPosition(): void {
  if (smoothedOrientation.gamma === null) {
    sensorMessage.textContent = 'Bitte starte zuerst die Sensoren und warte auf Orientierungsdaten.';
    return;
  }
  neutralGamma = smoothedOrientation.gamma;
  neutralAlpha = smoothedOrientation.alpha;
  updatePovPreview();
  sensorMessage.textContent = `Neutralposition gesetzt (γ ${neutralGamma.toFixed(1)}°, α ${neutralAlpha?.toFixed(1) ?? 'nicht verfügbar'}°). Vorschau nutzt γ, Vollbildneigung nutzt α.`;
}

function formatSensorValue(value: number | null | undefined): string {
  return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(2) : 'nicht verfügbar';
}

function onMotion(event: DeviceMotionEvent): void {
  motionEventsSeen += 1;
  const acceleration = event.accelerationIncludingGravity;
  smoothedAcceleration.x = smoothValue(smoothedAcceleration.x, acceleration?.x ?? null);
  smoothedAcceleration.y = smoothValue(smoothedAcceleration.y, acceleration?.y ?? null);
  smoothedAcceleration.z = smoothValue(smoothedAcceleration.z, acceleration?.z ?? null);

  sensorValues.vector.textContent = `(${formatSensorValue(smoothedAcceleration.x)}, ${formatSensorValue(smoothedAcceleration.y)}, ${formatSensorValue(smoothedAcceleration.z)}) m/s²`;
  const { x, y, z } = smoothedAcceleration;
  if (x !== null && y !== null && z !== null) {
    const magnitude = Math.sqrt(x * x + y * y + z * z);
    gravityCorrectedMagnitude = magnitude - 9.81;
    sensorValues.magnitude.textContent = `|a| = ${magnitude.toFixed(2)} m/s² · |a| − 9,81 = ${gravityCorrectedMagnitude.toFixed(2)} m/s²`;
  } else {
    gravityCorrectedMagnitude = null;
    sensorValues.magnitude.textContent = 'nicht verfügbar';
  }
  sensorStatus.textContent = 'Aktiv';
  if (gravityCorrectedMagnitude !== null && !povWaitingForDirectionChange && !document.body.classList.contains('pov-mode')) {
    sensorMessage.textContent = 'Bewegungsdaten werden empfangen.';
  }
}

function onOrientation(event: DeviceOrientationEvent): void {
  orientationEventsSeen += 1;
  smoothedOrientation.alpha = smoothValue(smoothedOrientation.alpha, event.alpha);
  smoothedOrientation.beta = smoothValue(smoothedOrientation.beta, event.beta);
  smoothedOrientation.gamma = smoothValue(smoothedOrientation.gamma, event.gamma);
  sensorValues.alpha.textContent = formatSensorValue(smoothedOrientation.alpha);
  sensorValues.beta.textContent = formatSensorValue(smoothedOrientation.beta);
  sensorValues.gamma.textContent = formatSensorValue(smoothedOrientation.gamma);
  updatePovPreview();
}

function stopSensors(): void {
  window.removeEventListener('devicemotion', onMotion);
  window.removeEventListener('deviceorientation', onOrientation);
  sensorsActive = false;
  sensorStartBtn.disabled = false;
  sensorStopBtn.disabled = true;
  sensorStatus.textContent = 'Nicht aktiv';
  displayedPovShift = 0;
  marquee.style.setProperty('--pov-shift', '0px');
  updatePovPreview();
  if (motionEventsSeen === 0 && orientationEventsSeen === 0) {
    sensorMessage.textContent = 'Keine Sensordaten empfangen. Prüfe HTTPS, Geräteunterstützung und Browser-Berechtigungen.';
  } else {
    sensorMessage.textContent = `Gestoppt. Empfangene Ereignisse: Bewegung ${motionEventsSeen}, Ausrichtung ${orientationEventsSeen}.`;
  }
}

async function startSensors(): Promise<void> {
  if (sensorsActive) return;
  if (!('DeviceMotionEvent' in window) && !('DeviceOrientationEvent' in window)) {
    sensorMessage.textContent = 'Dieser Browser stellt keine Gerätebewegungs- oder Ausrichtungssensoren bereit.';
    sensorStatus.textContent = 'Nicht unterstützt';
    return;
  }

  try {
    const motionPermission = (DeviceMotionEvent as typeof DeviceMotionEvent & { requestPermission?: () => Promise<string> }).requestPermission;
    if (typeof motionPermission === 'function') {
      const permission = await motionPermission.call(DeviceMotionEvent);
      if (permission !== 'granted') throw new Error('Zugriff auf Bewegungssensoren wurde nicht erlaubt.');
    }
    const orientationPermission = (DeviceOrientationEvent as typeof DeviceOrientationEvent & { requestPermission?: () => Promise<string> }).requestPermission;
    if (typeof orientationPermission === 'function') {
      const permission = await orientationPermission.call(DeviceOrientationEvent);
      if (permission !== 'granted') throw new Error('Zugriff auf den Orientierungssensor wurde nicht erlaubt.');
    }
    motionEventsSeen = 0;
    orientationEventsSeen = 0;
    smoothedAcceleration = { x: null, y: null, z: null };
    smoothedOrientation = { alpha: null, beta: null, gamma: null };
    gravityCorrectedMagnitude = null;
    povScrollOffset = 0;
    povScrollDirection = 1;
    previousAlphaDirection = null;
    povWaitingForDirectionChange = false;
    window.addEventListener('devicemotion', onMotion);
    window.addEventListener('deviceorientation', onOrientation);
    sensorsActive = true;
    sensorStartBtn.disabled = true;
    sensorStopBtn.disabled = false;
    sensorStatus.textContent = 'Warte auf Daten …';
    sensorMessage.textContent = 'Freigabe erteilt. Bewege oder neige das Gerät, um Daten zu sehen.';
  } catch (error) {
    sensorStatus.textContent = 'Freigabe fehlt';
    sensorMessage.textContent = error instanceof Error ? error.message : 'Sensorzugriff konnte nicht gestartet werden.';
  }
}

sensorStartBtn.addEventListener('click', () => void startSensors());
sensorStopBtn.addEventListener('click', stopSensors);
povPreviewToggle.addEventListener('change', updatePovPreview);
povSensitivityInput.addEventListener('input', () => {
  updatePovSensitivityLabel();
  updatePovPreview();
});
povCalibrateBtn.addEventListener('click', calibratePovNeutralPosition);

window.addEventListener('pagehide', () => {
  window.removeEventListener('devicemotion', onMotion);
  window.removeEventListener('deviceorientation', onOrientation);
});

startBtn.addEventListener('click', start);
stopBtn.addEventListener('click', stop);
messageInput.addEventListener('input', () => {
  if (!running) updateMessage();
});
speedInput.addEventListener('input', () => {
  speedOutput.value = `${speedInput.value} px/s`;
});
sizeInput.addEventListener('input', () => {
  marquee.style.fontSize = `${sizeInput.value}px`;
  sizeOutput.value = `${sizeInput.value} px`;
});

function updateBlinkSettings(): void {
  document.body.classList.toggle('blink-enabled', blinkToggle.checked);
  const duration = Number(blinkSpeedInput.value);
  document.documentElement.style.setProperty('--blink-duration', `${duration}s`);
  blinkSpeedOutput.value = `${duration.toLocaleString('de-DE', { maximumFractionDigits: 1 })} s`;
}

blinkToggle.addEventListener('change', updateBlinkSettings);
blinkSpeedInput.addEventListener('input', updateBlinkSettings);

document.querySelectorAll<HTMLButtonElement>('.swatch').forEach((button) => {
  button.addEventListener('click', () => {
    color = button.dataset.color || '#49f5d0';
    marquee.style.color = color;
    document.querySelectorAll('.swatch').forEach((item) => item.classList.remove('selected'));
    button.classList.add('selected');
  });
});

async function enterPovFullscreen(): Promise<void> {
  try {
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
    document.body.classList.add('pov-mode');
    povScrollOffset = 0;
    povScrollDirection = 1;
    povWaitingForDirectionChange = false;
    povLeftEndpoint = null;
    povRightEndpoint = null;
    if (!sensorsActive) sensorMessage.textContent = 'Starte die Sensoren. Die Scrollgeschwindigkeit folgt dann dem gravitationsbereinigten Beschleunigungswert.';
    else sensorMessage.textContent = 'Die Scrollgeschwindigkeit folgt dem gravitationsbereinigten Beschleunigungswert.';
    if (!running) start();
  } catch {
    statusText.textContent = 'Vollbild nicht verfügbar';
  }
}

async function exitPovFullscreen(): Promise<void> {
  document.body.classList.remove('pov-mode');
  if (document.fullscreenElement) {
    try {
      await document.exitFullscreen();
    } catch {
      statusText.textContent = 'Vollbild konnte nicht beendet werden';
    }
  }
}

fullscreenBtn.addEventListener('click', () => {
  if (document.body.classList.contains('pov-mode')) void exitPovFullscreen();
  else void enterPovFullscreen();
});

display.addEventListener('click', () => {
  if (document.body.classList.contains('pov-mode')) void exitPovFullscreen();
});

document.addEventListener('fullscreenchange', () => {
  if (!document.fullscreenElement) document.body.classList.remove('pov-mode');
});

// Volume-key events work in environments that forward them to the WebView.
// Some Android builds intercept these keys natively and require native handling.
document.addEventListener('keydown', (event) => {
  if (document.body.classList.contains('pov-mode') && (event.code === 'AudioVolumeUp' || event.key === 'VolumeUp')) {
    event.preventDefault();
    povLeftEndpoint = povScrollOffset;
    povWaitingForDirectionChange = false;
    sensorMessage.textContent = 'Linken Endpunkt gesetzt (Volume +, ' + Math.round(povScrollOffset) + ' px).';
    return;
  }
  if (document.body.classList.contains('pov-mode') && (event.code === 'AudioVolumeDown' || event.key === 'VolumeDown')) {
    event.preventDefault();
    povRightEndpoint = povScrollOffset;
    povWaitingForDirectionChange = false;
    sensorMessage.textContent = 'Rechten Endpunkt gesetzt (Volume −, ' + Math.round(povScrollOffset) + ' px).';
    return;
  }
  if (event.code === 'Space' && !(event.target instanceof HTMLTextAreaElement)) {
    event.preventDefault();
    running ? stop() : start();
  }
});

void keepScreenAwake();
updateMessage();
marquee.style.fontSize = `${sizeInput.value}px`;
marquee.style.color = color;
sizeOutput.value = `${sizeInput.value} px`;
speedOutput.value = `${speedInput.value} px/s`;
updatePovSensitivityLabel();
updateBlinkSettings();
updateStatus(false);

// Sensor diagnostics are a first step toward the later POV mode; no POV rendering yet.
