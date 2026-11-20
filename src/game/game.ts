import { RNG, hashSeed, randomSeed } from '../core/rng';
import { audio } from '../core/audio';
import type { ArcDef, CombatSpec, EventDef, Faction, MetaView } from './api';
import { ARCS } from '../content/arcs';
import { EventSession, getEvent, pickEvent, registerEvents, type EventHost } from './events';
import { World } from './world';
import type { POI, Ship } from './entities';
import { computeStats, createRun, currentNode, deserializeRun, factionById, gainXp, learn, nodeById, serializeRun, type RunState } from './run';
import { clearRun, DEEDS, hasDeed, loadRunRaw, meta, perk, saveMeta, saveRunRaw } from './meta';
import type { Stats } from './items';

export interface UiBridge {
  showEvent(session: EventSession, onClose: () => void): void;
  showStation(poi: POI): void;
  showSummary(won: boolean, text: string, echoes: number, deeds: string[]): void;
  toast(msg: string, color?: string): void;
  anyModal(): boolean;
  closeAll(): void;
}

const FALLBACK_FINALE: EventDef = {
  id: 'engine.finale',
  sites: ['marker'],
  title: 'The Heart',
  start: 'a',
  nodes: {
    a: {
      text: 'The lanes end here, knotted into a single bright point. Something vast waits inside it, and it has been waiting for you specifically.',
      choices: [{ label: 'Go in.', run: (ctx) => { ctx.combat({ side: 'warden', boss: 'warden_prime', afterVictory: 'engine.finale.win' }); } }],
    },
  },
};
const FALLBACK_FINALE_WIN: EventDef = {
  id: 'engine.finale.win',
  sites: ['marker'],
  title: 'Stillness',
  start: 'a',
  nodes: { a: { text: 'The guardian of the Heart comes apart in silence. Beyond it there is only light.', choices: [{ label: 'Step into the light.', run: (ctx) => { ctx.victory('You reached the Heart. The singing stops, for a while.'); } }] } },
};
export const ENGINE_EVENTS = [FALLBACK_FINALE, FALLBACK_FINALE_WIN];

export function metaView(): MetaView {
  return {
    runNumber: meta.runs + 1,
    hasCodex: (id) => meta.codex.includes(id),
    codexCount: (prefix) => meta.codex.filter((c) => !prefix || c.startsWith(prefix)).length,
    metaFlag: (n) => meta.metaFlags[n],
    victories: meta.victories,
  };
}

export class Game {
  run: RunState | null = null;
  world: World | null = null;
  ui!: UiBridge;
  private pendingVictory: string | null = null;
  private eventQueue: { def: EventDef; faction: Faction | null; poi: POI | null; ship: Ship | null }[] = [];
  private eventOpen = false;
  private peacefulStreak = 0;
  host: EventHost;

  constructor() {
    registerEvents(ENGINE_EVENTS);
    const self = this;
    this.host = {
      get run() {
        return self.run!;
      },
      getHull: () => (self.world ? self.world.player.hull : self.run!.hull),
      setHull: (n) => {
        self.run!.hull = n;
        if (self.world) self.world.player.hull = n;
      },
      stats: () => (self.world ? self.world.stats : computeStats(self.run!)),
      refresh: () => self.refresh(),
      gainXp: (n) => self.addXp(n),
      victory: (text) => {
        self.pendingVictory = text;
      },
      toast: (m, c) => self.ui.toast(m, c),
      systemName: () => (self.run ? currentNode(self.run).name : ''),
    } as EventHost;
  }

  get paused() {
    return this.ui.anyModal();
  }

  hasSave(): boolean {
    const raw = loadRunRaw();
    return !!raw && !!deserializeRun(raw);
  }

