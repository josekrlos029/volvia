import forge from 'node-forge'

/**
 * Detached PKCS#7 signature over `manifest.json`, which is what makes a `.pkpass`
 * installable. Apple checks three things: the signature verifies, the signing
 * certificate chains to the Apple WWDR intermediate, and the pass type identifier
 * inside the certificate matches the one in `pass.json`.
 *
 * In `stub` mode we sign with a self-signed development certificate. The structure
 * produced is byte-for-byte the real thing, which is what our tests assert; only an
 * actual Apple-issued certificate makes a real iPhone accept it.
 */
export interface SigningMaterial {
  /** PEM-encoded pass certificate issued by Apple (or self-signed in dev). */
  certificatePem: string
  /** PEM-encoded private key matching the certificate. */
  privateKeyPem: string
  /** Optional passphrase protecting the private key. */
  passphrase?: string
  /** PEM-encoded Apple WWDR intermediate. Omitted in dev. */
  wwdrPem?: string
}

export function signManifest(manifest: Buffer, material: SigningMaterial): Buffer {
  const certificate = forge.pki.certificateFromPem(material.certificatePem)
  const privateKey = material.passphrase
    ? forge.pki.decryptRsaPrivateKey(material.privateKeyPem, material.passphrase)
    : forge.pki.privateKeyFromPem(material.privateKeyPem)

  if (!privateKey) {
    throw new Error('wallet: could not read the pass private key (wrong passphrase?)')
  }

  const p7 = forge.pkcs7.createSignedData()
  p7.content = forge.util.createBuffer(manifest.toString('binary'))
  p7.addCertificate(certificate)

  // The WWDR intermediate must travel with the pass, otherwise the device cannot
  // build a chain to Apple's root and silently refuses the pass.
  if (material.wwdrPem) {
    p7.addCertificate(forge.pki.certificateFromPem(material.wwdrPem))
  }

  // node-forge types these OIDs as possibly-undefined; they are always present.
  const oids = forge.pki.oids as Record<string, string>

  p7.addSigner({
    key: privateKey,
    certificate,
    digestAlgorithm: oids.sha256!,
    authenticatedAttributes: [
      { type: oids.contentType!, value: oids.data! },
      { type: oids.messageDigest! },
      { type: oids.signingTime!, value: new Date().toISOString() },
    ],
  })

  // `detached` keeps the manifest out of the signature blob, as PassKit requires.
  p7.sign({ detached: true })

  const der = forge.asn1.toDer(p7.toAsn1()).getBytes()
  return Buffer.from(der, 'binary')
}

/** Reads the pass type identifier a certificate was issued for, to catch mismatches early. */
export function passTypeIdentifierFromCertificate(certificatePem: string): string | null {
  try {
    const certificate = forge.pki.certificateFromPem(certificatePem)
    const uid = certificate.subject.getField({ type: '0.9.2342.19200300.100.1.1' })
    return uid?.value ?? null
  } catch {
    return null
  }
}
