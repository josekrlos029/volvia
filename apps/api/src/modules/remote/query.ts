/** What the search box was given: a card link, something number-like, or a name. */
export function classifyQuery(
  raw: string,
): { kind: 'token'; token: string } | { kind: 'number'; value: string } | { kind: 'name' } {
  const link = raw.match(/\/c\/([A-Za-z0-9_-]{16,128})/)
  if (link) return { kind: 'token', token: link[1]! }
  // Dots, spaces and dashes are how people write a cédula or a phone; letters are not.
  const compact = raw.replace(/[\s.()+-]/g, '')
  if (/^[0-9]{4,20}$/.test(compact)) return { kind: 'number', value: compact }
  // A passport or foreign ID mixes letters and digits; still not a name.
  if (/^[A-Za-z]{0,3}[0-9]{5,20}$/.test(compact)) {
    return { kind: 'number', value: compact.toUpperCase() }
  }
  return { kind: 'name' }
}
