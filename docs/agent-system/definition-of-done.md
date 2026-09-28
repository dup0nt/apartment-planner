# Definition of Done
- Outcome and scope match the user request; source evidence and assumptions remain visible.
- All required reviewers from the catalog have returned findings before final completion. An interim handoff may explicitly state incomplete review; it is not completion.
- Geometry changes reach all consumers; no manual editing of exported geometry. Repeat-build hashes and 2D/3D dimensions remain consistent.
- `python3 check.py` passes. The production strict geometry command still rejects unknown inputs; never reinterpret provisional as confirmed.
- Review rendered output for visual changes; tests alone do not establish usability or physical clearance.
- Record decisions and validation evidence; no blockers or unresolved required findings at completion.

BLOCKING: geometry contradiction, unreviewed permission escalation, lost evidence, nondeterminism or unsupported installation certainty. REQUIRED: functional/test/routing defect needing correction before completion. ADVISORY: preference or optional improvement without correctness impact. Report severity, file, evidence and remedy separately. An agent cannot certify acoustics, structural safety or purchase fit from a diagram.
