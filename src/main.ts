// Placeholder: a procedurally seeded starfield. The game is built on top of this.
const canvas = document.getElementById('game') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;

function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32((Math.random() * 2 ** 32) >>> 0);
const stars = Array.from({ length: 400 }, () => ({ x: rand(), y: rand(), z: rand() }));

function resize() {
  canvas.width = innerWidth * devicePixelRatio;
  canvas.height = innerHeight * devicePixelRatio;
}
addEventListener('resize', resize);
resize();

function frame(t: number) {
  const { width: w, height: h } = canvas;
  ctx.fillStyle = '#02030a';
  ctx.fillRect(0, 0, w, h);
  for (const s of stars) {
    const x = ((s.x * w - t * 0.02 * s.z * devicePixelRatio) % w + w) % w;
    ctx.fillStyle = `rgba(200,220,255,${0.3 + s.z * 0.7})`;
    ctx.fillRect(x, s.y * h, 1 + s.z * 2, 1 + s.z * 2);
  }
  ctx.fillStyle = '#9cf';
  ctx.font = `${24 * devicePixelRatio}px monospace`;
  ctx.textAlign = 'center';
  ctx.fillText('SPACEROGUE — under construction', w / 2, h / 2);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
