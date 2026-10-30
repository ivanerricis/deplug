export const MAX_EXCLUSIONS = 50
export const MAX_EXCLUSION_LENGTH = 100

/** Trims, drops empty, over-long and duplicate (case-insensitive) patterns and caps the list. */
export function normalizeExclusions(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const item of value) {
    if (typeof item !== "string") continue
    const pattern = item.trim()
    if (pattern === "" || [...pattern].length > MAX_EXCLUSION_LENGTH) continue
    const key = pattern.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(pattern)
    if (out.length === MAX_EXCLUSIONS) break
  }
  return out
}

function patternToRegExp(pattern: string): RegExp {
  const body = pattern
    .toLowerCase()
    .split("*")
    .map(part => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*")
  return new RegExp(`^${body}$`, "s")
}

/**
 * Builds a predicate for names (a plugin bundle or a single folder name, never a full path).
 * A pattern matches the whole name, case-insensitively; `*` stands for any run of characters.
 */
export function createExcludeMatcher(patterns: readonly string[] | undefined): (name: string) => boolean {
  const regexes = normalizeExclusions(patterns ?? []).map(patternToRegExp)
  if (regexes.length === 0) return () => false
  return name => {
    const lower = name.toLowerCase()
    return regexes.some(re => re.test(lower))
  }
}
