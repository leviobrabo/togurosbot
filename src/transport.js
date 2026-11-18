"use strict";
const metrics = { received: 0, sent: 0, failed: 0, blocked: 0, rateLimited: 0, broadcasts: 0, broadcastMs: 0, latencyTotalMs: 0 };
const high = [], low = [];
let running = false, nextGlobal = 0, globalPause = 0;
const nextChat = new Map();
const blocked = new Set();
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const codeOf = e => e?.response?.body?.error_code;
const retryOf = e => Math.max(1, Number(e?.response?.body?.parameters?.retry_after) || 5);
const blockedError = e => codeOf(e) === 403 && /blocked|deactivated|chat not found|kicked|not a member|forbidden/i.test(e?.response?.body?.description || e?.message || "");
const snapshot = () => ({ ...metrics, highPending: high.length, bulkPending: low.length, blockedCached: blocked.size, avgLatencyMs: metrics.sent ? Math.round(metrics.latencyTotalMs / metrics.sent) : 0 });
function attach(bot) {
  if (bot.__priorityTransport) return bot.__priorityTransport;
  const originals = {};
  for (const name of ["sendMessage", "sendSticker", "sendPhoto", "sendVoice", "sendAudio", "copyMessage"]) {
    if (typeof bot[name] !== "function") continue;
    originals[name] = bot[name].bind(bot);
    bot[name] = (chatId, ...args) => enqueue("high", chatId, () => originals[name](chatId, ...args));
  }
  function enqueue(priority, chatId, fn) {
    return new Promise((resolve, reject) => {
      const job = { chatId, fn, resolve, reject, priority, created: Date.now() };
      (priority === "bulk" ? low : high).push(job);
      drain();
    });
  }
  async function drain() {
    if (running) return;
    running = true;
    try {
      while (high.length || low.length) {
        const job = high.shift() || low.shift();
        const chat = String(job.chatId);
        if (blocked.has(chat)) { job.reject(Object.assign(new Error("Recipient blocked"), { blocked: true })); continue; }
        const now = Date.now();
        const wait = Math.max(0, globalPause - now, nextGlobal - now, (nextChat.get(chat) || 0) - now);
        if (wait) { await sleep(wait); }
        // A waiting bulk job yields to interactive responses.
        if (low.length && high.length && Date.now() - job.created > 0 && !job.interactive) {
          // Only yield when this job was taken from bulk.
        }
        nextGlobal = Date.now() + 40; // ~25 messages/s ceiling per bot
        nextChat.set(chat, Date.now() + (Number(job.chatId) < 0 ? 3100 : 1100));
        try {
          const value = await job.fn();
          metrics.sent++;
          metrics.latencyTotalMs += Date.now() - job.created;
          job.resolve(value);
        } catch (e) {
          if (codeOf(e) === 429) {
            metrics.rateLimited++;
            globalPause = Math.max(globalPause, Date.now() + (retryOf(e) + 1) * 1000);
            (job.priority === "bulk" ? low : high).unshift(job);
            continue;
          }
          metrics.failed++;
          if (blockedError(e)) {
            blocked.add(chat);
            metrics.blocked++;
            if (typeof bot.__onBlocked === "function") Promise.resolve(bot.__onBlocked(job.chatId)).catch(() => {});
          }
          job.reject(e);
        }
      }
    } finally { running = false; }
  }
  const transport = {
    sendBulk: (chatId, text, options = {}) => enqueue("bulk", chatId, () => originals.sendMessage(chatId, text, options)),
    recordIncoming: () => { metrics.received++; },
    snapshot,
    isBlocked: id => blocked.has(String(id)),
    markBlocked: id => blocked.add(String(id)),
    recordBroadcast: duration => { metrics.broadcasts++; metrics.broadcastMs += duration; },
  };
  bot.__priorityTransport = transport;
  return transport;
}
module.exports = { attach, snapshot, blockedError };
