import type { Cause, Effect, ManagedRuntime } from "effect";
import { Cause as CauseModule } from "effect";

export const formatSuccess = (data: unknown) => ({
  content: [
    {
      type: "text" as const,
      text: JSON.stringify(data, null, 2),
    },
  ],
});

export const formatError = (cause: Cause.Cause<unknown>) => ({
  content: [
    {
      type: "text" as const,
      text: `Error: ${CauseModule.pretty(cause)}`,
    },
  ],
  isError: true as const,
});

export const runTool = async <R, E, A>(
  runtime: ManagedRuntime.ManagedRuntime<R, E>,
  effect: Effect.Effect<A, E, R>,
) => {
  const result = await runtime.runPromiseExit(effect);
  if (result._tag === "Failure") return formatError(result.cause);
  return formatSuccess(result.value);
};
