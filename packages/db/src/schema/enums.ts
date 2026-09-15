import { pgEnum } from 'drizzle-orm/pg-core'

export const planEnum = pgEnum('plan', ['free', 'pro', 'business', 'multi'])
export const subscriptionStatusEnum = pgEnum('subscription_status', [
  'none',
  'trialing',
  'active',
  'past_due',
  'canceled',
  'incomplete',
])
export const paymentProviderEnum = pgEnum('payment_provider', ['stripe', 'wompi'])
export const billingIntervalEnum = pgEnum('billing_interval', ['monthly', 'yearly'])
export const currencyEnum = pgEnum('currency', ['usd', 'cop'])
export const roleEnum = pgEnum('role', ['owner', 'admin', 'staff'])
export const localeEnum = pgEnum('locale', ['es', 'en'])
export const cardStatusEnum = pgEnum('card_status', ['draft', 'active', 'archived'])
export const rewardKindEnum = pgEnum('reward_kind', ['free_item', 'discount', 'custom'])
export const rewardGrantStatusEnum = pgEnum('reward_grant_status', [
  'pending',
  'redeemed',
  'expired',
  'revoked',
])
export const stampSourceEnum = pgEnum('stamp_source', [
  'staff_scan',
  'kiosk',
  'manual',
  'import',
  'campaign',
  'signup_bonus',
])
export const customerCardStatusEnum = pgEnum('customer_card_status', [
  'active',
  'blocked',
  'deleted',
])
export const campaignStatusEnum = pgEnum('campaign_status', [
  'draft',
  'scheduled',
  'running',
  'finished',
  'cancelled',
])
export const campaignTemplateEnum = pgEnum('campaign_template', [
  'slow_day',
  'happy_hour',
  'win_back',
  'double_stamps',
  'custom',
])
export const surveyTriggerEnum = pgEnum('survey_trigger', [
  'after_reward',
  'after_join',
  'after_nth_stamp',
  'manual',
])
export const automationTypeEnum = pgEnum('automation_type', [
  'birthday',
  'welcome',
  'inactivity_winback',
  'reward_expiry_reminder',
])
export const walletPlatformEnum = pgEnum('wallet_platform', ['apple', 'google'])
export const authTokenPurposeEnum = pgEnum('auth_token_purpose', [
  'magic_link',
  'email_verification',
  'password_reset',
  'invite',
])
export const outboxStatusEnum = pgEnum('outbox_status', ['pending', 'processing', 'done', 'failed'])
export const messageStatusEnum = pgEnum('message_status', [
  'draft',
  'scheduled',
  'sending',
  'sent',
  'failed',
])