  // -------------------------------------------------------------------------
  // Run lifecycle
  // -------------------------------------------------------------------------
  newRun(hullId: string, resonance: number) {
    const seed = randomSeed();
    const rng = new RNG(seed);
    const mv = metaView();
    const mains = ARCS.filter((a) => a.kind === 'main' && (!a.eligible || a.eligible(mv)));
    // don't repeat the previous main arc if possible
    const last = meta.metaFlags['engine.lastMainArc'];
    const pool = mains.length > 1 ? mains.filter((a) => a.id !== last) : mains;
    const forced = import.meta.env.DEV ? (globalThis as { __forceArc?: string }).__forceArc : undefined;
    const main = (forced && ARCS.find((a) => a.id === forced)) || rng.weighted(pool, (a) => (a.weight ?? 1) * (a.id === 'origin' ? 2.5 : 1));
    const sides = rng.shuffle(ARCS.filter((a) => a.kind === 'side' && (!a.eligible || a.eligible(mv)))).slice(0, rng.int(1, 2));
    meta.runs++;
    meta.metaFlags['engine.lastMainArc'] = main.id;
    saveMeta();
    const run = createRun(seed, hullId, resonance, main.id, sides.map((s) => s.id));
    for (const s of run.sideArcs) {
      const def = ARCS.find((a) => a.id === s.id);
      if (def?.activateAt !== undefined) s.at = def.activateAt;
    }
    if (perk('perk.relic') === 0 && run.relics.length) run.relics = [];
    this.run = run;
    this.peacefulStreak = 0;
    this.enterSystem(true);
  }

  continueRun(): boolean {
    const raw = loadRunRaw();
    if (!raw) return false;
    const run = deserializeRun(raw);
    if (!run) return false;
    this.run = run;
    this.peacefulStreak = run.peaceful;
    this.enterSystem(false);
    return true;
  }

  save() {
    if (!this.run || this.run.outcome) return;
    if (this.world?.playerDead) {
      // death is final: never persist a state from before the killing blow
      this.endRun(false, '');
      return;
    }
    if (this.world) {
      this.world.syncSys();
      this.run.hull = this.world.player.hull;
    }
    this.run.peaceful = this.peacefulStreak;
    saveRunRaw(serializeRun(this.run));
  }

  learnSkill(id: string): boolean {
    const run = this.run!;
    const before = computeStats(run).maxHull;
    const hullBefore = this.world ? this.world.player.hull : run.hull;
    if (!learn(run, id)) return false;
    this.refresh();
    const gain = computeStats(run).maxHull - before;
    if (gain > 0 && this.world) this.world.player.hull = Math.min(this.world.player.maxHull, hullBefore + gain);
    audio.sfx('levelup', { vol: 0.5 });
    return true;
  }

  private enterSystem(fresh: boolean) {
    const run = this.run!;
    const node = currentNode(run);
    node.visited = true;
    node.known = true;
    for (const id of node.links) nodeById(run, id).known = true;
    if (run.relics.includes('navigators_eye')) for (const n of run.nodes) if (n.col <= run.depth + 2) n.known = true;
    this.eventQueue = [];
    this.world = new World(run, {
      toast: (m, c) => this.ui.toast(m, c),
      poi: (p) => this.onPoi(p),
      dock: (p) => this.ui.showStation(p),
      hail: (s) => this.onHail(s),
      death: () => this.endRun(false, ''),
      jumped: (id) => this.onJumped(id),
      combatWon: (ev) => this.onCombatWon(ev),
      groupCleared: (ev) => this.clearPending(ev),
      levelUp: () => {},
      xp: (n) => this.addXp(n),
      bossKilled: () => this.grantDeed('deed.boss'),
      playerKill: () => {},
    });
    // fights with narrative follow-ups resume after a continue
    this.flushClearedPending();
    if (!fresh) for (const p of run.pending) if (p.nodeId === run.nodeId) this.world.startCombat(p.spec);
    run.pending = run.pending.filter((p) => p.nodeId === run.nodeId);
    this.save();
    if (fresh) meta.life.systems++;
    meta.life.bestDepth = Math.max(meta.life.bestDepth, run.depth);
    if (run.depth >= 3) this.grantDeed('deed.depth3');
    if (run.depth >= 6) this.grantDeed('deed.depth6');
    saveMeta();
    // narrative triggers
    if (fresh && run.depth === 0) {
      const wake = getEvent('wake');
      if (wake) this.queueEvent(wake, null, null, null);
      this.beginArc(run.mainArc);
    } else if (run.depth === 0 && !run.flags['engine.mainBegun']) this.beginArc(run.mainArc);
    for (const s of run.sideArcs) if (!s.begun && run.depth >= s.at && run.depth < run.finalDepth) this.beginArc(s.id);
    if (run.depth > 0 && node.kind !== 'final' && !run.sys.arrivalDone) {
      run.sys.arrivalDone = true;
      const rng = new RNG(hashSeed(run.seed, 'arrival', node.id));
      if (rng.chance(0.12)) {
        const ev = pickEvent(run, 'arrival', factionById(run, node.owner), rng, this.host);
        if (ev) this.queueEvent(ev, factionById(run, node.owner), null, null);
      }
    }
    this.pumpEvents();
  }

