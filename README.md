<p align="center">
  <img src="./assets/banner.png" alt="auto-startup" width="100%" />
</p>

<p align="center">
  <strong>Run Claude Code like a company</strong> — organize AI agents by role, run them with one command.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/auto-startup"><img src="https://img.shields.io/npm/v/auto-startup.svg" alt="npm version" /></a>
  <a href="https://github.com/vibemafiaclub/auto-startup/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/auto-startup.svg" alt="license" /></a>
</p>

---

## The Problem

Claude Code supports subagents, skills, hooks, MCP, and settings.
But there's **no way to bundle them per role.**

A frontend developer needs a different setup than a backend developer.
If you're manually combining CLI flags or copying configs every time — that's what auto-startup solves.

## The Solution

**Agent = Role bundle.**
System prompt + subagents + skills + hooks + MCP — all in one unit.

```bash
auto-startup run backend-dev "Optimize the slow query"
# → runs with db-expert subagent, deploy skill, backend-dev prompt
```

`.auto-startup/` is committed to git. Your entire team shares the same agent setup.

## Features

- **Role-based execution**: `auto-startup run <agent>` — one command switches everything
- **Daemon mode**: Ticket-based async task processing with agent workers
- **GitHub Webhook**: PR comment → auto ticket → agent handles it
- **Team sharing**: Commit `.auto-startup/` and sync the whole team

## Quick Start

```bash
npm install -g auto-startup
auto-startup init
auto-startup run developer "Fix the login bug"
```

> Requires [Claude Code](https://docs.anthropic.com/en/docs/claude-code) CLI installed and authenticated.

## Documentation

| Guide | Description |
|---|---|
| [Getting Started](docs/getting-started.md) | Install, init, first agent run |
| [CLI Reference](docs/cli-reference.md) | All commands and options |
| [Daemon Mode](docs/daemon-mode.md) | Ticket server, agent workers |
| [GitHub Webhook](docs/webhook-integration.md) | PR automation setup |
| [Configuration](docs/configuration.md) | config.json, agent.json schema |

## License

MIT
