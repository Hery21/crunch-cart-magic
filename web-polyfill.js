/**
 * Web Polyfill for Expo React Native App
 *
 * This polyfill provides web-compatible alternatives for native modules
 * that don't work in static web builds (e.g., AsyncStorage).
 *
 * It automatically detects the web environment and patches modules accordingly.
 */

const isWeb = typeof window !== "undefined" && typeof document !== "undefined";

/**
 * LocalStorage-backed implementation of AsyncStorage for web
 * Mirrors the async API of @react-native-async-storage/async-storage
 */
const WebAsyncStorage = {
  getItem: async (key) => {
    try {
      return localStorage.getItem(key) ?? null;
    } catch (e) {
      console.warn(`[WebAsyncStorage] Failed to get item ${key}:`, e);
      return null;
    }
  },

  setItem: async (key, value) => {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      console.warn(`[WebAsyncStorage] Failed to set item ${key}:`, e);
      throw e;
    }
  },

  removeItem: async (key) => {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.warn(`[WebAsyncStorage] Failed to remove item ${key}:`, e);
      throw e;
    }
  },

  getAllKeys: async () => {
    try {
      return Object.keys(localStorage);
    } catch (e) {
      console.warn("[WebAsyncStorage] Failed to get all keys:", e);
      return [];
    }
  },

  multiGet: async (keys) => {
    try {
      return keys.map((key) => [key, localStorage.getItem(key) ?? null]);
    } catch (e) {
      console.warn("[WebAsyncStorage] Failed to multiGet:", e);
      return keys.map((key) => [key, null]);
    }
  },

  multiSet: async (keyValuePairs) => {
    try {
      keyValuePairs.forEach(([key, value]) => {
        localStorage.setItem(key, value);
      });
    } catch (e) {
      console.warn("[WebAsyncStorage] Failed to multiSet:", e);
      throw e;
    }
  },

  multiRemove: async (keys) => {
    try {
      keys.forEach((key) => {
        localStorage.removeItem(key);
      });
    } catch (e) {
      console.warn("[WebAsyncStorage] Failed to multiRemove:", e);
      throw e;
    }
  },

  clear: async () => {
    try {
      localStorage.clear();
    } catch (e) {
      console.warn("[WebAsyncStorage] Failed to clear:", e);
      throw e;
    }
  },
};

/**
 * Initialize web polyfills if running on web
 */
if (isWeb) {
  console.log("[WebPolyfill] Initializing web polyfills...");

  // Polyfill @react-native-async-storage/async-storage
  try {
    // Register the AsyncStorage module replacement
    if (typeof global !== "undefined") {
      global.__REACT_NATIVE_ASYNC_STORAGE__ = WebAsyncStorage;
    }

    // Also try to patch the module cache if available
    if (typeof require !== "undefined" && require.cache) {
      // Patch the cached AsyncStorage module
      const asyncStorageModule = {
        default: WebAsyncStorage,
        ...WebAsyncStorage,
      };

      // This handles both named and default imports
      if (typeof require.cache !== "undefined") {
        const keys = Object.keys(require.cache);
        for (const key of keys) {
          if (key.includes("async-storage")) {
            require.cache[key].exports = asyncStorageModule;
            break;
          }
        }
      }
    }

    console.log("[WebPolyfill] AsyncStorage polyfill registered");
  } catch (e) {
    console.warn("[WebPolyfill] Failed to register AsyncStorage polyfill:", e);
  }

  // Suppress native module bridge warnings
  const originalWarn = console.warn;
  console.warn = function (...args) {
    const message = args[0]?.toString() ?? "";

    // Filter out the specific bridge-related error
    if (
      message.includes("message channel closed") ||
      message.includes("Native module") ||
      message.includes("Tried to get module")
    ) {
      console.log("[WebPolyfill] Suppressed native module warning:", args[0]);
      return;
    }

    originalWarn.apply(console, args);
  };

  console.log("[WebPolyfill] Web environment detected and polyfilled");
}

export default WebAsyncStorage;
