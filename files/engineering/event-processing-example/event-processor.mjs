// Illustrative, in-memory event processor. This is not code from a portfolio product.
export function createEventProcessor({ effect, maxAttempts = 2 }) {
  if (typeof effect !== "function") throw new TypeError("effect must be a function");
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1)
    throw new RangeError("maxAttempts must be a positive integer");

  const completed = new Map();
  const inFlight = new Map();

  async function process(event) {
    if (!event || typeof event.id !== "string" || !event.id.trim())
      throw new TypeError("event.id must be a non-empty string");
    const id = event.id;
    if (completed.has(id)) return { ...completed.get(id), duplicate: true };
    if (inFlight.has(id)) {
      const result = await inFlight.get(id);
      return { ...result, duplicate: true };
    }

    const pending = (async () => {
      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        try {
          const value = await effect(event);
          const result = { id, attempt, value, duplicate: false };
          completed.set(id, result);
          return result;
        } catch (error) {
          if (attempt === maxAttempts) throw error;
        }
      }
    })();
    inFlight.set(id, pending);
    try {
      return await pending;
    } finally {
      inFlight.delete(id);
    }
  }

  return { process };
}
