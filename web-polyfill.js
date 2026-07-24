/**
 * Web Polyfill for Expo React Native App
 *
 * This polyfill provides web-compatible alternatives for native modules
 * and mocks the React Native bridge to prevent "message channel closed" errors.
 */

const isWeb = typeof window !== "undefined" && typeof document !== "undefined";

if (isWeb) {
  console.log("[WebPolyfill] Initializing web polyfills...");

  // -----------------------------------------------------------------
  // 1. MOCK THE NATIVE BRIDGE (prevents "message channel" errors)
  // -----------------------------------------------------------------

  // Mock the global React Native bridge object
  if (!window.__fbBatchedBridge) {
    window.__fbBatchedBridge = {
      callFunctionReturnFlushedQueue: () => null,
      flushedQueue: () => null,
      invokeCallbackAndReturnFlushedQueue: () => null,
    };
  }

  // Mock the native event emitter used by Expo modules
  if (!window.RCTDeviceEventEmitter) {
    const listeners = new Map();
    window.RCTDeviceEventEmitter = {
      emit: (event, ...args) => {
        const callbacks = listeners.get(event) || [];
        callbacks.forEach((cb) => cb(...args));
      },
      addListener: (event, callback) => {
        if (!listeners.has(event)) listeners.set(event, []);
        listeners.get(event).push(callback);
        return {
          remove: () => {
            const arr = listeners.get(event);
            if (arr) {
              const idx = arr.indexOf(callback);
              if (idx !== -1) arr.splice(idx, 1);
            }
          },
        };
      },
      removeAllListeners: (event) => {
        listeners.delete(event);
      },
      removeSubscription: (subscription) => {
        if (subscription && subscription.remove) subscription.remove();
      },
    };
  }

  // Mock the native module proxy (used by expo modules)
  if (!window.nativeModuleProxy) {
    window.nativeModuleProxy = {};
  }

  // Mock the native module registry (used by expo-router)
  if (!window.__expo_native_modules__) {
    window.__expo_native_modules__ = {};
  }

  // Mock ExpoModules global (used by some expo packages)
  if (!window.ExpoModules) {
    window.ExpoModules = {};
  }

  // Mock the React Native "NativeModules" global
  if (!window.NativeModules) {
    window.NativeModules = {};
  }

  // Mock the react-native "Platform" module (prevents errors when checking OS)
  if (!window.__REACT_NATIVE_PLATFORM__) {
    window.__REACT_NATIVE_PLATFORM__ = { OS: "web", select: (obj) => obj.web };
  }

  // -----------------------------------------------------------------
  // 2. POLYFILL ASYNCSTORAGE WITH localStorage
  // -----------------------------------------------------------------

  const WebAsyncStorage = {
    getItem: async (key) => {
      try {
        return localStorage.getItem(key) ?? null;
      } catch {
        return null;
      }
    },
    setItem: async (key, value) => {
      try {
        localStorage.setItem(key, value);
      } catch (e) {
        throw e;
      }
    },
    removeItem: async (key) => {
      try {
        localStorage.removeItem(key);
      } catch (e) {
        throw e;
      }
    },
    getAllKeys: async () => {
      try {
        return Object.keys(localStorage);
      } catch {
        return [];
      }
    },
    multiGet: async (keys) => {
      try {
        return keys.map((k) => [k, localStorage.getItem(k) ?? null]);
      } catch {
        return keys.map((k) => [k, null]);
      }
    },
    multiSet: async (keyValuePairs) => {
      try {
        keyValuePairs.forEach(([k, v]) => localStorage.setItem(k, v));
      } catch (e) {
        throw e;
      }
    },
    multiRemove: async (keys) => {
      try {
        keys.forEach((k) => localStorage.removeItem(k));
      } catch (e) {
        throw e;
      }
    },
    clear: async () => {
      try {
        localStorage.clear();
      } catch (e) {
        throw e;
      }
    },
  };

  // Register the polyfill globally
  if (typeof global !== "undefined") {
    global.__REACT_NATIVE_ASYNC_STORAGE__ = WebAsyncStorage;
  }

  // Attempt to patch the module cache if running in a Node-like environment
  try {
    if (typeof require !== "undefined" && require.cache) {
      const moduleKeys = Object.keys(require.cache);
      for (const key of moduleKeys) {
        if (key.includes("async-storage")) {
          const mod = require.cache[key];
          if (mod && mod.exports) {
            // Patch both default and named exports
            mod.exports = WebAsyncStorage;
            mod.exports.default = WebAsyncStorage;
          }
          break;
        }
      }
    }
  } catch (e) {
    // ignore
  }

  console.log("[WebPolyfill] AsyncStorage polyfill registered");

  // -----------------------------------------------------------------
  // 3. SUPPRESS SPECIFIC WARNINGS (optional but helpful)
  // -----------------------------------------------------------------

  const originalWarn = console.warn;
  console.warn = function (...args) {
    const message = args[0]?.toString?.() || "";
    const suppressedPatterns = [
      "message channel closed",
      "Native module",
      "Tried to get module",
      "RCTDeviceEventEmitter",
      "BatchedBridge",
      "Unable to resolve module",
      "AsyncStorage:",
    ];
    for (const pattern of suppressedPatterns) {
      if (message.includes(pattern)) {
        // Silently suppress
        return;
      }
    }
    originalWarn.apply(console, args);
  };

  console.log("[WebPolyfill] Web environment polyfilled successfully");
}

// Export a dummy default to satisfy module imports
export default null;
