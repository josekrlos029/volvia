import type { BannerPattern, CardBanner, StampStyle } from '@volvia/shared'

/**
 * How a loyalty card is painted.
 *
 * The business edits the card in the dashboard and the customer opens it on their
 * phone; those are two different apps. Keeping the drawing here means the preview is
 * the card, not an approximation of it.
 */

/** Border radius for one stamp slot, by style. */
export const STAMP_RADIUS: Record<StampStyle, string> = {
  circle: '9999px',
  rounded: '30%',
  square: '6px',
  badge: '9999px',
}

/** A badge draws a ring around the slot; the others do not. */
export function stampSlotStyle(
  style: StampStyle,
  colors: { filled: string; empty: string; accent: string },
  filled: boolean,
): { borderRadius: string; background: string; boxShadow?: string } {
  const background = filled ? colors.filled : colors.empty

  if (style === 'badge') {
    return {
      borderRadius: STAMP_RADIUS.badge,
      background,
      boxShadow: filled
        ? `0 0 0 2px ${colors.accent}, 0 0 0 4px ${hexWithAlpha(colors.accent, 0.25)}`
        : `inset 0 0 0 1.5px ${hexWithAlpha(colors.empty, 0.9)}`,
    }
  }

  return { borderRadius: STAMP_RADIUS[style], background }
}

export function hexWithAlpha(hex: string, alpha: number): string {
  const value = hex.replace('#', '')
  const full =
    value.length === 3
      ? value
          .split('')
          .map((char) => char + char)
          .join('')
      : value
  const int = Number.parseInt(full, 16)
  const r = (int >> 16) & 255
  const g = (int >> 8) & 255
  const b = int & 255
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

/**
 * The fourteen overlay textures, as CSS background layers.
 *
 * Drawn from the card's own foreground colour at a chosen opacity, so changing the
 * palette carries the texture with it and nothing has to be re-uploaded.
 */
export function patternLayer(
  pattern: BannerPattern,
  color: string,
  opacityPercent: number,
): { backgroundImage: string; backgroundSize: string } | null {
  if (pattern === 'none' || opacityPercent <= 0) return null

  const ink = hexWithAlpha(color, Math.min(100, opacityPercent) / 100)
  const svg = (body: string, size: number) =>
    `url("data:image/svg+xml,${encodeURIComponent(
      `<svg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}' viewBox='0 0 ${size} ${size}'>${body}</svg>`,
    )}")`

  switch (pattern) {
    case 'dots':
      return {
        backgroundImage: `radial-gradient(${ink} 1.5px, transparent 1.6px)`,
        backgroundSize: '14px 14px',
      }
    case 'grid':
      return {
        backgroundImage: `linear-gradient(${ink} 1px, transparent 1px), linear-gradient(90deg, ${ink} 1px, transparent 1px)`,
        backgroundSize: '18px 18px',
      }
    case 'diagonal':
      return {
        backgroundImage: `repeating-linear-gradient(45deg, ${ink} 0 1.5px, transparent 1.5px 10px)`,
        backgroundSize: 'auto',
      }
    case 'stripes':
      return {
        backgroundImage: `repeating-linear-gradient(90deg, ${ink} 0 6px, transparent 6px 16px)`,
        backgroundSize: 'auto',
      }
    case 'chevron':
      return {
        backgroundImage: svg(
          `<path d='M0 12 L8 4 L16 12' fill='none' stroke='${ink}' stroke-width='1.5'/>`,
          16,
        ),
        backgroundSize: '16px 16px',
      }
    case 'zigzag':
      return {
        backgroundImage: svg(
          `<path d='M0 6 L5 1 L10 6 L15 1 L20 6' fill='none' stroke='${ink}' stroke-width='1.5'/>`,
          20,
        ),
        backgroundSize: '20px 12px',
      }
    case 'waves':
      return {
        backgroundImage: svg(
          `<path d='M0 10 Q 5 4 10 10 T 20 10' fill='none' stroke='${ink}' stroke-width='1.5'/>`,
          20,
        ),
        backgroundSize: '20px 14px',
      }
    case 'scales':
      return {
        backgroundImage: svg(
          `<path d='M0 16 A 8 8 0 0 1 16 16' fill='none' stroke='${ink}' stroke-width='1.5'/>`,
          16,
        ),
        backgroundSize: '16px 16px',
      }
    case 'circles':
      return {
        backgroundImage: svg(
          `<circle cx='12' cy='12' r='7' fill='none' stroke='${ink}' stroke-width='1.5'/>`,
          24,
        ),
        backgroundSize: '24px 24px',
      }
    case 'triangles':
      return {
        backgroundImage: svg(`<path d='M9 3 L15 14 L3 14 Z' fill='${ink}'/>`, 18),
        backgroundSize: '18px 18px',
      }
    case 'cross':
      return {
        backgroundImage: svg(
          `<path d='M7 3 V11 M3 7 H11' stroke='${ink}' stroke-width='1.5'/>`,
          14,
        ),
        backgroundSize: '14px 14px',
      }
    case 'confetti':
      return {
        backgroundImage: svg(
          `<rect x='3' y='4' width='3' height='6' rx='1' fill='${ink}' transform='rotate(25 4 7)'/>` +
            `<rect x='16' y='14' width='3' height='6' rx='1' fill='${ink}' transform='rotate(-35 17 17)'/>` +
            `<rect x='20' y='3' width='3' height='5' rx='1' fill='${ink}' transform='rotate(12 21 5)'/>` +
            `<rect x='8' y='18' width='3' height='5' rx='1' fill='${ink}' transform='rotate(-15 9 20)'/>`,
          28,
        ),
        backgroundSize: '28px 28px',
      }
    case 'noise':
      return {
        backgroundImage: svg(
          `<circle cx='2' cy='3' r='0.8' fill='${ink}'/><circle cx='9' cy='7' r='0.8' fill='${ink}'/>` +
            `<circle cx='5' cy='11' r='0.8' fill='${ink}'/><circle cx='12' cy='2' r='0.8' fill='${ink}'/>` +
            `<circle cx='14' cy='12' r='0.8' fill='${ink}'/><circle cx='7' cy='15' r='0.8' fill='${ink}'/>`,
          16,
        ),
        backgroundSize: '16px 16px',
      }
    default:
      return null
  }
}

/** The card header background, before the pattern is laid over it. */
export function bannerBackground(
  banner: CardBanner,
  fallbackColor: string,
): { background: string; backgroundSize?: string; backgroundPosition?: string } {
  switch (banner.kind) {
    case 'gradient':
      return { background: `linear-gradient(${banner.angle}deg, ${banner.from}, ${banner.to})` }
    case 'image':
      return {
        background: `${fallbackColor} url("${banner.url}") center / cover no-repeat`,
      }
    default:
      return { background: fallbackColor }
  }
}
