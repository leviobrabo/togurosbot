const test = require("node:test");
const assert = require("node:assert/strict");
const {
  dateKey,
  extractStartSource,
  calculateProductMetrics,
  buildProductMetricsText,
} = require("../src/services/productMetrics");

test("dateKey usa formato UTC yyyy-mm-dd", () => {
  assert.equal(dateKey(new Date("2026-06-01T12:30:00.000Z")), "2026-06-01");
});

test("extractStartSource normaliza origem do /start", () => {
  assert.equal(extractStartSource("/start canal_filmes"), "canal_filmes");
  assert.equal(extractStartSource("/start@togurosbot anuncio_y"), "anuncio_y");
  assert.equal(extractStartSource("/start"), "direct");
});

test("buildProductMetricsText inclui metricas principais", () => {
  const text = buildProductMetricsText({
    totalUsers: 100,
    dau: 10,
    wau: 35,
    mau: 70,
    wauTotalRate: "35.00%",
    silent30d: 30,
    vipUsers: [{ user_id: 1 }],
    retention: {
      d1Rate: "40.00%",
      d1Returned: 4,
      d1Cohort: 10,
      d7Rate: "20.00%",
      d7Returned: 2,
      d7Cohort: 10,
      d30Rate: "8.00%",
      d30Returned: 1,
      d30Cohort: 12,
    },
  });

  assert.match(text, /DAU/);
  assert.match(text, /WAU \/ Total/);
  assert.match(text, /D7/);
  assert.match(text, /Silenciosos/);
});

test("calculateProductMetrics calcula atividade, retencao e origem", async () => {
  const docs = [
    {
      user_id: 1,
      first_seen_day: "2026-05-31",
      active_days: ["2026-05-31", "2026-06-01"],
      source: "canal",
      action_count: 10,
    },
    {
      user_id: 2,
      first_seen_day: "2026-05-25",
      active_days: ["2026-05-25", "2026-06-01"],
      source: "grupo",
      action_count: 5,
    },
    {
      user_id: 3,
      first_seen_day: "2026-05-02",
      active_days: ["2026-05-02"],
      source: "canal",
      action_count: 1,
    },
  ];

  const matches = (doc, query = {}) => Object.entries(query).every(([key, expected]) => {
    const value = doc[key];
    if (expected && typeof expected === "object" && "$in" in expected) {
      return Array.isArray(value) && value.some((item) => expected.$in.includes(item));
    }
    if (Array.isArray(value)) return value.includes(expected);
    return value === expected;
  });

  const UserModel = {
    countDocuments(query) {
      if (!query) return Promise.resolve(docs.length);
      return Promise.resolve(docs.filter((doc) => matches(doc, query)).length);
    },
    aggregate() {
      return Promise.resolve([
        { _id: "canal", count: 2 },
        { _id: "grupo", count: 1 },
      ]);
    },
    find() {
      return {
        sort() { return this; },
        limit() { return this; },
        lean() { return this; },
        select() {
          return Promise.resolve([...docs].sort((a, b) => b.action_count - a.action_count));
        },
      };
    },
  };

  const metrics = await calculateProductMetrics(UserModel, new Date("2026-06-01T12:00:00.000Z"));

  assert.equal(metrics.totalUsers, 3);
  assert.equal(metrics.dau, 2);
  assert.equal(metrics.wau, 2);
  assert.equal(metrics.mau, 2);
  assert.equal(metrics.retention.d1Returned, 1);
  assert.equal(metrics.retention.d7Returned, 1);
  assert.equal(metrics.sourceBreakdown[0].source, "canal");
  assert.equal(metrics.vipUsers[0].user_id, 1);
});
