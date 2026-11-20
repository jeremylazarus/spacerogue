import { RNG, hashSeed } from '../core/rng';
import { clamp } from '../core/math';
import type { Aptitude, ChoiceDef, CombatSpec, EventCtx, EventDef, Faction, FactionArchetype, OfficerRole, RelicId, Site, Text, CodexEntry } from './api';
import { RELIC_IDS } from './api';
import { EVENTS, EVENT_CODEX } from '../content/events';
import { ARC_EVENTS } from '../content/arcs';
import { CODEX } from '../content/codex';
import { RELICS, moduleName, moduleValue, rollModule, rollRarity, type Stats } from './items';
import { aptitude, computeStats, makeOfficer, nodeById, type RunState } from './run';
import { meta, saveMeta, unlockedSet } from './meta';

export const ALL_EVENTS: EventDef[] = [...EVENTS, ...ARC_EVENTS];
const EVENT_MAP = new Map<string, EventDef>();
for (const e of ALL_EVENTS) {
  if (EVENT_MAP.has(e.id)) console.warn('duplicate event id', e.id);
  EVENT_MAP.set(e.id, e);
}
export const getEvent = (id: string) => EVENT_MAP.get(id);
export function registerEvents(defs: EventDef[]) {
  for (const e of defs) EVENT_MAP.set(e.id, e);
}
export const ALL_CODEX: CodexEntry[] = [...CODEX, ...EVENT_CODEX];

/** What the engine must provide to run events. */
export interface EventHost {
  run: RunState;
  getHull(): number;
  setHull(n: number): void;
  stats(): Stats;
  refresh(): void;
  gainXp(n: number): void;
  victory(text: string): void;
  toast(msg: string, color?: string): void;
  systemName(): string;
}

export interface OutLine {
  text: string;
  kind: 'good' | 'bad' | 'info' | 'note' | 'check';
}

export interface ChoiceView {
  label: string;
  enabled: boolean;
  req: string;
}

export interface EventView {
  title: string;
  text: string;
  lines: OutLine[];
  choices: ChoiceView[];
  terminal: boolean;
  portrait: 'faction' | 'none' | 'officer';
  faction: Faction | null;
}

const APT_NAME: Record<Aptitude, string> = { combat: 'Combat', science: 'Science', engineering: 'Engineering', diplomacy: 'Diplomacy', guile: 'Guile', salvage: 'Salvage', navigation: 'Navigation' };
const ROLE_NAME: Record<OfficerRole, string> = { gunner: 'Gunner', engineer: 'Engineer', navigator: 'Navigator', xenologist: 'Xenologist', medic: 'Medic', quartermaster: 'Quartermaster', spy: 'Spy' };

export class EventSession {
  def: EventDef;
  nodeId: string | null;
  ctx: EventCtx;
  lines: OutLine[] = [];
  combats: CombatSpec[] = [];
  chains: string[] = [];
  won: string | null = null;
  ended = false;
  private host: EventHost;
  private faction: Faction | null;
  private poiName: string;
  private visibleChoices: ChoiceDef[] = [];

  constructor(host: EventHost, def: EventDef, faction: Faction | null, poiName: string, seed: number) {
    this.host = host;
    this.def = def;
    this.faction = faction;
    this.poiName = poiName;
    this.ctx = this.makeCtx(new RNG(seed));
    this.nodeId = def.start;
    host.run.stats.events++;
    if (!host.run.usedEvents.includes(def.id)) host.run.usedEvents.push(def.id);
    this.enterNode();
  }

  private enterNode() {
    const n = this.nodeId ? this.def.nodes[this.nodeId] : null;
    if (!n) {
      this.ended = true;
      return;
    }
    try {
      n.enter?.(this.ctx);
    } catch (e) {
      console.error('event enter error', this.def.id, this.nodeId, e);
    }
  }

  view(): EventView {
    const n = this.nodeId ? this.def.nodes[this.nodeId] : null;
    const title = this.fmt(this.def.title);
    if (!n) return { title, text: '', lines: this.lines, choices: [{ label: 'Continue', enabled: true, req: '' }], terminal: true, portrait: this.def.portrait ?? 'none', faction: this.faction };
    const text = this.fmt(n.text);
    this.visibleChoices = (n.choices ?? []).filter((c) => {
      try {
        if (c.visible && !c.visible(this.ctx)) return false;
        if (c.hideIfUnmet && !this.reqMet(c)) return false;
      } catch (e) {
        console.error(e);
        return false;
      }
      return true;
    });
    const choices: ChoiceView[] = this.visibleChoices.map((c) => ({ label: this.fmt(c.label), enabled: this.reqMet(c), req: this.reqText(c) }));
    const terminal = choices.length === 0;
    if (terminal) choices.push({ label: 'Continue', enabled: true, req: '' });
    // never trap the player: if nothing is selectable, offer a way out
    else if (!choices.some((c) => c.enabled)) choices.push({ label: 'Leave.', enabled: true, req: '' });
    return { title, text, lines: this.lines, choices, terminal, portrait: this.def.portrait ?? 'none', faction: this.faction };
  }

