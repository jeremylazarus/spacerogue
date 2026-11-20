# Redesign proposal v2 (SPOILERS — never quote to the owner)

v1 critique: bolted onto the FTL loop; Tide toothless; Verdict menus with dominant Unravel; Flotilla derivative; too many meters.
v2 replaces the loop itself.

## Core identity
You are the only one in the Shoal who can spin **Thread** — the stuff lanes are made of. There is no star-map screen and no fuel.
**You weave your own route** out of what you bind in each system, while the **Tide** erases the system around you.

One resource: **Thread** (spun from the Choir's song). Spent on: jumping, binding loops, anchoring. Earned: unravelling bound
ships, harvesting lane-scars/anomalies, events, unravelling rocks. Credits remain (shops); XP/skills remain; Echoes remain (meta).
Removed: fuel, the map screen choice, the warden linger timer, flotillas, Legend.

## Pillar 1 — Spinning & Binding (combat verb)
- Hold **Q** (rebindable later) to spin: a glowing thread trails your ship; costs Thread per distance; strands fade after ~4s.
- Control fit: the ship faces the cursor, so putting the cursor on an enemy and holding A or D *orbits* it naturally — circling
  is the native motion of this control scheme.
- Enemies crossing an active strand are **snagged** (slowed, a little damage).
- **Closing a loop** around ships: each enclosed ship is stunned ~1.5s. If its hull is ≤ its **bind threshold** (shown as a
  tick on its health bar once you've learnt the verb; base 50%, elites 30%, bosses never), it is **Bound**.
- Loops around rocks harvest them into Thread; loops around anchors (see Pillar 2) weave them.

## Pillar 2 — Tethers & Verdicts in motion (no menus)
- A bound ship stays **tethered** to you and is towed (physics rope). Up to 2 tethers (skills raise it). While towed it is a
  flail (swing it into enemies — collision damage) and a shield (it absorbs shots).
- You decide its fate physically, any time before you jump:
  - **Reel** (hold E near it): **Strip** a **Graft** from it; the hulk is lost.
  - **Cut** (press the cut key while it's selected / or it breaks if overstrained): **Release** — its faction warms to you, and
    across runs released crews become **Kindred** (they can turn up to help a future Wayfarer).
  - **Drag it into the Tide**: **Unravel** — big Thread payout. Across runs, every unravelled ship adds weight to the **Choir**:
    the things that come out of the Tide in future lives are made from what you unravelled (stronger, and visibly familiar).
  - **Jump while towing**: it comes with you as a **Weft** — its faction's strand is woven into your next system (Pillar 3).
    The hulk is consumed in the weave.
- This kills the dominance: Unravel pays now, costs later; Strip builds you; Release builds goodwill and future aid; Weft steers.

## Pillar 3 — The weave is the exit (replaces the map)
- Each system has **anchors**: faction beacons, stations, planets (by type), derelicts, anomalies, lane-scars, rocks, Tide-wrack.
- Loop an anchor to take its **strand** (max 3 carried — the **Loom**, shown on the HUD as three spindles). Strands can also be
  given by events (story strands: "a signal from the drowned choir", etc.) and bought from Lacemakers.
- To leave, open the **Loom** (M): choose up to 3 strands to weave, see a *forecast* of the system they will create (owner,
  hazards, contents, danger), pay Thread (more strands = more Thread), spool, jump. Unused strands remain carried.
- Strand → next system: faction strand = that faction owns it; station strand = a station; derelict = wrecks; planet(kind)
  = that world type; anomaly = anomaly; scar = a hazard (choose your own hazard; hazards also pay more); story strand = the
  arc site. With no strands woven the jump is **frayed**: random and dangerous.
- Two strands of the same faction = its stronghold; two opposed factions = an ongoing battle between them; Tide-wrack =
  a pocket of the Tide (rich, lethal).
- **Depth** still rises by 1 per jump. Story arcs give strands instead of placing markers on a map.
- The voyage is recorded as a **tapestry** (journal visual): each jump a woven band coloured by its strands — the run's
  history as an artwork.

## Pillar 4 — The Tide (teeth)
- Replaces the warden timer. After a grace period, the Tide rises from one edge of the system as a visible wall of erasure
  that sweeps across the arena, slowly at first. Anything it touches is erased (heavy damage to ships; anchors are lost;
  POIs vanish). You must weave and leave before it reaches you — which anchors to grab first is a spatial decision.
- Things come out of the Tide (the Choir's hands — the old wardens, now built from unravelled ships across lives).
- **Narrows** (every 5 jumps; 3 of them): the Tide demands a **toll** — your *oldest* unanchored module or relic is claimed,
  unless you pay Thread to anchor it. Claimed items can resurface in later lives as Tide-wrack. Builds become a conveyor:
  keeping something is a statement.

## Pillar 5 — Grafts & Silhouette (customization = politics)
- Hulls gain graft sockets (2-4). Grafts are faction organs/devices with strong unique effects + trade-offs; ~3 per archetype.
- Each installed graft adds its faction's scent; the ship sprite visibly sprouts the part in the faction's colours.
- Attitude = rep + silhouette modifier. Each archetype has an explicit stance on worn parts, learnt on first hail and shown
  afterwards in the faction ledger and in every hail window ("How they see you: +12 (they admire the trophies you wear)"):
  hive: worn parts of anyone are an honour; machine: hate their own parts, curious about others; zealot: any graft is profane
  except from the Tide; raider: trophies of *other* factions earn respect, their own = insult; mercantile: indifferent;
  ancient: offended by many scents, respect a single one; lacemaker: dislike grafts entirely; tideborn: unreadable.

## Pillar 6 — Factions & the Exodus (readable)
- 6-7 factions per run from 8 archetypes (+ **Lacemakers**: thread-readers who sell strands & forecasts; + **Tideborn**:
  emerge from the Tide, moving against the exodus).
- Every faction is fleeing deeper. Each has a per-run **Ambition** and a **Strength** (0-10) shown in the ledger.
  Your actions change strength (destroying/unravelling/releasing their ships, events, weaving battles).
- At each **Narrows** the exodus converges: a set-piece system where the strongest factions hold the passage and the
  weakest are being ground down. Ambitions resolve here visibly ("the X have taken the Narrows"). The finale at the Heart is
  attended by whoever survived — shaping the ending.
- Each faction has a leader and a rival heir; certain events trigger succession, flipping ambition and stance.

## Pillar 7 — Remnants & Kindred (cross-run)
- Dead Wayfarers become Remnants (ship name, hull, gear scaled to depth, killer faction). They appear as named captains:
  grudge against their killer, may help, trade, or hunt. Reconcile → Echoes + codex.
- Released crews become Kindred; unravelled ships feed the Choir (Tide spawns use them).

## Size
- 3 Reaches × 5 jumps + Heart ≈ 16 systems per run (was 8). Many more anchors/strand combinations, Narrows set-pieces,
  new events for battles/strongholds/tide pockets, 2 new archetypes, new main arc(s).
