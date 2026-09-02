/**
 * Centralized Logger utility for Next.js (Client & Server)
 * - Suppresses verbose debug/info logs in production to reduce log volume, save bandwidth and cost.
 * - Preserves warning and error logs for observability in all environments.
 */

const isDev = process.env.NODE_ENV === "development";

export const logger = {
  /**
   * General info log — only outputs in development environment
   */
  info: (...args: any[]) => {
    if (isDev) {
      console.log(...args);
    }
  },

  /**
   * Alias for info
   */
  log: (...args: any[]) => {
    if (isDev) {
      console.log(...args);
    }
  },

  /**
   * Debug level log — only outputs in development environment
   */
  debug: (...args: any[]) => {
    if (isDev) {
      console.debug(...args);
    }
  },

  /**
   * Warning level log — always output
   */
  warn: (...args: any[]) => {
    console.warn(...args);
  },

  /**
   * Error level log — always output
   */
  error: (...args: any[]) => {
    console.error(...args);
  },
};
