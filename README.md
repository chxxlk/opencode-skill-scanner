# opencode-skill-scanner

**OpenCode plugin** that automatically detects relevant skills from your conversation context and injects them into the system prompt — no manual skill-loading needed.

## How It Works

```
You type a message —→ Plugin scans your installed skills —→ Top 5 matches injected into system prompt
                           ↓
                   Skill descriptions scored
                   against your message text
```

Every time you send a message, the plugin:
1. **Captures** your latest text
2. **Scores** all installed skills using keyword + reverse-word matching
3. **Injects** the top 5 matching skills into the system prompt as `## Relevant Skills`

The model sees the injected skills and can use their instructions without you having to explicitly `skill("name")` them.

## Installation

### Via npm (recommended)

```json
// opencode.json
{
  "plugin": ["opencode-skill-scanner"]
}
```

### Local install

Clone or download, then:

```json
// opencode.json
{
  "plugin": ["./path/to/opencode-skill-scanner/skill-scanner.ts"]
}
```

### Auto-discovery

Or just drop `skill-scanner.ts` into `.opencode/plugin/` or `.opencode/plugins/` — OpenCode auto-discovers plugins in those directories.

## What It Scans

The plugin looks for `SKILL.md` files in these locations:

| Scope | Path |
|---|---|
| Project | `.opencode/skills/` |
| Project (alt) | `.opencode/skill/` |
| Global | `~/.config/opencode/skills/` |
| Agents | `~/.agents/skills/` |
| Claude Code | `~/.claude/skills/` |

All installed skills are indexed at plugin init and matched on every message.

## Scoring Algorithm

| Signal | Weight | Example |
|---|---|---|
| Skill name in your message | **+10** | saying "react" matches react-specialist |
| Keywords from description | **+2 each** | "security audit" matches security-auditor |
| Your words in description | **+2 each** | "docker build deploy" in message matches docker-expert |

Results are capped at the **top 5** skills per turn to keep the prompt lean.

## Debugging

Logs are written to `/tmp/opencode-skill-scanner.log`:

```
2026-05-21T12:34:56.789Z [skill-scanner] Loaded 139 skills
2026-05-21T12:34:58.123Z [skill-scanner] Injected: react-specialist, typescript-pro, frontend-developer
```

Tail them live:

```bash
tail -f /tmp/opencode-skill-scanner.log
```

## Requirements

- OpenCode with `experimental.chat.messages.transform` and `experimental.chat.system.transform` hook support (OpenCode 0.x+)
- Skills installed via [awesome-opencode-skills](https://github.com/jshsakura/awesome-opencode-skills) or any `SKILL.md` files

## License

MIT
