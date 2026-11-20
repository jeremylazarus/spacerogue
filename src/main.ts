import './ui/style.css';
import { initInput, endFrameInput } from './core/input';
import { audio } from './core/audio';
import { Renderer } from './game/render';
import { Game } from './game/game';
import { UI } from './ui/ui';
import { meta } from './game/meta';
import { hashSeed } from './core/rng';
import { systemSeed } from './game/run';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const uiRoot = document.getElementById('ui') as HTMLElement;
initInput(canvas);
audio.setVolumes(meta.settings.master, meta.settings.sfx, meta.settings.music);
addEventListener('pointerdown', () => audio.unlock(), { once: false });
addEventListener('keydown', () => audio.unlock(), { once: false });

const renderer = new Renderer(canvas);
const game = new Game();
const ui = new UI(uiRoot, game);
game.ui = ui;
ui.toastFn = (m, c) => renderer.toast(m, c);
ui.onTitle = () => {
  game.world = null;
  renderer.setBackground(hashSeed('menu'));
  ui.showTitle();
};
ui.onTitle();

let last = performance.now();
let lastWorld: unknown = null;
function frame(now: number) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  const w = game.world;
  if (w) {
    if (w !== lastWorld) {
      lastWorld = w;
      renderer.setBackground(systemSeed(game.run!, w.node));
      renderer.camX = w.player.x;
      renderer.camY = w.player.y;
    }
    if (!game.paused) w.update(dt);
    else audio.setThrust(0);
    renderer.render(w, game.paused ? 0 : dt);
  } else {
    lastWorld = null;
    renderer.drawBackdrop(now / 1000);
  }
  endFrameInput();
  if (import.meta.env.DEV) (window as unknown as { __frames: number }).__frames = ((window as unknown as { __frames: number }).__frames ?? 0) + 1;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

if (import.meta.env.DEV) (window as unknown as { __game: Game }).__game = game;

// save on tab close
addEventListener('beforeunload', () => game.save());
