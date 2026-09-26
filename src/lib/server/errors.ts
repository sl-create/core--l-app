/** An error whose message is safe to show to the user. */
export class ActionError extends Error {}

export function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new ActionError(message);
}
