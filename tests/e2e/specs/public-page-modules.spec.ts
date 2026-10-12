import { expect, test } from '@playwright/test'
import { authHeaders, createAndPublishCard, registerBusiness, urls } from '../helpers'

/**
 * The public page as a business builds it: a menu with prices, the Wi-Fi, a cover,
 * and a count of how many people opened it. All through the API, the way the
 * dashboard and the customer page talk to it.
 */
test.describe('public business page', () => {
  test('a menu saved from the dashboard shows up on the page, priced and in order', async ({
    request,
  }) => {
    const session = await registerBusiness(request)
    await createAndPublishCard(request, session)

    const saved = await request.put(`${urls.api}/v1/page/modules/menu`, {
      headers: authHeaders(session),
      data: {
        sections: [
          {
            title: 'Entradas',
            items: [
              { title: 'Empanadas', description: 'De carne, tres', priceAmount: 900000 },
              { title: 'Arepa con queso', priceAmount: 600000, askVia: 'whatsapp' },
            ],
          },
          { title: 'Bebidas', items: [{ title: 'Limonada de coco', priceAmount: 800000 }] },
        ],
      },
    })
    expect(saved.ok(), await saved.text()).toBeTruthy()
    const body = (await saved.json()) as {
      sections: Array<{ id: string; title: string; items: Array<{ id: string; title: string }> }>
    }
    expect(body.sections.map((section) => section.title)).toEqual(['Entradas', 'Bebidas'])
    const empanadas = body.sections[0]!.items[0]!

    const org = await request.get(`${urls.api}/v1/org`, { headers: authHeaders(session) })
    const { slug } = (await org.json()) as { slug: string }

    const page = await request.get(`${urls.api}/p/business/${slug}`)
    expect(page.ok(), await page.text()).toBeTruthy()
    const payload = (await page.json()) as {
      business: { accentColor: string; wifi: unknown; showReviews: boolean; locale: string }
      modules: Array<{
        kind: string
        sections: Array<{ title: string; items: Array<{ title: string; priceAmount: number }> }>
      }>
    }
    const menu = payload.modules.find((module) => module.kind === 'menu')!
    expect(menu.sections.map((section) => section.title)).toEqual(['Entradas', 'Bebidas'])
    expect(menu.sections[0]!.items[0]).toMatchObject({ title: 'Empanadas', priceAmount: 900000 })
    expect(payload.business.locale).toBe('es')

    // Editing with the ids keeps the rows; the item's id survives a rename.
    const edited = await request.put(`${urls.api}/v1/page/modules/menu`, {
      headers: authHeaders(session),
      data: {
        sections: [
          {
            id: body.sections[0]!.id,
            title: 'Para empezar',
            items: [{ id: empanadas.id, title: 'Empanadas (3)', priceAmount: 950000 }],
          },
        ],
      },
    })
    expect(edited.ok(), await edited.text()).toBeTruthy()
    const after = (await edited.json()) as {
      sections: Array<{ id: string; title: string; items: Array<{ id: string; title: string }> }>
    }
    expect(after.sections).toHaveLength(1)
    expect(after.sections[0]!.id).toBe(body.sections[0]!.id)
    expect(after.sections[0]!.items[0]!.id).toBe(empanadas.id)
    expect(after.sections[0]!.items[0]!.title).toBe('Empanadas (3)')

    // The public page is cached briefly; a save must have dropped it.
    const refreshed = await request.get(`${urls.api}/p/business/${slug}`)
    const again = (await refreshed.json()) as {
      modules: Array<{ kind: string; sections: Array<{ title: string }> }>
    }
    expect(again.modules.find((module) => module.kind === 'menu')!.sections[0]!.title).toBe(
      'Para empezar',
    )
  })

  test('wifi, accent and reservations travel with the page settings', async ({ request }) => {
    const session = await registerBusiness(request)
    const patched = await request.patch(`${urls.api}/v1/org`, {
      headers: authHeaders(session),
      data: {
        settings: {
          guestWifi: { ssid: 'Negocio Invitados', password: 'bienvenido' },
          pageAccentColor: '#E9A23B',
          reservationsUrl: 'https://reservas.example.com/mesa',
          pageShowReviews: false,
        },
      },
    })
    expect(patched.ok(), await patched.text()).toBeTruthy()
    const { slug } = (await patched.json()) as { slug: string }

    const page = await request.get(`${urls.api}/p/business/${slug}`)
    const payload = (await page.json()) as {
      business: {
        accentColor: string
        wifi: { ssid: string; password: string } | null
        reservationsUrl: string | null
        showReviews: boolean
      }
    }
    expect(payload.business.wifi).toEqual({ ssid: 'Negocio Invitados', password: 'bienvenido' })
    expect(payload.business.accentColor).toBe('#E9A23B')
    expect(payload.business.reservationsUrl).toBe('https://reservas.example.com/mesa')
    expect(payload.business.showReviews).toBe(false)
  })

  test('opening the page is counted once per visitor and shows in the overview', async ({
    request,
  }) => {
    const session = await registerBusiness(request)
    const org = await request.get(`${urls.api}/v1/org`, { headers: authHeaders(session) })
    const { slug } = (await org.json()) as { slug: string }

    for (let index = 0; index < 3; index += 1) {
      const beacon = await request.post(`${urls.api}/p/business/${slug}/view`, {
        headers: { 'user-agent': 'e2e-visitor/1.0' },
      })
      expect(beacon.status()).toBe(204)
    }

    const page = await request.get(`${urls.api}/v1/page`, { headers: authHeaders(session) })
    expect(page.ok(), await page.text()).toBeTruthy()
    const { views30d, publicUrl } = (await page.json()) as { views30d: number; publicUrl: string }
    expect(views30d, 'three opens by one visitor count once').toBe(1)
    expect(publicUrl).toContain(`/b/${slug}`)

    const overview = await request.get(`${urls.api}/v1/analytics/overview?range=30d`, {
      headers: authHeaders(session),
    })
    expect(overview.ok(), await overview.text()).toBeTruthy()
    expect(((await overview.json()) as { pageViews: number }).pageViews).toBe(1)
  })

  test('the catalogue closes with the trial on the free plan', async ({ request }) => {
    const session = await registerBusiness(request)
    const { createDatabase, eq, organizations } = await import('@volvia/db')
    const connection = createDatabase({ url: process.env.DATABASE_URL ?? '', max: 1 })
    try {
      await connection.db
        .update(organizations)
        .set({ customerCount: 30 })
        .where(eq(organizations.id, session.orgId))
    } finally {
      await connection.close()
    }

    const denied = await request.put(`${urls.api}/v1/page/modules/products`, {
      headers: authHeaders(session),
      data: {
        sections: [{ title: '', items: [{ title: 'Bolsa de café', priceAmount: 4500000 }] }],
      },
    })
    expect(denied.status()).toBe(402)
  })
})
