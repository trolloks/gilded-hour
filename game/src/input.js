// Keyboard and mouse, normalised into the handful of actions the game loop reads.
// A key stays down between frames; a press is consumed once by wasPressed().

const GAME_KEYS = new Set([
  'KeyW', 'KeyA', 'KeyS', 'KeyD',
  'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight',
  'ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight',
  'KeyE', 'KeyQ', 'KeyF', 'KeyR', 'KeyM', 'KeyP', 'Tab',
  'Enter', 'Space', 'Escape',
]);

export function createInput(canvas) {
  const down = new Set();
  const pressed = new Set();
  const mouse = { clientX: 0, clientY: 0, moved: false, inside: false };
  let clickPending = false;
  let rightClickPending = false;
  let leftDown = false;

  function onKeyDown(event) {
    if (GAME_KEYS.has(event.code)) event.preventDefault();
    if (event.repeat) return;
    down.add(event.code);
    pressed.add(event.code);
  }

  function onKeyUp(event) {
    down.delete(event.code);
  }

  function onMouseMove(event) {
    mouse.clientX = event.clientX;
    mouse.clientY = event.clientY;
    mouse.moved = true;
    mouse.inside = true;
  }

  function onMouseDown(event) {
    if (event.button === 0) {
      clickPending = true;
      leftDown = true;
    }
    if (event.button === 2) rightClickPending = true;
  }

  function onMouseUp(event) {
    if (event.button === 0) leftDown = false;
  }

  function onContextMenu(event) {
    event.preventDefault();
  }

  window.addEventListener('keydown', onKeyDown, { passive: false });
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', () => down.clear());
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mouseleave', () => { mouse.inside = false; });
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);
  canvas.addEventListener('contextmenu', onContextMenu);

  return {
    isDown(code) {
      return down.has(code);
    },
    anyDown(codes) {
      return codes.some((code) => down.has(code));
    },
    wasPressed(code) {
      return pressed.has(code);
    },
    takeClick() {
      const value = clickPending;
      clickPending = false;
      return value;
    },
    takeRightClick() {
      const value = rightClickPending;
      rightClickPending = false;
      return value;
    },
    leftHeld() {
      return leftDown;
    },
    mouse,
    endFrame() {
      pressed.clear();
      clickPending = false;
      rightClickPending = false;
      mouse.moved = false;
    },
    /** -1, 0 or 1 on each axis: both arrow keys and WASD work. */
    axis() {
      const x = (down.has('KeyD') || down.has('ArrowRight') ? 1 : 0) - (down.has('KeyA') || down.has('ArrowLeft') ? 1 : 0);
      const y = (down.has('KeyS') || down.has('ArrowDown') ? 1 : 0) - (down.has('KeyW') || down.has('ArrowUp') ? 1 : 0);
      return { x, y };
    },
    sprinting() {
      return down.has('ShiftLeft') || down.has('ShiftRight');
    },
    sneaking() {
      return down.has('ControlLeft') || down.has('ControlRight');
    },
  };
}
