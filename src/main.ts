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

// Sensor/POV research will be added after the text-scroller is stable.