  private beginArc(id: string) {
    const run = this.run!;
    const def: ArcDef | undefined = ARCS.find((a) => a.id === id);
    if (!def) return;
    if (def.kind === 'main') {
      if (run.flags['engine.mainBegun']) return;
      run.flags['engine.mainBegun'] = true;
    } else {
      const s = run.sideArcs.find((x) => x.id === id);
      if (!s || s.begun) return;
      s.begun = true;
    }
    const shim: EventDef = { id: 'arc.begin.' + id, sites: ['marker'], title: def.title, start: 'x', nodes: {} };
    const sess = new EventSession(this.host, shim, factionById(run, currentNode(run).owner), '', hashSeed(run.seed, 'arc', id));
    run.usedEvents = run.usedEvents.filter((e) => e !== shim.id);
    run.stats.events--;
    try {
      def.begin(sess.ctx);
    } catch (e) {
      console.error('arc begin failed', id, e);
    }
    for (const l of sess.lines) if (l.kind !== 'check') this.ui.toast(l.text, l.kind === 'bad' ? '#f98' : l.kind === 'good' ? '#9e9' : '#cdb');
    this.applySessionResults(sess, null);
    this.save();
  }

  private onJumped(id: number) {
    const run = this.run!;
    if (this.world && this.world.killsHere === 0 && run.depth > 0) {
      this.peacefulStreak++;
      if (this.peacefulStreak >= 4) this.grantDeed('deed.pacifist');
    } else this.peacefulStreak = 0;
    // fuel is spent on arrival, so saving mid-spool can't lose it
    if (run.fuel > 0) {
      run.fuel--;
      if (run.skills['w_drift'] && Math.random() < 0.25) {
        run.fuel++;
        this.ui.toast('The lane gives back a little fuel.', '#8ef');
      }
    } else {
      const p = this.world!.player;
      const cost = Math.min(Math.round(p.maxHull * 0.2), Math.max(0, p.hull - 1));
      p.hull -= cost;
      this.ui.toast(`Dry jump: the drive tears at the hull (−${cost})`, '#f98');
    }
    run.hull = this.world!.player.hull;
    run.depth = nodeById(run, id).col;
    run.nodeId = id;
    run.stats.systems++;
    this.ui.closeAll();
    this.enterSystem(true);
  }

  /** player chose a destination on the map */
  setCourse(id: number): string | null {
    const run = this.run!;
    const w = this.world!;
    const node = currentNode(run);
    if (!node.links.includes(id)) return 'No lane connects there.';
    if (w.jump) return 'Drive already spooling.';
    if (w.playerDead) return 'Too late.';
    if (run.pending.some((p) => p.nodeId === run.nodeId && !p.cleared)) return 'Something here has locked onto your drive. Deal with it first.';
    w.startJump(id);
    return null;
  }

  addXp(n: number) {
    const run = this.run!;
    const lv = gainXp(run, n);
    if (lv > 0) {
      audio.sfx('levelup');
      this.ui.toast(`Level ${run.level}! Skill point available (K)`, '#e0c8ff');
      if (run.level >= 10) this.grantDeed('deed.level10');
    }
  }

  refresh() {
    if (this.world) {
      this.world.refreshPlayer(false);
      this.world.spawnDrones();
      this.world.syncHostility();
    }
    const run = this.run!;
    if (run.relics.length >= 3) this.grantDeed('deed.relics3');
    if (run.officers.length >= 4) this.grantDeed('deed.officers4');
    if (run.credits >= 2500) this.grantDeed('deed.rich');
    if (meta.codex.filter((c) => c.startsWith('frag.origin.')).length >= 3) this.grantDeed('deed.frag3');
    if (meta.life.kills >= 100) this.grantDeed('deed.kills100');
  }

  grantDeed(id: string) {
    if (hasDeed(id)) return;
    const d = DEEDS.find((x) => x.id === id);
    if (!d) return;
    meta.deeds.push(id);
    meta.echoes += d.echoes;
    meta.totalEchoes += d.echoes;
    if (id === 'deed.win') meta.maxResonance = Math.max(meta.maxResonance, 1);
    saveMeta();
    this.ui.toast(`Deed: ${d.name} — ${d.reward}`, '#ffd36b');
    audio.sfx('levelup', { pitch: 1.3 });
  }

