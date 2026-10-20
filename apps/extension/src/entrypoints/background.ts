import { browser } from 'wxt/browser'
import { defineBackground } from 'wxt/utils/define-background'
import { POLL_DEVICE_MESSAGE, pollPendingDevice } from '../lib/device'
import { setPendingQuery } from '../lib/pending-query'

const MENU_ID = 'volvia-search'

/**
 * The right-click "Buscar en Volvia" on a selected phone number or cédula — in
 * WhatsApp Web, a delivery panel, anywhere. The selection is handed to the popup,
 * which opens with the search already typed.
 */
export default defineBackground(() => {
  // The popup asks for this when the person starts connecting with a code.
  browser.runtime.onMessage.addListener((message) => {
    if (message === POLL_DEVICE_MESSAGE) void pollPendingDevice()
  })
  // A code still waiting when the browser restarts the worker keeps being watched.
  void pollPendingDevice()

  browser.runtime.onInstalled.addListener(() => {
    browser.contextMenus.create({
      id: MENU_ID,
      title: 'Buscar «%s» en Volvia',
      contexts: ['selection'],
    })
  })

  browser.contextMenus.onClicked.addListener(async (info) => {
    if (info.menuItemId !== MENU_ID || !info.selectionText) return
    await setPendingQuery(info.selectionText)
    try {
      // Chrome 127+ and Safari open the popup programmatically after a user gesture.
      await browser.action.openPopup()
    } catch {
      // Older browsers: the query waits until the person clicks the icon.
      await browser.action.setBadgeText({ text: '1' })
      await browser.action.setBadgeBackgroundColor({ color: '#7C3AED' })
    }
  })
})
