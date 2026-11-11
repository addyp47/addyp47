# Apartment Planner

A client-only web app for planning an apartment's layout and decor.
Built with React, TypeScript, Vite, SVG (2D plan), and three.js (3D view). There is no backend. Layouts live in your browser
(localStorage), and you can export them as JSON or PNG.

```bash
cd apartment-planner
npm install
npm run dev        # http://localhost:5173
npm test           # geometry, warnings, rug sizing, scan import, 3D walls
npm run build      # static build in dist/ (can be hosted anywhere, e.g. GitHub Pages)
```

## Model your real apartment from a LiDAR scan

This is the main workflow: scan the apartment, import it, then test changes in 3D.

1. **Scan** each room with an iPhone Pro or iPad Pro using an app built on Apple's RoomPlan
   that can export the room as **USDZ** (the "parametric" or "room model" export, not a
   photo-textured mesh) or as RoomPlan **JSON**.
2. **Import** it with **Import scan / JSON** in the toolbar. Walls, doors, windows, and the
   furniture the scan recognized arrive at their measured sizes, and the app opens the 3D view.
3. **Fix up** what a scan can't know: rename pieces, flip door swings (they default to swinging
   into the room), and set room types. Scanned pieces are plain boxes labeled by category
   (Sofa, Bed, Storage…).
4. **Test changes** in 3D or 2D: drag furniture, or add a piece from the library and edit it
   to the exact size of the thing you're considering. Pieces that hit a wall, block a door, or
   squeeze a walkway turn red and are listed under **Issues**.
5. **Export GLB** (3D view) writes the model in meters for other 3D tools.

What to expect from scans:

- RoomPlan dimensions are typically within an inch or two. Check anything critical (an alcove
  a sofa must fit) with a tape measure and correct it in the Inspector.
- Scanned walls are kept 1″ thin and sit on the measured wall surface, so room dimensions
  stay true to the scan.
- One closed loop of walls becomes one room. Multi-room scans with T-junction walls import
  all walls and objects but get a single outline; trace rooms in 2D if you want them split.
- The readers are tested against RoomPlan-shaped files generated for the tests, not yet
  against a scan from a real device. If a real scan imports wrong, the file itself is the
  bug report.

## Quick tour

1. **Floor plan.** Upload a photo of your lease or listing plan (left panel). The app switches
   to **Set scale (K)**: click both ends of a wall you know, then enter its real length.
2. **Trace rooms.** Use **Room (M)** and click the corners. Lines snap to 90° and to existing
   corners, with alignment guides; hold Shift for a free angle. Click the first point to close
   the room. Walls are created along the edges, and walls shared with a neighbor room are not
   duplicated. **Wall (W)** draws open wall runs (double-click or Enter to finish).
3. **Openings.** Use **Door (D)**, **Window (N)**, and **Outlet (O)**, then click a wall. The side
   you hover is the side the door swings into. Drag an opening along its wall, and flip the hinge
   or swing in the Inspector.
4. **Furniture.** Click or drag pieces from the library. Each piece is drawn to scale with real
   default sizes. Drag to move, use the round handle to rotate (15° snap, Shift for free), and
   use the square handles to resize. **R** rotates 90°, **Ctrl+D** duplicates, and the arrow keys
   nudge. Hovering shows dimensions.
5. **Issues tab.** Lists furniture overlapping walls, blocking a door swing, overlapping other
   pieces, and walkway gaps between 2″ and 30″. Small or movable pieces and the coffee-table gap
   are skipped.
6. **Style tab.** Choose Japandi, Mid-century modern, Cozy maximalist, Scandinavian, or
   Industrial. Each preset recolors floors, wall paint, and furniture, and suggests furniture,
   rug sizes, and tips for each room (set room types in the Inspector). **Renter-friendly mode**
   (on by default) replaces permanent ideas with removable ones.
7. **Saving.** Changes autosave. **Layouts…** opens, copies, or deletes saved layouts.
   **Import/Export JSON** backs up or moves a layout. **Export PNG** saves an image of the plan.

Undo/redo: Ctrl+Z / Ctrl+Shift+Z. To pan, drag empty space, Alt+drag, or middle-drag.
Scroll to zoom.

## Design

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the data model, the module layout,
why the plan is SVG, and how the planned 3D walkthrough and RoomPlan import fit in.

## Known limitations (v1)

- Floor plan images are downscaled to 2200 px and stored inline. Very large plans plus many
  layouts can fill localStorage (about 5 MB). Export JSON as a backup.
- Rug suggestions use the largest rectangle that fits inside each room. That is exact for
  rectilinear rooms and approximate for angled walls.
- Sectionals use a rectangular footprint. L-shaped furniture is not modeled yet.
