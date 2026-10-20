declare const __API_URL__: string
declare const __APP_URL__: string

/** Set at build time by `wxt.config.ts`: production unless WXT_API_URL says otherwise. */
export const API_URL = __API_URL__
export const APP_URL = __APP_URL__
