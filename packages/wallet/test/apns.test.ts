import { type Http2SecureServer, createSecureServer } from 'node:http2'
import type { AddressInfo } from 'node:net'
import forge from 'node-forge'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { isDeadPushToken, sendPassUpdatePushes } from '../src/apple/apns'

function selfSigned(commonName: string): { certificatePem: string; privateKeyPem: string } {
  const keys = forge.pki.rsa.generateKeyPair(2048)
  const cert = forge.pki.createCertificate()
  cert.publicKey = keys.publicKey
  cert.serialNumber = '01'
  cert.validity.notBefore = new Date(Date.now() - 60_000)
  cert.validity.notAfter = new Date(Date.now() + 3_600_000)
  const attrs = [{ name: 'commonName', value: commonName }]
  cert.setSubject(attrs)
  cert.setIssuer(attrs)
  cert.setExtensions([{ name: 'subjectAltName', altNames: [{ type: 2, value: 'localhost' }] }])
  cert.sign(keys.privateKey, forge.md.sha256.create())
  return {
    certificatePem: forge.pki.certificateToPem(cert),
    privateKeyPem: forge.pki.privateKeyToPem(keys.privateKey),
  }
}

interface Received {
  path: string
  topic: string | undefined
  body: string
  clientCertificate: boolean
}

describe('sendPassUpdatePushes', () => {
  const serverIdentity = selfSigned('localhost')
  const clientIdentity = selfSigned('pass.co.volvia.loyalty')
  const received: Received[] = []
  let server: Http2SecureServer
  let host: string

  beforeAll(async () => {
    server = createSecureServer({
      cert: serverIdentity.certificatePem,
      key: serverIdentity.privateKeyPem,
      requestCert: true,
      rejectUnauthorized: false,
    })
    server.on('stream', (stream, headers) => {
      let body = ''
      stream.setEncoding('utf8')
      stream.on('data', (chunk: string) => {
        body += chunk
      })
      stream.on('end', () => {
        const path = String(headers[':path'])
        const socket = stream.session?.socket as { getPeerCertificate?: () => object } | undefined
        received.push({
          path,
          topic: headers['apns-topic'] as string | undefined,
          body,
          clientCertificate: Object.keys(socket?.getPeerCertificate?.() ?? {}).length > 0,
        })
        if (path.endsWith('/gone-token')) {
          stream.respond({ ':status': 410, 'content-type': 'application/json' })
          stream.end(JSON.stringify({ reason: 'Unregistered' }))
          return
        }
        stream.respond({ ':status': 200 })
        stream.end()
      })
    })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    host = `https://localhost:${(server.address() as AddressInfo).port}`
  })

  afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())))

  it('posts an empty body to each device with the pass type id as topic', async () => {
    const results = await sendPassUpdatePushes({
      pushTokens: ['live-token', 'gone-token'],
      topic: 'pass.co.volvia.loyalty',
      signing: clientIdentity,
      host,
      ca: serverIdentity.certificatePem,
    })

    expect(results).toEqual([
      { token: 'live-token', status: 200, reason: null },
      { token: 'gone-token', status: 410, reason: 'Unregistered' },
    ])
    expect(received.map((entry) => entry.path).sort()).toEqual([
      '/3/device/gone-token',
      '/3/device/live-token',
    ])
    for (const entry of received) {
      expect(entry.topic).toBe('pass.co.volvia.loyalty')
      expect(entry.body).toBe('{}')
      expect(entry.clientCertificate).toBe(true)
    }
    expect(results.filter(isDeadPushToken).map((result) => result.token)).toEqual(['gone-token'])
  })

  it('does nothing without tokens', async () => {
    await expect(
      sendPassUpdatePushes({ pushTokens: [], topic: 't', signing: clientIdentity, host }),
    ).resolves.toEqual([])
  })
})
