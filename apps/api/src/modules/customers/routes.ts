import { and, customers, eq } from '@volvia/db'
import { VISIT_FREQUENCIES, customerListQuerySchema, updateCustomerSchema } from '@volvia/shared'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { AUDIT_ACTIONS, audit } from '../../lib/audit'
import { AppError } from '../../lib/errors'
import { typed } from '../../types'
import {
  communityCounts,
  deleteCustomer,
  exportCustomersCsv,
  getCustomer,
  listCustomers,
} from './service'

const customerParams = z.object({ customerId: z.string().uuid() })

export async function customerRoutes(fastify: FastifyInstance): Promise<void> {
  const app = typed(fastify)

  app.get(
    '/',
    {
      preHandler: [app.requireOrg('staff')],
      schema: { querystring: customerListQuerySchema, tags: ['customers'] },
    },
    async (request) => {
      const page = await listCustomers(
        app.db,
        request.org!.orgId,
        request.query,
        request.org!.visitFrequency,
      )

      // Contact details are a paid feature: mask them rather than hiding the customer,
      // so a free plan still sees who its regulars are.
      if (!request.org!.entitlements.has('customer_contact_details')) {
        return {
          ...page,
          items: page.items.map((item) => ({ ...item, email: maskEmail(item.email) })),
          masked: true,
        }
      }
      return { ...page, masked: false }
    },
  )

  app.get(
    '/:customerId',
    {
      preHandler: [app.requireOrg('staff')],
      schema: { params: customerParams, tags: ['customers'] },
    },
    async (request) => {
      const detail = await getCustomer(app.db, request.org!.orgId, request.params.customerId)
      if (!request.org!.entitlements.has('customer_contact_details')) {
        return {
          ...detail,
          customer: { ...detail.customer, email: maskEmail(detail.customer.email) },
          masked: true,
        }
      }
      return { ...detail, masked: false }
    },
  )

  app.patch(
    '/:customerId',
    {
      preHandler: [app.requireOrg('admin')],
      schema: { params: customerParams, body: updateCustomerSchema, tags: ['customers'] },
    },
    async (request) => {
      const [updated] = await app.db
        .update(customers)
        .set({ ...request.body, updatedAt: new Date() })
        .where(
          and(eq(customers.id, request.params.customerId), eq(customers.orgId, request.org!.orgId)),
        )
        .returning()
      if (!updated) throw new AppError('NOT_FOUND', { message: 'customer not found' })
      return updated
    },
  )

  app.delete(
    '/:customerId',
    {
      preHandler: [app.requireOrg('admin')],
      schema: { params: customerParams, tags: ['customers'] },
    },
    async (request) => {
      const result = await deleteCustomer(app.db, request.org!.orgId, request.params.customerId)
      await audit(app.db, {
        orgId: request.org!.orgId,
        actorUserId: request.auth!.userId,
        action: AUDIT_ACTIONS.customerDeleted,
        targetType: 'customer',
        targetId: request.params.customerId,
        ip: request.ip,
      })
      return result
    },
  )

  app.get(
    '/segments',
    {
      preHandler: [app.requireOrg('staff')],
      schema: {
        querystring: customerListQuerySchema,
        response: {
          200: z.object({
            total: z.number().int(),
            frequency: z.enum(VISIT_FREQUENCIES),
            segments: z.record(z.string(), z.number().int()),
          }),
        },
        tags: ['customers'],
      },
    },
    async (request) => ({
      ...(await communityCounts(
        app.db,
        request.org!.orgId,
        request.query,
        request.org!.visitFrequency,
      )),
      frequency: request.org!.visitFrequency,
    }),
  )

  app.get(
    '/export.csv',
    {
      preHandler: [app.requireOrg('admin'), app.requireFeature('csv_export')],
      schema: { querystring: customerListQuerySchema, tags: ['customers'] },
    },
    async (request, reply) => {
      const csv = await exportCustomersCsv(
        app.db,
        request.org!.orgId,
        request.query,
        request.org!.visitFrequency,
      )
      await audit(app.db, {
        orgId: request.org!.orgId,
        actorUserId: request.auth!.userId,
        action: AUDIT_ACTIONS.customerExported,
        meta: { segment: request.query.segment },
        ip: request.ip,
      })
      return (
        reply
          .header('content-type', 'text/csv; charset=utf-8')
          .header('content-disposition', 'attachment; filename="clientes-volvia.csv"')
          // Excel needs a BOM to read accented characters correctly.
          .send(`﻿${csv}`)
      )
    },
  )
}

/** `maria@cliente.test` → `m•••@cliente.test`: recognisable, not contactable. */
function maskEmail(email: string): string {
  const [local = '', domain = ''] = email.split('@')
  const head = local.slice(0, 1)
  return `${head}${'•'.repeat(Math.max(3, local.length - 1))}@${domain}`
}
