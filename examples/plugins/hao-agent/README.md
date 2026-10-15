# Hao Agent Workbench

A personal PI-Desktop extension with four model roles and a deterministic
scheduler. Setup, architecture, limits and verification are documented in
[`PERSONAL-AGENT.md`](../../../PERSONAL-AGENT.md).

The main session invokes `hao_task` through the `hao-agent` skill. The panel
only configures connected model bindings and displays job summaries; it cannot
spawn workers or send agent prompts. All model calls reuse host authentication.

Run tests with `node --test test/*.test.cjs` in this directory. No provider
credentials or paid model requests are used in tests.
