/**
 * Dev-only preload for `firebase emulators:start` in proxied environments.
 *
 * firebase-tools routes *every* request through HTTPS_PROXY and ignores NO_PROXY,
 * which breaks emulator-to-emulator calls on localhost. This patch makes undici's
 * ProxyAgent send loopback requests directly (honouring NO_PROXY semantics) while
 * all external traffic still goes through the proxy. No effect when no proxy is set.
 *
 * Usage: NODE_OPTIONS="--require ./scripts/emulator-loopback-direct.cjs" firebase emulators:start
 */
const path = require("node:path");

function patch(undiciPath) {
  let undici;
  try {
    undici = require(undiciPath);
  } catch {
    return;
  }
  if (!undici.ProxyAgent || undici.ProxyAgent.__loopbackPatched) return;
  const direct = new undici.Agent();
  const LOOPBACK = new Set(["localhost", "127.0.0.1", "::1", "[::1]", "0.0.0.0"]);
  const original = undici.ProxyAgent.prototype.dispatch;
  undici.ProxyAgent.prototype.dispatch = function dispatch(opts, handler) {
    try {
      const host = new URL(String(opts.origin)).hostname;
      if (LOOPBACK.has(host) || host.startsWith("127.")) return direct.dispatch(opts, handler);
    } catch {
      /* fall through */
    }
    return original.call(this, opts, handler);
  };
  undici.ProxyAgent.__loopbackPatched = true;
}

const root = path.resolve(__dirname, "..");
patch(path.join(root, "node_modules/firebase-tools/node_modules/undici"));
patch(path.join(root, "node_modules/undici"));
