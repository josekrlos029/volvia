import { randomBytes, randomInt } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { config } from 'dotenv'
import { eq } from 'drizzle-orm'
import { createDatabase } from '../client'
import {
  analyticsDaily,
  automations,
  customerCards,
  customers,
  locations,
  memberships,
  organizations,
  profileQuestions,
  rewardGrants,
  rewards,
  stampCards,
  stampEvents,
  surveys,
  users,
} from '../schema/index'
import {
  businesses,
  firstNames,
  lastNames,
  profileQuestionsByCategory,
  surveyQuestions,
} from './data'

config({ path: fileURLToPath(new URL('../../../../.env', import.meta.url)) })

const url = process.env.DATABASE_URL
if (!url) {
  console.error('DATABASE_URL is not set')
  process.exit(1)
}

const { db, close } = createDatabase({ url })

/**
 * Argon2id hash of the seed password, generated with the same parameters the API uses.
 *
 * Precomputed so seeding stays fast and the db package needs no native crypto
 * dependency. Every seeded account shares this password; local development only.
 */
const SEED_PASSWORD_HASH =
  '$argon2id$v=19$m=19456,t=2,p=1$mmJ6RVxpwgyiJqkyJzETUg$LPH9E+igvLpb0NKqaZ7zDVeigKqSfIk3eX3x/BsOo2A'
const SEED_PASSWORD = 'volvia-local-2026'

function token(bytes = 24): string {
  return randomBytes(bytes).toString('base64url')
}

function slug(length = 10): string {
  const alphabet = 'abcdefghijkmnpqrstuvwxyz23456789'
  return Array.from({ length }, () => alphabet[randomInt(alphabet.length)]).join('')
}

function code(): string {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 6 }, () => alphabet[randomInt(alphabet.length)]).join('')
}

/** Spanish names carry accents; the email addresses generated from them should not. */
function asciiFold(value: string): string {
  return (
    value
      .toLowerCase()
      .normalize('NFD')
      // biome-ignore lint/suspicious/noMisleadingCharacterClass: matching combining marks is the intent, not an accident: NFD has just split accented letters apart and this removes the marks left behind.
      .replace(/[\u0300-\u036f]/gu, '')
  )
}

