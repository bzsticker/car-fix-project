import { NextResponse } from "next/server";

export type ApiErrorCode =
  | "ERR_BAD_REQUEST"
  | "ERR_UNAUTHORIZED"
  | "ERR_FORBIDDEN"
  | "ERR_NOT_FOUND"
  | "ERR_VALIDATION"
  | "ERR_LOW_STOCK"
  | "ERR_INTERNAL";

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export function apiError(
  status: number,
  code: ApiErrorCode,
  message: string,
  details?: JsonValue,
) {
  return NextResponse.json(
    {
      error: {
        code,
        message,
        ...(details !== undefined ? { details } : {}),
      },
    },
    { status },
  );
}

export function apiSuccess<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function apiPaginated<T>(
  data: T,
  pagination: {
    page: number;
    limit: number;
    total_records: number;
    total_pages: number;
  },
  init?: ResponseInit,
) {
  return NextResponse.json({ data, pagination }, init);
}
