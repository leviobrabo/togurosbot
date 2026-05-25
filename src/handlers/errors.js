process.on("unhandledRejection", (reason, promise) => {
  const errorMessage = reason?.message ?? String(reason);
  const errorCode = reason?.response?.body?.error_code;
  const desc = reason?.response?.body?.description || "";

  if (errorCode === 429) {
    const retryAfter = reason?.response?.body?.parameters?.retry_after || 5;
    console.warn(`[RATE-LIMIT] 429 — retry after ${retryAfter}s: ${errorMessage}`);
    return;
  }

  if (errorCode === 400 || errorCode === 403) {
    console.warn(`[TG-API] ${errorCode} — ${desc || errorMessage}`);
    return;
  }

  if (
    errorMessage.includes("ETELEGRAM") ||
    errorMessage.includes("polling") ||
    errorMessage.includes("Conflict: terminated") ||
    errorMessage.includes("message to be replied not found") ||
    errorMessage.includes("message to delete not found") ||
    errorMessage.includes("message is not modified") ||
    errorMessage.includes("Bad Request")
  ) {
    console.warn(`[TELEGRAM-ERR] ${errorMessage}`);
    return;
  }

  console.error(`[UNHANDLED] ${errorMessage}`);
});

process.on("uncaughtException", (err) => {
  const msg = err?.message ?? String(err);

  if (
    msg.includes("ETELEGRAM") ||
    msg.includes("polling") ||
    msg.includes("429") ||
    msg.includes("Bad Request") ||
    msg.includes("message to be replied") ||
    msg.includes("message to delete") ||
    msg.includes("message is not modified") ||
    msg.includes("Conflict")
  ) {
    console.warn(`[TELEGRAM-ERR] ${msg}`);
    return;
  }

  console.error(`[FATAL] ${msg}`);
  setTimeout(() => process.exit(1), 1000);
});

module.exports = process;
