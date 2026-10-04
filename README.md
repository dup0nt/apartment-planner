## Interactive blueprint viewer

Run `python3 serve.py` from this repository, then open http://127.0.0.1:8765/. Use `--port 8766` to change the port or `--open` to open your browser. No npm install, API key, cloud upload or external library is needed. Python serves static files locally; images and project data stay in your browser unless you explicitly save them.

- Upload PNG, JPG or WebP (up to 12 MB and 20 megapixels).
- Use **Scale**: click both ends of a printed dimension, enter metres and apply. Both axes assumes an undistorted scan; separate X/Y calibration supports stretched references.
- Use **Wall** to click endpoints, then add **Door** or **Window** openings. Select a wall to move endpoints or edit length, height, thickness and opening properties. Hinge and swing are explicit.
- **Measure** preserves the original printed label. Amber measurement chips flag disagreement with the calibrated trace; source labels never silently change geometry.
- Orbit and zoom the synchronized 3D view. Cutaway changes display only. Save a portable JSON project, reopen it, export a 2D SVG or save a 3D image.
- Optional **Suggest lines** finds ink runs, not recognised walls. It may include text, fixtures and neighbouring apartments. Review every candidate.

The included A–B example is an illustrative manual trace of the corrected uploaded plan, not a verified survey. Its X/Y calibration uses living-room labels 3.98 m and 4.85 m. Other source dimensions disagree with those proportions. Door dimensions/hinges, glazing operation, heights and thicknesses require checking. Balconies and built-in wardrobes are not modelled. The app does not automatically interpret text, partition apartments, rectify perspective or infer missing measurements. Raster tracing alone cannot guarantee exact architecture. 3D geometry is reproducible from saved JSON; screenshot pixels may differ between GPUs.

The viewer uses `web/demo.json` / `web/demo-image.js` as a separate pixel-space example. The legacy metre-space planner below remains unchanged. `web/demo-image.js` is the JSON project wrapped as `window.BLUEPRINT_DEMO=<JSON>;` for dependency-free browser loading. Keep both demo representations synchronized.

Validation: Python 3.11+ and Node.js are required for `python3 check.py`. Set `NODE_BINARY` if Node is outside PATH. This runs governance, legacy geometry and interactive geometry tests.

# Deterministic apartment planner

A local, dependency-free Python 3 repository. One explicit geometry source drives a labelled 2D SVG, interactive 3D HTML viewer and real 3D OBJ mesh. No AI image generation, external CDN, API key or randomness. Same inputs and program version produce byte-identical files (tested).

## Run

From this directory:

```sh
python3 planner.py build --layout J
open build/J/viewer.html
open build/J/plan.svg
python3 -m unittest discover -s tests -v
```

On Windows/Linux open the generated HTML/SVG using your browser or file manager. No web server is required. Drag the 3D viewer to rotate, scroll to zoom, and toggle full-height walls. Furniture appears as external envelopes, not photorealistic upholstery. The OBJ can be imported into Blender with Z up and metres as units.

Other candidates: E, F, F2, G, H, J.

```sh
python3 planner.py build --layout G
python3 planner.py validate --layout J
python3 planner.py validate --layout J --strict
```

**Strict validation intentionally exits with status 1 today** because architectural assumptions remain. Normal builds are explicitly PROVISIONAL. A collision also exits with status 1 and prevents a new build. Do not treat old generated files as a successful new build after an error: read the command exit status.

## Source of truth

- `references/architect-plan.png`: the user's corrected A-B blueprint. Apartment is the RIGHT half of this upright image.
- `data/architecture.json`: architectural dimensions, evidence status, doors, glazing and reserved access areas. Dimensions are metres.
- `data/J.json` etc.: furniture outer sizes and positions. Architecture is never redefined in layout files.
- `planner.py`: polygon, wall segmentation, door geometry, validation and export.
- `viewer-template.html`: deterministic projection of the exported geometry. Does not invent dimensions.
- `build/<layout>/scene.json`: complete resolved input and geometry; `manifest.json` records SHA-256 hashes of generated files.

Origin is upper-left living-room interior: X right, Y toward the balcony, Z up. Sofa direction is explicit. Door closed angles use +X=0 degrees, +Y=90; signed swing angles define opening direction. The displayed 3D leaf is 70% open; the 2D plan shows the complete swing sector.

