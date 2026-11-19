/** Keyboard + mouse state. World-space mouse is set by the renderer each frame. */
export const input = {
  keys: new Set<string>(),
  pressed: new Set<string>(), // pressed this frame
  mouseX: 0,
  mouseY: 0,
  worldX: 0,
  worldY: 0,
  lmb: false,
  rmb: false,
  lmbPressed: false,
  wheel: 0,
  /** when a DOM panel has focus/modal open, game input is ignored */
  blocked: false,
};

export function initInput(canvas: HTMLCanvasElement) {
  addEventListener('keydown', (e) => {
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (!input.keys.has(k)) input.pressed.add(k);
    input.keys.add(k);
    if (e.key === 'Tab' || e.key === ' ') e.preventDefault();
  });
  addEventListener('keyup', (e) => {
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    input.keys.delete(k);
  });
  addEventListener('blur', () => {
    input.keys.clear();
    input.lmb = input.rmb = false;
  });
  canvas.addEventListener('mousemove', (e) => {
    input.mouseX = e.clientX;
    input.mouseY = e.clientY;
  });
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) {
      input.lmb = true;
      input.lmbPressed = true;
    }
    if (e.button === 2) input.rmb = true;
  });
  addEventListener('mouseup', (e) => {
    if (e.button === 0) input.lmb = false;
    if (e.button === 2) input.rmb = false;
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener('wheel', (e) => {
    input.wheel += Math.sign(e.deltaY);
  }, { passive: true });
}

export function endFrameInput() {
  input.pressed.clear();
  input.lmbPressed = false;
  input.wheel = 0;
}

export const key = (k: string) => !input.blocked && input.keys.has(k);
export const pressed = (k: string) => !input.blocked && input.pressed.has(k);
