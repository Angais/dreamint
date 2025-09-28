const DEBUG_PREFIX = "[Dreamint]" as const;

export function debugLog(message: string, ...optional: unknown[]) {
  if (typeof console === "undefined") {
    return;
  }

  if (optional.length === 0) {
    console.log(DEBUG_PREFIX, message);
    return;
  }

  if (optional.length === 1) {
    console.log(DEBUG_PREFIX, message, optional[0]);
    return;
  }

  console.log(DEBUG_PREFIX, message, ...optional);
}
