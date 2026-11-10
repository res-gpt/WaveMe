type MotionPermissionEvent = typeof DeviceMotionEvent & { requestPermission?: () => Promise<'granted' | 'denied'> };
type OrientationPermissionEvent = typeof DeviceOrientationEvent & { requestPermission?: () => Promise<'granted' | 'denied'> };

const byId = <T extends HTMLElement>(id: string): T => {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing sensor element: ${id}`);
  return element as T;
};

const sensorStart = byId<HTMLButtonElement>('sensorStartBtn');
const sensorStop = byId<HTMLButtonElement>('sensorStopBtn');
const sensorStatus = byId<HTMLSpanElement>('sensorStatus');
const alphaValue = byId<HTMLOutputElement>('alphaValue');
const betaValue = byId<HTMLOutputElement>('betaValue');
const gammaValue = byId<HTMLOutputElement>('gammaValue');
const accelXValue = byId<HTMLOutputElement>('accelXValue');
const accelYValue = byId<HTMLOutputElement>('accelYValue');
const accelZValue = byId<HTMLOutputElement>('accelZValue');

let listening = false;

function format(value: number | null): string {
  return value == null || !Number.isFinite(value) ? '—' : value.toFixed(2);
}

function onOrientation(event: DeviceOrientationEvent): void {
  alphaValue.value = format(event.alpha);
  betaValue.value = format(event.beta);
  gammaValue.value = format(event.gamma);
}

function onMotion(event: DeviceMotionEvent): void {
  const acceleration = event.accelerationIncludingGravity ?? event.acceleration;
  accelXValue.value = format(acceleration?.x ?? null);
  accelYValue.value = format(acceleration?.y ?? null);
  accelZValue.value = format(acceleration?.z ?? null);
}

function setStatus(message: string): void {
  sensorStatus.textContent = message;
}

async function startSensors(): Promise<void> {
  if (listening) return;
  sensorStart.disabled = true;
  setStatus('Berechtigung wird geprüft …');

  try {
    const motionCtor = DeviceMotionEvent as MotionPermissionEvent;
    const orientationCtor = DeviceOrientationEvent as OrientationPermissionEvent;

    // iOS requires permission requests to originate from a user gesture.
    if (typeof motionCtor.requestPermission === 'function') {
      const permission = await motionCtor.requestPermission();
      if (permission !== 'granted') throw new Error('Bewegungssensor nicht freigegeben');
    }
    if (typeof orientationCtor.requestPermission === 'function') {
      const permission = await orientationCtor.requestPermission();
      if (permission !== 'granted') throw new Error('Orientierungssensor nicht freigegeben');
    }

    if (!('DeviceMotionEvent' in window) && !('DeviceOrientationEvent' in window)) {
      throw new Error('Dieses Gerät stellt keine Bewegungssensoren bereit');
    }

    window.addEventListener('deviceorientation', onOrientation);
    window.addEventListener('devicemotion', onMotion);
    listening = true;
    sensorStop.disabled = false;
    setStatus('Sensoren aktiv');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Sensorzugriff fehlgeschlagen';
    setStatus(message);
  } finally {
    sensorStart.disabled = listening;
  }
}

function stopSensors(): void {
  window.removeEventListener('deviceorientation', onOrientation);
  window.removeEventListener('devicemotion', onMotion);
  listening = false;
  sensorStart.disabled = false;
  sensorStop.disabled = true;
  setStatus('Gestoppt');
}

sensorStart.addEventListener('click', () => void startSensors());
sensorStop.addEventListener('click', stopSensors);
window.addEventListener('pagehide', stopSensors);
