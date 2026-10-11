import { describe, expect, it } from 'vitest'
import { SECTIONS, visibleSections } from '../src/lib/nav'

const labels = (role: 'owner' | 'admin' | 'staff') => visibleSections(role).map((s) => s.label)

/**
 * A counter account only gets the doors the API will open for it. The list of admin-only
 * sections is pinned here so the menu and the `(manage)` route group cannot drift apart.
 */
describe('visibleSections', () => {
  it('shows a counter account only what it can actually use', () => {
    expect(labels('staff')).toEqual(['Resumen', 'Tarjetas', 'Clientes', 'Segmentos'])
  })

  it('shows admins and owners every section', () => {
    expect(labels('admin')).toEqual(SECTIONS.map((s) => s.label))
    expect(labels('owner')).toEqual(SECTIONS.map((s) => s.label))
  })

  it('keeps the admin-only sections in step with the (manage) route group', () => {
    const gated = SECTIONS.filter((s) => s.minRole === 'admin').map((s) => s.href)
    expect(gated).toEqual([
      '/campaigns',
      '/messages',
      '/surveys',
      '/reviews',
      '/automations',
      '/team',
      '/settings',
    ])
  })
})
