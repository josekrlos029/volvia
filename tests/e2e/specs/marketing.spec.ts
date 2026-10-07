import { expect, test } from '@playwright/test'
import { urls } from '../helpers'

/**
 * The marketing site.
 *
 * It is the first thing a business sees, and most of it is content: pages that render
 * and link to each other correctly matter more here than any interaction. The one real
 * interaction — the contact form — has to actually reach somebody.
 */
const PAGES = [
  '/es',
  '/es/funciones',
  '/es/funciones/wallet',
  '/es/funciones/clientes-y-segmentos',
  '/es/precios',
  '/es/sectores',
  '/es/sectores/pizzerias',
  '/es/guia',
  '/es/plantillas',
  '/es/referencias',
  '/es/glosario',
  '/es/comparativas',
  '/es/comparativas/app-propia',
  '/es/preguntas',
  '/es/contacto',
  '/es/generador-qr-resenas',
  '/es/calculadora',
  '/en',
  '/en/funciones/wallet',
  '/en/guia',
  '/en/preguntas',
]

test.describe('every page is reachable', () => {
  for (const path of PAGES) {
    test(`${path} renders with a title and one h1`, async ({ page }) => {
      const response = await page.goto(`${urls.web}${path}`)
      expect(response?.status(), path).toBe(200)

      await expect(page.locator('h1')).toHaveCount(1)
      expect(await page.title()).not.toBe('')
    })
  }
})

test.describe('search engines get what they need', () => {
  test('the sitemap lists both languages of every page', async ({ request }) => {
    const sitemap = await request.get(`${urls.web}/sitemap.xml`)
    expect(sitemap.ok()).toBeTruthy()

    const body = await sitemap.text()
    const urlCount = (body.match(/<loc>/g) ?? []).length
    expect(urlCount).toBeGreaterThan(80)

    for (const path of ['/es/guia', '/en/guia', '/es/funciones/wallet', '/es/sectores/spa']) {
      expect(body, path).toContain(`${urls.web}${path}<`)
    }
  })

  test('robots points at the sitemap', async ({ request }) => {
    const robots = await request.get(`${urls.web}/robots.txt`)
    expect(await robots.text()).toContain('sitemap.xml')
  })

  test('a page declares its canonical and its other language', async ({ page }) => {
    await page.goto(`${urls.web}/es/funciones/wallet`)

    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      /\/es\/funciones\/wallet$/,
    )
    await expect(page.locator('link[hreflang="en"]')).toHaveAttribute(
      'href',
      /\/en\/funciones\/wallet$/,
    )
  })

  test('structured data is valid JSON, not a string that looks like it', async ({ page }) => {
    await page.goto(`${urls.web}/es/preguntas`)

    const blocks = await page.locator('script[type="application/ld+json"]').allTextContents()
    expect(blocks.length).toBeGreaterThan(0)

    const types = blocks.map((block) => JSON.parse(block)['@type'])
    expect(types).toContain('FAQPage')
  })
})

test.describe('the site leads somewhere', () => {
  test('the calls to action go to sign-up, and the header keeps sign-in', async ({ page }) => {
    await page.goto(`${urls.web}/es`)

    await expect(page.locator(`a[href="${urls.app}/signup"]`).first()).toBeVisible()
    await expect(page.locator(`a[href="${urls.app}/login"]`).first()).toBeVisible()
  })

  test('a feature page leads on to a related one', async ({ page }) => {
    await page.goto(`${urls.web}/es/funciones/wallet`)

    // The "Relacionado" block at the foot of every feature page.
    const related = page.locator('a[href^="/es/funciones/"]').filter({ hasNotText: 'Funciones' })
    await expect(related.first()).toBeVisible()

    await related.first().click()
    await expect(page).toHaveURL(/\/es\/funciones\/[a-z-]+$/)
    await expect(page.locator('h1')).toHaveCount(1)
  })

  test('the contact form reaches a person', async ({ page }) => {
    await page.goto(`${urls.web}/es/contacto`)

    await page.getByLabel('Tu nombre').fill('Ana de prueba')
    await page.getByLabel('Tu correo').fill(`contacto-${Date.now()}@volvia.test`)
    await page.getByLabel('Cuéntanos').fill('Tengo una cafetería y quiero saber si esto me sirve.')
    await page.getByRole('button', { name: 'Enviar' }).click()

    await expect(page.getByRole('heading', { name: 'Recibido' })).toBeVisible()
  })

  test('the review QR generator works without an account', async ({ page }) => {
    await page.goto(`${urls.web}/es/generador-qr-resenas`)

    await page
      .getByLabel('Enlace o identificador de tu ficha de Google')
      .fill('ChIJN1t_tDeuEmsRUsoyG83frY4')

    // The QR is drawn in the browser; nothing is sent anywhere.
    await expect(page.getByRole('link', { name: 'Descargar para imprimir' })).toBeVisible()
    await expect(page.locator('img[src^="data:image/png"]')).toBeVisible()
  })
})
