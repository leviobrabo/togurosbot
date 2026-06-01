const DAY_MS = 24 * 60 * 60 * 1000;

function dateKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function dateKeyDaysAgo(days, now = new Date()) {
  return dateKey(new Date(now.getTime() - days * DAY_MS));
}

function extractStartSource(text = "") {
  const match = String(text).trim().match(/^\/start(?:@\w+)?(?:\s+(.+))?$/i);
  if (!match || !match[1]) return "direct";
  return match[1].trim().slice(0, 80) || "direct";
}

function pct(part, total) {
  if (!total) return "0.00%";
  return `${((part / total) * 100).toFixed(2)}%`;
}

function buildProductMetricsText(metrics) {
  return (
    `📈 <b>Métricas de Produto - Toguro</b>\n\n` +
    `👥 <b>Total:</b> <code>${metrics.totalUsers}</code>\n` +
    `☀️ <b>DAU:</b> <code>${metrics.dau}</code>\n` +
    `📅 <b>WAU:</b> <code>${metrics.wau}</code>\n` +
    `🗓 <b>MAU:</b> <code>${metrics.mau}</code>\n` +
    `🔥 <b>WAU / Total:</b> <code>${metrics.wauTotalRate}</code>\n\n` +
    `🔁 <b>Retenção</b>\n` +
    `D1: <code>${metrics.retention.d1Rate}</code> (${metrics.retention.d1Returned}/${metrics.retention.d1Cohort})\n` +
    `D7: <code>${metrics.retention.d7Rate}</code> (${metrics.retention.d7Returned}/${metrics.retention.d7Cohort})\n` +
    `D30: <code>${metrics.retention.d30Rate}</code> (${metrics.retention.d30Returned}/${metrics.retention.d30Cohort})\n\n` +
    `😶 <b>Silenciosos 30d:</b> <code>${metrics.silent30d}</code>\n` +
    `⭐ <b>VIPs por ações:</b> <code>${metrics.vipUsers.length}</code>\n\n` +
    `💰 <b>Receita / churn:</b> ainda sem evento financeiro no banco.`
  );
}

async function calculateProductMetrics(UserModel, now = new Date()) {
  const today = dateKey(now);
  const last7 = Array.from({ length: 7 }, (_, i) => dateKeyDaysAgo(i, now));
  const last30 = Array.from({ length: 30 }, (_, i) => dateKeyDaysAgo(i, now));

  const d1 = dateKeyDaysAgo(1, now);
  const d7 = dateKeyDaysAgo(7, now);
  const d30 = dateKeyDaysAgo(30, now);

  const [
    totalUsers,
    dau,
    wau,
    mau,
    d1Cohort,
    d1Returned,
    d7Cohort,
    d7Returned,
    d30Cohort,
    d30Returned,
    sourceBreakdown,
    vipUsers,
  ] = await Promise.all([
    UserModel.countDocuments(),
    UserModel.countDocuments({ active_days: today }),
    UserModel.countDocuments({ active_days: { $in: last7 } }),
    UserModel.countDocuments({ active_days: { $in: last30 } }),
    UserModel.countDocuments({ first_seen_day: d1 }),
    UserModel.countDocuments({ first_seen_day: d1, active_days: today }),
    UserModel.countDocuments({ first_seen_day: d7 }),
    UserModel.countDocuments({ first_seen_day: d7, active_days: today }),
    UserModel.countDocuments({ first_seen_day: d30 }),
    UserModel.countDocuments({ first_seen_day: d30, active_days: today }),
    UserModel.aggregate([
      { $group: { _id: "$source", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]),
    UserModel.find()
      .sort({ action_count: -1, last_seen_at: -1 })
      .limit(10)
      .lean()
      .select("user_id username firstname action_count last_seen_at"),
  ]);

  return {
    totalUsers,
    dau,
    wau,
    mau,
    wauTotalRate: pct(wau, totalUsers),
    silent30d: Math.max(totalUsers - mau, 0),
    retention: {
      d1Cohort,
      d1Returned,
      d1Rate: pct(d1Returned, d1Cohort),
      d7Cohort,
      d7Returned,
      d7Rate: pct(d7Returned, d7Cohort),
      d30Cohort,
      d30Returned,
      d30Rate: pct(d30Returned, d30Cohort),
    },
    sourceBreakdown: sourceBreakdown.map((item) => ({
      source: item._id || "direct",
      count: item.count,
    })),
    vipUsers,
  };
}

module.exports = {
  dateKey,
  extractStartSource,
  calculateProductMetrics,
  buildProductMetricsText,
};