function pick<T>(list: readonly T[]): T {
  return list[randomInt(list.length)]!
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

async function seed(): Promise<void> {
  console.log('→ seeding Volvia development data')

  for (const business of businesses) {
    const email = `hola@${business.slug}.test`

    // The organisation slug is the real identity here: re-running the seed must not
    // fail, and a business created by hand during testing should be left alone.
    const [existing] = await db
      .select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.slug, business.slug))
      .limit(1)

    if (existing) {
      console.log(`  · ${business.name} already exists (${business.slug}), skipping`)
      continue
    }

    // The unique index on users is over `lower(email)`, which Postgres cannot use as an
    // ON CONFLICT arbiter — so look the account up explicitly instead.
    const [existingOwner] = await db.select().from(users).where(eq(users.email, email)).limit(1)

    const owner =
      existingOwner ??
      (
        await db
          .insert(users)
          .values({
            email,
            passwordHash: SEED_PASSWORD_HASH,
            name: `Dueño ${business.name}`,
            locale: 'es',
            emailVerifiedAt: new Date(),
          })
          .returning()
      )[0]

    const [org] = await db
      .insert(organizations)
      .values({
        name: business.name,
        slug: business.slug,
        category: business.category,
        tagline: business.tagline,
        about: business.about,
        brandColor: business.brandColor,
        country: 'CO',
        currency: 'cop',
        timezone: 'America/Bogota',
        locale: 'es',
        plan: business.plan,
        subscriptionStatus: business.plan === 'free' ? 'none' : 'active',
        contactEmail: email,
        socialLinks: [
          { platform: 'instagram', url: `https://instagram.com/${business.slug}` },
          { platform: 'whatsapp', url: 'https://wa.me/573000000000' },
        ],
        onboarding: {
          businessProfile: true,
          firstCard: true,
          cardPublished: true,
          qrDownloaded: true,
        },
      })
      .returning()

    await db.insert(memberships).values({ orgId: org!.id, userId: owner!.id, role: 'owner' })

    const [location] = await db
      .insert(locations)
      .values({
        orgId: org!.id,
        name: business.name,
        address: business.address,
        city: business.city,
        timezone: 'America/Bogota',
        hours: [1, 2, 3, 4, 5, 6].map((day) => ({ day, opens: '09:00', closes: '20:00' })),
      })
      .returning()

    const questionSet = profileQuestionsByCategory[business.category] ?? []
    const questions = await db
      .insert(profileQuestions)
      .values(
        questionSet.map((question, index) => ({
          orgId: org!.id,
          prompt: question.prompt,
          type: question.type,
          options: question.options,
          askOn: question.askOn,
          position: index,
        })),
      )
      .returning()

    const [card] = await db
      .insert(stampCards)
      .values({
        orgId: org!.id,
        name: business.card.name,
        status: 'active',
        stampsRequired: business.card.stampsRequired,
        design: {
          layout: 'classic',
          backgroundColor: business.cardBackground,
          foregroundColor: '#FFFFFF',
          accentColor: business.cardAccent,
          stampIcon: { kind: 'preset', value: business.card.stampIcon },
          emptyStampColor: '#3A3A3A',
          logoUrl: null,
          bannerUrl: null,
          headline: business.card.headline,
          subheadline: business.card.subheadline,
        },
        rules: {
          mode: 'per_visit',
          minSpendAmount: null,
          cooldownMinutes: 30,
          dailyCap: 2,
          maxStampsPerScan: 1,
          kioskEnabled: business.plan === 'business' || business.plan === 'multi',
          kioskDailyCap: 1,
        },
        terms: business.card.terms,
        collectBirthday: true,
        signupQuestionIds: questions.filter((q) => q.askOn === 'signup').map((q) => q.id),
        joinSlug: slug(),
        publishedAt: new Date(),
      })
      .returning()

    const cardRewards = await db
      .insert(rewards)
      .values(
        business.card.rewards.map((reward) => ({
          cardId: card!.id,
          orgId: org!.id,
          atStamp: reward.atStamp,
          title: reward.title,
          description: reward.description,
          kind: 'free_item' as const,
          isRepeating: true,
        })),
      )
      .returning()

    if (business.plan === 'business' || business.plan === 'multi') {
      await db.insert(surveys).values({
        orgId: org!.id,
        name: 'Después de la recompensa',
        trigger: 'after_reward',
        cardIds: [card!.id],
        questions: surveyQuestions,
        isAnonymous: false,
        routeToReviewFromRating: 4,
      })
      await db.insert(automations).values({
        orgId: org!.id,
        type: 'birthday',
        isActive: true,
        config: {
          offsetDays: 0,
          headline: '¡Feliz cumpleaños!',
          body: `Te dejamos algo en tu tarjeta de ${business.name}.`,
          offer: { kind: 'bonus_stamps', amount: 2, title: null, validForDays: 14 },
          sendEmail: true,
          sendPush: true,
        },
      })
    }

    // ── Customers with plausible visit histories ─────────────────────────────
    const stats = new Map<
      string,
      { joins: number; stamps: number; unlocked: number; redeemed: number; hourly: number[] }
    >()
    const bump = (
      day: string,
      field: 'joins' | 'stamps' | 'unlocked' | 'redeemed',
      hour?: number,
    ) => {
      const entry = stats.get(day) ?? {
        joins: 0,
        stamps: 0,
        unlocked: 0,
        redeemed: 0,
        hourly: Array(24).fill(0),
      }
      entry[field] += 1
      if (field === 'stamps' && hour !== undefined)
        entry.hourly[hour] = (entry.hourly[hour] ?? 0) + 1
      stats.set(day, entry)
    }

    const now = Date.now()
    const historyMs = business.scale.weeksOfHistory * 7 * 24 * 3_600_000

    for (let index = 0; index < business.scale.customers; index += 1) {
      const first = pick(firstNames)
      const last = pick(lastNames)
      const joinedAt = new Date(now - randomInt(historyMs))

      const [customer] = await db
        .insert(customers)
        .values({
          orgId: org!.id,
          firstName: first,
          email: `${asciiFold(first)}.${asciiFold(last)}${index}@cliente.test`,
          birthdayMonth: randomInt(1, 13),
          birthdayDay: randomInt(1, 29),
          locale: 'es',
          marketingConsent: Math.random() < 0.72,
          consentAt: joinedAt,
          joinedAt,
        })
        .returning()

      const [customerCard] = await db
        .insert(customerCards)
        .values({
          orgId: org!.id,
          cardId: card!.id,
          customerId: customer!.id,
          token: token(),
          joinedAt,
        })
        .returning()

      bump(isoDate(joinedAt), 'joins')

      // Visit cadence: most customers come rarely, a few come constantly.
      const weeks = Math.max(1, Math.floor((now - joinedAt.getTime()) / (7 * 24 * 3_600_000)))
      const [minVisits, maxVisits] = business.scale.visitsPerWeek
      const intensity = Math.random() ** 2
      const perWeek = minVisits + intensity * (maxVisits - minVisits)
      const totalVisits = Math.floor(perWeek * weeks)

      let stampsCount = 0
      let cycleIndex = 0
      let lifetime = 0
      let lastStampAt: Date | null = null
      const events: Array<typeof stampEvents.$inferInsert> = []
      const grants: Array<typeof rewardGrants.$inferInsert> = []

      for (let visit = 0; visit < totalVisits; visit += 1) {
        const at = new Date(joinedAt.getTime() + randomInt(Math.max(1, now - joinedAt.getTime())))
        // Cluster visits into opening hours so the "busiest hours" chart is meaningful.
        at.setHours(randomInt(9, 20), randomInt(0, 60), 0, 0)
        if (at.getTime() > now) continue

        stampsCount += 1
        lifetime += 1
        const unlocked = cardRewards.find((reward) => reward.atStamp === stampsCount)

        if (unlocked) {
          const granted = {
            orgId: org!.id,
            customerCardId: customerCard!.id,
            rewardId: unlocked.id,
            title: unlocked.title,
            description: unlocked.description,
            code: code(),
            cycleIndex,
            grantedAt: at,
            // Most rewards get claimed; some never are.
            status: Math.random() < 0.78 ? ('redeemed' as const) : ('pending' as const),
            redeemedAt: null as Date | null,
          }
          if (granted.status === 'redeemed') {
            granted.redeemedAt = new Date(at.getTime() + randomInt(14 * 24 * 3_600_000))
            if (granted.redeemedAt.getTime() > now) granted.redeemedAt = new Date(now)
            bump(isoDate(granted.redeemedAt), 'redeemed')
          }
          grants.push(granted)
          bump(isoDate(at), 'unlocked')
        }

        if (stampsCount >= business.card.stampsRequired) {
          stampsCount = 0
          cycleIndex += 1
        }

        events.push({
          orgId: org!.id,
          customerCardId: customerCard!.id,
          locationId: location!.id,
          source: 'staff_scan',
          delta: 1,
          resultingCount: stampsCount,
          cycleIndex,
          idempotencyKey: `seed-${customerCard!.id}-${visit}`,
          occurredAt: at,
        })
        bump(isoDate(at), 'stamps', at.getHours())
        if (!lastStampAt || at > lastStampAt) lastStampAt = at
      }

      if (events.length > 0) await db.insert(stampEvents).values(events)
      if (grants.length > 0) await db.insert(rewardGrants).values(grants)

      await db
        .update(customerCards)
        .set({ stampsCount, cycleIndex, lifetimeStamps: lifetime, lastStampAt })
        .where(eq(customerCards.id, customerCard!.id))

      await db
        .update(customers)
        .set({
          totalStamps: lifetime,
          totalRewards: grants.length,
          lastStampAt,
        })
        .where(eq(customers.id, customer!.id))
    }

    await db
      .update(organizations)
      .set({ customerCount: business.scale.customers })
      .where(eq(organizations.id, org!.id))

    if (stats.size > 0) {
      await db.insert(analyticsDaily).values(
        [...stats.entries()].map(([day, entry]) => ({
          orgId: org!.id,
          cardId: card!.id,
          locationId: null,
          day,
          joins: entry.joins,
          stamps: entry.stamps,
          rewardsUnlocked: entry.unlocked,
          rewardsRedeemed: entry.redeemed,
          hourly: entry.hourly,
        })),
      )
    }

    console.log(
      `  ✓ ${business.name} — ${business.scale.customers} clientes, plan ${business.plan}, login ${email}`,
    )
  }

  console.log(`\n✓ seed complete. Password for every seeded account: ${SEED_PASSWORD}`)
}

try {
  await seed()
} catch (error) {
  console.error('✗ seed failed:', error)
  process.exitCode = 1
} finally {
  await close()
}