  /** returns true if the event is over */
  choose(i: number): boolean {
    const n = this.nodeId ? this.def.nodes[this.nodeId] : null;
    if (!n || this.visibleChoices.length === 0) {
      this.ended = true;
      return true;
    }
    if (i === this.visibleChoices.length && !this.visibleChoices.some((x) => this.reqMet(x))) {
      // the fallback "Leave" choice
      this.ended = true;
      return true;
    }
    const c = this.visibleChoices[i];
    if (!c || !this.reqMet(c)) return false;
    this.lines = [];
    let next: string | void | undefined;
    try {
      next = c.run ? c.run(this.ctx) : undefined;
      if (next === undefined && c.next) next = c.next;
    } catch (e) {
      console.error('event choice error', this.def.id, e);
      next = undefined;
    }
    if (this.won) {
      this.nodeId = null;
      this.ended = false; // show outcome, then end
      return false;
    }
    if (next && this.def.nodes[next]) {
      this.nodeId = next;
      this.enterNode();
      return false;
    }
    // end: show outcome lines if any, else close
    this.nodeId = null;
    if (this.lines.length === 0) {
      this.ended = true;
      return true;
    }
    return false;
  }

  private reqMet(c: ChoiceDef): boolean {
    const r = c.req;
    if (!r) return true;
    const run = this.host.run;
    if (r.apt) for (const [a, v] of Object.entries(r.apt)) if (aptitude(run, a as Aptitude) < (v as number)) return false;
    if (r.credits !== undefined && run.credits < r.credits) return false;
    if (r.fuel !== undefined && run.fuel < r.fuel) return false;
    if (r.officer && !run.officers.some((o) => o.role === r.officer)) return false;
    if (r.relic && !run.relics.includes(r.relic)) return false;
    return true;
  }

  private reqText(c: ChoiceDef): string {
    const r = c.req;
    if (!r) return '';
    const parts: string[] = [];
    if (r.apt) for (const [a, v] of Object.entries(r.apt)) parts.push(`${APT_NAME[a as Aptitude]} ${v}`);
    if (r.credits !== undefined) parts.push(`${r.credits}¢`);
    if (r.fuel !== undefined) parts.push(`${r.fuel} fuel`);
    if (r.officer) parts.push(ROLE_NAME[r.officer]);
    if (r.relic) parts.push(RELICS[r.relic].name);
    return parts.join(', ');
  }

  fmt(t: Text): string {
    let s: string;
    try {
      s = typeof t === 'function' ? t(this.ctx) : t;
    } catch (e) {
      console.error('event text error', this.def.id, e);
      s = '…';
    }
    return formatText(s, this.host.run, this.faction, this.poiName, this.host.systemName());
  }

  private add(text: string, kind: OutLine['kind']) {
    this.lines.push({ text: kind === 'note' ? formatText(text, this.host.run, this.faction, this.poiName, this.host.systemName()) : text, kind });
  }

