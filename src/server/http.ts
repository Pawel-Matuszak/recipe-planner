// Shared plumbing for route handlers: who is calling, JSON in/out, and turning errors into responses.
import { z } from "zod";
import { DomainError, unauthorized } from "./errors";
import { sessionUser, type SessionUser } from "./identity/auth";

type Handler = (user: SessionUser, req: Request) => Promise<unknown>;

/** Runs `fn` for a signed-in user. Replies `{ ok, result }`, or `{ error, message }` with a fitting status. */
export function withUser(fn: Handler) {
  return async (req: Request): Promise<Response> => {
    try {
      const user = await sessionUser(req.headers);
      if (!user) throw unauthorized();
      return Response.json({ ok: true, result: (await fn(user, req)) ?? null });
    } catch (e) {
      return errorResponse(e);
    }
  };
}

export async function readBody<T extends z.ZodType>(req: Request, schema: T): Promise<z.infer<T>> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new DomainError("bad_json", "Nieprawidłowe zapytanie.");
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw new DomainError("invalid", "Nieprawidłowe dane: " + z.prettifyError(parsed.error));
  return parsed.data;
}

export function errorResponse(e: unknown): Response {
  if (e instanceof DomainError) return Response.json({ error: e.code, message: e.message }, { status: e.status });
  console.error(e);
  return Response.json({ error: "server", message: "Coś poszło nie tak po stronie serwera." }, { status: 500 });
}
