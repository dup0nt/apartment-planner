# Decision register
| ID | Status | Decision | Evidence / owner |
|---|---|---|---|
| D001 | Accepted product baseline | Deterministic shared geometry replaces AI imagery as layout authority | User repository request; geometry steward |
| D002 | Accepted scope | Living/dining E/F/F2/G/H/J only | Existing README and CLI; integrator |
| D003 | Unresolved | Notch run, leaf widths, exact hinges, glazing operation and heights remain provisional | architecture.json; human evidence owner |
| D004 | Implemented and independently reviewed | Three roles, local Python governance checks, read-only independent assurance | User invoked structure-agentic-monorepo; bootstrap mission |

Research, generated images and draft missions are not accepted architecture. Update this register only when evidence or a decision changes, not on every task.

Known baseline issue P001 (open, outside governance scope): `validate()` does not currently enforce the kitchen-hinge/notch invariant that `walls()` asserts during build. A future geometry mission should move that check into validation with a negative test; until then run build checks as well as validate after changing notch/hinge fields. Reported by the independent forward test; do not weaken the build assertion.