  // -------------------------------------------------------------------------
  // Events
  // -------------------------------------------------------------------------
  private onPoi(p: POI) {
    const run = this.run!;
    const owner = factionById(run, currentNode(run).owner);
    const rng = new RNG(hashSeed(run.seed, run.nodeId, p.id, 'poi'));
    let def: EventDef | null | undefined = null;
    if (p.markerIdx >= 0) {
      const m = run.markers[p.markerIdx];
      def = getEvent(m.eventId);
      m.done = true;
    } else if (p.kind === 'finale') {
      if (run.pending.some((x) => x.nodeId === run.nodeId) || this.world?.bossShip) {
        this.ui.toast('Not now.', '#f98');
        return;
      }
      def = getEvent(run.finaleEvent ?? '') ?? FALLBACK_FINALE;
    } else {
      def = rng.chance(p.kind === 'planet' ? 0.75 : 1) ? pickEvent(run, p.site, p.owner ?? owner, rng, this.host) : null;
    }
    if (p.kind !== 'finale') p.used = true; // the finale can always be re-entered
    this.save();
    if (def) this.queueEvent(def, p.owner ?? owner, p, null);
    else this.queueEvent(this.fallbackEvent(p), owner, p, null);
    this.pumpEvents();
  }

  stationConcourse(p: POI) {
    const run = this.run!;
    const rng = new RNG(hashSeed(run.seed, run.nodeId, p.id, 'concourse'));
    const def = pickEvent(run, 'station', p.owner, rng, this.host) ?? this.fallbackEvent(p);
    this.queueEvent(def, p.owner, p, null);
    this.pumpEvents();
  }

  private onHail(s: Ship) {
    const run = this.run!;
    s.hailed = true;
    this.save();
    const rng = new RNG(hashSeed(run.seed, run.nodeId, s.id, 'hail'));
    const def = pickEvent(run, 'hail', s.faction, rng, this.host) ?? this.fallbackHail();
    this.queueEvent(def, s.faction, null, s);
    this.pumpEvents();
  }

  queueEvent(def: EventDef, faction: Faction | null, poi: POI | null, ship: Ship | null) {
    this.eventQueue.push({ def, faction, poi, ship });
  }

  private pumpEvents() {
    if (this.eventOpen || this.eventQueue.length === 0 || !this.run || this.run.outcome || this.world?.playerDead) return;
    const next = this.eventQueue.shift()!;
    const run = this.run;
    this.eventOpen = true;
    const sess = new EventSession(this.host, next.def, next.faction, next.poi?.name ?? next.ship?.name ?? '', hashSeed(run.seed, next.def.id, run.stats.events, run.nodeId));
    this.ui.showEvent(sess, () => {
      this.eventOpen = false;
      this.applySessionResults(sess, next.ship);
      this.refresh();
      this.save();
      if (this.pendingVictory !== null) {
        const t = this.pendingVictory;
        this.pendingVictory = null;
        this.endRun(true, t);
        return;
      }
      this.pumpEvents();
    });
  }

  private applySessionResults(sess: EventSession, ship: Ship | null) {
    for (const c of sess.combats) this.startCombat(c, ship);
    sess.combats = [];
    for (const id of sess.chains) {
      const d = getEvent(id);
      if (d) this.queueEvent(d, sess.ctx.faction, null, null);
      else console.warn('chain to unknown event', id);
    }
    sess.chains = [];
    if (this.pendingVictory !== null && !this.eventOpen) {
      const t = this.pendingVictory;
      this.pendingVictory = null;
      this.endRun(true, t);
    }
  }

  private startCombat(spec: CombatSpec, ship: Ship | null) {
    if (!this.world || !this.run) return;
    if (spec.afterVictory) this.run.pending.push({ nodeId: this.run.nodeId, spec });
    this.world.startCombat(spec, ship);
  }

  /** the fight is over; its follow-up fires shortly (on world time) */
  private clearPending(ev: string | undefined) {
    if (!ev || !this.run) return;
    const p = this.run.pending.find((x) => x.spec.afterVictory === ev && x.nodeId === this.run!.nodeId && !x.cleared);
    if (p) p.cleared = true;
  }

