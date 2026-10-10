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
  terms: string
  logoUrl: string | null
  bannerUrl: string | null
  backgroundColor: string
  foregroundColor: string
  labelColor: string
  /** Deep link back to the web card. */
  cardUrl: string
  /**
   * Up to ten points where the OS surfaces the pass on its own. The wording shown next
   * to it is derived from the card state, so it is never stored here.
   */
  places: Array<{ latitude: number; longitude: number }>
  /** Free-form message shown when a campaign or birthday offer is active. */
  offerMessage: string | null
  /**
   * The last message the business sent to this card. Its change is what makes the
   * phone show a notification, so the text is already rendered for this customer.
   */
  latestMessage: { headline: string; body: string; sentAt: Date } | null
  locale: 'es' | 'en'
  updatedAt: Date
}

export type WalletMode = 'stub' | 'real' | 'disabled'
