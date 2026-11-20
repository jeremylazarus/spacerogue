import { audio } from '../core/audio';
import { input } from '../core/input';
import { hashSeed } from '../core/rng';
import { RNG } from '../core/rng';
import { makePortrait } from '../art/portraits';
import type { Game, UiBridge } from '../game/game';
import type { EventSession } from '../game/events';
import { ALL_CODEX } from '../game/events';
import type { POI } from '../game/entities';
import { HULLS, RARITY_COLORS, RARITY_NAMES, RELICS, describeModule, fmtMod, hullDef, moduleName, moduleValue, rollModule, type ModuleInst } from '../game/items';
import { SKILLS, TREES, skillById } from '../game/skills';
import { APTITUDES } from '../game/api';
import { ROLE_APT, aptitude, canLearn, computeStats, currentNode, factionById, makeOfficer, nodeById, repLabel, type RunState } from '../game/run';
import { DEEDS, LEGACY, hasDeed, hullUnlocked, meta, perk, resetMeta, saveMeta, unlockedSet } from '../game/meta';
import { playerSprite } from '../game/world';
import { ARCS } from '../content/arcs';
import type { Officer } from '../game/api';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const APT_LABEL: Record<string, string> = { combat: 'Combat', science: 'Science', engineering: 'Engineering', diplomacy: 'Diplomacy', guile: 'Guile', salvage: 'Salvage', navigation: 'Navigation' };
const ROLE_LABEL: Record<string, string> = { gunner: 'Gunner', engineer: 'Engineer', navigator: 'Navigator', xenologist: 'Xenologist', medic: 'Medic', quartermaster: 'Quartermaster', spy: 'Spy' };

type PanelId = 'event' | 'station' | 'ship' | 'captain' | 'map' | 'journal' | 'pause' | 'settings' | 'summary' | 'title' | 'hulls' | 'legacy' | 'codex';

export class UI implements UiBridge {
  root: HTMLElement;
  game: Game;
  stack: { id: PanelId; el: HTMLElement; onClose?: () => void }[] = [];
  tip: HTMLDivElement;
  toastFn: (m: string, c?: string) => void = () => {};
  onTitle: () => void = () => {};

  constructor(root: HTMLElement, game: Game) {
    this.root = root;
    this.game = game;
    this.tip = document.createElement('div');
    this.tip.className = 'tip';
    this.tip.style.display = 'none';
    document.body.appendChild(this.tip);
    addEventListener('mousemove', (e) => {
      if (this.tip.style.display !== 'none') this.placeTip(e.clientX, e.clientY);
    });
    addEventListener('keydown', (e) => this.onKey(e));
    // UI sounds
    root.addEventListener('click', (e) => {
      const t = e.target as HTMLElement;
      if (t.closest('button:not(:disabled)')) audio.sfx('ui_click', { vol: 0.5 });
    });
  }

  // -------------------------------------------------------------------------
  // Bridge
  // -------------------------------------------------------------------------
  toast(msg: string, color?: string) {
    this.toastFn(msg, color);
  }
  anyModal() {
    return this.stack.length > 0;
  }
  closeAll() {
    while (this.stack.length) this.pop(true);
  }

  private push(id: PanelId, el: HTMLElement, onClose?: () => void) {
    this.root.appendChild(el);
    this.stack.push({ id, el, onClose });
    input.blocked = true;
    this.hideTip();
    input.lmb = input.rmb = false;
  }
  private pop(silent = false) {
    const top = this.stack.pop();
    if (!top) return;
    top.el.remove();
    this.hideTip();
    if (!silent) audio.sfx('ui_close', { vol: 0.4 });
    input.blocked = this.stack.length > 0;
    // the key/click that closed a panel must not also act in the game world
    input.pressed.clear();
    input.lmbPressed = false;
    input.lmb = input.rmb = false;
    top.onClose?.();
  }
  private top() {
    return this.stack[this.stack.length - 1];
  }
  private closeId(id: PanelId) {
    const entry = this.stack.find((s) => s.id === id);
    if (!entry) return;
    // onClose may push new panels (e.g. the next queued event); stop once the target is gone
    while (this.stack.includes(entry)) this.pop();
  }
  isOpen(id: PanelId) {
    return this.stack.some((s) => s.id === id);
  }

  private overlay(cls = '', clear = false): HTMLDivElement {
    const o = document.createElement('div');
    o.className = 'overlay' + (clear ? ' clear' : '') + (cls ? ' ' + cls : '');
    return o;
  }

  private onKey(e: KeyboardEvent) {
    const top = this.top();
    const k = e.key;
    if (top?.id === 'event') {
      const n = parseInt(k, 10);
      if (n >= 1 && n <= 9) {
        const btns = top.el.querySelectorAll<HTMLButtonElement>('.choice');
        btns[n - 1]?.click();
        e.preventDefault();
      } else if ((k === 'Enter' || k === ' ') && top.el.querySelectorAll('.choice').length === 1) {
        top.el.querySelector<HTMLButtonElement>('.choice')?.click();
        e.preventDefault();
      }
      return;
    }
    if (top && ['summary', 'title'].includes(top.id)) return;
    if (k === 'Escape') {
      if (top && top.id !== 'title') {
        if (top.id === 'hulls' || top.id === 'legacy' || top.id === 'codex' || top.id === 'settings') {
          this.pop();
          return;
        }
        this.pop();
      } else if (this.game.world && !this.game.run?.outcome && !this.game.world.playerDead) this.showPause();
      e.preventDefault();
      return;
    }
    if (!this.game.world || this.game.run?.outcome || this.game.world.playerDead) return;
    if (top?.id === 'station' && (k === 'Tab' || k === 'i' || k === 'I')) {
      e.preventDefault();
      this.showShip();
      return;
    }
    if (top && !['ship', 'captain', 'map', 'journal'].includes(top.id)) return;
    const map: Record<string, PanelId> = { Tab: 'ship', i: 'ship', I: 'ship', k: 'captain', K: 'captain', m: 'map', M: 'map', j: 'journal', J: 'journal' };
    const id = map[k];
    if (!id) return;
    e.preventDefault();
    if (top?.id === id) {
      this.pop();
      return;
    }
    if (top) this.pop(true);
    if (id === 'ship') this.showShip();
    if (id === 'captain') this.showCaptain();
    if (id === 'map') this.showMap();
    if (id === 'journal') this.showJournal();
  }

  // -------------------------------------------------------------------------
  // Tooltips
  // -------------------------------------------------------------------------
  private showTip(html: string, e: MouseEvent) {
    this.tip.innerHTML = html;
    this.tip.style.display = 'block';
    this.placeTip(e.clientX, e.clientY);
  }
  private placeTip(x: number, y: number) {
    const r = this.tip.getBoundingClientRect();
    let tx = x + 16, ty = y + 14;
    if (tx + r.width > innerWidth - 8) tx = x - r.width - 12;
    if (ty + r.height > innerHeight - 8) ty = innerHeight - r.height - 8;
    this.tip.style.left = tx + 'px';
    this.tip.style.top = ty + 'px';
  }
  private hideTip() {
    this.tip.style.display = 'none';
  }
  private bindTip(el: HTMLElement, html: () => string) {
    el.addEventListener('mouseenter', (e) => this.showTip(html(), e));
    el.addEventListener('mouseleave', () => this.hideTip());
  }
  private moduleTip(m: ModuleInst, extra = ''): string {
    const lines = describeModule(m);
    return `<div class="t" style="color:${RARITY_COLORS[m.rarity]}">${esc(moduleName(m))}</div><div class="r" style="color:${RARITY_COLORS[m.rarity]}">${RARITY_NAMES[m.rarity]} ${m.slot}</div>${lines.map((l) => `<div>${esc(l)}</div>`).join('')}${extra}`;
  }

