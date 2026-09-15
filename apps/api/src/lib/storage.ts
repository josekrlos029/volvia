import { randomUUID } from 'node:crypto'
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { ALLOWED_IMAGE_TYPES, MAX_UPLOAD_BYTES } from '@volvia/shared'
import { env } from '../env'

export interface UploadTarget {
  /** Pre-signed PUT the browser uploads straight to, keeping large files off the API. */
  uploadUrl: string
  /** Where the object will be readable once uploaded. */
  publicUrl: string
  key: string
  expiresInSeconds: number
}

export interface StorageAdapter {
  createUploadTarget(input: {
    orgId: string
    kind: 'logo' | 'banner' | 'cover' | 'stamp'
    contentType: string
    contentLength: number
  }): Promise<UploadTarget>
  publicUrlFor(key: string): string
}

function assertUploadable(contentType: string, contentLength: number): void {
  if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(contentType)) {
    throw new Error(`unsupported_content_type:${contentType}`)
  }
  if (contentLength > MAX_UPLOAD_BYTES) {
    throw new Error('file_too_large')
  }
}

/** S3-compatible: MinIO locally, and any S3 API in production (GCS via its S3 endpoint). */
class S3Storage implements StorageAdapter {
  private readonly client: S3Client

  constructor() {
    this.client = new S3Client({
      region: env.STORAGE_REGION,
      endpoint: env.STORAGE_ENDPOINT || undefined,
      forcePathStyle: env.STORAGE_FORCE_PATH_STYLE,
      credentials: {
        accessKeyId: env.STORAGE_ACCESS_KEY,
        secretAccessKey: env.STORAGE_SECRET_KEY,
      },
    })
  }

  async createUploadTarget(input: {
    orgId: string
    kind: 'logo' | 'banner' | 'cover' | 'stamp'
    contentType: string
    contentLength: number
  }): Promise<UploadTarget> {
    assertUploadable(input.contentType, input.contentLength)
    const extension = input.contentType.split('/')[1]?.replace('+xml', '') ?? 'bin'
    const key = `org/${input.orgId}/${input.kind}/${randomUUID()}.${extension}`
    const expiresInSeconds = 300

    const uploadUrl = await getSignedUrl(
      this.client,
      new PutObjectCommand({
        Bucket: env.STORAGE_BUCKET,
        Key: key,
        ContentType: input.contentType,
        ContentLength: input.contentLength,
      }),
      { expiresIn: expiresInSeconds },
    )

    return { uploadUrl, publicUrl: this.publicUrlFor(key), key, expiresInSeconds }
  }

  publicUrlFor(key: string): string {
    const base = env.STORAGE_PUBLIC_URL.replace(/\/$/, '')
    return `${base}/${key}`
  }
}

/** Used by tests so they never need object storage running. */
class MemoryStorage implements StorageAdapter {
  async createUploadTarget(input: {
    orgId: string
    kind: string
    contentType: string
    contentLength: number
  }): Promise<UploadTarget> {
    assertUploadable(input.contentType, input.contentLength)
    const key = `org/${input.orgId}/${input.kind}/${randomUUID()}`
    return {
      uploadUrl: `memory://${key}`,
      publicUrl: this.publicUrlFor(key),
      key,
      expiresInSeconds: 300,
    }
  }

  publicUrlFor(key: string): string {
    return `memory://${key}`
  }
}

export function createStorage(): StorageAdapter {
  return env.STORAGE_DRIVER === 's3' ? new S3Storage() : new MemoryStorage()
}