## What is and is not confirmed

The plan labels 3.98 m across the hall end, 4.85 m along the room and 2.90 m across the balcony end. The 1.08 m notch width is derived from 3.98-2.90. The 3.20 m left-wall run to the kitchen recess is an earlier planning assumption, NOT a printed dimension. The room's 17.70 m² label is not used to reverse-engineer that distance because its area convention is unknown.

Door positions/directions are interpreted from the drawing, but widths and exact hinge offsets are unmeasured. Wall thickness/height, glazing sill/height and opening operation are unverified. Glazing is an aperture marker with no invented panel count or sash swing. Source pixels are not used as uniformly scaled measurements.

Changing `notch_y` also requires updating the kitchen hinge and the kitchen access reserve. An assertion prevents a door remaining on the wrong wall. This is an explicit-edit schema, not a CAD constraint solver. Read dimensions and derived dimensions must also be kept consistent when editing.

## Validation limits

Checks detect furniture overlap, room/notch violations, reserved-access intrusion and conservative door-sweep bounding-box intrusion. Cylinders use conservative rectangular footprints for collisions. Door swing checks can over-report because the entire sector bounding box is reserved. Furniture sides touching are not positive-area overlaps.

These checks do NOT certify chair pull-out, continuous walking width, accessibility, glazing movement, electrical positions or acoustics. F2 remains a tight unvalidated circulation proposal even if its static footprints pass. Assumptions cannot be promoted to confirmed merely because a render looks plausible.

## Scope

The implemented geometry is the living/dining room, for layouts E/F/F2/G/H/J. The complete apartment reference is included, but bedrooms, bathroom and kitchen are not yet modelled. Earlier AI-generated images are not authoritative and are not inputs to this repository. Speaker models are not yet added: use real speaker/stand dimensions before updating furniture data.

## Reproducibility

No timestamps are inserted. Generated artifacts contain fixed float formatting or stable JSON ordering. Interactive camera changes affect only the displayed view, not the geometry or stored files. Keep JSON inputs and generator together in Git; review diffs before rebuilding. The included first commit provides a reproducible baseline, not a claim of surveyed accuracy.

## Agent collaboration and full checks

The repository has a small [agent operating model](docs/agent-system/README.md): geometry, rendering and read-only independent assurance. [AGENTS.md](AGENTS.md) is the concise router; [catalog.json](docs/agent-system/catalog.json) owns review routing. This does not change existing geometry or add an orchestration runtime.

With Python 3.11 or newer, run all product and governance checks:

```sh
python3 check.py
```

The renderer retains its existing Python requirements; Python 3.11 is needed only for standard-library TOML validation of agent profiles.

### Arrange furniture
The furniture bar adds **Straight sofa**, **Sofa + chaise**, **TV** and **TV unit**. Choose one, then click the blueprint. With Select active, drag a piece in 2D and see its 3D position update. Select it to edit overall width, depth, height and bottom elevation in centimetres; rotate with the button, degree field or `R` key. The chaise has left/right placement, width and total depth controls. Left/right refers to the unrotated plan, where the sofa faces downward.

Sofas include arms, back, seat cushions and legs; chaise sofas have an actual L footprint. TVs include a thin screen and stand; cabinets include fronts, top and legs. These are schematic shapes, not exact product models. Furniture chips beneath the inspector select overlapping pieces and focus the plan. Use Focus in 3D to inspect the selected piece; Reset view shows the whole model. Save/open project, undo/redo and 2D/3D exports include the furniture. Old project files load without furniture. Clear traces leaves furniture intact; use Delete selected to remove pieces.

Furniture can overlap walls or doors: inspect clearances before trusting a layout. Uploaded-plan calibration also controls its apparent size relative to architecture. TV bottom elevation can be set to the cabinet height; the two pieces remain independently movable.

Furniture defaults: both sofa shapes use a 210 × 110 cm base; the chaise retains an adjustable illustrative 160 cm total depth. TV: 55-inch 16:9 visible screen, schematic bezel/stand, bottom elevation 56 cm. TV unit: 179 × 42 × 56 cm. Existing placed/saved furniture retains its custom dimensions. Sofa height remains illustrative at 84 cm.
