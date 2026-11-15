export type Attempt<T> = { ok: true; value: T } | { ok: false; message: string | null };

/**
 * Runs a request and hands back its result or its error's message, so a component needn't wrap the
 * call in try/catch. The React Compiler can't yet handle a try with a finally, or with a conditional
 * inside, and skips the whole component when it meets one, leaving every render of it unoptimised.
 */
export async function attempt<T>(request: () => Promise<T>): Promise<Attempt<T>> {
  try {
    return { ok: true, value: await request() };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : null };
  }
}
