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
  marquee.style.transform = `translateX(0px)`;
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

  offset += Number(speedInput.value) * elapsed;
  const firstTextWidth = marquee.scrollWidth / 2;
  if (firstTextWidth > 0 && offset >= firstTextWidth) offset -= firstTextWidth;
  marquee.style.transform = `translateX(${-offset}px)`;
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

function formatSensorValue(value: number | null | undefined): string {
  return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(2) : 'nicht verfügbar';
}

function onMotion(event: DeviceMotionEvent): void {
  motionEventsSeen += 1;
  sensorValues.x.textContent = formatSensorValue(event.accelerationIncludingGravity?.x);
  sensorValues.y.textContent = formatSensorValue(event.accelerationIncludingGravity?.y);
  sensorValues.z.textContent = formatSensorValue(event.accelerationIncludingGravity?.z);
  sensorStatus.textContent = 'Aktiv';
  sensorMessage.textContent = 'Bewegungsdaten werden empfangen.';
}

function onOrientation(event: DeviceOrientationEvent): void {
  orientationEventsSeen += 1;
  sensorValues.alpha.textContent = formatSensorValue(event.alpha);
  sensorValues.beta.textContent = formatSensorValue(event.beta);
  sensorValues.gamma.textContent = formatSensorValue(event.gamma);
}

function stopSensors(): void {
  window.removeEventListener('devicemotion', onMotion);
  window.removeEventListener('deviceorientation', onOrientation);
  sensorsActive = false;
  sensorStartBtn.disabled = false;
  sensorStopBtn.disabled = true;
  sensorStatus.textContent = 'Nicht aktiv';
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

fullscreenBtn.addEventListener('click', async () => {
  try {
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
    else await document.exitFullscreen();
  } catch {
    statusText.textContent = 'Vollbild nicht verfügbar';
  }
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
updateStatus(false);

// Sensor diagnostics are a first step toward the later POV mode; no POV rendering yet.
