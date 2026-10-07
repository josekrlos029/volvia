import { LOCALES, PLAN_IDS, ROLES, STAMP_SOURCES, SURVEY_TRIGGERS } from '@volvia/shared'
import { Table, getTableColumns, getTableName, is } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import {
  cardStatusEnum,
  localeEnum,
  planEnum,
  roleEnum,
  stampSourceEnum,
  surveyTriggerEnum,
} from '../src/schema/enums'
import * as schema from '../src/schema/index'

// Each table has its own literal type, so the narrowing is asserted after the runtime
// check rather than written as a predicate the union would reject.
const tables = Object.values(schema).filter((value) => is(value, Table)) as unknown as Table[]

/** Tables that belong to the platform rather than to one business. */
const NOT_TENANT_SCOPED = new Set([
  'users',
  'auth_identities',
  'auth_tokens',
  'organizations',
  'webhook_events',
  // PassKit device registrations hang off a wallet pass, which is itself scoped to a
  // customer card. Apple addresses them by device and serial, never by business.
  'apple_pass_registrations',
  'apple_pass_logs',
])

describe('multi-tenancy', () => {
  it('finds every table', () => {
    expect(tables.length).toBeGreaterThan(25)
  })

  it('scopes every business table by organisation', () => {
    // A table without `org_id` cannot be filtered by tenant, which is how one business
    // ends up reading another's customers. Adding one is a deliberate decision, so it
    // has to be listed above rather than slip in unnoticed.
    const unscoped = tables
      .map((table) => ({ name: getTableName(table), columns: getTableColumns(table) }))
      .filter(({ name, columns }) => !NOT_TENANT_SCOPED.has(name) && !('orgId' in columns))
      .map(({ name }) => name)

    expect(unscoped).toEqual([])
  })

  it('gives every table a primary key called id', () => {
    for (const table of tables) {
      expect(getTableColumns(table), getTableName(table)).toHaveProperty('id')
    }
  })
})

describe('database enums match the shared contract', () => {
  it.each([
    ['plan', planEnum, PLAN_IDS],
    ['role', roleEnum, ROLES],
    ['locale', localeEnum, LOCALES],
    ['stamp source', stampSourceEnum, STAMP_SOURCES],
    ['survey trigger', surveyTriggerEnum, SURVEY_TRIGGERS],
  ] as const)('%s', (_label, enumeration, shared) => {
    // The API validates against the shared list and the column accepts the database
    // list. When they drift, the request passes validation and then fails at insert.
    expect([...enumeration.enumValues].sort()).toEqual([...shared].sort())
  })

  it('keeps card status in step with the lifecycle the product exposes', () => {
    expect(cardStatusEnum.enumValues).toEqual(['draft', 'active', 'archived'])
  })
})
