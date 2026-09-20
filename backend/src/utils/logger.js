const isDev = process.env.NODE_ENV !== "production";

const logger = {
  info: (...args) => console.log("[INFO]", ...args),
  warn: (...args) => console.warn("[WARN]", ...args),
  error: (...args) => console.error("[ERROR]", ...args),
  debug: isDev ? (...args) => console.log("[DEBUG]", ...args) : () => {},
};

module.exports = logger;
