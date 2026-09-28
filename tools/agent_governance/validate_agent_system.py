#!/usr/bin/env python3
"""Validate a scaffolded or customized agent-team operating system."""

from __future__ import annotations

import argparse
import json
import re
import sys
import tomllib
from fnmatch import fnmatchcase
from pathlib import Path, PurePosixPath


HEADINGS = (
    "## Mission",
    "## Stewardship",
    "## Decision rights",
    "## Non-responsibilities",
    "## Inputs",
    "## Outputs",
    "## Required collaboration",
    "## Quality bar",
    "## Escalate when",
)
REQUIRED_AGENT_FIELDS = ("name", "description", "developer_instructions")
ALLOWED_AGENT_FIELDS = {
    *REQUIRED_AGENT_FIELDS,
    "sandbox_mode",
    "model",
    "model_reasoning_effort",
    "mcp_servers",
    "skills",
}
SANDBOX_MODES = {"read-only", "workspace-write", "danger-full-access"}
SECRET_PATTERNS = (
    re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----"),
    re.compile(r"\bgh[pousr]_[A-Za-z0-9]{20,}\b"),
    re.compile(r"\bsk-[A-Za-z0-9_-]{20,}\b"),
    re.compile(r"\bAKIA[A-Z0-9]{16}\b"),
)


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("target", type=Path, help="Repository root to validate")
    return parser.parse_args(argv)


def strings(value: object, label: str, errors: list[str]) -> list[str]:
    if not isinstance(value, list):
        errors.append(f"{label}: must be a list")
        return []
    result: list[str] = []
    for item in value:
        if not isinstance(item, str) or not item:
            errors.append(f"{label}: values must be non-empty strings")
            continue
        result.append(item)
    if len(result) != len(set(result)):
        errors.append(f"{label}: duplicate values are not allowed")
    return result


def safe_path(root: Path, value: object, label: str, errors: list[str]) -> Path | None:
    if not isinstance(value, str) or not value:
        errors.append(f"{label}: must be a non-empty relative path")
        return None
    pure = PurePosixPath(value)
    if pure.is_absolute() or ".." in pure.parts or "\\" in value:
        errors.append(f"{label}: unsafe path {value!r}")
        return None
    path = root / value
    if not path.resolve().is_relative_to(root):
        errors.append(f"{label}: path escapes repository {value!r}")
        return None
    return path


def parse_toml(path: Path, errors: list[str]) -> dict[str, object]:
    try:
        data = tomllib.loads(path.read_text(encoding="utf-8"))
    except (OSError, tomllib.TOMLDecodeError) as exc:
        errors.append(f"{path}: invalid TOML: {exc}")
        return {}
    return data


def validate_agent(
    root: Path,
    value: object,
    expected_name: object,
    expected_sandbox: object,
    names: set[str],
    paths: set[Path],
    errors: list[str],
    independent_review: object = False,
) -> None:
    path = safe_path(root, value, "agent profile", errors)
    if path is None:
        return
    paths.add(path)
    if not path.is_file():
        errors.append(f"missing agent profile {path.relative_to(root)}")
        return
    raw = path.read_text(encoding="utf-8")
    data = parse_toml(path, errors)
    for field in REQUIRED_AGENT_FIELDS:
        if not isinstance(data.get(field), str) or not str(data[field]).strip():
            errors.append(f"{path.relative_to(root)}: missing {field}")
    unknown = sorted(set(data) - ALLOWED_AGENT_FIELDS)
    if unknown:
        errors.append(f"{path.relative_to(root)}: unsupported agent fields {unknown}")
    name = data.get("name")
    if name != expected_name:
        errors.append(
            f"{path.relative_to(root)}: name {name!r} does not match "
            f"catalog {expected_name!r}"
        )
    if isinstance(name, str):
        if name in names:
            errors.append(f"duplicate agent name {name!r}")
        names.add(name)
    sandbox = data.get("sandbox_mode")
    if not isinstance(independent_review, bool):
        errors.append(f"{path.relative_to(root)}: independent_review must be a boolean")
    if (independent_review is True or expected_name in (
        "adversarial_reviewer", "domain_reviewer"
    )) and sandbox != "read-only":
        errors.append(f"{path.relative_to(root)}: independent reviewer must be read-only")
    if sandbox not in SANDBOX_MODES:
        errors.append(f"{path.relative_to(root)}: invalid sandbox_mode {sandbox!r}")
    if sandbox != expected_sandbox:
        errors.append(
            f"{path.relative_to(root)}: sandbox_mode {sandbox!r} does not match "
            f"catalog {expected_sandbox!r}"
        )
    if any(pattern.search(raw) for pattern in SECRET_PATTERNS):
        errors.append(f"{path.relative_to(root)}: possible embedded secret")