  // -------------------------------------------------------------------------
  // Title flow
  // -------------------------------------------------------------------------
  showTitle() {
    this.closeAll();
    const o = this.overlay('title', true);
    const hasSave = this.game.hasSave();
    o.innerHTML = `
      <div class="logo">SHOAL</div>
      <div class="sub">a voyage to the heart</div>
      <div class="menu">
        ${hasSave ? '<button class="btn primary" data-a="continue" data-tip="continue">Continue Voyage</button>' : ''}
        <button class="btn ${hasSave ? '' : 'primary'}" data-a="new" data-tip="new">${meta.runs === 0 ? 'Wake' : 'Wake Again'}</button>
        ${meta.runs > 0 ? this.legacyButton() : ''}
        ${meta.codex.length > 0 ? '<button class="btn" data-a="codex" data-tip="codex">Codex</button>' : ''}
        <button class="btn" data-a="settings" data-tip="settings">Settings</button>
      </div>
      ${meta.runs > 0 ? `<div class="echo-count">◈ ${meta.echoes} Echoes · ${meta.runs} ${meta.runs === 1 ? 'life' : 'lives'}${meta.victories ? ` · ${meta.victories} reached the Heart` : ''}</div>` : ''}
      <div class="footer">Mouse & keyboard · best with sound on</div>`;
    o.addEventListener('click', (e) => {
      const a = (e.target as HTMLElement).closest('[data-a]')?.getAttribute('data-a');
      audio.unlock();
      if (a === 'continue') {
        this.closeAll();
        if (!this.game.continueRun()) this.showTitle();
      } else if (a === 'new') {
        this.hideTip();
        if (hasSave && !confirm('Abandon the voyage in progress?')) return;
        this.showHulls();
      } else if (a === 'legacy') this.showLegacy();
      else if (a === 'codex') this.showCodex();
      else if (a === 'settings') this.showSettings();
    });
    this.bindMenuTips(o);
    this.push('title', o);
    audio.setMood('menu');
  }

  /** true if some Legacy purchase is affordable right now */
  private legacyAffordable(): boolean {
    return LEGACY.some((l) => {
      if (l.needsDeed && !hasDeed(l.needsDeed)) return false;
      if (l.id === 'hull.lancer' && hullUnlocked('lancer')) return false;
      const cost = l.costs[perk(l.id)];
      return cost !== undefined && meta.echoes >= cost;
    });
  }

  private legacyButton(): string {
    const afford = this.legacyAffordable();
    return `<button class="btn ${afford ? 'gold' : ''}" data-a="legacy" data-tip="legacy">Legacy · ◈ ${meta.echoes}${afford ? ' <span class="pip">●</span>' : ''}</button>`;
  }

  private bindMenuTips(root: HTMLElement, only?: string) {
    const afford = this.legacyAffordable();
    const TIPS: Record<string, () => string> = {
      continue: () => 'Resume the voyage in progress, from your last arrival in a system.',
      new: () => (meta.runs === 0 ? 'Begin your first voyage.' : 'Begin a new voyage. Everything you have unlocked in Legacy comes with you; the voyage itself is new.') + (this.game.hasSave() ? '<div class="cmp">This abandons the voyage in progress.</div>' : ''),
      legacy: () => `Spend Echoes ◈ on permanent unlocks that carry into every future voyage. This does not start a game.<div class="cmp">You have ◈ ${meta.echoes}.${afford ? ' <span style="color:var(--gold)">Something is affordable now.</span>' : ''}</div>`,
      codex: () => 'What you remember: lore recovered across all your lives.',
      settings: () => 'Volume, screen shake, damage numbers, and erasing progress.',
      again: () => 'Back to ship selection for a new voyage. Your unlocks carry over.',
    };
    root.querySelectorAll<HTMLElement>(only ? `[data-tip="${only}"]` : '[data-tip]').forEach((el) => {
      const f = TIPS[el.dataset.tip!];
      if (f) this.bindTip(el, f);
    });
  }

  showHulls() {
    const o = this.overlay();
    let sel = HULLS.find((h) => hullUnlocked(h.id))!.id;
    let res = 0;
    const p = document.createElement('div');
    p.className = 'panel';
    p.style.width = 'min(980px,96vw)';
    o.appendChild(p);
    const render = () => {
      const resSel = meta.maxResonance > 0 ? `<div class="row" style="margin-top:14px"><span class="hint">Resonance</span>${Array.from({ length: meta.maxResonance + 1 }, (_, i) => `<button class="btn small ${i === res ? 'primary' : ''}" data-res="${i}">${i === 0 ? 'Calm' : 'R' + i}</button>`).join('')}<span class="hint">${res > 0 ? `The Shoal fights harder. +${res * 20}% Echoes.` : ''}</span></div>` : '';
      p.innerHTML = `<div class="phead"><h2>Choose a ship</h2><button class="x" data-a="close">×</button></div>
        <div class="pbody"><div class="hulls">${HULLS.map((h) => {
          const un = hullUnlocked(h.id);
          const secret = h.id === 'hollow' && !un;
          return `<div class="hull ${un ? '' : 'locked'} ${sel === h.id ? 'sel' : ''}" data-h="${h.id}">
            <div class="cv" data-cv="${h.id}"></div>
            <div class="nm">${secret ? '???' : h.name}</div>
            <div class="ds">${secret ? 'Something you have not remembered yet.' : esc(h.desc)}</div>
            ${secret ? '' : `<div class="ab">${h.abilityName}: ${esc(h.abilityDesc)}</div><div class="sl">${h.weaponSlots} weapon · ${h.utilSlots} utility</div>`}
            ${un ? '' : secret ? '' : `<div class="sl" style="color:var(--gold)">Unlock in Legacy</div>`}
          </div>`;
        }).join('')}</div>${resSel}
        <div class="row" style="margin-top:18px;justify-content:flex-end"><button class="btn primary" data-a="go">Launch</button></div></div>`;
      p.querySelectorAll<HTMLElement>('[data-cv]').forEach((d) => {
        const id = d.dataset.cv!;
        if (id === 'hollow' && !hullUnlocked(id)) return;
        const spr = playerSprite(id);
        const c = document.createElement('canvas');
        c.width = c.height = 90;
        const cx = c.getContext('2d')!;
        cx.translate(45, 45);
        cx.rotate(-Math.PI / 2);
        const k = Math.min(1.8, 80 / spr.width);
        cx.scale(k, k);
        cx.drawImage(spr, -spr.width / 2, -spr.height / 2);
        d.appendChild(c);
      });
    };
    render();
    p.addEventListener('click', (e) => {
      const t = e.target as HTMLElement;
      const h = t.closest('[data-h]')?.getAttribute('data-h');
      if (h && hullUnlocked(h)) {
        sel = h;
        render();
      }
      const r = t.closest('[data-res]')?.getAttribute('data-res');
      if (r) {
        res = +r;
        render();
      }
      const a = t.closest('[data-a]')?.getAttribute('data-a');
      if (a === 'close') this.pop();
      if (a === 'go') {
        this.closeAll();
        this.game.newRun(sel, res);
      }
    });
    p.addEventListener('dblclick', (e) => {
      const h = (e.target as HTMLElement).closest('[data-h]')?.getAttribute('data-h');
      if (h && hullUnlocked(h)) {
        this.closeAll();
        this.game.newRun(h, res);
      }
    });
    this.push('hulls', o);
  }

