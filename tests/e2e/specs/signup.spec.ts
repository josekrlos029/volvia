import { expect, test } from '@playwright/test'
import {
  authHeaders,
  registerBusiness,
  signIn,
  signUpThroughTheForm,
  tokenFromEmail,
  uniqueBusiness,
  urls,
} from '../helpers'

/**
 * Self-service sign-up, and the four screens our emails link to.
 *
 * Every assertion here goes through the browser. The API-level suite passed while there
 * was no way at all to create an account from the website, which is exactly the gap
 * these tests exist to close.
 */
test.describe('a business signs itself up', () => {
  test('the marketing site sends visitors to sign-up, not to sign-in', async ({ page }) => {
    await page.goto(`${urls.web}/es`)

    const cta = page.locator(`a[href="${urls.app}/signup"]`).first()
    await expect(cta).toBeVisible()

    // The header keeps a way back for people who already have an account.
    await expect(page.locator(`a[href="${urls.app}/login"]`).first()).toBeVisible()
  })

  test('the form creates the business and lands on the first steps', async ({ page }) => {
    const business = await signUpThroughTheForm(page)

    await expect(page.getByRole('heading', { level: 1 })).toContainText(business.businessName)
    await expect(page.getByText('0 de 6 pasos completados')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Crea tu tarjeta de sellos' })).toBeVisible()
  })

  test('the first steps tick themselves off as the work gets done', async ({ page, request }) => {
    const business = uniqueBusiness()
    const session = await registerBusiness(request, business)

    await request.post(`${urls.api}/v1/cards`, {
      headers: authHeaders(session),
      data: {
        name: 'Club del café',
        stampsRequired: 5,
        rules: { cooldownMinutes: 0, dailyCap: 10, maxStampsPerScan: 1 },
        rewards: [{ atStamp: 5, title: 'Café gratis', description: '' }],
        terms: 'Un sello por visita.',
      },
    })

    await signIn(page, business.email, business.password)
    await page.goto(`${urls.app}/onboarding`)

    await expect(page.getByText('1 de 6 pasos completados')).toBeVisible()
    // A finished step stops offering its button.
    await expect(page.getByRole('link', { name: 'Crear tarjeta' })).toHaveCount(0)
  })

  test('a guessable password is refused with an explanation', async ({ page }) => {
    const business = uniqueBusiness()
    await page.goto(`${urls.app}/signup`)
    await page.fill('#businessName', business.businessName)
    await page.fill('#name', business.name)
    await page.fill('#email', business.email)
    // Long enough for the browser to submit, rejected by the API's own policy.
    await page.fill('#password', 'password12345')
    await page.click('button[type=submit]')

    await expect(page.locator('p[role="alert"]')).toContainText('demasiado común')
    await expect(page).toHaveURL(`${urls.app}/signup`)
  })

  test('an email that already has an account says so instead of failing silently', async ({
    page,
    request,
  }) => {
    const business = uniqueBusiness()
    await registerBusiness(request, business)

    await page.goto(`${urls.app}/signup`)
    await page.fill('#businessName', 'Otro negocio')
    await page.fill('#name', 'Otra persona')
    await page.fill('#email', business.email)
    await page.fill('#password', 'una-frase-larga-distinta')
    await page.click('button[type=submit]')

    await expect(page.locator('p[role="alert"]')).toContainText('ya tiene una cuenta')
  })

  test('sign-in offers Google and a way to create an account', async ({ page }) => {
    await page.goto(`${urls.app}/login`)

    await expect(page.getByRole('link', { name: 'Entrar con Google' })).toHaveAttribute(
      'href',
      `${urls.api}/v1/auth/google/start`,
    )
    await expect(page.getByRole('link', { name: 'Crea tu negocio gratis' })).toBeVisible()
  })
})

test.describe('the screens our emails link to', () => {
  test('the verification link confirms the address', async ({ page, request }) => {
    const business = uniqueBusiness()
    await registerBusiness(request, business)

    const token = await tokenFromEmail(request, business.email, 'verify-email')
    await page.goto(`${urls.app}/verify-email?token=${token}`)

    await expect(page.getByRole('heading', { name: 'Correo confirmado' })).toBeVisible()
  })

  test('a used verification link says so rather than pretending to work', async ({
    page,
    request,
  }) => {
    const business = uniqueBusiness()
    await registerBusiness(request, business)
    const token = await tokenFromEmail(request, business.email, 'verify-email')

    await page.goto(`${urls.app}/verify-email?token=${token}`)
    await expect(page.getByRole('heading', { name: 'Correo confirmado' })).toBeVisible()

    await page.goto(`${urls.app}/verify-email?token=${token}`)
    await expect(
      page.getByRole('heading', { name: 'No pudimos confirmar tu correo' }),
    ).toBeVisible()
  })

  test('a magic link opens the dashboard', async ({ page, request }) => {
    const business = uniqueBusiness()
    await registerBusiness(request, business)

    await request.post(`${urls.api}/v1/auth/magic-link`, { data: { email: business.email } })
    const token = await tokenFromEmail(request, business.email, 'magic')

    await page.goto(`${urls.app}/magic?token=${token}`)
    await page.waitForURL(`${urls.app}/`)
    await expect(page.getByRole('link', { name: 'Clientes' })).toBeVisible()
  })

  test('an expired magic link offers a new one instead of a dead end', async ({ page }) => {
    await page.goto(`${urls.app}/magic?token=${'x'.repeat(40)}`)

    await expect(page.getByRole('heading', { name: 'Este enlace ya no sirve' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Pedir un enlace nuevo' })).toHaveAttribute(
      'href',
      '/login',
    )
  })

  test('a forgotten password can be reset and used', async ({ page, request }) => {
    const business = uniqueBusiness()
    await registerBusiness(request, business)

    await page.goto(`${urls.app}/reset-password`)
    await page.fill('#email', business.email)
    await page.click('button[type=submit]')
    await expect(page.getByRole('heading', { name: 'Revisa tu correo' })).toBeVisible()

    const token = await tokenFromEmail(request, business.email, 'reset-password')
    await page.goto(`${urls.app}/reset-password?token=${token}`)

    const nuevaClave = 'mi-clave-nueva-2026'
    await page.fill('#password', nuevaClave)
    await page.fill('#confirm', nuevaClave)
    await page.click('button[type=submit]')
    await expect(page.getByRole('heading', { name: 'Contraseña cambiada' })).toBeVisible()

    // The real point of the test: the session minted after a reset has to work.
    await signIn(page, business.email, nuevaClave)
    await expect(page.getByRole('link', { name: 'Clientes' })).toBeVisible()
  })

  test('two different passwords are caught before anything is sent', async ({ page, request }) => {
    const business = uniqueBusiness()
    await registerBusiness(request, business)
    await request.post(`${urls.api}/v1/auth/password-reset/request`, {
      data: { email: business.email },
    })
    const token = await tokenFromEmail(request, business.email, 'reset-password')

    await page.goto(`${urls.app}/reset-password?token=${token}`)
    await page.fill('#password', 'una-frase-larga-aqui')
    await page.fill('#confirm', 'otra-frase-larga-aqui')
    await page.click('button[type=submit]')

    await expect(page.locator('p[role="alert"]')).toContainText('no son iguales')
  })
})

test.describe('joining a team by invitation', () => {
  test('an invited person with no account creates one and gets in', async ({ page, request }) => {
    const owner = uniqueBusiness()
    const session = await registerBusiness(request, owner)
    const staffEmail = `probe-staff-${Date.now()}@volvia.test`

    const invited = await request.post(`${urls.api}/v1/org/members/invite`, {
      headers: authHeaders(session),
      data: { email: staffEmail, role: 'staff' },
    })
    expect(invited.ok(), await invited.text()).toBeTruthy()

    const token = await tokenFromEmail(request, staffEmail, 'invite')
    await page.goto(`${urls.app}/invite?token=${token}`)

    // The page names the business before asking for anything.
    await expect(page.getByText(owner.businessName).first()).toBeVisible()
    await expect(page.getByText(staffEmail)).toBeVisible()

    await page.fill('#name', 'Luis del mostrador')
    await page.fill('#password', 'clave-de-mostrador-1')
    await page.click('button[type=submit]')

    await page.waitForURL(`${urls.app}/`)
    await expect(page.getByRole('link', { name: 'Clientes' })).toBeVisible()
  })

  test('an invitation already used does not let a second person in', async ({ page, request }) => {
    const owner = uniqueBusiness()
    const session = await registerBusiness(request, owner)
    const staffEmail = `probe-staff-${Date.now()}-b@volvia.test`

    await request.post(`${urls.api}/v1/org/members/invite`, {
      headers: authHeaders(session),
      data: { email: staffEmail, role: 'admin' },
    })
    const token = await tokenFromEmail(request, staffEmail, 'invite')

    const accepted = await request.post(`${urls.api}/p/invite/accept`, {
      data: { token, name: 'Primera persona', password: 'clave-de-mostrador-1' },
    })
    expect(accepted.ok(), await accepted.text()).toBeTruthy()

    await page.goto(`${urls.app}/invite?token=${token}`)
    await expect(page.getByRole('heading', { name: 'Esta invitación ya no sirve' })).toBeVisible()
  })

  test('a made-up invitation link is refused', async ({ page }) => {
    await page.goto(`${urls.app}/invite?token=${'z'.repeat(40)}`)
    await expect(page.getByRole('heading', { name: 'Esta invitación ya no sirve' })).toBeVisible()
  })
})
