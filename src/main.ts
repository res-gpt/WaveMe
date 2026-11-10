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
  x: byId<HTMLElement>('accelX'),
  y: byId<HTMLElement>('accelY'),
  z: byId<HTMLElement>('accelZ'),
  alpha: byId<HTMLElement>('orientAlpha'),
  beta: byId<HTMLElement>('orientBeta'),
  gamma: byId<HTMLElement>('orientGamma'),
};

let running = false;
let offset = 0;
let previousFrame = 0;
let animationId = 0;
let color = '#49f5d0';

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
    // Immersive POV mode is positioned by live sensor tilt, not marquee scrolling.
    updatePovPreview();
    marquee.style.transform = 'translateX(var(--pov-shift, 0px))';
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
  updatePovPreview();
  sensorMessage.textContent = `Neutralposition gesetzt (γ ${neutralGamma.toFixed(1)}°). Neige das Gerät aus dieser Position, um die Vorschau zu testen.`;
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
  sensorValues.x.textContent = formatSensorValue(smoothedAcceleration.x);
  sensorValues.y.textContent = formatSensorValue(smoothedAcceleration.y);
  sensorValues.z.textContent = formatSensorValue(smoothedAcceleration.z);
  sensorStatus.textContent = 'Aktiv';
  sensorMessage.textContent = 'Bewegungsdaten werden empfangen.';
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

// Keyboard-friendly and useful when running in a desktop browser.
document.addEventListener('keydown', (event) => {
  if (event.code === 'Space' && !(event.target instanceof HTMLTextAreaElement)) {
    event.preventDefault();
    running ? stop() : start();
  }
});

updateMessage();
marquee.style.fontSize = `${sizeInput.value}px`;
marquee.style.color = color;
sizeOutput.value = `${sizeInput.value} px`;
speedOutput.value = `${speedInput.value} px/s`;
updatePovSensitivityLabel();
updateStatus(false);

// Sensor diagnostics are a first step toward the later POV mode; no POV rendering yet.
