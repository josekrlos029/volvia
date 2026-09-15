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
  /** Locations that trigger a lock-screen suggestion when the customer is nearby. */
  places: Array<{ latitude: number; longitude: number; relevantText?: string }>
  /** Free-form message shown when a campaign or birthday offer is active. */
  offerMessage: string | null
  locale: 'es' | 'en'
  updatedAt: Date
}

export type WalletMode = 'stub' | 'real' | 'disabled'
