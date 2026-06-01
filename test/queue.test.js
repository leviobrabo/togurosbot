const test = require("node:test");
const assert = require("node:assert/strict");
const queue = require("../src/config/queue");

test("bulk lock bloqueia concorrencia e libera no endBulk correto", () => {
  queue.forceEndBulk();

  assert.equal(queue.canStartBulk("ADS-USERS"), true);
  queue.startBulk("ADS-USERS");
  assert.equal(queue.canStartBulk("BC"), false);
  assert.equal(queue.getBulkType(), "ADS-USERS");

  queue.endBulk("ADS-GROUPS");
  assert.equal(queue.isBulkActive(), true);

  queue.endBulk("ADS-USERS");
  assert.equal(queue.isBulkActive(), false);
});

test("forceEndBulk libera campanha travada", () => {
  queue.forceEndBulk();
  queue.startBulk("ADS-USERS");

  assert.equal(queue.forceEndBulk(), true);
  assert.equal(queue.canStartBulk("BC"), true);
});
