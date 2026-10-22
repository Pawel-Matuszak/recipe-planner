import { toNextJsHandler } from "better-auth/next-js";
import { getAuth } from "../../../../server/identity/auth";

// the handler is built per request so the auth instance (and its database pool) is created lazily
export const GET = (req: Request) => toNextJsHandler(getAuth()).GET(req);
export const POST = (req: Request) => toNextJsHandler(getAuth()).POST(req);
