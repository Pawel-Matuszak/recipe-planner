// Expected failures of a use case. Route handlers turn them into JSON with the given HTTP status;
// `message` is Polish and shown to the user as is.
export class DomainError extends Error {
  constructor(public code: string, message: string, public status = 400) {
    super(message);
  }
}

export const unauthorized = () => new DomainError("unauthorized", "Zaloguj się ponownie.", 401);
export const forbidden = () => new DomainError("forbidden", "Nie masz do tego uprawnień.", 403);
