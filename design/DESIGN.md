# Design notes (SPOILERS — the owner plays blind; never quote this to them)

See WORLD.md for setting/lore. This file documents systems so future sessions stay consistent.

## Run structure
- Galaxy: columns 0..7 (`run.finalDepth`). Col 0 = cradle (start), col 7 = The Heart (finale). Cols 1-6 have 3-4 nodes; lanes only go forward (`GNode.links`).
- Node kinds: station, hostile, nebula, derelict, anomaly, haven, empty. Hazards: asteroids, radiation (shield regen ×0.5), ionstorm (telegraphed lightning strikes), nebula (scan & detection ×0.6).
- Jumping: open map (M), select a linked node, engage → spool 3s (1.8s w/ Lane Drifter), halved speed if aggro hostiles within 1000. Costs 1 fuel, spent on arrival; at 0 fuel a "dry jump" costs 20% max hull (refused if hull too low). Jumps blocked while an afterVictory fight is unresolved.
- Wardens: after ~220s in a system (300 in the cradle), warning at T-30s, then escalating warden waves every 40s. Warden's Key ×1.5, Hollow Idol ×0.75, Resonance −5%/level. Never in the final system.
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