  /** fire follow-ups for fights already won but whose event hasn't shown (e.g. after reload or a quick jump) */
  private flushClearedPending() {
    const run = this.run!;
    const due = run.pending.filter((p) => p.cleared);
    run.pending = run.pending.filter((p) => !p.cleared);
    for (const p of due) {
      const d = getEvent(p.spec.afterVictory!);
      if (d) this.queueEvent(d, factionById(run, currentNode(run).owner), null, null);
    }
  }

  private onCombatWon(ev: string | undefined) {
    if (!this.run || this.run.outcome) return;
    if (ev) {
      const i = this.run.pending.findIndex((p) => p.spec.afterVictory === ev && p.nodeId === this.run!.nodeId && p.cleared);
      if (i < 0) return; // already flushed elsewhere
      this.run.pending.splice(i, 1);
    }
    this.save();
    if (!ev) return;
    const d = getEvent(ev);
    if (!d) return;
    this.queueEvent(d, factionById(this.run, currentNode(this.run).owner), null, null);
    this.pumpEvents();
  }

  private fallbackEvent(p: POI): EventDef {
    const flavor: Record<string, string[]> = {
      planet: ['Your sensors sweep {poi}. Rock, weather, and silence. You log the readings and move on.', 'Long scans of {poi} reveal nothing that wants to be found. A few trace minerals, catalogued and sold as survey data later.', '{poi} turns beneath you, indifferent. The survey is routine. Routine is underrated.'],
      derelict: ['The wreck has been picked clean by someone faster than you.'],
      anomaly: ['The anomaly flickers and folds in on itself before you can get a clean reading.'],
      distress: ['The beacon repeats a looped message, decades old. No one is left to rescue.'],
      asteroid: ['Mostly ice. A little nickel. You chip off what you can.'],
      beacon: ['Static.'],
    };
    const text = new RNG(p.id * 31 + p.name.length).pick(flavor[p.kind] ?? flavor.planet);
    return {
      id: 'engine.fallback.' + p.kind,
      sites: [],
      title: p.name,
      start: 'a',
      nodes: { a: { text, enter: (ctx) => { ctx.gainXp(8 + ctx.depth * 2); if (ctx.chance(0.5)) ctx.gainCredits(10 + ctx.depth * 8); } } },
    };
  }

  private fallbackHail(): EventDef {
    return {
      id: 'engine.fallback.hail',
      sites: [],
      title: 'Hail',
      portrait: 'faction',
      start: 'a',
      nodes: { a: { text: 'The {Fsp} vessel acknowledges your hail with a curt burst of static, then nothing. They have nothing to say to you.' } },
    };
  }

  // -------------------------------------------------------------------------
  // End
  // -------------------------------------------------------------------------
  endRun(won: boolean, text: string, abandoned = false) {
    const run = this.run;
    if (!run || run.outcome) return;
    run.outcome = { won, text };
    this.eventQueue = [];
    // a life that never left the cradle carries nothing forward (prevents start/abandon farming)
    const echoes = !won && run.stats.systems === 0 ? 0 : this.computeEchoes(run, won);
    meta.echoes += echoes;
    meta.totalEchoes += echoes;
    if (won) {
      meta.victories++;
      meta.maxResonance = Math.max(meta.maxResonance, run.resonance + 1);
      this.grantDeed('deed.win');
    } else {
      meta.life.deaths++;
      if (!abandoned && run.depth === 0 && run.stats.systems === 0) this.grantDeed('deed.died_early');
    }
    meta.lastShips.unshift(run.shipName);
    meta.lastShips = meta.lastShips.slice(0, 10);
    meta.metaFlags['engine.lastDeathDepth'] = won ? -1 : run.depth;
    saveMeta();
    clearRun();
    const before = new Set(meta.deeds);
    void before;
    audio.setMood(won ? 'victory' : 'death');
    setTimeout(() => this.ui.showSummary(won, text, echoes, []), won ? 300 : 600);
  }

  computeEchoes(run: RunState, won: boolean): number {
    let e = run.depth * 12 + run.stats.kills * 0.6 + run.stats.bosses * 30 + run.level * 4 + run.stats.events * 1.5 + (won ? 120 : 0);
    e *= 1 + perk('perk.echo') * 0.1;
    if (run.relics.includes('echo_shard')) e *= 1.25;
    e *= 1 + run.resonance * 0.2;
    return Math.round(e);
  }

  abandon() {
    this.endRun(false, 'You let go.', true);
  }

  stats(): Stats {
    return this.world!.stats;
  }
}
