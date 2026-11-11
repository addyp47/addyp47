# Apartment Planner — Architecture

## Rendering choice: SVG (not canvas)

The plan is drawn as **SVG** rendered by React.

- **Hit-testing for free.** Every wall, door, and furniture piece is a DOM node, so
  hover, click, drag handles, and cursors come from normal pointer events.
  On a canvas we would have to write our own picking for rotated shapes.
- **Small scene.** An apartment has tens to a few hundred elements. The DOM
  handles that easily, so canvas's speed advantage doesn't matter here.
- **Crisp at any zoom.** Pan and zoom is one `transform` on the root group.
  Strokes use `vector-effect="non-scaling-stroke"` so lines stay a fixed pixel width.
- **Declarative.** A layer is a pure function of `Project` data, which is the same
  idea the future three.js view will use.
- **Export is easy.** We clone the SVG, strip UI-only nodes (`.no-export`),
  rasterize it onto an offscreen canvas, and save a PNG.

## World coordinates

- All geometry is stored in **inches**: x to the right, y down (screen convention).
- The future 3D view maps plan `(x, y)` to three.js `(x, z)`, with height on `y`.
  Walls, openings, and furniture already store heights (`height`, `sillHeight`,
  `headHeight`, `elevation`) so a 3D view can extrude them without changing the schema.
- **Calibration** rescales world geometry (background image, walls, rooms, furniture
  *positions*) by `realLength / measuredLength`. Furniture *sizes* are real-world
  measurements, so they are never rescaled.

## Data model (`src/model/types.ts`)

```
Project
├─ version: 1                ← schema version, migrated in model/migrate.ts
├─ id, name, createdAt, updatedAt
├─ ceilingHeight             (in)
├─ background: BackgroundImage | null
│    dataUrl, naturalWidth/Height, x, y, inchesPerPixel, opacity, visible, locked
├─ rooms: Room[]             id, name, type (living|bedroom|…), polygon: Vec2[], floorColor?
├─ walls: Wall[]             id, a: Vec2, b: Vec2, thickness, height
├─ openings: Opening[]       id, kind (door|window|outlet), wallId, t (0..1 along wall),
│                            width, hinge (start|end), side (±1), sillHeight, headHeight
├─ furniture: FurnitureItem[] id, catalogId, name, kind, x, y (center), rotation (deg),
│                            width, depth, height, elevation, shape (rect|ellipse),
│                            color?, obstacle (false for rugs)
├─ style: { presetId, palette { walls, floor, wood, textile, accents[] }, renterMode }
└─ source: { kind: manual | json | roomplan }   ← where the plan came from
```

Design notes:

- **Openings are attached to walls parametrically** (`wallId` + `t`). When a wall
  endpoint moves, its doors and windows move with it. The 3D view will cut holes at
  the same parameters.
- **Rooms are polygons, separate from walls.** Tracing a closed room makes both a
  `Room` and its `Wall`s (shared edges are deduplicated). Rooms carry semantics
  (type, floor color, style suggestions); walls carry construction (thickness, height,
  openings). RoomPlan scans give exactly this split: walls/doors/windows plus room labels.
- **The furniture catalog is data** (`src/catalog/furniture.ts`). Placed items copy
  their dimensions, so editing a piece never changes the catalog.
- **Derived data is never stored.** Warnings, areas, rug suggestions, and wall polygons
  are computed from `Project` in pure functions (`geometry/`, `analysis/`, `styles/`).

## Code structure

```
src/
  model/        types, defaults/factories, schema migration      (pure TS, no React)
  geometry/     vectors, polygons (SAT, distances), plan shapes, units/ft-in formatting
  catalog/      furniture library with real default dimensions
  styles/       style presets, palettes, renter-friendly ideas, rug sizing
  analysis/     warnings: wall overlap, door swing, walkway clearance
  persistence/  localStorage slots, JSON import/export, PNG export
  importers/    PlanImporter interface (JSON now; RoomPlan USDZ later)
  store/        zustand editor store: project + undo/redo + selection/tool/view
  components/
    plan/       PlanCanvas (pointer routing, pan/zoom) + one component per layer
    *.tsx       Toolbar, sidebars, Inspector, StylePanel, WarningsPanel, dialogs
```

Anything React-free (model, geometry, analysis, styles, importers) can be reused
as-is by a future `src/three/` walkthrough view or a Web Worker that parses USDZ.

## Future fit

- **3D walkthrough:** `src/three/buildScene(project)` extrudes `wallPolygon(wall)` to
  `wall.height`, subtracts openings using `openingSpan` + sill/head heights, and
  places furniture boxes or models by `kind`. It reads the same store, so 2D and 3D
  stay in sync. A `viewMode: '2d' | '3d'` switch would go in the store.
- **RoomPlan USDZ import:** implement `PlanImporter` in `importers/roomplan.ts`.
  CapturedRoom walls (transform + dimensions) map to `Wall` segments projected onto
  the floor plane; doors and windows map to `Opening`s by projecting onto their parent
  wall; objects (sofa, bed, table, storage…) map to `FurnitureItem`s by category.
  Set `source.kind = 'roomplan'`.
