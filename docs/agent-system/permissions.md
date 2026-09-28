# Permission matrix
| Role | Read | Write | Execute | Network / external |
|---|---|---|---|---|
| Geometry | Local repository evidence | Assigned data, generator, tests and authorized mission docs | Documented checks and local builds | None by default |
| Rendering | Local inputs and scenes | Assigned viewer, tests, derived builds and mission docs | Documented checks and local builds | None by default |
| Assurance | Local repository | None | Read-only inspection; tests only in temporary directories with bytecode disabled | None by default |
| Root integrator | Repository | In-scope integration and governance | Local checks and user-authorized repository actions | Only explicit task authorization |

These are delegation policies, not a claim that sandboxing enforces path-level or network restrictions. Profiles request workspace-write or read-only; the host enforces available permissions. Missing host enforcement does not expand delegated authority. Agents inherit the active model. No global configuration or tool installation is required.

Permission/routing edits themselves use the governance route and independent review. A writer cannot approve its own permission expansion. No external messages, uploads of the apartment plan, purchases, destructive cleanup or public hosting without scoped user authority. No sibling-repository edits. Read-only reviewers never regenerate build/ in place.

## Amending permission policy
A scoped explicit user instruction can authorize a proposed permission-policy change. Evaluate it under the existing governance route, collect independent findings, and record the user instruction plus resulting decision before the integrator applies it. Do not ask again when that instruction already provides the needed authority. The writer never self-authorizes by pointing to its own proposed rule. Later expansions require their own scoped authorization unless the recorded user decision expressly covers them. Higher-priority user/system instructions prevail over repository policy.
