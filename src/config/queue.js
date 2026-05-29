const PQueue = require("p-queue").default;

// Telegram Bot API limits:
// - 30 messages/second globally
// - 1 message/second per chat
// - 20 messages/minute in the same group
//
// We use 25/s to leave headroom for polling overhead

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

let isBulkRunning = false;
let activeBulkType = null;

function canStartBulk(type) {
  if (isBulkRunning) {
    console.warn(`[QUEUE] Bulk ${activeBulkType} em andamento — ${type} bloqueado`);
    return false;
  }
  return true;
}

function startBulk(type) {
  isBulkRunning = true;
  activeBulkType = type;
  console.log(`[QUEUE] Bulk iniciado: ${type}`);
}

function endBulk(type) {
  if (activeBulkType === type) {
    isBulkRunning = false;
    activeBulkType = null;
    console.log(`[QUEUE] Bulk finalizado: ${type}`);
  }
}

function isBulkActive() {
  return isBulkRunning;
}

function getBulkType() {
  return activeBulkType;
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
  isBulkActive,
  getBulkType,
  enqueue,
  queueSize,
};
