# opencode-skill-scanner

**OpenCode plugin** that automatically detects relevant skills from your conversation context and injects them into the system prompt — no manual `skill("name")` needed.

## How It Works

```
You type a message —→ Plugin scans your installed skills —→ Top 5 matches injected into system prompt
                           ↓
                   Skill descriptions scored
                   against your message text
```

Every message turn:
1. **Captures** your latest text
2. **Scores** all installed skills by keyword + reverse-word matching
3. **Injects** the top 5 matches into the system prompt as `## Relevant Skills`

The model sees the injected skills and can use their instructions automatically — no manual skill-loading required.

## Installation

### Auto-discover (easiest)

Drop `skill-scanner.ts` into your project's `.opencode/plugin/` or `.opencode/plugins/` directory — OpenCode loads it automatically.

### From GitHub (recommended)

```json
// opencode.json
{
  "plugin": ["https://raw.githubusercontent.com/chxxlk/opencode-skill-scanner/main/skill-scanner.ts"]
}
```

### Local clone

```bash
git clone https://github.com/chxxlk/opencode-skill-scanner.git
```

Then in `opencode.json`:

```json
{
  "plugin": ["./path/to/opencode-skill-scanner/skill-scanner.ts"]
}
```

## What It Scans

The plugin looks for `SKILL.md` files in these locations:

| Scope | Path |
|---|---|
| Project | `.opencode/skills/` |
| Project (alt) | `.opencode/skill/` |
| Global | `~/.config/opencode/skills/` |
| Agents | `~/.agents/skills/` |
| Claude Code | `~/.claude/skills/` |

All installed skills are indexed once at plugin init and scored on every message.

## Scoring Algorithm

| Signal | Weight | Example |
|---|---|---|
| Skill name in your message | **+10** | saying "react" matches react-specialist |
| Keywords from description | **+2 each** | "security audit" matches security-auditor |
| Your words in description | **+2 each** | "docker build deploy" → docker-expert |

Capped at **top 5** per turn to keep the prompt lean.

## See What Was Injected

Ask in chat at any time:

```
What skills were injected?
```

The plugin exposes a `last_injected_skills` tool that returns the last matched skills, their scores, and what message triggered them — visible right in your conversation.

## Debugging

Logs are written to `/tmp/opencode-skill-scanner.log`:

```
2026-05-21T12:34:56.789Z [skill-scanner] Loaded 139 skills
2026-05-21T12:34:58.123Z [skill-scanner] Injected: react-specialist, typescript-pro, frontend-developer
```

Tail live:

```bash
tail -f /tmp/opencode-skill-scanner.log
```

## Requirements

- OpenCode with `experimental.chat.messages.transform` and `experimental.chat.system.transform` hook support
- Skills installed (e.g., via [awesome-opencode-skills](https://github.com/jshsakura/awesome-opencode-skills) or any `SKILL.md` files)

## License

MIT