  private makeCtx(rng: RNG): EventCtx {
    const host = this.host;
    const run = host.run;
    const self = this;
    const ctx: EventCtx = {
      rng,
      get depth() {
        return run.depth;
      },
      finalDepth: run.finalDepth,
      faction: this.faction,
      factions: run.factions,
      systemName: host.systemName(),
      poiName: this.poiName,
      captainName: run.captain,
      shipName: run.shipName,
      get credits() {
        return run.credits;
      },
      get fuel() {
        return run.fuel;
      },
      get hull() {
        return Math.round(host.getHull());
      },
      get maxHull() {
        return host.stats().maxHull;
      },
      get officers() {
        return run.officers;
      },
      apt: (a) => aptitude(run, a),
      officer: (role) => (role ? run.officers.find((o) => o.role === role) ?? null : run.officers[0] ?? null),
      rep: (id) => run.rep[id] ?? 0,
      hasRelic: (id) => run.relics.includes(id),
      flag: (n) => run.flags[n],
      setFlag: (n, v) => {
        run.flags[n] = v;
      },
      metaFlag: (n) => meta.metaFlags[n],
      setMetaFlag: (n, v) => {
        meta.metaFlags[n] = v;
        saveMeta();
      },
      runNumber: run.runNumber,
      hasCodex: (id) => meta.codex.includes(id),
      factionOf: (a: FactionArchetype) => run.factions.find((f) => f.archetype === a) ?? null,
      check: (a, diff) => {
        const v = aptitude(run, a);
        const p = clamp(0.35 + 0.15 * (v - diff), 0.05, 0.95);
        const ok = rng.next() < p;
        self.add(`[${APT_NAME[a]} check: ${ok ? 'success' : 'failure'}]`, 'check');
        return ok;
      },
      chance: (p) => rng.next() < p,
      gainCredits: (n) => {
        n = Math.round(n * (run.relics.includes('ledger') ? 1.15 : 1));
        if (n <= 0) return;
        run.credits += n;
        run.stats.creditsEarned += n;
        self.add(`+${n} credits`, 'good');
      },
      loseCredits: (n) => {
        n = Math.min(run.credits, Math.round(n));
        if (n <= 0) return;
        run.credits -= n;
        self.add(`−${n} credits`, 'bad');
      },
      gainFuel: (n) => {
        const max = host.stats().maxFuel;
        const before = run.fuel;
        run.fuel = Math.min(max, run.fuel + n);
        if (run.fuel > before) self.add(`+${run.fuel - before} fuel`, 'good');
        else self.add('Fuel tanks already full', 'info');
      },
      loseFuel: (n) => {
        const l = Math.min(run.fuel, n);
        if (l <= 0) return;
        run.fuel -= l;
        self.add(`−${l} fuel`, 'bad');
      },
      damageHull: (n) => {
        const h = host.getHull();
        const nh = Math.max(1, h - n);
        host.setHull(nh);
        self.add(`Hull −${Math.round(h - nh)}`, 'bad');
      },
      repairHull: (n) => {
        const h = host.getHull();
        const nh = Math.min(host.stats().maxHull, h + n);
        host.setHull(nh);
        if (nh > h) self.add(`Hull +${Math.round(nh - h)}`, 'good');
      },
      gainXp: (n) => {
        host.gainXp(n);
        self.add(`+${Math.round(n * host.stats().xpMult)} experience`, 'good');
      },
      giveItem: (q) => {
        const r2 = new RNG(rng.fork());
        const rarity = q?.rarity ?? Math.max(q?.minRarity ?? 0, rollRarity(r2, run.depth, host.stats().luck));
        const m = rollModule(r2, { slot: q?.slot, rarity: clamp(rarity, 0, 4), unlocked: unlockedSet() });
        const name = moduleName(m);
        if (run.cargo.length >= 12) {
          const v = Math.round(moduleValue(m) * 0.35);
          run.credits += v;
          self.add(`Cargo full — ${name} sold off for ${v} credits`, 'info');
          return name;
        }
        run.cargo.push(m);
        self.add(`Acquired: ${name}`, 'good');
        return name;
      },
      giveRelic: (id) => {
        const pool = RELIC_IDS.filter((r) => !run.relics.includes(r));
        const rid: RelicId | undefined = id && !run.relics.includes(id) ? id : id ? undefined : pool.length ? rng.pick(pool) : undefined;
        if (!rid) return null;
        run.relics.push(rid);
        host.refresh();
        self.add(`Relic: ${RELICS[rid].name} — ${RELICS[rid].desc}`, 'good');
        return RELICS[rid].name;
      },
      loseItem: () => {
        if (!run.cargo.length) return null;
        const i = rng.int(0, run.cargo.length - 1);
        const [m] = run.cargo.splice(i, 1);
        const name = moduleName(m);
        self.add(`Lost: ${name}`, 'bad');
        return name;
      },
      changeRep: (id, d) => {
        const f = run.factions.find((x) => x.id === id);
        if (!f || !d) return;
        run.rep[id] = clamp((run.rep[id] ?? 0) + d, -100, 100);
        self.add(`${f.short} regard ${d > 0 ? 'improved' : 'worsened'}`, d > 0 ? 'good' : 'bad');
      },
      addOfficer: (role, species) => {
        if (run.officers.length >= 4) {
          self.add('No room aboard for another officer.', 'info');
          return null;
        }
        const o = makeOfficer(new RNG(rng.fork()), run.factions, role, species);
        run.officers.push(o);
        self.add(`${o.name} (${ROLE_NAME[o.role]}) joins your crew`, 'good');
        return o;
      },
      removeOfficer: (id, reason) => {
        const i = run.officers.findIndex((o) => o.id === id);
        if (i < 0) return;
        const [o] = run.officers.splice(i, 1);
        self.add(`${o.name} ${reason ?? 'has left the crew'}`, 'bad');
      },
      revealMap: (cols) => {
        let n = 0;
        for (const node of run.nodes) if (node.col > run.depth && node.col <= run.depth + cols && !node.known) {
          node.known = true;
          n++;
        }
        if (n) self.add('Star charts updated', 'info');
      },
      unlockCodex: (id) => {
        if (meta.codex.includes(id)) return;
        meta.codex.push(id);
        saveMeta();
        const e = ALL_CODEX.find((c) => c.id === id);
        self.add(`Codex: ${e?.title ?? id}`, 'info');
      },
      combat: (spec) => {
        self.combats.push(spec);
      },
      placeMarker: (o) => {
        const cur = nodeById(run, run.nodeId);
        const targetCol = cur.col + Math.max(1, o.colOffset);
        if (targetCol > run.finalDepth - 1) return false;
        // nodes reachable from current
        let frontier = new Set([cur.id]);
        for (let c = cur.col; c < targetCol; c++) {
          const nf = new Set<number>();
          for (const id of frontier) for (const l of nodeById(run, id).links) nf.add(l);
          frontier = nf;
        }
        const cands = [...frontier].filter((id) => !run.markers.some((m) => m.nodeId === id && !m.done));
        const pool = cands.length ? cands : [...frontier];
        if (!pool.length) return false;
        // mark every reachable node in the column so the player can't route around the arc
        const picks = pool;
        for (const nid of picks) {
          run.markers.push({ nodeId: nid, eventId: o.eventId, label: o.label, kind: o.kind ?? 'beacon', done: false });
          nodeById(run, nid).known = true;
        }
        return true;
      },
      journal: (arcId, text) => {
        if (text) run.journal[arcId] = text;
        else delete run.journal[arcId];
        if (text) host.toast('Journal updated', '#cdb');
      },
      setFinale: (id) => {
        run.finaleEvent = id;
      },
      victory: (text) => {
        self.won = text;
        host.victory(text);
      },
      chain: (id) => {
        self.chains.push(id);
      },
      note: (text) => self.add(text, 'note'),
    };
    return ctx;
  }
}

