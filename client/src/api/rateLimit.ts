export class RateLimitError extends Error {
  retryAfterSeconds: number

  constructor(retryAfterSeconds: number, message: string) {
    super(message)
    this.name = 'RateLimitError'
    this.retryAfterSeconds = retryAfterSeconds
  }
}

export function parseRetryAfterSeconds(
  body: unknown,
  headerValue: string | null,
): number {
  if (body && typeof body === 'object' && 'detail' in body) {
    const detail = (body as { detail?: unknown }).detail
    if (detail && typeof detail === 'object' && 'retry_after_seconds' in detail) {
      const seconds = Number(
        (detail as { retry_after_seconds?: unknown }).retry_after_seconds,
      )
      if (Number.isFinite(seconds) && seconds > 0) {
        return Math.ceil(seconds)
      }
    }
  }

  if (headerValue) {
    const seconds = Number(headerValue)
    if (Number.isFinite(seconds) && seconds > 0) {
      return Math.ceil(seconds)
    }
  }

  return 60
}

export async function readRateLimitFromResponse(
  response: Response,
): Promise<RateLimitError> {
  let body: unknown = null
  try {
    body = await response.json()
  } catch {
    body = null
  }

  const seconds = parseRetryAfterSeconds(body, response.headers.get('Retry-After'))
  const message =
    body &&
    typeof body === 'object' &&
    'detail' in body &&
    typeof (body as { detail?: unknown }).detail === 'object' &&
    (body as { detail?: { message?: string } }).detail?.message
      ? String((body as { detail: { message: string } }).detail.message)
      : `Daily limit reached. Try again in ${seconds} seconds.`

  return new RateLimitError(seconds, message)
}
