/**
 * GlobalTestState - Mirrors the Kotlin GlobalTestState pattern.
 * Caches tokens and extracted variables with TTL support.
 * Persists across test runs within the same browser session.
 * 
 * Usage:
 *   globalTestState.set("customer_access_token_DEV", token)
 *   globalTestState.setWithTTL("customer_access_token_DEV", token, 15 * 60 * 1000)
 *   globalTestState.get("customer_access_token_DEV") // returns null if expired
 */

const DEFAULT_TTL_MS = 15 * 60 * 1000; // 15 minutes

class GlobalTestState {
  constructor() {
    this.store = new Map();
    this.timestamps = new Map();
    this.ttls = new Map();
  }

  /**
   * Set a value without TTL (lives forever in the session).
   */
  set(key, value) {
    this.store.set(key, value);
    this.timestamps.set(key, Date.now());
    this.ttls.delete(key); // no expiry
  }

  /**
   * Set a value with a TTL. Default is 15 minutes.
   */
  setWithTTL(key, value, ttlMs = DEFAULT_TTL_MS) {
    this.store.set(key, value);
    this.timestamps.set(key, Date.now());
    this.ttls.set(key, ttlMs);
  }

  /**
   * Get a value. Returns null if not found or expired.
   */
  get(key) {
    if (!this.store.has(key)) return null;

    const ttl = this.ttls.get(key);
    if (ttl !== undefined) {
      const elapsed = Date.now() - this.timestamps.get(key);
      if (elapsed > ttl) {
        // Expired — clean up
        this.store.delete(key);
        this.timestamps.delete(key);
        this.ttls.delete(key);
        return null;
      }
    }

    return this.store.get(key);
  }

  /**
   * Check if a key exists and is NOT expired.
   */
  has(key) {
    return this.get(key) !== null;
  }

  /**
   * Get the timestamp when a key was last set.
   */
  getTimestamp(key) {
    return this.timestamps.get(key) || null;
  }

  /**
   * Get remaining TTL in ms. Returns null if no TTL or expired.
   */
  getRemainingTTL(key) {
    if (!this.store.has(key) || !this.ttls.has(key)) return null;
    const ttl = this.ttls.get(key);
    const elapsed = Date.now() - this.timestamps.get(key);
    const remaining = ttl - elapsed;
    return remaining > 0 ? remaining : null;
  }

  /**
   * Remove a specific key.
   */
  remove(key) {
    this.store.delete(key);
    this.timestamps.delete(key);
    this.ttls.delete(key);
  }

  /**
   * Clear all state.
   */
  clear() {
    this.store.clear();
    this.timestamps.clear();
    this.ttls.clear();
  }

  /**
   * Get all non-expired entries as a plain object (for debugging/logging).
   */
  toJSON() {
    const result = {};
    for (const [key] of this.store) {
      const value = this.get(key); // triggers expiry check
      if (value !== null) {
        const remaining = this.getRemainingTTL(key);
        result[key] = {
          value,
          setAt: new Date(this.timestamps.get(key)).toISOString(),
          remainingMs: remaining,
          remainingFormatted: remaining 
            ? `${Math.floor(remaining / 60000)}m ${Math.floor((remaining % 60000) / 1000)}s` 
            : 'no TTL'
        };
      }
    }
    return result;
  }
}

// Singleton — shared across the entire dashboard session
export const globalTestState = new GlobalTestState();