export function formatText(s: string, run: RunState, faction: Faction | null, poi: string, sys: string): string {
  if (!s || s.indexOf('{') < 0) return s;
  return s.replace(/\{(\w+)(?::(\w+))?\}/g, (m, k: string, arg?: string) => {
    switch (k) {
      case 'F':
        return faction?.name ?? 'the locals';
      case 'Fs':
        return faction?.short ?? 'local';
      case 'Fsp':
        return faction?.species ?? 'locals';
      case 'Fl':
        return faction?.leader ?? 'their leader';
      case 'sys':
        return sys;
      case 'poi':
        return poi;
      case 'cap':
        return run.captain;
      case 'ship':
        return run.shipName;
      case 'off': {
        if (arg) return run.officers.find((o) => o.role === arg)?.name ?? 'your crew';
        const o = run.officers[hashSeed(s) % Math.max(1, run.officers.length)];
        return o?.name ?? 'your first mate';
      }
      default:
        return m;
    }
  });
}

/** Choose a random event for a site. */
export function pickEvent(run: RunState, site: Site, faction: Faction | null, rng: RNG, host: EventHost): EventDef | null {
  const probe = new EventSession.Probe(host, faction);
  const cands = ALL_EVENTS.filter((e) => {
    if (!e.sites.includes(site)) return false;
    if (e.minDepth !== undefined && run.depth < e.minDepth) return false;
    if (e.maxDepth !== undefined && run.depth > e.maxDepth) return false;
    if (e.unique && run.usedEvents.includes(e.id)) return false;
    if (e.archetypes && (!faction || !e.archetypes.includes(faction.archetype))) return false;
    if (e.condition) {
      try {
        if (!e.condition(probe.ctx)) return false;
      } catch {
        return false;
      }
    }
    return true;
  });
  if (!cands.length) return null;
  // de-emphasize events already seen this run
  return rng.weighted(cands, (e) => (e.weight ?? 1) * (run.usedEvents.includes(e.id) ? 0.15 : 1));
}

// A lightweight context for evaluating `condition`s without side effects.
// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace EventSession {
  export class Probe {
    ctx: EventCtx;
    constructor(host: EventHost, faction: Faction | null) {
      const def: EventDef = { id: '__probe', sites: [], title: '', start: 'x', nodes: {} };
      const s = Object.create(EventSession.prototype) as EventSession;
      Object.assign(s, { host, def, faction, poiName: '', lines: [], combats: [], chains: [], won: null, ended: true, visibleChoices: [] });
      this.ctx = (s as unknown as { makeCtx(r: RNG): EventCtx }).makeCtx(new RNG(1));
    }
  }
}

export function statsOf(run: RunState) {
  return computeStats(run);
}
