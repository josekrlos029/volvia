import type { OpeningHours, StampIcon, StampStyle } from '@volvia/shared'

/** Everything a wallet pass needs to render, independent of Apple/Google specifics. */
export interface PassContent {
  /** Stable, unguessable identifier for this customer's pass. */
  serial: string
  organizationName: string
  cardName: string
  /** Displayed as the primary progress line, e.g. "4 / 8". */
  stampsCount: number
  stampsRequired: number
  rewardTitle: string
  rewardDescription: string
  /**
   * Rewards the customer has earned but not yet claimed. This cannot be derived from
   * `stampsCount`: completing a card resets the count to zero, so a full card and an
   * empty one look identical from the count alone.
   */
  pendingRewardCount: number
  /** 1-based slots that unlock a reward, so the strip can mark them. */
  rewardPositions: number[]
  /** The slot the customer is working towards; null when nothing is left to earn. */
  nextRewardAt: number | null
  /** Completed laps of the card. Shown as "Vuelta N" from the second lap on. */
  cycleIndex: number
  lastStampAt: Date | null
  headline: string
  terms: string
  logoUrl: string | null
  bannerUrl: string | null
  backgroundColor: string
  foregroundColor: string
  /** The card's accent: labels on Apple, filled stamps everywhere. */
  labelColor: string
  emptyStampColor: string
  stampIcon: StampIcon
  stampStyle: StampStyle
  /** Deep link back to the web card. */
  cardUrl: string
  /**
   * Up to ten points where the OS surfaces the pass on its own. The wording shown next
   * to it is derived from the card state, so it is never stored here.
   */
  places: Array<{ latitude: number; longitude: number }>
  /** The business's own nearby wording, rendered for this customer. Null uses the default. */
  nearbyMessage: string | null
  /** A campaign or birthday offer live on this card, already worded for this customer. */
  offer: PassOffer | null
  /**
   * The last message the business sent to this card. Its change is what makes the
   * phone show a notification, so the text is already rendered for this customer.
   */
  latestMessage: { headline: string; body: string; sentAt: Date } | null
  /** The customer's first name. Google shows it as the account holder; Apple on the back. Empty when unknown. */
  customerName: string
  /** The business's own description, as written in its settings. Empty when it has none. */
  about: string
  /**
   * Everything on the pass the customer can tap, in display order, already localized
   * and capped at eight: the business's links, directions, phone and email. The Volvia
   * card link is `cardUrl` and stays separate.
   */
  links: PassLink[]
  /** The branch shown on the back: the oldest active location with an address. */
  place: PassPlace | null
  /** A promotional picture for Google's image module: the org cover or the card's image banner. */
  promoImageUrl: string | null
  locale: 'es' | 'en'
  updatedAt: Date
}

/** What an offer does to the pass while it runs, beyond its one line of text. */
export interface PassOffer {
  message: string
  /** Replaces the business name in the header. Ignored while a reward waits. */
  headerLabel: string | null
  /** Replaces the reward description on the back of the pass. */
  text: string | null
  banner: { kind: 'preset'; value: string } | { kind: 'image'; url: string } | null
  /** The stamp grid tucks behind the banner; only a small progress pill remains. */
  hideStamps: boolean
  endsAt: Date | null
}

export type PassLinkKind = 'web' | 'phone' | 'email' | 'maps'

export interface PassLink {
  /** Stable within the pass; becomes the field key on Apple and the uri id on Google. */
  id: string
  label: string
  url: string
  kind: PassLinkKind
}

export interface PassPlace {
  address: string | null
  city: string | null
  hours: OpeningHours
}

export type WalletMode = 'stub' | 'real' | 'disabled'
