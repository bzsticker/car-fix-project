type ApiErrorPayload = {
  error?: {
    message?: string;
  };
};

export async function fetchApi<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    credentials: "same-origin",
    ...init,
  });

  const payload = (await response.json()) as T & ApiErrorPayload;

  if (!response.ok) {
    throw new Error(payload.error?.message ?? "Request failed");
  }

  return payload;
}
