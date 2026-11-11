# Apartment Planner

A client-only web app for planning an apartment's layout and decor.
Built with React, TypeScript, Vite, and SVG. There is no backend. Layouts live in your browser
(localStorage), and you can export them as JSON or PNG.

```bash
cd apartment-planner
npm install
npm run dev        # http://localhost:5173
npm test           # geometry, warnings, rug sizing, import/export
npm run build      # static build in dist/ (can be hosted anywhere, e.g. GitHub Pages)
```

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
