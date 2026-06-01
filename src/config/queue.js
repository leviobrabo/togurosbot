const PQueue = require("p-queue").default;

// Telegram Bot API limits:
// - 30 messages/second globally
// - 1 message/second per chat
// - 20 messages/minute in the same group
//
// We use 25/s to leave headroom for polling overhead.

const botQueue = new PQueue({
  concurrency: 1,
  interval: 1000,
  intervalCap: 25,
});

const PRIORITY = {
  CRITICAL: 100,
  HIGH: 50,
  NORMAL: 10,
  LOW: 1,
};

const DELAY_USER = 1500;
const DELAY_GROUP = 3000;
const BULK_MAX_AGE_MS = Number(process.env.BULK_MAX_AGE_MS || 2 * 60 * 60 * 1000);

let isBulkRunning = false;
let activeBulkType = null;
let bulkStartedAt = null;

function clearStaleBulk(now = Date.now()) {
  if (!isBulkRunning || !bulkStartedAt) return false;
  const ageMs = now - bulkStartedAt.getTime();
  if (ageMs < BULK_MAX_AGE_MS) return false;

  console.warn(`[QUEUE] Bulk ${activeBulkType} expirou apos ${Math.round(ageMs / 1000)}s. Liberando lock.`);
  isBulkRunning = false;
  activeBulkType = null;
  bulkStartedAt = null;
  return true;
}

function canStartBulk(type) {
  clearStaleBulk();
  if (isBulkRunning) {
    console.warn(`[QUEUE] Bulk ${activeBulkType} em andamento - ${type} bloqueado`);
    return false;
  }
  return true;
}

function startBulk(type) {
  clearStaleBulk();
  isBulkRunning = true;
  activeBulkType = type;
  bulkStartedAt = new Date();
  console.log(`[QUEUE] Bulk iniciado: ${type}`);
}

function endBulk(type) {
  if (activeBulkType === type) {
    isBulkRunning = false;
    activeBulkType = null;
    bulkStartedAt = null;
    console.log(`[QUEUE] Bulk finalizado: ${type}`);
  }
}

function forceEndBulk() {
  if (!isBulkRunning) return false;
  console.warn(`[QUEUE] Bulk ${activeBulkType} liberado manualmente.`);
  isBulkRunning = false;
  activeBulkType = null;
  bulkStartedAt = null;
  return true;
}

function isBulkActive() {
  clearStaleBulk();
  return isBulkRunning;
}

function getBulkType() {
  clearStaleBulk();
  return activeBulkType;
}

function getBulkStatus() {
  clearStaleBulk();
  return {
    active: isBulkRunning,
    type: activeBulkType,
    startedAt: bulkStartedAt,
    ageMs: bulkStartedAt ? Date.now() - bulkStartedAt.getTime() : 0,
    maxAgeMs: BULK_MAX_AGE_MS,
  };
}

function enqueue(fn, priority = PRIORITY.NORMAL) {
  return botQueue.add(fn, { priority });
}

function queueSize() {
  return botQueue.size + botQueue.pending;
}

module.exports = {
  botQueue,
  PRIORITY,
  DELAY_USER,
  DELAY_GROUP,
  canStartBulk,
  startBulk,
  endBulk,
  forceEndBulk,
  isBulkActive,
  getBulkType,
  getBulkStatus,
  clearStaleBulk,
  enqueue,
  queueSize,
};