  // -------------------------------------------------------------------------
  // Events
  // -------------------------------------------------------------------------
  showEvent(session: EventSession, onClose: () => void) {
    const o = this.overlay();
    const p = document.createElement('div');
    p.className = 'panel event';
    o.appendChild(p);
    audio.sfx('ui_open', { vol: 0.5 });
    const render = () => {
      const v = session.view();
      p.innerHTML = `<div class="phead"><h2>${esc(v.title)}</h2><span class="hint">${esc(this.game.run ? currentNode(this.game.run).name : '')}</span></div>
        <div class="body"><div class="pt"></div><div class="text">${esc(v.text)}</div></div>
        <div class="lines">${v.lines.map((l) => `<div class="line ${l.kind}">${esc(l.text)}</div>`).join('')}</div>
        <div class="choices">${v.choices.map((c, i) => `<button class="choice" data-i="${i}" ${c.enabled ? '' : 'disabled'}><span class="n">${i + 1}</span><span>${esc(c.label)}${c.req ? `<span class="req">[${esc(c.req)}]</span>` : ''}</span></button>`).join('')}</div>`;
      if (!v.text) p.querySelector('.body')!.remove();
      if (v.portrait !== 'none' && v.text) {
        const f = v.faction;
        let arch: Parameters<typeof makePortrait>[1] = 'human';
        let seed = 1, c1 = '#8ab', c2 = '#345';
        if (v.portrait === 'faction' && f) {
          arch = f.archetype;
          seed = hashSeed(f.name, session.def.id);
          c1 = f.color;
          c2 = f.color2;
        } else if (v.portrait === 'officer') {
          seed = hashSeed(session.def.id);
        }
        const pc = makePortrait(seed, arch, 180, c1, c2);
        pc.className = 'portrait';
        pc.style.width = pc.style.height = '180px';
        p.querySelector('.pt')!.appendChild(pc);
      }
    };
    render();
    p.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest('[data-i]') as HTMLButtonElement | null;
      if (!b || b.disabled) return;
      const done = session.choose(+b.dataset.i!);
      if (done || session.ended) {
        this.closeId('event');
      } else render();
    });
    this.push('event', o, onClose);
  }

  // -------------------------------------------------------------------------
  // Station
  // -------------------------------------------------------------------------
  showStation(poi: POI) {
    const game = this.game;
    const run = game.run!;
    const w = game.world!;
    audio.sfx('dock');
    w.player.vx = w.player.vy = 0;
    const haven = currentNode(run).kind === 'haven';
    const f = poi.owner;
    const rep = f ? run.rep[f.id] ?? 0 : 20;
    const st = () => w.stats;
    const discount = () => st().priceMult * (rep >= 60 ? 0.8 : rep >= 30 ? 0.9 : 1) * (haven ? 0.85 : 1);
    // stable stock per station
    const key = `station.${run.nodeId}.${poi.id}`;
    const stockRng = new RNG(hashSeed(run.seed, key));
    const unlocked = unlockedSet();
    const stockKey = key + '.stock';
    let stock: ModuleInst[] = (run.flags[stockKey] ? JSON.parse(run.flags[stockKey] as string) : null) ?? Array.from({ length: 6 }, (_, i) => rollModule(stockRng, { slot: i < 3 ? 'weapon' : 'utility', rarity: Math.min(4, Math.max(0, Math.floor(stockRng.next() * 2.2 + run.depth * 0.25 + (i === 5 ? 1 : 0)))), unlocked }));
    const saveStock = () => (run.flags[stockKey] = JSON.stringify(stock));
    saveStock();
    const officerKey = key + '.officer';
    let officer: Officer | null = run.flags[officerKey] === 'none' ? null : run.flags[officerKey] ? JSON.parse(run.flags[officerKey] as string) : stockRng.chance(0.55) ? makeOfficer(stockRng, run.factions) : null;
    run.flags[officerKey] = officer ? JSON.stringify(officer) : 'none';
    const concourseKey = key + '.concourse';
    const o = this.overlay();
    const p = document.createElement('div');
    p.className = 'panel station';
    o.appendChild(p);
    let tab: 'market' | 'yard' | 'crew' = 'market';
    const render = () => {
      const s = st();
      const missing = Math.max(0, Math.round(s.maxHull - w.player.hull));
      const repairCost = Math.ceil(missing * 1.4 * discount() * (1 + run.depth * 0.08));
      const fuelCost = Math.round(16 * discount() * (1 + run.depth * 0.1));
      const hireCost = Math.round((110 + run.depth * 25) * discount());
      const price = (m: ModuleInst) => Math.round(moduleValue(m) * discount() * (1 + run.depth * 0.08));
      const sellP = (m: ModuleInst) => Math.round(moduleValue(m) * 0.35);
      p.innerHTML = `<div class="phead"><div><h2>${esc(poi.name)}</h2><span class="hint">${f ? `${esc(f.name)} · ${repLabel(rep)}` : 'Independent'} · ¢ <b style="color:var(--gold)">${run.credits}</b></span></div>
        <div class="row"><div class="tabs"><button class="tab ${tab === 'market' ? 'on' : ''}" data-tab="market">Market</button><button class="tab ${tab === 'yard' ? 'on' : ''}" data-tab="yard">Shipyard</button><button class="tab ${tab === 'crew' ? 'on' : ''}" data-tab="crew">Crew</button></div>
        <button class="btn small" data-a="ship">Ship <span class="kbd">Tab</span></button><button class="btn" data-a="undock">Undock</button></div></div>
        <div class="pbody">${
          tab === 'market'
            ? `<h3>For sale</h3><div class="cargo">${stock.map((m, i) => `<div class="card" data-buy="${i}" style="--edge:${RARITY_COLORS[m.rarity]}55"><div class="nm" style="color:${RARITY_COLORS[m.rarity]}">${esc(moduleName(m))}</div><div class="kind">${RARITY_NAMES[m.rarity]} ${m.slot}</div><div class="price">${price(m)}¢</div></div>`).join('') || '<div class="hint">Sold out.</div>'}</div>
               <h3>Your cargo <span class="hint" style="text-transform:none;letter-spacing:0">— click to sell</span></h3><div class="cargo">${run.cargo.map((m, i) => `<div class="card" data-sell="${i}"><div class="nm" style="color:${RARITY_COLORS[m.rarity]}">${esc(moduleName(m))}</div><div class="kind">${RARITY_NAMES[m.rarity]} ${m.slot}</div><div class="price">+${sellP(m)}¢</div></div>`).join('') || '<div class="hint">Empty. Unequip modules in the ship screen to sell them.</div>'}</div>`
            : tab === 'yard'
              ? `<div class="service"><div class="grow"><b>Repair hull</b><span>${missing > 0 ? `${missing} damage to patch` : 'Hull is intact.'}</span></div><button class="btn" data-a="repair" ${missing > 0 && run.credits >= Math.min(repairCost, 1) ? '' : 'disabled'}>${missing > 0 ? (run.credits >= repairCost ? `Repair all · ${repairCost}¢` : `Repair what you can afford`) : 'Repaired'}</button></div>
                 <div class="service"><div class="grow"><b>Refuel</b><span>${run.fuel}/${s.maxFuel} cells</span></div><button class="btn" data-a="fuel" ${run.fuel < s.maxFuel && run.credits >= fuelCost ? '' : 'disabled'}>Buy 1 · ${fuelCost}¢</button><button class="btn" data-a="fuelmax" ${run.fuel < s.maxFuel && run.credits >= fuelCost * 2 ? '' : 'disabled'}>Fill up</button></div>
                 <div class="service"><div class="grow"><b>Concourse</b><span>${run.flags[concourseKey] ? 'You have already walked the concourse.' : 'Stretch your legs. Listen. See who is around.'}</span></div><button class="btn" data-a="concourse" ${run.flags[concourseKey] ? 'disabled' : ''}>Visit</button></div>`
              : `<h3>For hire</h3>${officer ? `<div class="service"><div class="grow"><b>${esc(officer.name)} — ${ROLE_LABEL[officer.role]}</b><span>${esc(officer.species)}, ${esc(officer.trait)}. +2 ${APT_LABEL[ROLE_APT[officer.role]]}.</span></div><button class="btn" data-a="hire" ${run.credits >= hireCost && run.officers.length < 4 ? '' : 'disabled'}>${run.officers.length >= 4 ? 'No room' : `Hire · ${hireCost}¢`}</button></div>` : '<div class="hint">Nobody here is looking for a berth.</div>'}
                 <h3>Your officers (${run.officers.length}/4)</h3>${run.officers.map((of) => `<div class="list-item"><b>${esc(of.name)}</b><span class="hint">${ROLE_LABEL[of.role]} · ${esc(of.species)} · ${esc(of.trait)}</span></div>`).join('') || '<div class="hint">You fly alone.</div>'}`
        }</div>`;
      p.querySelectorAll<HTMLElement>('[data-buy]').forEach((el) => {
        const m = stock[+el.dataset.buy!];
        this.bindTip(el, () => this.moduleTip(m, this.compareTip(run, m)));
      });
      p.querySelectorAll<HTMLElement>('[data-sell]').forEach((el) => {
        const m = run.cargo[+el.dataset.sell!];
        this.bindTip(el, () => this.moduleTip(m));
      });
    };
    render();
    p.addEventListener('click', (e) => {
      const t = e.target as HTMLElement;
      const tb = t.closest('[data-tab]')?.getAttribute('data-tab');
      if (tb) {
        tab = tb as typeof tab;
        render();
        return;
      }
      const s = st();
      const disc = discount();
      const buy = t.closest('[data-buy]')?.getAttribute('data-buy');
      if (buy !== undefined && buy !== null) {
        const m = stock[+buy];
        const pr = Math.round(moduleValue(m) * disc * (1 + run.depth * 0.08));
        if (run.credits < pr) {
          audio.sfx('error');
          return;
        }
        if (run.cargo.length >= 12) {
          this.toast('Cargo hold full', '#fa8');
          audio.sfx('error');
          return;
        }
        run.credits -= pr;
        run.cargo.push(m);
        stock = stock.filter((x) => x !== m);
        saveStock();
        audio.sfx('credits');
        this.hideTip();
        render();
        return;
      }
      const sell = t.closest('[data-sell]')?.getAttribute('data-sell');
      if (sell !== undefined && sell !== null) {
        const m = run.cargo[+sell];
        run.cargo.splice(+sell, 1);
        const v = Math.round(moduleValue(m) * 0.35);
        run.credits += v;
        stock.push(m);
        saveStock();
        audio.sfx('credits');
        this.hideTip();
        render();
        return;
      }
      const a = t.closest('[data-a]')?.getAttribute('data-a');
      if (a === 'undock') this.closeId('station');
      if (a === 'ship') this.showShip();
      if (a === 'repair') {
        const missing = Math.max(0, s.maxHull - w.player.hull);
        const per = 1.4 * disc * (1 + run.depth * 0.08);
        const afford = Math.min(missing, Math.floor(run.credits / per));
        run.credits -= Math.ceil(afford * per);
        w.player.hull += afford;
        run.hull = w.player.hull;
        audio.sfx('pickup');
        render();
      }
      if (a === 'fuel' || a === 'fuelmax') {
        const fc = Math.round(16 * disc * (1 + run.depth * 0.1));
        do {
          if (run.credits < fc || run.fuel >= s.maxFuel) break;
          run.credits -= fc;
          run.fuel++;
        } while (a === 'fuelmax');
        audio.sfx('pickup');
        render();
      }
      if (a === 'hire' && officer) {
        const hc = Math.round((110 + run.depth * 25) * disc);
        if (run.credits < hc || run.officers.length >= 4) return;
        run.credits -= hc;
        run.officers.push(officer);
        officer = null;
        run.flags[officerKey] = 'none';
        this.game.refresh();
        audio.sfx('levelup');
        render();
      }
      if (a === 'concourse') {
        run.flags[concourseKey] = true;
        this.closeId('station');
        this.game.stationConcourse(poi);
      }
    });
    this.push('station', o, () => this.game.save());
  }

  private compareTip(run: RunState, m: ModuleInst): string {
    const eq = (m.slot === 'weapon' ? run.weapons : run.utils).filter(Boolean) as ModuleInst[];
    if (!eq.length) return '';
    return `<div class="cmp">Equipped: ${eq.map((x) => `<span style="color:${RARITY_COLORS[x.rarity]}">${esc(moduleName(x))}</span>`).join(', ')}</div>`;
  }

  // -------------------------------------------------------------------------
  // Ship
  // -------------------------------------------------------------------------
  showShip() {
    const game = this.game;
    const run = game.run!;
    const o = this.overlay();
    const p = document.createElement('div');
    p.className = 'panel ship';
    o.appendChild(p);
    const h = hullDef(run.hullId);
    let selected: { from: 'cargo' | 'weapon' | 'utility'; i: number } | null = null;
    const render = () => {
      const s = computeStats(run);
      const slotCard = (m: ModuleInst | null, kind: 'weapon' | 'utility', i: number) =>
        m
          ? `<div class="card ${selected?.from === kind && selected.i === i ? 'sel' : ''}" draggable="true" data-from="${kind}" data-i="${i}" style="--edge:${RARITY_COLORS[m.rarity]}66"><div class="nm" style="color:${RARITY_COLORS[m.rarity]}">${esc(moduleName(m))}</div><div class="kind">${kind === 'weapon' ? (i % 2 === 0 ? 'Left mouse' : 'Right mouse') : 'Utility'}</div></div>`
          : `<div class="card empty" data-from="${kind}" data-i="${i}">Empty ${kind} slot</div>`;
      const stat = (label: string, v: string) => `<div><span>${label}</span><span>${v}</span></div>`;
      p.innerHTML = `<div class="phead"><div><h2>${esc(run.shipName)}</h2><span class="hint">${h.name} · Captain ${esc(run.captain)}</span></div><div class="row"><span class="hint">Drag modules between slots and cargo · double-click to equip/unequip</span><button class="x" data-a="close">×</button></div></div>
        <div class="pbody"><div class="cols"><div>
          <h3>Weapons</h3><div class="slots">${run.weapons.map((m, i) => slotCard(m, 'weapon', i)).join('')}</div>
          <h3>Utility</h3><div class="slots">${run.utils.map((m, i) => slotCard(m, 'utility', i)).join('')}</div>
          <h3>Systems</h3><div class="stats">
            ${stat('Hull', `${Math.round(game.world?.player.hull ?? run.hull)}/${s.maxHull}`)}${stat('Armor', s.armor.toFixed(0))}
            ${stat('Shield', `${Math.round(s.maxShield)} (+${s.shieldRegen.toFixed(1)}/s)`)}${stat('Energy', `${Math.round(s.maxEnergy)} (+${Math.round(s.energyRegen)}/s)`)}
            ${stat('Speed', Math.round(s.maxSpeed) + '')}${stat('Damage', `${Math.round((s.damageMult - 1) * 100) >= 0 ? '+' : ''}${Math.round((s.damageMult - 1) * 100)}%`)}
            ${stat('Fire rate', `+${Math.round((s.fireRateMult - 1) * 100)}%`)}${stat('Critical', `${Math.round(s.critChance * 100)}% ×${s.critMult.toFixed(1)}`)}
            ${stat('Scanner', Math.round(s.scanRange) + '')}${stat('Fuel', `${run.fuel}/${s.maxFuel}`)}
            ${s.drones ? stat('Drones', s.drones + '') : ''}${s.dodge ? stat('Evasion', Math.round(s.dodge * 100) + '%') : ''}${s.hullRegen ? stat('Hull repair', s.hullRegen.toFixed(1) + '/s') : ''}${s.lifesteal ? stat('Lifesteal', Math.round(s.lifesteal * 100) + '%') : ''}
          </div>
          <h3>Relics</h3><div>${run.relics.map((r) => `<span class="tag" data-relic="${r}" style="--edge:#ffb34766;color:#ffd08a">${esc(RELICS[r].name)}</span>`).join('') || '<span class="hint">None yet.</span>'}</div>
          <h3>Crew (${run.officers.length}/4)</h3><div>${run.officers.map((of) => `<span class="tag">${esc(of.name)} · ${ROLE_LABEL[of.role]} · +2 ${APT_LABEL[ROLE_APT[of.role]]}</span>`).join('') || '<span class="hint">No officers aboard.</span>'} <span class="hint">Details on the Captain screen (K).</span></div>
        </div><div>
          <h3>Cargo (${run.cargo.length}/12)</h3><div class="cargo" data-cargo="1">${run.cargo.map((m, i) => `<div class="card ${selected?.from === 'cargo' && selected.i === i ? 'sel' : ''}" draggable="true" data-from="cargo" data-i="${i}" style="--edge:${RARITY_COLORS[m.rarity]}44"><div class="nm" style="color:${RARITY_COLORS[m.rarity]}">${esc(moduleName(m))}</div><div class="kind">${RARITY_NAMES[m.rarity]} ${m.slot}</div></div>`).join('')}<div class="card empty" data-from="cargo" data-i="-1">Drop here to unequip</div></div>
          <div class="row" style="margin-top:12px"><button class="btn small danger" data-a="scrap" ${selected?.from === 'cargo' ? '' : 'disabled'}>Scrap selected</button><span class="hint">Scrapping a module yields a few credits.</span></div>
        </div></div></div>`;
      p.querySelectorAll<HTMLElement>('.card[draggable]').forEach((el) => {
        const m = this.getMod(run, el.dataset.from as 'cargo', +el.dataset.i!);
        if (m) this.bindTip(el, () => this.moduleTip(m, el.dataset.from === 'cargo' ? this.compareTip(run, m) : ''));
      });
      p.querySelectorAll<HTMLElement>('[data-relic]').forEach((el) => {
        const r = RELICS[el.dataset.relic as keyof typeof RELICS];
        this.bindTip(el, () => `<div class="t" style="color:#ffd08a">${esc(r.name)}</div><div>${esc(r.desc)}</div>`);
      });
    };
    const apply = (from: { from: string; i: number }, to: { from: string; i: number }) => {
      if (this.moveModule(run, from as never, to as never)) {
        game.refresh();
        audio.sfx('pickup', { vol: 0.4, pitch: 1.4 });
      } else audio.sfx('error', { vol: 0.4 });
      selected = null;
      this.hideTip();
      render();
    };
    render();
    let dragFrom: { from: string; i: number } | null = null;
    p.addEventListener('dragstart', (e) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>('.card[draggable]');
      if (!el) return;
      dragFrom = { from: el.dataset.from!, i: +el.dataset.i! };
      e.dataTransfer?.setData('text/plain', 'x');
      this.hideTip();
    });
    p.addEventListener('dragover', (e) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>('.card');
      if (el && dragFrom) {
        e.preventDefault();
        p.querySelectorAll('.drop').forEach((d) => d.classList.remove('drop'));
        el.classList.add('drop');
      }
    });
    p.addEventListener('drop', (e) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>('.card');
      if (!el || !dragFrom) return;
      e.preventDefault();
      apply(dragFrom, { from: el.dataset.from!, i: +el.dataset.i! });
      dragFrom = null;
    });
    p.addEventListener('dragend', () => {
      dragFrom = null;
      p.querySelectorAll('.drop').forEach((d) => d.classList.remove('drop'));
    });
    p.addEventListener('click', (e) => {
      const t = e.target as HTMLElement;
      const a = t.closest('[data-a]')?.getAttribute('data-a');
      if (a === 'close') return this.closeId('ship');
      if (a === 'scrap' && selected?.from === 'cargo') {
        const [m] = run.cargo.splice(selected.i, 1);
        const v = Math.round(moduleValue(m) * 0.12);
        run.credits += v;
        this.toast(`Scrapped for ${v}¢`, '#ffd76a');
        selected = null;
        render();
        return;
      }
      const el = t.closest<HTMLElement>('.card');
      if (!el) return;
      const here = { from: el.dataset.from!, i: +el.dataset.i! };
      if (selected) {
        if (selected.from === here.from && selected.i === here.i) selected = null;
        else return apply(selected, here);
      } else if (!el.classList.contains('empty')) selected = here as { from: 'cargo' | 'weapon' | 'utility'; i: number };
      render();
    });
    p.addEventListener('dblclick', (e) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>('.card[draggable]');
      if (!el) return;
      const from = { from: el.dataset.from!, i: +el.dataset.i! };
      if (from.from === 'cargo') {
        const m = run.cargo[from.i];
        const arr = m.slot === 'weapon' ? run.weapons : run.utils;
        let idx = arr.findIndex((x) => !x);
        if (idx < 0) idx = 0;
        apply(from, { from: m.slot, i: idx });
      } else apply(from, { from: 'cargo', i: -1 });
    });
    this.push('ship', o, () => game.save());
  }

  private getMod(run: RunState, from: 'cargo' | 'weapon' | 'utility', i: number): ModuleInst | null {
    if (from === 'cargo') return run.cargo[i] ?? null;
    return (from === 'weapon' ? run.weapons : run.utils)[i] ?? null;
  }

  private moveModule(run: RunState, a: { from: 'cargo' | 'weapon' | 'utility'; i: number }, b: { from: 'cargo' | 'weapon' | 'utility'; i: number }): boolean {
    const ma = this.getMod(run, a.from, a.i);
    if (!ma) return false;
    if (b.from === 'cargo') {
      if (a.from === 'cargo') return false;
      const arr = a.from === 'weapon' ? run.weapons : run.utils;
      if (a.from === 'weapon' && arr.filter(Boolean).length <= 1) {
        this.toast('You need at least one weapon.', '#fa8');
        return false;
      }
      if (run.cargo.length >= 12) return false;
      arr[a.i] = null;
      run.cargo.push(ma);
      return true;
    }
    if (ma.slot !== b.from) {
      this.toast(`That's a ${ma.slot} module.`, '#fa8');
      return false;
    }
    const dest = b.from === 'weapon' ? run.weapons : run.utils;
    const mb = dest[b.i] ?? null;
    if (a.from === 'cargo') {
      run.cargo.splice(a.i, 1);
      dest[b.i] = ma;
      if (mb) run.cargo.push(mb);
    } else {
      const src = a.from === 'weapon' ? run.weapons : run.utils;
      src[a.i] = mb;
      dest[b.i] = ma;
    }
    return true;
  }

  // -------------------------------------------------------------------------
  // Captain
  // -------------------------------------------------------------------------
  showCaptain() {
    const game = this.game;
    const run = game.run!;
    const o = this.overlay();
    const p = document.createElement('div');
    p.className = 'panel captain';
    o.appendChild(p);
    const render = () => {
      p.innerHTML = `<div class="phead"><div><h2>Captain ${esc(run.captain)}</h2><span class="hint">Level ${run.level} · ${run.skillPoints > 0 ? `<b style="color:var(--gold)">${run.skillPoints} skill point${run.skillPoints > 1 ? 's' : ''} to spend</b>` : 'no unspent points'}</span></div><button class="x" data-a="close">×</button></div>
      <div class="pbody">
        <h3 style="margin-top:0">Aptitudes</h3><div class="apts">${APTITUDES.map((a) => `<div class="apt">${APT_LABEL[a]}<b>${aptitude(run, a)}</b></div>`).join('')}</div>
        <h3>Skills</h3><div class="trees">${TREES.map((t) => `<div class="tree"><div class="tn" style="color:${t.color}">${t.name}</div><div class="tb">${t.blurb}</div><div class="grid" data-tree="${t.id}">
          <svg></svg>${SKILLS.filter((s) => s.tree === t.id).map((s) => {
            const rank = run.skills[s.id] ?? 0;
            const reqOk = !s.req || s.req.some((r) => (run.skills[r] ?? 0) > 0);
            const cls = rank >= s.max ? 'has maxed' : rank > 0 ? (canLearn(run, s.id) ? 'has avail' : 'has') : canLearn(run, s.id) ? 'avail' : reqOk ? '' : 'locked';
            return `<div class="node ${cls}" data-s="${s.id}" style="grid-column:${s.col + 1};grid-row:${s.row + 1}"><div class="nn">${esc(s.name)}</div><div class="rk">${rank}/${s.max}</div></div>`;
          }).join('')}</div></div>`).join('')}</div>
        <h3>Officers</h3>${run.officers.map((of) => `<div class="list-item"><b>${esc(of.name)}</b><span class="hint">${ROLE_LABEL[of.role]} · ${esc(of.species)} · ${esc(of.trait)} · +2 ${APT_LABEL[ROLE_APT[of.role]]}</span></div>`).join('') || '<div class="hint">No officers aboard. Stations sometimes have people looking for a berth.</div>'}
        <h3>Standing</h3><div class="apts">${run.factions.map((f) => `<div class="apt" style="--edge:${f.color}55"><span style="color:${f.color}">${esc(f.short)}</span><b>${repLabel(run.rep[f.id] ?? 0)}</b></div>`).join('')}</div>
      </div>`;
      // connector lines
      requestAnimationFrame(() => p.querySelectorAll<HTMLElement>('.grid').forEach((g) => {
        const svg = g.querySelector('svg')!;
        const ctr = (el: HTMLElement) => [el.offsetLeft + el.offsetWidth / 2, el.offsetTop + el.offsetHeight / 2];
        let lines = '';
        for (const s of SKILLS.filter((x) => x.tree === g.dataset.tree && x.req)) {
          const [ax, ay] = ctr(g.querySelector<HTMLElement>(`[data-s="${s.id}"]`)!);
          for (const r of s.req!) {
            const [bx, by] = ctr(g.querySelector<HTMLElement>(`[data-s="${r}"]`)!);
            const on = (run.skills[r] ?? 0) > 0;
            lines += `<line x1="${bx}" y1="${by}" x2="${ax}" y2="${ay}" stroke="${on ? 'rgba(255,220,140,0.6)' : 'rgba(150,180,255,0.2)'}" stroke-width="2"/>`;
          }
        }
        svg.innerHTML = lines;
      }));
      p.querySelectorAll<HTMLElement>('[data-s]').forEach((el) => {
        const s = skillById(el.dataset.s!);
        this.bindTip(el, () => {
          const rank = run.skills[s.id] ?? 0;
          const req = s.req ? `<div class="cmp">Requires: ${s.req.map((r) => esc(skillById(r).name)).join(' or ')}</div>` : '';
          return `<div class="t">${esc(s.name)} <span class="hint">${rank}/${s.max}</span></div><div>${esc(s.desc)}</div>${req}${canLearn(run, s.id) ? '<div style="color:var(--gold);margin-top:4px">Click to learn</div>' : ''}`;
        });
      });
    };
    render();
    p.addEventListener('click', (e) => {
      const t = e.target as HTMLElement;
      if (t.closest('[data-a="close"]')) return this.closeId('captain');
      const id = t.closest<HTMLElement>('[data-s]')?.dataset.s;
      if (id) {
        if (game.learnSkill(id)) {
          audio.sfx('levelup', { vol: 0.5 });
          this.hideTip();
          render();
        } else audio.sfx('error', { vol: 0.3 });
      }
    });
    this.push('captain', o, () => game.save());
  }

  // -------------------------------------------------------------------------
  // Map
  // -------------------------------------------------------------------------
  showMap() {
    const game = this.game;
    const run = game.run!;
    const o = this.overlay();
    const p = document.createElement('div');
    p.className = 'panel mapp';
    o.appendChild(p);
    const cur = currentNode(run);
    p.innerHTML = `<div class="phead"><div><h2>Star map</h2><span class="hint">Lanes run one way: deeper. Each jump burns a fuel cell. Fuel ${run.fuel}.</span></div><button class="x" data-a="close">×</button></div>
      <div class="pbody"><div class="mapwrap"><canvas></canvas></div><div class="mapinfo"></div></div>`;
    const cv = p.querySelector('canvas')!;
    const info = p.querySelector<HTMLElement>('.mapinfo')!;
    const W = Math.min(1060, innerWidth * 0.92), H = Math.min(520, innerHeight * 0.58);
    const dpr = Math.min(2, devicePixelRatio);
    cv.width = W * dpr;
    cv.height = H * dpr;
    cv.style.height = H + 'px';
    const c = cv.getContext('2d')!;
    let hover: number | null = null;
    let chosen: number | null = null;
    const pos = (n: { x: number; y: number }) => [n.x * W, n.y * H] as const;
    const ICON: Record<string, string> = { station: '⌂', hostile: '⚔', nebula: '☁', derelict: '⚓', anomaly: '✶', haven: '✚', empty: '·', start: '◎', final: '◉' };
    const draw = (t: number) => {
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.clearRect(0, 0, W, H);
      // lanes
      for (const n of run.nodes) for (const l of n.links) {
        const m = nodeById(run, l);
        const [x1, y1] = pos(n), [x2, y2] = pos(m);
        const active = n.id === cur.id;
        const past = n.visited && m.visited;
        c.strokeStyle = past ? 'rgba(79,224,200,0.55)' : active ? (l === hover || l === chosen ? 'rgba(255,217,152,0.95)' : 'rgba(255,190,92,0.6)') : n.col < cur.col ? 'rgba(110,90,60,0.15)' : 'rgba(168,116,47,0.3)';
        c.lineWidth = active ? 2.5 : 1.5;
        c.setLineDash(active && !(l === hover || l === chosen) ? [6, 6] : []);
        c.lineDashOffset = -t * 20;
        c.beginPath();
        c.moveTo(x1, y1);
        c.lineTo(x2, y2);
        c.stroke();
      }
      c.setLineDash([]);
      for (const n of run.nodes) {
        const [x, y] = pos(n);
        const owner = factionById(run, n.owner);
        const reachable = cur.links.includes(n.id);
        const faded = n.col < cur.col && !n.visited;
        c.globalAlpha = faded ? 0.25 : 1;
        if (owner && n.known) {
          c.fillStyle = owner.color + '22';
          c.beginPath();
          c.arc(x, y, 26, 0, Math.PI * 2);
          c.fill();
        }
        c.fillStyle = n.id === cur.id ? '#ffd998' : n.visited ? '#2a8c80' : reachable ? '#ffbe5c' : '#4c3e2b';
        c.beginPath();
        c.arc(x, y, n.kind === 'final' ? 13 : n.id === hover ? 10 : 8, 0, Math.PI * 2);
        c.fill();
        if (n.id === cur.id) {
          c.strokeStyle = '#4fe0c8';
          c.lineWidth = 2;
          c.beginPath();
          c.arc(x, y, 14 + Math.sin(t * 3) * 2, 0, Math.PI * 2);
          c.stroke();
        }
        if (n.id === chosen) {
          c.strokeStyle = '#ffd36b';
          c.lineWidth = 2;
          c.beginPath();
          c.arc(x, y, 15, 0, Math.PI * 2);
          c.stroke();
        }
        c.font = '600 13px "Chakra Petch", system-ui';
        c.textAlign = 'center';
        c.fillStyle = '#0a0e1a';
        if (n.known) {
          c.fillText(ICON[n.kind] ?? '·', x, y + 4.5);
          if (n.hazard !== 'none' && n.kind !== 'nebula') {
            c.fillStyle = '#fa6';
            c.font = '10px system-ui';
            c.fillText('⚠', x + 12, y - 8);
          }
        } else {
          c.fillText('?', x, y + 4.5);
        }
        const marked = run.markers.some((m) => m.nodeId === n.id && !m.done);
        if (marked) {
          c.fillStyle = '#ffd36b';
          c.font = '14px system-ui';
          c.fillText('◆', x, y - 16);
        }
        c.globalAlpha = 1;
      }
    };
    let raf = 0;
    const loop = (ts: number) => {
      draw(ts / 1000);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    const nodeAt = (ex: number, ey: number) => {
      const r = cv.getBoundingClientRect();
      const mx = ((ex - r.left) / r.width) * W, my = ((ey - r.top) / r.height) * H;
      let best: number | null = null, bd = 22 * 22;
      for (const n of run.nodes) {
        const [x, y] = pos(n);
        const d = (x - mx) ** 2 + (y - my) ** 2;
        if (d < bd) {
          bd = d;
          best = n.id;
        }
      }
      return best;
    };
    const KIND_DESC: Record<string, string> = { station: 'A station: trade, repairs, fuel, crew.', hostile: 'Hostile activity reported.', nebula: 'A nebula. Sensors are blinded here.', derelict: 'Wreckage drifts here.', anomaly: 'Strange readings.', haven: 'A quiet haven. Cheap repairs.', empty: 'Little of note on the charts.', start: 'The cradle.', final: 'The Heart of the Shoal.' };
    const HAZ: Record<string, string> = { asteroids: 'Asteroid fields', radiation: 'Radiation (weak shields)', ionstorm: 'Ion storms', nebula: '' };
    const showInfo = (id: number | null) => {
      const target = id ?? chosen;
      if (target === null) {
        info.innerHTML = `<span class="hint">Hover a system to inspect it. Click a connected system to set course.</span>`;
        return;
      }
      const n = nodeById(run, target);
      const owner = factionById(run, n.owner);
      const reachable = cur.links.includes(n.id);
      const markers = run.markers.filter((m) => m.nodeId === n.id && !m.done);
      info.innerHTML = `<div class="row"><div class="grow"><b style="font-size:15px">${esc(n.name)}</b> <span class="hint">${owner && n.known ? `· <span style="color:${owner.color}">${esc(owner.name)}</span> (${repLabel(run.rep[owner.id] ?? 0)})` : ''}</span>
        <div class="hint">${n.known ? KIND_DESC[n.kind] : 'Uncharted.'} ${n.known && n.hazard !== 'none' && HAZ[n.hazard] ? '⚠ ' + HAZ[n.hazard] : ''}</div>
        ${markers.map((m) => `<div style="color:var(--gold);font-size:13px">◆ ${esc(m.label)}</div>`).join('')}</div>
        ${n.id === chosen && reachable ? `<button class="btn primary" data-a="jump">${run.fuel > 0 ? 'Engage jump drive' : 'Dry jump (damages hull)'}</button>` : reachable ? '<span class="hint">Click to select</span>' : ''}</div>`;
    };
    showInfo(null);
    cv.addEventListener('mousemove', (e) => {
      const n = nodeAt(e.clientX, e.clientY);
      if (n !== hover) {
        hover = n;
        showInfo(hover);
      }
    });
    cv.addEventListener('mouseleave', () => {
      hover = null;
      showInfo(null);
    });
    cv.addEventListener('click', (e) => {
      const n = nodeAt(e.clientX, e.clientY);
      if (n !== null && cur.links.includes(n)) {
        chosen = n;
        showInfo(n);
      }
    });
    cv.addEventListener('dblclick', (e) => {
      const n = nodeAt(e.clientX, e.clientY);
      if (n !== null && cur.links.includes(n)) {
        chosen = n;
        doJump();
      }
    });
    const doJump = () => {
      if (chosen === null) return;
      const err = game.setCourse(chosen);
      if (err) {
        this.toast(err, '#fa8');
        audio.sfx('error');
      } else this.closeId('map');
    };
    p.addEventListener('click', (e) => {
      const a = (e.target as HTMLElement).closest('[data-a]')?.getAttribute('data-a');
      if (a === 'close') this.closeId('map');
      if (a === 'jump') doJump();
    });
    if (cur.kind === 'final') info.innerHTML = '<span class="hint">There is nowhere deeper to go.</span>';
    this.push('map', o, () => cancelAnimationFrame(raf));
  }

  // -------------------------------------------------------------------------
  // Journal & codex
  // -------------------------------------------------------------------------
  showJournal() {
    const run = this.game.run!;
    const o = this.overlay();
    const p = document.createElement('div');
    p.className = 'panel journal';
    o.appendChild(p);
    const entries = Object.entries(run.journal).filter(([, t]) => t);
    Promise.resolve({ ARCS }).then(({ ARCS }) => {
      p.innerHTML = `<div class="phead"><h2>Journal</h2><div class="row"><button class="btn small" data-a="codex">Codex (${meta.codex.length})</button><button class="x" data-a="close">×</button></div></div>
      <div class="pbody">${entries.map(([id, t]) => `<div class="entry"><b>${esc(ARCS.find((a) => a.id === id)?.title ?? id)}</b>${esc(t)}</div>`).join('') || '<div class="hint">Nothing written yet.</div>'}
      <h3>This voyage</h3><div class="stats" style="max-width:420px">
        <div><span>Depth</span><span>${run.depth} / ${run.finalDepth}</span></div><div><span>Systems crossed</span><span>${run.stats.systems}</span></div>
        <div><span>Ships destroyed</span><span>${run.stats.kills}</span></div><div><span>Credits earned</span><span>${run.stats.creditsEarned}</span></div>
      </div></div>`;
    });
    p.addEventListener('click', (e) => {
      const a = (e.target as HTMLElement).closest('[data-a]')?.getAttribute('data-a');
      if (a === 'close') this.closeId('journal');
      if (a === 'codex') this.showCodex();
    });
    this.push('journal', o);
  }

  showCodex() {
    const o = this.overlay();
    const p = document.createElement('div');
    p.className = 'panel journal';
    o.appendChild(p);
    const known = ALL_CODEX.filter((c) => meta.codex.includes(c.id));
    const cats = [...new Set(known.map((c) => c.category))];
    let sel = known[0]?.id;
    const render = () => {
      const e = known.find((c) => c.id === sel);
      if (e && !meta.seenCodex.includes(e.id)) {
        meta.seenCodex.push(e.id);
        saveMeta();
      }
      p.innerHTML = `<div class="phead"><h2>Codex</h2><button class="x" data-a="close">×</button></div><div class="pbody">${known.length ? `<div class="codex"><div class="ls">${cats.map((cat) => `<div class="cat">${esc(cat)}</div>${known.filter((c) => c.category === cat).map((c) => `<div data-c="${c.id}" class="${c.id === sel ? 'on' : ''}">${meta.seenCodex.includes(c.id) ? '' : '• '}${esc(c.title)}</div>`).join('')}`).join('')}</div><div class="bd">${e ? `<h2 style="margin-bottom:10px">${esc(e.title)}</h2>${esc(e.body)}` : ''}</div></div>` : '<div class="hint">You remember nothing yet.</div>'}</div>`;
    };
    render();
    p.addEventListener('click', (ev) => {
      const t = ev.target as HTMLElement;
      if (t.closest('[data-a="close"]')) return this.pop();
      const c = t.closest<HTMLElement>('[data-c]')?.dataset.c;
      if (c) {
        sel = c;
        render();
      }
    });
    this.push('codex', o);
  }

  // -------------------------------------------------------------------------
  // Legacy
  // -------------------------------------------------------------------------
  showLegacy() {
    const o = this.overlay();
    const p = document.createElement('div');
    p.className = 'panel legacy';
    o.appendChild(p);
    const render = () => {
      const groups = ['Ships', 'Arsenal', 'Inheritance'] as const;
      p.innerHTML = `<div class="phead"><div><h2>Legacy</h2><span class="hint">What you carry from one life to the next.</span></div><div class="row"><b style="color:var(--gold)">◈ ${meta.echoes} Echoes</b><button class="x" data-a="close">×</button></div></div>
      <div class="pbody">${groups.map((g) => `<h3>${g}</h3><div class="lgrid">${LEGACY.filter((l) => l.group === g && (!l.needsDeed || hasDeed(l.needsDeed))).map((l) => {
        const rank = perk(l.id);
        const maxed = rank >= l.costs.length || (l.id === 'hull.lancer' && hullUnlocked('lancer'));
        const cost = l.costs[rank];
        return `<div class="litem ${maxed ? 'owned' : ''}"><div class="grow"><b>${esc(l.name)}${l.costs.length > 1 ? ` <span class="hint">${rank}/${l.costs.length}</span>` : ''}</b><span>${esc(l.desc)}</span></div>${maxed ? '<span class="hint">✓</span>' : `<button class="btn small gold" data-buy="${l.id}" ${meta.echoes >= cost ? '' : 'disabled'}>◈ ${cost}</button>`}</div>`;
      }).join('')}</div>`).join('')}
      <h3>Deeds</h3><div class="lgrid">${DEEDS.map((d) => {
        const got = hasDeed(d.id);
        return `<div class="litem deed ${got ? 'got owned' : ''}"><div class="grow"><b>${got ? esc(d.name) : '???'}</b><span>${esc(d.hint)}${got ? ' — ' + esc(d.reward) : ''}</span></div></div>`;
      }).join('')}</div>
      <h3>Lives</h3><div class="stats" style="max-width:480px"><div><span>Voyages</span><span>${meta.runs}</span></div><div><span>Reached the Heart</span><span>${meta.victories}</span></div><div><span>Deepest</span><span>${meta.life.bestDepth}</span></div><div><span>Ships destroyed</span><span>${meta.life.kills}</span></div></div>
      </div>`;
    };
    render();
    p.addEventListener('click', (e) => {
      const t = e.target as HTMLElement;
      if (t.closest('[data-a="close"]')) return this.pop();
      const id = t.closest<HTMLElement>('[data-buy]')?.dataset.buy;
      if (id) {
        const l = LEGACY.find((x) => x.id === id)!;
        const rank = perk(id);
        const cost = l.costs[rank];
        if (cost === undefined || meta.echoes < cost) return;
        meta.echoes -= cost;
        meta.perks[id] = rank + 1;
        saveMeta();
        audio.sfx('levelup');
        render();
      }
    });
    this.push('legacy', o, () => {
      if (this.top()?.id === 'title') this.showTitle();
      const top = this.top();
      if (top?.id === 'summary') {
        const old = top.el.querySelector<HTMLElement>('[data-a="legacy"]');
        if (old) {
          old.outerHTML = this.legacyButton();
          this.bindMenuTips(top.el, 'legacy');
        }
      }
    });
  }

  // -------------------------------------------------------------------------
  // Pause / settings / summary
  // -------------------------------------------------------------------------
  showPause() {
    const o = this.overlay();
    o.innerHTML = `<div class="panel pause"><div class="phead"><h2>Paused</h2></div><div class="pbody"><div class="menu">
      <button class="btn primary" data-a="resume">Resume</button>
      <button class="btn" data-a="ship">Ship <span class="kbd">Tab</span></button>
      <button class="btn" data-a="captain">Captain <span class="kbd">K</span></button>
      <button class="btn" data-a="map">Star map <span class="kbd">M</span></button>
      <button class="btn" data-a="journal">Journal <span class="kbd">J</span></button>
      <button class="btn" data-a="settings">Settings</button>
      <button class="btn" data-a="title">Save & quit to title</button>
      <button class="btn danger" data-a="abandon">Abandon voyage</button>
    </div></div></div>`;
    o.addEventListener('click', (e) => {
      const a = (e.target as HTMLElement).closest('[data-a]')?.getAttribute('data-a');
      if (!a) return;
      if (a === 'resume') this.closeId('pause');
      if (a === 'ship') (this.closeId('pause'), this.showShip());
      if (a === 'captain') (this.closeId('pause'), this.showCaptain());
      if (a === 'map') (this.closeId('pause'), this.showMap());
      if (a === 'journal') (this.closeId('pause'), this.showJournal());
      if (a === 'settings') this.showSettings();
      if (a === 'title') {
        this.game.save();
        this.closeAll();
        this.onTitle();
      }
      if (a === 'abandon' && confirm('Abandon this voyage? It will end as if you had died.')) {
        this.closeAll();
        this.game.abandon();
      }
    });
    this.push('pause', o);
  }

  showSettings() {
    const o = this.overlay();
    const v = audio.getVolumes();
    o.innerHTML = `<div class="panel settings"><div class="phead"><h2>Settings</h2><button class="x" data-a="close">×</button></div><div class="pbody">
      <div class="set"><label>Master volume</label><input type="range" min="0" max="1" step="0.05" value="${v.master}" data-v="master"></div>
      <div class="set"><label>Effects</label><input type="range" min="0" max="1" step="0.05" value="${v.sfx}" data-v="sfx"></div>
      <div class="set"><label>Music</label><input type="range" min="0" max="1" step="0.05" value="${v.music}" data-v="music"></div>
      <div class="set"><label>Screen shake</label><input type="checkbox" data-c="shake" ${meta.settings.shake ? 'checked' : ''}></div>
      <div class="set"><label>Damage numbers</label><input type="checkbox" data-c="damageNumbers" ${meta.settings.damageNumbers ? 'checked' : ''}></div>
      <h3>Danger</h3><button class="btn small danger" data-a="reset">Erase all progress</button>
    </div></div>`;
    o.addEventListener('input', (e) => {
      const t = e.target as HTMLInputElement;
      if (t.dataset.v) {
        const s = meta.settings as unknown as Record<string, number>;
        s[t.dataset.v] = +t.value;
        audio.setVolumes(meta.settings.master, meta.settings.sfx, meta.settings.music);
        saveMeta();
      }
      if (t.dataset.c) {
        (meta.settings as unknown as Record<string, boolean>)[t.dataset.c] = t.checked;
        saveMeta();
      }
    });
    o.addEventListener('click', (e) => {
      const a = (e.target as HTMLElement).closest('[data-a]')?.getAttribute('data-a');
      if (a === 'close') this.pop();
      if (a === 'reset' && confirm('Erase every life, unlock, and memory? This cannot be undone.')) {
        resetMeta();
        location.reload();
      }
    });
    this.push('settings', o);
  }

  showSummary(won: boolean, text: string, echoes: number) {
    this.closeAll();
    const run = this.game.run!;
    const o = this.overlay();
    o.innerHTML = `<div class="panel summary"><div class="pbody">
      <div class="big">${won ? 'THE HEART' : 'SILENCE'}</div>
      <div class="hint">${esc(run.shipName)} · Captain ${esc(run.captain)} · ${hullDef(run.hullId).name}</div>
      ${text ? `<div class="ep">${esc(text)}</div>` : `<div class="ep">${won ? '' : `The ${esc(run.shipName)} breaks apart at ${esc(currentNode(run).name)}, depth ${run.depth}. For a moment there is nothing at all.\n\nThen, faintly, singing.`}</div>`}
      <div class="stats" style="text-align:left;margin:0 auto;max-width:380px">
        <div><span>Depth reached</span><span>${run.depth}/${run.finalDepth}</span></div><div><span>Level</span><span>${run.level}</span></div>
        <div><span>Ships destroyed</span><span>${run.stats.kills}</span></div><div><span>Encounters</span><span>${run.stats.events}</span></div>
      </div>
      <div class="echo">◈ +${echoes} Echoes</div>
      <div class="row" style="justify-content:center"><button class="btn primary" data-a="again" data-tip="again">Wake again</button>${this.legacyButton()}</div>
    </div></div>`;
    o.addEventListener('click', (e) => {
      const a = (e.target as HTMLElement).closest('[data-a]')?.getAttribute('data-a');
      if (a === 'again') {
        this.closeAll();
        this.game.world = null;
        this.game.run = null;
        this.onTitle();
        this.showHulls();
      }
      if (a === 'legacy') this.showLegacy();
    });
    this.bindMenuTips(o);
    this.push('summary', o);
  }

  void(x: unknown) {
    return x;
  }
}

export { fmtMod };
