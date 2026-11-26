type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

export function createRequestCache<T>(ttlMs: number) {
  let generation = 0;
  let cached: CacheEntry<T> | null = null;
  let inFlight: { generation: number; promise: Promise<T> } | null = null;

  return {
    get(load: () => Promise<T>): Promise<T> {
      if (cached && cached.expiresAt > Date.now()) {
        return Promise.resolve(cached.value);
      }

      if (inFlight?.generation === generation) {
        return inFlight.promise;
      }

      const requestGeneration = generation;
      const promise = Promise.resolve()
        .then(load)
        .then((value) => {
          if (generation === requestGeneration) {
            cached = { value, expiresAt: Date.now() + ttlMs };
          }
          return value;
        })
        .finally(() => {
          if (inFlight?.promise === promise) {
            inFlight = null;
          }
        });

      inFlight = { generation: requestGeneration, promise };
      return promise;
    },

    invalidate() {
      generation += 1;
      cached = null;
      inFlight = null;
    },
  };
}

export const requestsCache = createRequestCache<unknown[]>(1_000);