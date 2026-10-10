import type { StampPreset } from './schemas/card'

/**
 * The built-in stamp glyphs as SVG path data on a 24×24 grid.
 *
 * Drawn as 2px strokes with round caps, so they stay legible at the 14px of a wallet
 * strip and at the 24px of the web card alike. Kept here, not in a UI package, because
 * the wallet images are rendered on the server without React.
 */
export const STAMP_ICON_PATHS: Record<StampPreset, string> = {
  coffee: 'M17 8h1a4 4 0 1 1 0 8h-1M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4ZM6 2v2M10 2v2M14 2v2',
  burger:
    'M4 10a8 5 0 0 1 16 0ZM3 14h18M4 17h16a2 2 0 0 1-2 3H6a2 2 0 0 1-2-3ZM8 7h.01M12 6h.01M16 7h.01',
  pizza:
    'M15 11h.01M11 15h.01M16 16h.01M2 16l20 6-6-20A20 20 0 0 0 2 16M5.71 17.11a17.04 17.04 0 0 1 11.4-11.4',
  'ice-cream': 'M7 11a5 5 0 0 1 10 0v1H7ZM7 12l5 10 5-10M9 7a3 3 0 0 1 6 0',
  scissors:
    'M6 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM20 4 8.12 15.88M14.47 14.48 20 20M8.12 9.12 12 13',
  nail: 'M10 2h4v5h-4ZM7 10a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2ZM7 14h10',
  dumbbell: 'M3 9v6M6 6v12M6 12h12M18 6v12M21 9v6',
  paw: 'M9 4a2 2 0 1 0 4 0 2 2 0 1 0-4 0M16 7a2 2 0 1 0 4 0 2 2 0 1 0-4 0M4 9a2 2 0 1 0 4 0 2 2 0 1 0-4 0M18 15a2 2 0 1 0 4 0 2 2 0 1 0-4 0M9 11a4 4 0 0 1 6 0l2 3a3 3 0 0 1-2.5 4.6h-5A3 3 0 0 1 7 14Z',
  car: 'M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2M7 17a2 2 0 1 0 4 0 2 2 0 1 0-4 0M15 17a2 2 0 1 0 4 0 2 2 0 1 0-4 0M9 17h6',
  heart:
    'M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z',
  star: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z',
  leaf: 'M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10ZM2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12',
}

/** The slot that unlocks a reward, before it is reached. */
export const GIFT_ICON_PATH =
  'M20 12v10H4V12M2 7h20v5H2zM12 22V7M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z'

export const CHECK_ICON_PATH = 'M20 6 9 17l-5-5'

/** Path data for a stamp icon; emoji and custom images have none and fall back to a preset. */
export function stampIconPath(
  icon: { kind: 'preset'; value: StampPreset } | { kind: 'emoji' | 'image'; value: string },
  fallback: StampPreset = 'star',
): string {
  return icon.kind === 'preset' ? STAMP_ICON_PATHS[icon.value] : STAMP_ICON_PATHS[fallback]
}
