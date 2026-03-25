import { Data } from "effect";

export class GrafanaError extends Data.TaggedError("GrafanaError")<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

export class NotFoundError extends Data.TaggedError("NotFoundError")<{
  readonly resource: string;
  readonly id: string;
}> {}
