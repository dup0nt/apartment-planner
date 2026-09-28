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
