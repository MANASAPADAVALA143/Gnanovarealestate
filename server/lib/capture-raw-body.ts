import type { Request, Response } from 'express'

declare module 'express-serve-static-core' {
  interface Request {
    rawBody?: string
  }
}

/** Attach to express.json() / express.urlencoded() via `verify` for webhook signature checks. */
export function captureRawBody(req: Request, _res: Response, buf: Buffer): void {
  if (buf?.length) {
    req.rawBody = buf.toString('utf8')
  }
}
