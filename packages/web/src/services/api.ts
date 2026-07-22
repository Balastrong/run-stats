export class ApiError extends Error {
  readonly status: number;
  readonly payload: Record<string, unknown>;

  constructor(status: number, payload: Record<string, unknown>) {
    super(
      typeof payload.error === "string"
        ? payload.error
        : `Request failed (${status})`,
    );
    this.status = status;
    this.payload = payload;
  }
}

export async function api(
  path: string,
  init?: RequestInit,
): Promise<Record<string, unknown>> {
  const response = await fetch(path, init);
  const payload = (await response.json()) as Record<string, unknown>;
  if (!response.ok) throw new ApiError(response.status, payload);
  return payload;
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