def resolve_dynamic(
    reviewer: str,
    fixture: dict[str, object],
    capability_teams: dict[str, str],
    label: str,
    errors: list[str],
) -> set[str]:
    if reviewer not in {"$affected_capability_teams", "$affected_application_team"}:
        errors.append(
            f"{label}: add a repository-native resolver for dynamic reviewer {reviewer}"
        )
        return set()
    capabilities = strings(
        fixture.get("affected_capabilities"),
        f"{label} affected_capabilities",
        errors,
    )
    result: set[str] = set()
    for capability in capabilities:
        team = capability_teams.get(capability)
        if team is None:
            errors.append(f"{label}: capability {capability!r} has no team")
        else:
            result.add(team)
    if not result:
        errors.append(f"{label}: dynamic reviewer {reviewer} resolved to no teams")
    return result


def validate_routes(
    catalog: dict[str, object],
    team_ids: set[str],
    capability_teams: dict[str, str],
    errors: list[str],
) -> int:
    triggers = set(strings(catalog.get("review_triggers"), "review_triggers", errors))
    dynamic = set(
        strings(catalog.get("dynamic_reviewers"), "dynamic_reviewers", errors)
    )
    if "always" not in triggers:
        errors.append("review_triggers must include always")
    for reviewer in dynamic:
        if not reviewer.startswith("$"):
            errors.append(f"dynamic reviewer {reviewer!r} must begin with '$'")

    values = catalog.get("path_ownership")
    if not isinstance(values, list) or not values:
        errors.append("path_ownership must be a non-empty list")
        return 0
    routes: dict[str, dict[str, object]] = {}
    patterns: dict[str, list[str]] = {}
    for route in values:
        if not isinstance(route, dict):
            errors.append("path_ownership entries must be objects")
            continue
        route_id = route.get("id")
        if not isinstance(route_id, str) or not route_id:
            errors.append("path route requires a non-empty id")
            continue
        if route_id in routes:
            errors.append(f"duplicate path route {route_id!r}")
        routes[route_id] = route
        if route.get("primary_team") not in team_ids:
            errors.append(f"route {route_id}: unknown primary team")
        route_patterns = strings(route.get("paths"), f"route {route_id} paths", errors)
        for pattern in route_patterns:
            pure = PurePosixPath(pattern)
            if (
                pure.is_absolute()
                or ".." in pure.parts
                or "|" in pattern
                or "\\" in pattern
                or pattern.endswith("/")
            ):
                errors.append(f"route {route_id}: invalid path glob {pattern!r}")
        patterns[route_id] = route_patterns
        used: set[str] = set()
        rules = route.get("review_rules")
        if not isinstance(rules, list):
            errors.append(f"route {route_id}: review_rules must be a list")
            continue
        for rule in rules:
            if not isinstance(rule, dict):
                errors.append(f"route {route_id}: review rules must be objects")
                continue
            when = rule.get("when")
            if when not in triggers:
                errors.append(f"route {route_id}: unknown trigger {when!r}")
            if isinstance(when, str):
                if when in used:
                    errors.append(f"route {route_id}: duplicate trigger {when!r}")
                used.add(when)
            for reviewer in strings(
                rule.get("reviewers"),
                f"route {route_id} reviewers",
                errors,
            ):
                if reviewer not in team_ids and reviewer not in dynamic:
                    errors.append(f"route {route_id}: unknown reviewer {reviewer!r}")

    fixtures = catalog.get("routing_fixtures")
    if not isinstance(fixtures, list) or not fixtures:
        errors.append("routing_fixtures must be a non-empty list")
        return len(routes)
    covered: set[str] = set()
    for index, fixture in enumerate(fixtures):
        label = f"routing fixture {index + 1}"
        if not isinstance(fixture, dict):
            errors.append(f"{label}: must be an object")
            continue
        route_id = fixture.get("route")
        path = fixture.get("path")
        if route_id not in routes:
            errors.append(f"{label}: unknown route {route_id!r}")
            continue
        covered.add(str(route_id))
        if not isinstance(path, str) or any(character in path for character in "*?[|\\"):
            errors.append(f"{label}: path must be concrete")
            continue
        matching = [
            candidate
            for candidate, route_patterns in patterns.items()
            if any(fnmatchcase(path, pattern) for pattern in route_patterns)
        ]
        if matching != [route_id]:
            errors.append(f"{label}: path matches {matching}, expected only {route_id!r}")
        active = set(strings(fixture.get("triggers"), f"{label} triggers", errors))
        if active - triggers:
            errors.append(f"{label}: unknown triggers {sorted(active - triggers)}")
        actual: set[str] = set()
        for rule in routes[str(route_id)].get("review_rules", []):
            if not isinstance(rule, dict):
                continue
            if rule.get("when") == "always" or rule.get("when") in active:
                for reviewer in rule.get("reviewers", []):
                    if reviewer in dynamic:
                        actual.update(
                            resolve_dynamic(
                                reviewer,
                                fixture,
                                capability_teams,
                                label,
                                errors,
                            )
                        )
                    elif isinstance(reviewer, str):
                        actual.add(reviewer)
        expected = set(strings(fixture.get("reviewers"), f"{label} reviewers", errors))
        if any(reviewer not in team_ids for reviewer in expected):
            errors.append(f"{label}: expected reviewers must be concrete teams")
        if actual != expected:
            errors.append(
                f"{label}: reviewers {sorted(actual)} do not match "
                f"{sorted(expected)}"
            )
        if fixture.get("primary_team") != routes[str(route_id)].get("primary_team"):
            errors.append(f"{label}: primary team does not match route")
    missing = set(routes) - covered
    if missing:
        errors.append(f"routes without fixtures: {sorted(missing)}")
    return len(routes)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    root = args.target.resolve()
    errors: list[str] = []
    catalog_path = root / "docs" / "agent-system" / "catalog.json"
    try:
        catalog = json.loads(catalog_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        print(f"ERROR: invalid or missing catalog: {exc}", file=sys.stderr)
        return 2
    if not isinstance(catalog, dict):
        print("ERROR: catalog root must be an object", file=sys.stderr)
        return 2
    if catalog.get("schema_version") != "agent-team-catalog.v1":
        errors.append("unsupported catalog schema_version")

    teams = catalog.get("teams")
    if not isinstance(teams, list) or not teams:
        errors.append("teams must be a non-empty list")
        teams = []
    ids: set[str] = set()
    agent_names: set[str] = set()
    catalogued_agents: set[Path] = set()
    marker = chr(96)
    for team in teams:
        if not isinstance(team, dict):
            errors.append("team entries must be objects")
            continue
        team_id = team.get("id")
        if not isinstance(team_id, str) or not team_id:
            errors.append("team missing non-empty id")
            continue
        if team_id in ids:
            errors.append(f"duplicate team id {team_id!r}")
        ids.add(team_id)
        charter_value = team.get("charter")
        if isinstance(charter_value, str) and charter_value.startswith("teams/"):
            charter_value = f"docs/agent-system/{charter_value}"
        charter = safe_path(root, charter_value, f"team {team_id} charter", errors)
        if charter is None or not charter.is_file():
            if charter is not None:
                errors.append(f"{team_id}: missing charter {charter.relative_to(root)}")
        else:
            text = charter.read_text(encoding="utf-8")
            if f"Team ID: {marker}{team_id}{marker}" not in text:
                errors.append(f"{charter.relative_to(root)}: Team ID mismatch")
            if f"Agent: {marker}{team.get('agent_name')}{marker}" not in text:
                errors.append(f"{charter.relative_to(root)}: Agent mismatch")
            for heading in HEADINGS:
                if heading not in text:
                    errors.append(f"{charter.relative_to(root)}: missing {heading}")
        validate_agent(
            root,
            team.get("agent"),
            team.get("agent_name"),
            team.get("sandbox_mode"),
            agent_names,
            catalogued_agents,
            errors,
            team.get("independent_review", False),
        )

    coordination = catalog.get("coordination_agents")
    if not isinstance(coordination, list):
        errors.append("coordination_agents must be a list")
        coordination = []
    for entry in coordination:
        if not isinstance(entry, dict):
            errors.append("coordination agent entries must be objects")
            continue
        validate_agent(
            root,
            entry.get("agent"),
            entry.get("agent_name"),
            entry.get("sandbox_mode"),
            agent_names,
            catalogued_agents,
            errors,
            entry.get("independent_review", False),
        )
    actual_agents = set((root / ".codex" / "agents").glob("*.toml"))
    for path in sorted(actual_agents - catalogued_agents):
        errors.append(f"uncatalogued agent {path.relative_to(root)}")

    capability_teams: dict[str, str] = {}
    capabilities = catalog.get("capabilities")
    if not isinstance(capabilities, list) or not capabilities:
        errors.append("capabilities must be a non-empty list")
        capabilities = []
    for capability in capabilities:
        if not isinstance(capability, dict):
            errors.append("capability entries must be objects")
            continue
        capability_id = capability.get("id")
        team = capability.get("team")
        if not isinstance(capability_id, str) or not capability_id:
            errors.append("capability requires a non-empty id")
        elif capability_id in capability_teams:
            errors.append(f"duplicate capability id {capability_id!r}")
        elif team not in ids:
            errors.append(f"capability {capability_id!r}: unknown team {team!r}")
        elif isinstance(team, str):
            capability_teams[capability_id] = team

    route_count = validate_routes(catalog, ids, capability_teams, errors)

    for relative in strings(
        catalog.get("required_artifacts"), "required_artifacts", errors
    ):
        path = safe_path(root, relative, "required artifact", errors)
        if path is not None and not path.is_file():
            errors.append(f"missing required artifact {relative}")

    agents_file = root / "AGENTS.md"
    if not agents_file.is_file():
        errors.append("missing root AGENTS.md; integrate AGENTS.agent-team.fragment.md")
    else:
        text = agents_file.read_text(encoding="utf-8")
        if "## Agent-team operating model" not in text:
            errors.append("root AGENTS.md is missing the agent-team router")
        if len(text.encode("utf-8")) > 24 * 1024:
            errors.append("root AGENTS.md exceeds the 24 KiB skill budget")
    config = parse_toml(root / ".codex" / "config.toml", errors)
    agents_config = config.get("agents")
    if not isinstance(agents_config, dict) or agents_config.get("enabled") is not True:
        errors.append(".codex/config.toml must enable agents")

    if errors:
        for error in sorted(set(errors)):
            print(f"ERROR: {error}", file=sys.stderr)
        return 1
    print(
        f"Agent system valid: {len(ids)} teams, {len(agent_names)} agents, "
        f"{len(capability_teams)} capabilities and {route_count} routes."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
