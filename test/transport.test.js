const test = require("node:test");
const assert = require("node:assert/strict");
const { attach } = require("../src/transport");
const wait = ms => new Promise(r => setTimeout(r, ms));
test("priority, metrics and blocked recipients", async () => {
  const calls = [];
  const bot = { sendMessage: async (id, text) => {
    calls.push(text);
    if (text === "blocked") throw { response: { body: { error_code: 403, description: "Forbidden: bot was blocked by the user" } } };
    return { message_id: calls.length };
  }};
  const t = attach(bot);
  const first = t.sendBulk(1001, "bulk-1");
  const second = t.sendBulk(1002, "bulk-2");
  const urgent = bot.sendMessage(1003, "urgent");
  await Promise.all([first, second, urgent]);
  assert.ok(calls.indexOf("urgent") < calls.indexOf("bulk-2"));
  assert.equal(t.snapshot().sent, 3);
  await assert.rejects(() => bot.sendMessage(1004, "blocked"));
  assert.equal(t.isBlocked(1004), true);
  await assert.rejects(() => bot.sendMessage(1004, "ignored"));
  assert.ok(!calls.includes("ignored"));
  t.unblock(1004);
  assert.equal(t.isBlocked(1004), false);
});
test("429 is retried after retry_after", async () => {
  let attempts = 0;
  const bot = { sendMessage: async () => {
    attempts++;
    if (attempts === 1) throw { response: { body: { error_code: 429, parameters: { retry_after: 1 } } } };
    return { ok: true };
  }};
  const t = attach(bot);
  await bot.sendMessage(500, "hello");
  assert.equal(attempts, 2);
  assert.equal(t.snapshot().rateLimited, 1);
});
