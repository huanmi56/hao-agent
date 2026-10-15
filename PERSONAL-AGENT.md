# Hao Agent

Hao Agent is a personal workflow extension built on PI-Desktop 0.20.1. The
desktop host remains the upstream PI-Desktop portable binary; this is not a
recompiled or independently signed desktop distribution. Its source fork lives
in this worktree on `feat/personal-agent`. LGPL-3.0 upstream attribution and
license files are retained.

## Start on Windows

1. Run `Hao-Agent.bat` from this directory. The portable host is under
   `distribution/pi-desktop`; its downloaded ZIP was checked against the GitHub
   release asset SHA-256 digest.
2. In Plugins, install `distribution/local.hao-agent-0.1.0.piplug`, or load the
   development folder `examples/plugins/hao-agent`. Review its six permissions.
   The extension does not request raw network, filesystem or session-history
   access. `agent.complete` can spend model quota; `desktop.control` can start
   permission-limited worker sessions.
3. In Settings > Models, use vendor sign-in for your ChatGPT subscription.
   Complete the provider's own browser consent. Do not paste ChatGPT cookies,
   access tokens or a password into the plugin. Select the account's actual
   `gpt-6-astra` binding. Availability depends on your plan and account.
4. Add OpenCode Go using the existing Go service preset and your subscription's
   Go key. Go API access is part of Go; this is not an OpenAI API key. Model
   discovery and credential storage are owned by PI-Desktop. Do not put keys
   in this repository, plugin settings or chat. No Zen prepaid-balance fallback
   is enabled by this extension; review your provider billing settings yourself.
5. Open the **Hao Agent** command, suggest models, inspect and save assignments.
   Enable the execution model for AI delegation in the host's Models settings.
   Nothing is silently enabled and no unavailable model is substituted.
6. Use an inexpensive Go model for the parent chat. Invoke `/hao-agent` and
   describe the task. The exact slash entry presentation follows the host's
   skill picker. The agent calls `hao_task` to plan, then advances ready work.

The launcher confines this profile's application data, Chromium profile,
plugin data, agent directory and temporary/cache directories to `distribution`
on D when this checkout is on D. Windows' credential store and OS bookkeeping
are still managed by Windows. It does not move existing Codex data or edit
system/user-wide environment variables. Always start through this launcher.

## Model roles

| Role | Initial preference | Behavior |
|---|---|---|
| Scheduler | Local code | Dependencies, checkpoints, deduplication and budgets; no model request |
| Decision | ChatGPT / GPT-6 Astra | One focused plan per coding job; low reasoning when supported |
| Execution | Go / Kimi K2.7 Code | Durable worker sessions; actual project tools and test commands |
| Report review | Go / GLM-5.3 | Different-family review of bounded worker reports |
| Text | Go / Qwen3.8 Flash | User-facing summary; direct writing tasks skip Astra |

These are initial workload choices, not measured speed/quality rankings on
your tasks. Suggestions use only the host's ready connected model catalog.
Account entitlements, regional access and model lists can change. Missing
roles remain unconfigured and fail visibly. The plugin cannot query your
remaining ChatGPT or Go subscription quota and never invents a balance.

References checked for this implementation:

- [OpenCode Go](https://opencode.ai/v2/docs/console/go/)
- [Sign in with ChatGPT](https://learn.chatgpt.com/docs/sign-in-with-chatgpt)
- [GPT-6 Astra](https://developers.openai.com/api/docs/models/gpt-6-astra)
- [PI-Desktop upstream](https://github.com/vastsa/PI-Desktop)

## Budget and correctness

- A coding job makes at most one planner completion, one report-review
  completion and one text completion. A failed completion still reserves its
  call. The host may retry transient provider failures inside a logical call;
  the limits are not caps on physical HTTP requests or subscription credits.
- Planner input is at most 12,000 request characters plus 6,000 context
  characters. Full transcripts are never included. Output length is requested
  in the prompt, not hard-capped by the current public plugin completion API.
- At most six planned tasks. At most two read-intent workers, and writers run
  alone. The host's existing permission ceiling remains authoritative. A
  planner's `writes:false` is an intent declaration, not a new OS read-only
  sandbox; workers must still obey their briefs and host permission prompts.
- Reviews assess reports. They do not independently inspect repository files
  and are not proof of security, correctness, deployment or acceptance.
- Provider rate limits, invalid plans, failed workers and missing verification
  pause the job. There is no automatic retry of the premium decision model.
- Saved state lives in host-owned private plugin settings. The worker transcript
  is host-owned. After restart, running workers retain their exact delivery IDs.
  An interrupted billed completion or uncertain dispatch pauses for inspection,
  rather than spending more quota or creating duplicate workers.
- Jobs are scoped to their parent session. Known workers cannot recursively
  orchestrate. Cancellation targets only this plugin's exact deliveries and
  retains worker sessions and history. Completed jobs do not rerun on repeated
  requests; change the brief for a new job.
- Worker execution tokens, tools and the parent session consume their normal
  provider quota outside the one-shot counters. Review duration and actual
  reported token usage are shown in task telemetry; worker usage stays in the
  host session UI.

## Development

No new desktop dependency or Rust toolchain is needed for this plugin-only
implementation. A fresh clone has no host build environment, so packaging
uses Node 24's TypeScript transform to run the repository's SDK/devkit checker
and store-only ZIP packer. This does not replace TypeScript typechecking.

```powershell
node --test examples/plugins/hao-agent/test/*.test.cjs
node scripts/build-hao-agent.mjs
node --test scripts/hao-agent-host.test.mjs
```

Rendered panel checks can use a preinstalled Playwright module and browser.
Set `HAO_PLAYWRIGHT_PATH` to the module directory and `HAO_BROWSER_PATH` to
the browser executable, then run `node --test scripts/hao-agent-panel.test.mjs`.
Its isolated browser profile and screenshots stay in `distribution/panel-tests`.
Screenshots use fixture accounts and are not evidence of actual sign-in.

No live model calls are made by those tests. Sign-in, actual account entitlements,
Go rate limits, real provider reliability and end-to-end paid execution require
your configured accounts and have not been asserted by mocked provider tests.

The original full application build instructions and all upstream features
remain in README.upstream.md. Do not enable upstream auto-updates as a substitute for
validating this extension against a newer host version.
