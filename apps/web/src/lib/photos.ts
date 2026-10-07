/**
 * Every photograph on the site goes through here, keyed by a stable seed that names a
 * file in `public/photos`. Pages only ever ask for a seed, so replacing the photography
 * never means a hunt through every page.
 */
export function photo(seed: string): string {
  return `/photos/${seed}.webp`
}
