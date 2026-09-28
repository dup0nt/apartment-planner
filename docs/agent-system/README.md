# Agent operating model
Start with [constitution](constitution.md), [catalog](catalog.json) and the relevant [team charter](teams/geometry.md). Then consult [ownership](ownership.md), [interactions](interactions.md), [decision rights](decision-rights.md), [permissions](permissions.md), [Definition of Done](definition-of-done.md), [decision status](decision-status.md) and [evaluation](evaluation.md).

This governs only apartment-planner. The root agent is the mission integrator; specialists are bounded delegation handles, not autonomous departments. Three teams are enough for this repository. No model is pinned.

For a cross-team change use templates/mission-brief.md, then templates/handoff.md. The machine-readable catalog is authoritative for routing; prose must not silently add or remove reviewers. `python3 check.py` is the integrated check command.
