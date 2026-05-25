const TelegramBot = require("node-telegram-bot-api");

const bot = new TelegramBot(process.env.TELEGRAM_API, {
  polling: {
    interval: 300,
    autoStart: true,
    params: {
      timeout: 10,
    },
  },
  onlyFirstMatch: true,
});

bot.catchGlobal = (err) => {
  const msg = err?.message ?? String(err);
  const code = err?.response?.body?.error_code;
  if (code === 429) {
    const retryAfter = err?.response?.body?.parameters?.retry_after || 5;
    console.warn(`[RATE-LIMIT] 429 — aguardando ${retryAfter}s`);
    return;
  }
  if (msg.includes("ETELEGRAM") || msg.includes("message to be replied not found") || msg.includes("message to delete not found") || msg.includes("message is not modified") || msg.includes("Bad Request")) {
    console.warn(`[TG-WARN] ${msg}`);
    return;
  }
  console.error(`[TG-ERR] ${msg}`);
};

exports.bot = bot;
