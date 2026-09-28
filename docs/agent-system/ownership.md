# Routing and seams
`catalog.json` is the only path-route source. Patterns are case-sensitive repository-relative POSIX strings evaluated by Python fnmatch.fnmatchcase on the whole string. `*` crosses slashes, and `**` has the same matching behavior; there are no negations or first-match rules. Reject absolute/traversal paths. Exactly one route must match each governed file. An unknown/new route is an integration blocker, not permission to skip review.

All current routes have unconditional reviewers (`always`). `contract_change` is reserved vocabulary, not a reviewer exemption. Each route has one concrete fixture; contract changes still receive all unconditional reviewers. Reviewer requests are one bounded review per mission, not mandatory subagent spawning for every small edit.

The resolved-geometry-v1 seam has geometry as steward and rendering as consumer. Assurance audits the integration. Generated artifacts have rendering stewardship but geometry review because they encode physical claims. Test stewardship is assurance; implementation fixes are made by geometry/rendering or the integrator because assurance's profile is read-only.
