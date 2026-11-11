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
  idea the three.js view uses.
- **Export is easy.** We clone the SVG, strip UI-only nodes (`.no-export`),
  rasterize it onto an offscreen canvas, and save a PNG.

## World coordinates

- All geometry is stored in **inches**: x to the right, y down (screen convention).
- The 3D view maps plan `(x, y)` to three.js `(x, z)`, with height on `y`. Walls, openings,
  and furniture store heights (`height`, `sillHeight`, `headHeight`, `elevation`).
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
  model/        types.ts, defaults.ts (factories), operations.ts (add room/walls,
                calibrate-rescale, move shared vertices, delete), migrate.ts   (pure TS)
  geometry/     vec, polygon (SAT overlap, distances, inscribed rect), plan (wall/door/
                furniture footprints, nearest wall), snapping (90°/vertex/alignment), units
  catalog/      furniture.ts: library with real default dimensions + palette colors
  styles/       presets.ts (palettes, room suggestions, ideas w/ renter alternatives),
                rugs.ts (rug sizing + placement per room)
  analysis/     warnings.ts: wall overlap, door swing, furniture overlap, walkway clearance
  persistence/  storage.ts (localStorage slots), useAutosave, exportPng, image downscaling
  importers/    PlanImporter registry: planner JSON, RoomPlan JSON and USDZ (see below)
  store/        editor.ts: zustand store with project, undo/redo, selection/tool/view
  components/
    plan/       PlanCanvas (pointer routing to tools, pan/zoom, drag state machine) and
                pure layer renderers: Grid, layers (rooms/walls/dims/handles),
                OpeningShape, FurnitureShape, WarningsLayer
    *.tsx       Toolbar, ToolPalette, BackgroundPanel, FurnitureLibrary, Inspector,
                RoomsPanel, StylePanel, WarningsPanel, CalibrateDialog, ProjectsDialog
```

Interaction notes:

- Layers are pure renderers that mark hit targets with `data-kind` / `data-id`. `PlanCanvas`
  has a single pointer handler that routes on those attributes. That keeps all drag logic
  (move, rotate, resize, vertex, opening, background, pan) in one small state machine.
- Drags call `checkpoint()` once and then `mutate(fn, { record: false })` on every move, so a
  whole drag is one undo step.
- UI-only SVG nodes carry `className="no-export"` and are stripped from the PNG export.

Anything React-free (model, geometry, analysis, styles, importers) can be reused
as-is by the 3D view, the importers, or a Web Worker.

## 3D view (`src/three/`)

- `buildScene.ts` turns a `Project` into three.js objects: floors from room polygons, walls
  as boxes split around their openings (`wallPieces`), window glass, door leaves and swing
  sectors, and furniture massing per `kind`. Units stay in inches; plan `(x, y)` → `(x, z)`.
- `View3D.tsx` owns the renderer, orbit camera, and floor-plane dragging. It writes to the
  same store as the 2D canvas, so undo, warnings, and the side panels work in both views.
  Structure and furniture rebuild separately, keyed on the parts of `Project` they read.
- It is lazy-loaded, so three.js is only downloaded when the 3D view opens.

## Scan import (`src/importers/roomplan/`)

Both RoomPlan formats are reduced to one neutral shape, `ScanData`: lists of measured boxes
(center, floor-plane axis, width/height/depth in meters) for walls, doors, windows, openings,
and objects.

- `capturedRoom.ts` reads Apple's `CapturedRoom` JSON (column-major transforms + dimensions).
- `usdz.ts` reads RoomPlan's USDZ with three's `USDLoader`, classifies meshes by name
  (`Wall0`, `Door0`, `Sofa1`…), and measures each box from its world-space vertices, so it
  doesn't depend on how the file stores transforms.
- `scan.ts` (`scanToProject`) converts to the plan model: meters → inches, squares the plan
  to its longest wall, snaps wall ends into corners, attaches openings to their wall with sill
  and head heights, maps object categories to furniture kinds, and derives room polygons from
  closed wall loops.

## Later

- **First-person walkthrough** camera (eye height, walk between rooms) on the existing scene.
- **Real furniture models** (GLB per catalog item) in place of massing boxes.
- **Photos as reference:** attach photos to rooms or pieces; use them to set colors and names.
- **Room splitting** for multi-room scans (planar face tracing instead of simple loops).
