import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'wxt'

/**
 * Where the extension talks to. Production unless a local build says otherwise:
 * `WXT_API_URL=http://localhost:8081 pnpm dev` points it at the isolated stack.
 */
const apiUrl = process.env.WXT_API_URL ?? 'https://api.somosvolvia.com'
const appUrl = process.env.WXT_APP_URL ?? 'https://app.somosvolvia.com'

export default defineConfig({
  srcDir: 'src',
  vite: () => ({
    plugins: [react(), tailwindcss()],
    define: {
      __API_URL__: JSON.stringify(apiUrl),
      __APP_URL__: JSON.stringify(appUrl),
    },
  }),
  manifest: {
    name: 'Volvia Biz',
    description:
      'Sella las tarjetas de tus clientes de domicilio: búscalos por cédula, teléfono o nombre.',
    // Only what the popup needs: keeping the session, the right-click search, and
    // calling the Volvia API. No access to the pages people browse.
    permissions: ['storage', 'contextMenus'],
    host_permissions: [`${new URL(apiUrl).origin}/*`],
    action: { default_title: 'Volvia Biz' },
    commands: {
      _execute_action: {
        suggested_key: { default: 'Ctrl+Shift+V', mac: 'Command+Shift+V' },
        description: 'Abrir Volvia Biz',
      },
    },
  },
})
