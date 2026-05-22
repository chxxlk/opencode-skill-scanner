import type { Plugin } from "@opencode-ai/plugin"
import * as fs from "fs"
import * as path from "path"

interface SkillInfo {
  name: string
  description: string
  content: string
  keywords: string[]
  descLower: string
}

const LOG_FILE = "/tmp/opencode-skill-scanner.log"

function log(msg: string) {
  try { fs.appendFileSync(LOG_FILE, `${new Date().toISOString()} ${msg}\n`) } catch {}
}

/**
 * Extract meaningful keywords from a skill's description text.
 * Filters to words > 3 chars and deduplicates.
 */
function extractKeywords(text: string): string[] {
  return [...new Set(text.toLowerCase().split(/[\s,;:.()]+/).filter(t => t.length > 3))]
}

/**
 * Strip DCP metadata tags and punctuation for clean text matching.
 */
function cleanText(text: string): string {
  return text.replace(/m\d+<\/dcp-message>/gi, "").replace(/[^a-z0-9\s]/gi, " ").toLowerCase()
}

/**
 * Score a skill's relevance against the user's last message.
 *
 * Scoring strategy:
 *  - +10  exact (substring) match on skill name
 *  - +2   per keyword from skill description found in user text
 *  - +2   per unique user word (>3 chars) found in skill description
 */
function scoreSkill(skill: SkillInfo, userText: string): number {
  const lower = cleanText(userText)
  let score = 0

  for (const kw of skill.keywords) {
    if (lower.includes(kw)) score += 2
  }

  if (lower.includes(skill.name.toLowerCase())) score += 10

  const words = [...new Set(lower.split(/\s+/).filter(w => w.length > 3))]
  for (const w of words) {
    if (skill.descLower.includes(w)) score += 2
  }

  return score
}

/**
 * Recursively scan skill directories for SKILL.md files,
 * parse their frontmatter, and build a skill index.
 */
function scanSkills(dirs: string[]): SkillInfo[] {
  const skills: SkillInfo[] = []
  const seen = new Set<string>()

  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue
    const walk = (d: string) => {
      for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
        const full = path.join(d, entry.name)
        if (entry.isDirectory()) { walk(full); continue }
        if (entry.name !== "SKILL.md") continue
        try {
          const content = fs.readFileSync(full, "utf-8")
          const fm = content.match(/^---\n([\s\S]*?)\n---/)
          if (!fm) continue
          const name = fm[1].match(/name:\s*(.+)/)?.[1]?.trim()
          const desc = fm[1].match(/description:\s*(.+)/)?.[1]?.trim()
          if (name && desc && !seen.has(name)) {
            seen.add(name)
            skills.push({
              name,
              description: desc,
              content,
              keywords: extractKeywords(desc),
              descLower: desc.toLowerCase(),
            })
          }
        } catch {}
      }
    }
    walk(dir)
  }
  return skills
}

export default (async ({ directory }) => {
  const home = process.env.HOME || ""
  const allSkills = scanSkills([
    // Project-level skills
    path.join(directory, ".opencode", "skills"),
    path.join(directory, ".opencode", "skill"),
    // Global skills
    path.join(home, ".config", "opencode", "skills"),
    path.join(home, ".agents", "skills"),
    path.join(home, ".claude", "skills"),
  ])

  log(`[skill-scanner] Loaded ${allSkills.length} skills`)
  if (!allSkills.length) return {}

  let lastUserText = ""
  let lastInjected: { name: string; score: number; description: string }[] = []

  return {
    /**
     * experimental.chat.messages.transform
     * Extracts the user's latest text from the message parts.
     * Runs on every message turn.
     */
    "experimental.chat.messages.transform": async (_input, output) => {
      try {
        const msgs = (output as any).messages
        if (!msgs?.length) return
        for (let i = msgs.length - 1; i >= 0; i--) {
          const parts = msgs[i]?.parts
          if (!parts?.length) continue
          for (const part of parts) {
            if (part.type === "text" && part.text?.trim()) {
              lastUserText = part.text
              return
            }
          }
        }
      } catch {}
    },

    /**
     * experimental.chat.system.transform
     * Scores all known skills against the last user text,
     * injects the top 5 matching skills into the system prompt.
     */
    "experimental.chat.system.transform": async (_input, output) => {
      try {
        if (!lastUserText) return
        const sys = (output as any).system
        if (!Array.isArray(sys)) return

        const scored = allSkills
          .map(s => ({ s, score: scoreSkill(s, lastUserText) }))
          .filter(x => x.score > 0)
          .sort((a, b) => b.score - a.score)
          .slice(0, 5)

        if (!scored.length) return

        lastInjected = scored.map(x => ({
          name: x.s.name,
          score: x.score,
          description: x.s.description,
        }))

        const block = [
          "## Relevant Skills",
          ...scored
            .map(({ s }) => ({
              name: s.name,
              description: s.description,
              content: s.content.replace(/^---\n[\s\S]*?\n---\n?/, "").trim(),
            }))
            .map(
              ({ name, description, content }) =>
                `### ${name}\n${description}\n\n${content}`
            ),
        ].join("\n\n---\n\n")

        sys.push(block)
        log(`[skill-scanner] Injected: ${scored.map(x => x.s.name).join(", ")}`)
      } catch (e: any) {
        log(`[skill-scanner] Error: ${e.message}`)
      }
    },

    tool: {
      last_injected_skills: {
        description: "Show which skills were last auto-injected by the skill-scanner plugin and why",
        inputSchema: { type: "object", properties: {} },
        execute: async () => {
          const text = lastUserText || "(none yet)"
          if (!lastInjected.length) {
            return `No skills matched for your last message.\n\nTriggered by: "${text}"`
          }
          const lines = lastInjected.map((s, i) =>
            `  ${i + 1}. **${s.name}** (score: ${s.score}) — ${s.description}`
          )
          return [
            `**Last injected skills:**`,
            ...lines,
            ``,
            `Triggered by: "${text}"`,
          ].join("\n")
        },
      },
    },
  }
}) satisfies Plugin
