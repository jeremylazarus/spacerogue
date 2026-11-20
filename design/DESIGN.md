# Design notes (SPOILERS — the owner plays blind; never quote this to them)

See WORLD.md for setting/lore. This file documents systems so future sessions stay consistent.

## v2 redesign (Nov 2026) — see PROPOSAL.md for the reviewed pitch
Owner said the game felt too familiar (FTL + shooter + Hades). v2 replaces the map/fuel/warden loop. Reviewed twice by an
adversarial originality reviewer; key exploit fixes are baked in below.

## Run structure (v2)
- No star map. `run.step` 0..FINAL_STEP(12) counts jumps; `run.depth` = `tierOf(step)` 0..7 is the danger tier content/scaling read.
  `run.nodes` is just the history of visited systems (the Loom's tapestry). Save key still `spacerogue.run.v1`, RunState `v: 2`.
- **Thread** (`run.thread`, max = stat `maxThread`, base 40, start 30) replaces fuel. Content's fuel API maps 1 cell = 4 thread
  (`THREAD_PER_FUEL` in events.ts); `revealMap` grants a little thread.
- **Spinning** (thread.ts): hold Q → trail, 1 thread / 320px (Lane Tendril graft ×1.4). Points live 4s. Crossing hostile = snag
  (slow + dot). Closing a loop (self-intersection) → hostile ships inside stunned 1.5s; if hull ≤ bind threshold (50%, elite 30%,
  +graft/skill; bosses never) → **bound** (tethered, allied, weapons stripped, decays 0.8%/s, max 2 tethers). Loops also break
  rocks for thread (cap 10/system) and take **strands** from anchors. Neutral ships ignore loops entirely. No spinning mid-jump.
- **Tethers**: rope constraint (hulk tug capped 30%), towing slows you 12%/10% per hulk, hulks are flails (speed-based damage to
  hostiles only) and shields (enemy fire hits them). Fates: hold F = reel → strip (graft from its archetype, else a module; −3 rep,
  −0.2 strength); R = cut loose/release (+8 rep, +0.3 strength, ship marked provoked so it can't be re-looped);
  drag into the Tide = unravel (6+r*0.2+depth thread; meta `choir.weight` & `choir.w.<arch>` +1 → future Choirhands).
  Jumping drops all tethers.
- **Anchors/strands** (weave.ts): planets (strand planet:kind), stations/havens, derelicts, anomalies, faction lane-beacons
  (owner + sometimes a passing faction; cradle always has a non-raider beacon), lane scars (hazard), Tide-wrack (appears when the
  Tide rises; seeded positions; +4 thread). Loom holds 3 (LOOM_SIZE).
- **Weaving** (M = the Loom): pick ≤3 strands → `weaveNode` deterministically builds the next GNode and a forecast. Cost: frayed
  (0 strands) 2; else 2+2n, +3 per station/haven strand; Navigator's Eye −1. Faction strand = owner; second different faction =
  guest patrols; two same-faction = stronghold; station/haven/derelict/anomaly set kind; planet strands force rich planets (event
  always fires); scar sets hazard + `scarred` (kill credits ×1.5); wrack = early Tide (30s) + extra derelicts + monsters.
  Frayed = random, more hostile/hazard. Not enough thread with 0 strands = threadless jump (20% hull). Thread spent on arrival.
- **The Tide** (replaces wardens): own clock `tideT` (paused while a boss lives or a pending afterVictory fight is unresolved).
  Grace: cradle 300, station/haven/narrows 160, else 110, wrack 30; Warden's Key ×1.5, Hollow Idol ×0.75, Still Heart ×1.35,
  resonance −5%/lvl. Comes from the side you arrived on, as a straight front: 18px/s accelerating to 90. Beyond it: ships take
  12%(player)/20% max hull per s (wardens & bosses immune), tethered hulks unravel, allied drones vanish, POIs/rocks/pickups erased.
  POIs within 900 of the front pulse red. Choirhands (warden side) climb out every 36s near the player.
  Never in the final system. Restore: player position, tideT, risen state, rock cap, woven anchors are saved in `run.sys`.
- **Story markers** now have `step` (placeMarker converts tier offset → step); missed markers roll to the next step (cap 11);
  never placed in the final system.

## Exodus (exodus.ts)
- `run.strength[fid]` 0..10 (base by archetype ±1), `run.ambitions` (hold / crush rival / reach Heart ≥5 / shelter: str≥2 & rep≥30).
- Each arrival: all −0.12; 55% a feuding pair clashes (weaker more likely to lose 0.6). <0.5 = broken (no patrols/beacons).
  Player kill −0.15 (+2 rep with the victim's enemies), NPC kill −0.08, strip −0.2, unravel −0.3, release +0.3.
- Feuds (`atWar`): zealot–machine, hive–zealot, hive–mercantile, raider–mercantile, raider–zealot, machine–hive, raider–machine,
  ancient–hive. Feuding ships fight on sight (`Ship.foe`), their shots hit each other; patrol size scales with strength.
- **Narrows** at steps 4 and 8: forced node (strands only add planets/hazard), owner = strongest, every unbroken faction present.
  On arrival: `resolveNarrows` (+0.8 to holder; 'hold' ambition succeeds if holder, fails only at the last Narrows) and **the Toll**
  (toll.ts): Tide wants one of your 2 most valuable things (equipped modules by rarity, relics, grafts; never the last weapon) —
  give one, pay 12/20 thread, or feed it all strands (≥2). Taken items are remembered in meta `tide.wrack` (JSON, 8 max).
- Victory text gets `heartEpilogue`: factions with strength ≥3 arrive; fulfilled ambitions listed.

## Grafts & silhouette (grafts.ts)
- Sockets per hull (HULL_SOCKETS: skiff 2, lancer 2, bulwark 3, weaver 3, mirage 2, dredger 4, hollow 3); hold of 4. 14 grafts,
  2 per archetype + 2 lane-beast (monster). Fit from the ship screen; tearing out destroys it. Drawn on the hull (drawGrafts).
- `attitude(run, f)` = rep + silhouette mod; used for hostility, docking, event `ctx.rep`, labels. Stances: hive +6/graft (+6 more
  per hive graft); machine −18 per machine graft, +4 per other; zealot −8/graft; raider +6 per other-faction graft, −20 per raider
  graft; mercantile 0; ancient +12 if all grafts one archetype, else −8 per extra archetype. Shown in hails ("How they see you").

## (v1, superseded) Run structure
- Galaxy: columns 0..7 (`run.finalDepth`). Col 0 = cradle (start), col 7 = The Heart (finale). Cols 1-6 have 3-4 nodes; lanes only go forward (`GNode.links`).
- Node kinds: station, hostile, nebula, derelict, anomaly, haven, empty. Hazards: asteroids, radiation (shield regen ×0.5), ionstorm (telegraphed lightning strikes), nebula (scan & detection ×0.6).
- Every system arrival autosaves (localStorage `spacerogue.run.v1`). Continue regenerates the system from its seed.

## Player ship
- Ship-relative thrust: W forward, S reverse, A/D strafe (owner request), soft brake; ship faces the mouse (heading held when cursor is on the ship), mouse aim, LMB fires even-index weapons, RMB odd-index (a single weapon fires on either). Shift afterburner (energy), Space hull ability, E interact/hail.
- Hulls (items.ts HULLS): Skiff (blink), Lancer (overdrive), Bulwark (bastion: refill shield + reflect), Weaver (drones + swarm), Mirage (cloak, guaranteed crit from cloak), Dredger (harpoon), Hollow (echo ally; secret — deed.frag3).
- Modules: weapons (pulse, scatter, rail, missile, beam, flak; locked until Legacy: mine, arc, wave, lance) and utilities (shield, armor, thruster, reactor, targeting, capacitor, loader, nanites, tractor, scanner, dronebay, pd, fueltank; locked: phase, leech, ion). Rarity 0-4 scales base stats ×1..1.6 and adds 0-3 affixes.
- Relics: passive artifacts (items.ts RELICS, effects scattered through world.ts/run.ts).
- Skills: 3 trees × 11-12 nodes (skills.ts). Keystone flags: ram, overcharge, exec, storm, shunt, dronedmg, overload, envoy, drift.
- Aptitudes (event checks): base 1 + skills + officers (+2 per role) + relic/module bonuses.

## Factions
- 4-5 per run from archetypes (always one raider). Procedural names (names.ts). Territories by nearest centre; ancients sit deep.
- Rep −100..100; ≤−30 hostile (raiders with Rust Crown ≤−70; zealots with Pilgrim's Lamp ≤−60). Shooting a neutral provokes it and nearby same-faction ships (−12 rep). Kills −4 (traders −10); killing raiders pleases mercantiles.

## Events
- Engine: events.ts (EventSession implements api.ts EventCtx). POIs: planets (75% event), derelicts, anomalies, distress, asteroid, station concourse (once per station), hails (neutral faction ships), arrival (12%), markers (arc sites), finale.
- Arcs: one main (drives finale via setFinale), 1-2 side arcs. Content in src/content/arcs; generic events in src/content/events.

## Meta progression (meta.ts)
- Echoes = depth×12 + kills×0.6 + bosses×30 + level×4 + events×1.5 (+120 win), × perks/relic/resonance.
- Legacy shop: hulls, weapon schematics, inheritance perks. Deeds: hidden achievements (hints only).
- Resonance difficulty unlocked by winning; enemies scale with depth + 0.8×resonance.

## Ideas not yet built
- Faction-vs-faction skirmishes in space; escort missions; mining laser; ship naming; gamepad support; more bosses; per-hull unique passives; endless mode after the Heart.

## v2 additions (cross-run & content hooks)
- **Remnants** (remnant.ts): non-abandoned deaths after ≥1 jump store a Remnant in meta (ship, captain, best weapon, killer from
  `world.lastHitBy`, max 6). New runs: 60% chance a remnant hails at a non-Narrows step (flags `remnant.step/i/met`). Choices:
  diplomacy-2 talk or 60¢ → their weapon (rarity capped depth+1), codex `lore.remnant`, `remnant.reconciled`; point it at the
  killer faction (−1.2 strength); or fight it (rogue, strength 2.4, `engine.remnant.won`). Consumed on choice.
- **Kindred**: at run end, `released.<fid>` counts add to meta.kindred[archetype] (cap 9). Once per system, when ≥4 hostiles
  are on you, 45% chance 2 kindred fighters (60s, allied) arrive; spends 1 kindred.
- **Choir weight**: meta `choir.weight` boosts Choirhand strength (+2%/ship, cap +60%); `choir.w.<arch>` makes some Choirhands
  appear as "Choirhand (once <species>)" tinted that faction's colour.
- **Tide-wrack returns**: looping a Tide-wrack anchor has a 35% chance to return an item the Toll took in a past life.
- **Lacemaker** stall (station yard tab; always at havens, 50% elsewhere): 3 strands for sale (faction, planet, scar, derelict,
  anomaly, haven), stored per station in run flags.
- **Skills**: g_bind (+8% bind threshold/rank), e_spool (+10 max thread/rank), w_tether (+1 tether).
- **Content flags** (game.ts `syncContentFlags`, refreshed on arrival and refresh): here.kind/step/narrows/extras,
  wears.<arch>/wears.total, str.<fid>, amb.<fid>; plus released.<fid>, broken.<fid>. Codex auto-unlocks: lore.thread (first
  bind), lore.unravel, lore.narrows, lore.grafts, lore.loom (first jump), lore.remnant (remnant).
- Content copies the feud table in src/content/events/exodus.ts and src/content/arcs/narrows_truce.ts — keep them in sync with
  exodus.ts FEUDS.
- New arcs: `last_weaver` (main; 5 stages; 4 endings by flags and ships unravelled this run), `narrows_truce` (side, tier 1),
  `tidewalker` (side, tier 2). New events: src/content/events/exodus.ts (`ex_*`, 24).
- Known limitations: missed story markers at step 11 are lost (final system never hosts markers); removing the brood graft
  leaves its drone until it dies.
