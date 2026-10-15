# Personal Hao Agent workflow

This opt-in local plugin composes the existing `models.list`, `agent.complete`
and authenticated session collaboration APIs. It changes no core protocol,
credential ownership, permission defaults or database schema.

- One Astra decision call per coding job, Go execution sessions, Go report
  review and Go text output. Explicit text jobs bypass the decision role.
- Models are selected from ready host bindings. Decision requires the exact
  `gpt-6-astra` model; other roles require an OpenCode Go provider. Execution
  requires per-model delegation opt-in. No silent fallback or extra-credit use.
- Planner tasks form a validated DAG of at most six nodes. Writers are
  serialized. At most two declared-read workers run concurrently; read intent
  does not override host tool permissions or imply OS sandbox enforcement.
- Calls reserve persisted per-job budgets before crossing the paid boundary.
  Dedupe and exact delivery IDs prevent accidental repeat requests. A paused
  request never automatically re-enters a billed completion after restart.
- Parent-session ownership and a worker recursion check scope control. Panel
  channels cannot execute tasks. Unload prevents subsequent dispatch.
- Review failures or verification gaps withhold the final success summary.
  A completed workflow means reviewed reports, not independently verified work.
- Public completion API deadlines and provider retries remain unchanged. Output
  token constraints remain prompt requests because the API has no hard cap.
- The personal launcher uses D-local profile, cache and temp roots without
  changing the installed Codex app or any global environment settings.

Validation: plugin public-interface workflow tests, actual repository devkit
manifest/package validation and an isolated native host package-install test.
Real provider execution is an explicit manual acceptance step after sign-in.
