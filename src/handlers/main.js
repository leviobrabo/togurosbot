const { MessageModel, ChatModel, UserModel } = require("../database");
const { bot } = require("../bot");
const CronJob = require("cron").CronJob;
const { setTimeout: delay } = require("timers/promises");
const palavrasProibidas = require("./palavrasproibida.json");
const { audioList, photoList } = require("../config/media");
const { adsterra } = require("../config/ads");
const { PRIORITY, DELAY_USER, DELAY_GROUP, canStartBulk, startBulk, endBulk, forceEndBulk, getBulkStatus, isBulkActive, enqueue, queueSize, getBulkType } = require("../config/queue");
const { dateKey, extractStartSource, calculateProductMetrics, buildProductMetricsText } = require("../services/productMetrics");

require("./errors.js");

const groupId = process.env.groupId;
const logMsgId = parseInt(process.env.LOG_MSG_ID) || null;
const channelStatusId = process.env.channelStatusId;

let crashCount = 0;
let lastCrashTime = 0;
const CRASH_LIMIT = 5;
const CRASH_WINDOW = 60000;

function checkCrashLoop() {
  const now = Date.now();
  if (now - lastCrashTime > CRASH_WINDOW) crashCount = 0;
  crashCount++;
  lastCrashTime = now;
  if (crashCount >= CRASH_LIMIT) {
    console.error(`[CRASH-LOOP] ${crashCount} crashes em ${CRASH_WINDOW / 1000}s — parando para evitar loop.`);
    process.exit(2);
  }
}

process.on("uncaughtException", (err) => {
  const msg = err?.message ?? String(err);
  if (msg.includes("ETELEGRAM") || msg.includes("polling") || msg.includes("Conflict")) return;
  checkCrashLoop();
});

process.on("unhandledRejection", (reason) => {
  const msg = reason?.message ?? String(reason);
  const code = reason?.response?.body?.error_code;
  if (code === 429 || msg.includes("ETELEGRAM") || msg.includes("polling")) return;
  checkCrashLoop();
});

// ─── helpers ─────────────────────────────────────────────────────────────────

function is_dev(user_id) {
    const devUsers = (process.env.DEV_USERS || "").split(",").map((s) => s.trim());
    return devUsers.includes(user_id.toString());
}

const GROUP_LANG_OPTIONS = [
  ["pt-br", "Português"],
  ["en", "English"],
  ["es", "Español"],
  ["it", "Italiano"],
  ["fr", "Français"],
  ["de", "Deutsch"],
  ["ru", "Русский"],
  ["tr", "Türkçe"],
  ["id", "Indonesia"],
  ["ar", "العربية"],
  ["hi", "हिन्दी"],
  ["ja", "日本語"],
  ["ko", "한국어"],
  ["zh", "中文"],
  ["unknown", "Automático"],
];

function normalizeLangCode(langCode) {
  const normalized = String(langCode || "unknown").trim().toLowerCase().replace("_", "-");
  if (normalized === "auto") return "unknown";
  if (/^[a-z]{2,3}(?:-[a-z]{2})?$/.test(normalized)) return normalized;
  return "unknown";
}

function buildLangKeyboard() {
  const buttons = GROUP_LANG_OPTIONS.map(([code, label]) => (
    { text: label, callback_data: `group_lang:${code}` }
  ));
  const rows = [];
  for (let i = 0; i < buttons.length; i += 2) rows.push(buttons.slice(i, i + 2));

  return {
    inline_keyboard: rows,
  };
}

function uiLocaleFromUser(user) {
  const lang = normalizeLangCode(user?.language_code);
  if (lang === "pt" || lang.startsWith("pt-")) return "pt-br";
  if (lang === "es" || lang.startsWith("es-")) return "es";
  return "en";
}

const UI_TEXT = {
  "pt-br": {
    groupWelcome: "Olá, me chamo Toguro! Obrigado por me adicionar ao grupo. Vou responder as mensagens da galera aqui kkkkk.",
    devStart: (name) => `Olá, <b>${name}</b>! Você é um dos desenvolvedores 🧑‍💻\n\nVocê está no painel do Toguro. Use os comandos com responsabilidade.`,
    userStart: (name) => `Olá, <b>${name}</b>!\n\nEu sou <b>Toguro</b>, um bot que responde mensagens, áudios e figurinhas da galera 😄\n\n📣 <b>Novidades do bot:</b> <a href="https://t.me/lbrabo">@lbrabo</a>\n📚 <b>Cursos:</b> <a href="https://t.me/cursobroff">@cursobroff</a>`,
    addGroup: "✨ Adicione-me em seu grupo",
    officialChannel: "📣 Canal Oficial",
    support: "👨‍💻 Suporte",
    bugReport: "🐛 Relate Bugs",
    devCommands: "🗃 Comandos do Dev",
    useInGroup: "Use este comando em um grupo.",
    adminOnly: "Apenas admins podem alterar o idioma do grupo.",
    chooseLang: "Escolha o idioma das respostas do Toguro:",
    langSet: (lang) => `Idioma das respostas definido para: <b>${lang}</b>`,
    pong: "𝚙𝚘𝚗𝚐!",
    pingResult: (ms, uptime) => `𝚙𝚒𝚗𝚐: \`${ms}𝚖𝚜\`\n𝚞𝚙𝚝𝚒𝚖𝚎: \`${uptime}\``,
  },
  es: {
    groupWelcome: "Hola, soy Toguro. Gracias por agregarme al grupo. Voy a responder los mensajes de la gente por aquí kkkkk.",
    devStart: (name) => `Hola, <b>${name}</b>. Eres uno de los desarrolladores 🧑‍💻\n\nEstás en el panel de Toguro. Usa los comandos con responsabilidad.`,
    userStart: (name) => `Hola, <b>${name}</b>!\n\nSoy <b>Toguro</b>, un bot que responde mensajes, audios y stickers de la gente 😄\n\n📣 <b>Novedades del bot:</b> <a href="https://t.me/lbrabo">@lbrabo</a>\n📚 <b>Cursos:</b> <a href="https://t.me/cursobroff">@cursobroff</a>`,
    addGroup: "✨ Agrégame a tu grupo",
    officialChannel: "📣 Canal Oficial",
    support: "👨‍💻 Soporte",
    bugReport: "🐛 Reportar bugs",
    devCommands: "🗃 Comandos Dev",
    useInGroup: "Usa este comando en un grupo.",
    adminOnly: "Solo los admins pueden cambiar el idioma del grupo.",
    chooseLang: "Elige el idioma de las respuestas de Toguro:",
    langSet: (lang) => `Idioma de las respuestas definido como: <b>${lang}</b>`,
    pong: "𝚙𝚘𝚗𝚐!",
    pingResult: (ms, uptime) => `𝚙𝚒𝚗𝚐: \`${ms}𝚖𝚜\`\n𝚝𝚒𝚎𝚖𝚙𝚘 𝚊𝚌𝚝𝚒𝚟𝚘: \`${uptime}\``,
  },
  en: {
    groupWelcome: "Hi, I'm Toguro. Thanks for adding me to the group. I'll reply to messages here kkkkk.",
    devStart: (name) => `Hi, <b>${name}</b>. You are one of the developers 🧑‍💻\n\nYou are in the Toguro panel. Use the commands responsibly.`,
    userStart: (name) => `Hi, <b>${name}</b>!\n\nI'm <b>Toguro</b>, a bot that replies to messages, audio, and stickers from the group 😄\n\n📣 <b>Bot news:</b> <a href="https://t.me/lbrabo">@lbrabo</a>\n📚 <b>Courses:</b> <a href="https://t.me/cursobroff">@cursobroff</a>`,
    addGroup: "✨ Add me to your group",
    officialChannel: "📣 Official Channel",
    support: "👨‍💻 Support",
    bugReport: "🐛 Report Bugs",
    devCommands: "🗃 Dev Commands",
    useInGroup: "Use this command in a group.",
    adminOnly: "Only admins can change the group language.",
    chooseLang: "Choose Toguro's reply language:",
    langSet: (lang) => `Reply language set to: <b>${lang}</b>`,
    pong: "𝚙𝚘𝚗𝚐!",
    pingResult: (ms, uptime) => `𝚙𝚒𝚗𝚐: \`${ms}𝚖𝚜\`\n𝚞𝚙𝚝𝚒𝚖𝚎: \`${uptime}\``,
  },
};

function uiText(user, key, ...args) {
  const locale = uiLocaleFromUser(user);
  const value = UI_TEXT[locale][key] || UI_TEXT.en[key];
  return typeof value === "function" ? value(...args) : value;
}

const forbiddenWords = palavrasProibidas.palavras_proibidas;

function containsUrl(text) {
    if (typeof text !== "string") return false;
    return /\b(?:https?:\/\/|www\.)\S+\.(?:[a-z]{2,})(?:\S*)?\b/gi.test(text);
}

function hasForbiddenWord(text) {
    if (typeof text !== "string") return false;
    const lower = text.toLowerCase();
    return forbiddenWords.some((w) => lower.includes(w.toLowerCase()));
}

function timeFormatter(seconds) {
    const h = String(Math.floor(seconds / 3600)).padStart(2, "0");
    const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, "0");
    const s = String(Math.floor(seconds % 60)).padStart(2, "0");
    return `${h}:${m}:${s}`;
}

function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function extractEmojiEntities(entities) {
  if (!Array.isArray(entities)) return [];
  return entities
    .filter((e) => e.type === "custom_emoji" && e.custom_emoji_id)
    .map((e) => ({
      offset: e.offset,
      length: e.length || 2,
      custom_emoji_id: e.custom_emoji_id,
    }));
}

function buildReplyItem(message) {
  if (message.sticker) {
    return { type: "sticker", value: message.sticker.file_id, emoji_entities: [] };
  }
  const emojiEntities = extractEmojiEntities(message.entities);
  const text = message.text || "";
  if (emojiEntities.length > 0) {
    return { type: "custom_emoji", value: text, emoji_entities: emojiEntities };
  }
  return { type: "text", value: text, emoji_entities: [] };
}

function isGroupChat(chat) {
  return chat?.type === "group" || chat?.type === "supergroup";
}

async function resolveLearningLang(message) {
  if (isGroupChat(message.chat)) {
    const chat = await ChatModel.findOne({ chatId: message.chat.id }).lean().catch(() => null);
    const groupLang = normalizeLangCode(chat?.lang_code);
    if (groupLang !== "unknown") return groupLang;
  }

  return normalizeLangCode(message.from?.language_code);
}

function buildMessageQuery(lang, value) {
  return { l: normalizeLangCode(lang), m: value };
}

function getRepliesFromDoc(doc) {
  if (!doc) return [];
  const compactReplies = Array.isArray(doc.r) ? doc.r : [];
  const legacyReplies = Array.isArray(doc.reply) ? doc.reply : [];
  return compactReplies.concat(legacyReplies);
}

function toStoredEmojiEntities(emojiEntities) {
  if (!Array.isArray(emojiEntities) || emojiEntities.length === 0) return undefined;
  return emojiEntities.map((e) => ({
    o: e.offset ?? e.o,
    l: e.length ?? e.l ?? 2,
    c: e.custom_emoji_id ?? e.c,
  })).filter((e) => e.o !== undefined && e.c);
}

function toStoredReplyItem(replyItem) {
  const stored = { v: replyItem.value };
  if (replyItem.type === "sticker") stored.t = "s";
  if (replyItem.type === "custom_emoji") stored.t = "e";

  const emojiEntities = toStoredEmojiEntities(replyItem.emoji_entities);
  if (emojiEntities?.length) stored.e = emojiEntities;

  return stored;
}

function buildMessageKey(message) {
  if (message.sticker) return message.sticker.file_unique_id;
  return message.text || "";
}

function buildEntitiesFromStored(emojiEntities) {
  if (!emojiEntities || !emojiEntities.length) return undefined;
  return emojiEntities.map((e) => ({
    offset: e.offset ?? e.o,
    length: e.length ?? e.l,
    type: "custom_emoji",
    custom_emoji_id: e.custom_emoji_id ?? e.c,
  }));
}

function normalizeReplyItem(raw) {
  const item = (raw && typeof raw.toObject === "function") ? raw.toObject() : raw;

  if (typeof item === "string" || item instanceof String) {
    const isStickerFileId = /^[A-Za-z0-9_-]{30,}$/.test(item);
    return { type: isStickerFileId ? "sticker" : "text", value: item, emoji_entities: [] };
  }
  if (!item.value && item["0"] !== undefined) {
    let i = 0, chars = [];
    while (item[String(i)] !== undefined) { chars.push(item[String(i)]); i++; }
    const str = chars.join("");
    const isStickerFileId = /^[A-Za-z0-9_-]{30,}$/.test(str);
    return { type: isStickerFileId ? "sticker" : "text", value: str, emoji_entities: [] };
  }
  if (item.v) {
    const type = item.t === "s" ? "sticker" : item.t === "e" ? "custom_emoji" : "text";
    const emojiEntities = Array.isArray(item.e)
      ? item.e.map((e) => ({
          offset: e.o,
          length: e.l || 2,
          custom_emoji_id: e.c,
        })).filter((e) => e.offset !== undefined && e.custom_emoji_id)
      : [];
    return { type, value: item.v, emoji_entities: emojiEntities };
  }
  if (item.custom_emoji_ids && !item.emoji_entities) {
    item.emoji_entities = [];
  }
  if (!item.emoji_entities) item.emoji_entities = [];
  return item;
}

function chunkArray(arr, size) {
    const chunks = [];
    for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
    return chunks.length ? chunks : [[]];
}

function runBackgroundTask(name, task) {
  setImmediate(async () => {
    try {
      await task();
    } catch (err) {
      console.error(`[${name}] Erro em background:`, err.message);
    }
  });
}

// ─── retry mechanism (com retry_after automático) ──────────────────────────────

async function retryWithBackoff(fn, maxRetries = 3, delayMs = 1000) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      const errorCode = error?.response?.body?.error_code;
      if (errorCode === 429) {
        const retryAfter = error?.response?.body?.parameters?.retry_after || 10;
        console.warn(`[RATE-LIMIT] 429 — aguardando ${retryAfter}s (tentativa ${i + 1}/${maxRetries})`);
        await delay(retryAfter * 1000);
        continue;
      }
      if (i === maxRetries - 1) throw error;
      await delay(delayMs * Math.pow(2, i));
    }
  }
}

async function safeSendMessage(chatId, text, options = {}) {
  return retryWithBackoff(async () => {
    return await bot.sendMessage(chatId, text, {
      ...options,
      parse_mode: options.parse_mode || "HTML",
    });
  });
}

async function safeSendAudio(chatId, audioUrl, options = {}) {
  return retryWithBackoff(async () => {
    return await bot.sendVoice(chatId, audioUrl, options);
  });
}

async function safeSendPhoto(chatId, photoUrl, options = {}) {
  return retryWithBackoff(async () => {
    return await bot.sendPhoto(chatId, photoUrl, options);
  });
}

async function safeCopyMessage(chatId, fromChatId, messageId) {
  return retryWithBackoff(async () => {
    return await bot.copyMessage(chatId, fromChatId, messageId);
  });
}

let BOT_ID = null;
async function getBotId() {
    if (!BOT_ID) {
        const me = await bot.getMe();
        BOT_ID = me.id;
    }
    return BOT_ID;
}

// ─── pagination ───────────────────────────────────────────────────────────────

// key: `${type}:${userId}` → { pages, currentPage }
const paginationState = new Map();

function cleanPaginationState() {
  const now = Date.now();
  const TTL = 10 * 60 * 1000;
  for (const [key, val] of paginationState) {
    if (now - val.createdAt > TTL) paginationState.delete(key);
  }
}

setInterval(cleanPaginationState, 5 * 60 * 1000).unref();

function buildNavMarkup(type, page, total) {
    const buttons = [];
    if (page > 0) {
        buttons.push({ text: "◀️ Anterior", callback_data: `${type}:${page - 1}` });
    }
    buttons.push({ text: `${page + 1}/${total}`, callback_data: "noop" });
    if (page < total - 1) {
        buttons.push({ text: "Próximo ▶️", callback_data: `${type}:${page + 1}` });
    }
    return { reply_markup: { inline_keyboard: [buttons] }, parse_mode: "HTML" };
}

async function sendPaginated(chatId, userId, type, pages) {
  const sent = await enqueue(() => bot.sendMessage(chatId, pages[0], buildNavMarkup(type, 0, pages.length)), PRIORITY.HIGH);
  paginationState.set(`${type}:${userId}`, { pages, currentPage: 0, msgId: sent.message_id, createdAt: Date.now() });
}

// ─── learning system ──────────────────────────────────────────────────────────

async function deleteMessageIfExists(lang, repliedMessage, replyValue) {
  const found = await MessageModel.findOne({
    $or: [
      { l: lang, m: repliedMessage },
      { l: lang, "r.v": replyValue },
    ],
  });
  if (found) await MessageModel.deleteOne({ _id: found._id });
}

async function addReply(message) {
  if (isGroupChat(message.chat)) {
    const groupSaved = await ensureGroupSaved(message);
    if (!groupSaved) return;
  }

  const repliedMessage = message.reply_to_message
    ? buildMessageKey(message.reply_to_message)
    : null;
  const replyItem = buildReplyItem(message);
  const lang = await resolveLearningLang(message);

  if (!repliedMessage || !replyItem.value) return;
  if (/^[\/.!]/.test(repliedMessage) || (/^[\/.!]/.test(replyItem.value) && replyItem.type === "text")) return;
  if (containsUrl(repliedMessage) || (replyItem.type === "text" && containsUrl(replyItem.value))) {
    await deleteMessageIfExists(lang, repliedMessage, replyItem.value);
    return;
  }
  if (hasForbiddenWord(repliedMessage) || (replyItem.type === "text" && hasForbiddenWord(replyItem.value))) {
    await deleteMessageIfExists(lang, repliedMessage, replyItem.value);
    return;
  }

  await MessageModel.findOneAndUpdate(
    buildMessageQuery(lang, repliedMessage),
    {
      $setOnInsert: { l: lang, m: repliedMessage },
      $push: { r: { $each: [toStoredReplyItem(replyItem)], $slice: REPLY_MAX_SIZE } },
    },
    { upsert: true }
  ).catch(() => {});
}

// ─── answer user ──────────────────────────────────────────────────────────────

async function answerUser(message) {
  const received = buildMessageKey(message);
  const chatId = message.chat.id;
  const isGroup = isGroupChat(message.chat);

  if (isGroup) {
    const groupSaved = await ensureGroupSaved(message);
    if (!groupSaved) return;
  }

  try {
    if (/^[\/.!]/.test(received)) return;

    const sendOpts = { reply_to_message_id: message.message_id };

  const audioMatch = audioList.find((a) => received === a.keyword);
  if (audioMatch) {
    await bot.sendChatAction(chatId, "record_audio").catch(() => {});
    await enqueue(
      () => Promise.race([
        safeSendAudio(chatId, audioMatch.audioUrl, sendOpts),
        new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 6000)),
      ]).catch((e) => console.warn("[AUDIO-WARN]", e.message)),
      PRIORITY.HIGH
    );
    return;
  }

  const photoMatch = photoList.find((p) => received === p.keyword);
  if (photoMatch) {
    await bot.sendChatAction(chatId, "upload_photo").catch(() => {});
    await enqueue(
      () => Promise.race([
        safeSendPhoto(chatId, photoMatch.photoUrl, sendOpts),
        new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 6000)),
      ]).catch((e) => console.warn("[PHOTO-WARN]", e.message)),
      PRIORITY.HIGH
    );
    return;
  }

    const lang = await resolveLearningLang(message);
    const doc = await MessageModel.findOne(buildMessageQuery(lang, received));
    const replies = getRepliesFromDoc(doc);
    if (doc && replies.length) {
      const validReplies = replies
        .map(normalizeReplyItem)
        .filter((r) => r && r.value);
      if (!validReplies.length) return;
      const replyItem = randomItem(validReplies);

      const typingTime = Math.min(Math.max(50 * replyItem.value.length, 200), 6000);
      await bot.sendChatAction(chatId, "typing").catch(() => {});
      await delay(typingTime);

  if (replyItem.type === "sticker") {
    await enqueue(
      () => bot.sendSticker(chatId, replyItem.value, sendOpts).catch((err) => {
        console.warn("[STICKER-WARN]", err.message);
        return bot.sendSticker(chatId, replyItem.value).catch(() => {});
      }),
      PRIORITY.HIGH
    );
  } else if (replyItem.type === "custom_emoji" && replyItem.emoji_entities?.length > 0) {
    await enqueue(
      () => bot.sendMessage(chatId, replyItem.value, {
        ...sendOpts,
        disable_web_page_preview: true,
        entities: buildEntitiesFromStored(replyItem.emoji_entities),
      }).catch(async (err) => {
        console.warn("[EMOJI-WARN]", err.message);
        await bot.sendMessage(chatId, replyItem.value, {
          disable_web_page_preview: true,
        }).catch(() => {});
      }),
      PRIORITY.HIGH
    );
  } else {
    await enqueue(
      () => bot.sendMessage(chatId, replyItem.value, {
        ...sendOpts,
        disable_web_page_preview: true,
      }).catch(async (err) => {
        console.warn("[TEXT-WARN]", err.message);
        await bot.sendMessage(chatId, replyItem.value, {
          disable_web_page_preview: true,
        }).catch(() => {});
      }),
      PRIORITY.HIGH
    );
  }
    }
  } catch (error) {
    const code = error?.response?.body?.error_code;
    if (error.message?.includes("CHAT_WRITE_FORBIDDEN") || code === 403) {
      await enqueue(() => bot.leaveChat(chatId), PRIORITY.CRITICAL).catch(() => {});
      await ChatModel.deleteOne({ chatId }).catch(() => {});
    }
  }
}

// ─── main message handler ─────────────────────────────────────────────────────

async function main(message) {
    try {
        const replyTo = message?.reply_to_message ?? false;
        const botId = await getBotId();

        if (message.chat.type === "private") {
            await ensureUserSaved(message);
        }

        if (message.sticker || message.text) {
            if (replyTo && replyTo.from?.id !== botId) addReply(message);
            if (!replyTo || replyTo.from?.id === botId) answerUser(message);
        }
    } catch (err) {
        console.error("[MAIN-ERROR]", err.message);
    }
}

// ─── user / group registration ────────────────────────────────────────────────

async function saveUserInformation(message) {
  const user = message.from;
  if (!user || user.is_bot) return;

  try {
    const langCode = user.language_code || "unknown";
    const now = new Date();
    const today = dateKey(now);
    const source = extractStartSource(message.text || "");
    const isAction = Boolean(message.text && !message.text.startsWith("/start"));
    const setOnInsert = {
      user_id: user.id,
      is_dev: false,
      first_seen_at: now,
      first_seen_day: today,
      source,
      ...(isAction ? { first_action_at: now } : {}),
    };
    await UserModel.findOneAndUpdate(
      { user_id: user.id },
      {
        $setOnInsert: setOnInsert,
        $set: {
          username: user.username,
          firstname: user.first_name,
          lastname: user.last_name,
          lang_code: langCode,
          last_seen_at: now,
          last_seen_day: today,
        },
        $addToSet: { active_days: today },
        $inc: { action_count: 1 },
      },
      { upsert: true }
    );
  } catch (err) {}
}

async function saveNewChatMembers(msg) {
  const chatId = msg.chat.id;
  const chatName = msg.chat.title;
  const chatType = msg.chat.type || "unknown";
  const langCode = inferGroupLangCode(msg);

  try {
    const chat = await ChatModel.findOneAndUpdate(
      { chatId },
      {
        $setOnInsert: { is_ban: false, lang_code: langCode },
        $set: { chatName: chatName || `Group-${chatId}`, chat_type: chatType },
      },
      { upsert: true, new: true }
    );

  if (chat.is_ban) {
    await enqueue(() => bot.leaveChat(chatId), PRIORITY.CRITICAL).catch(() => {});
    return;
    }

    const isNew = chat.wasNew;
    const botUser = await bot.getMe();
    const addedNow = msg.new_chat_members?.some((m) => m.id === botUser.id);
    const chatLink = msg.chat.username ? `@${msg.chat.username}` : "Private Group";

  if (addedNow) {
    const notif =
      `#Togurosbot #New_Group\n` +
      `<b>Group:</b> ${chat.chatName}\n` +
      `<b>ID:</b> <code>${chatId}</code>\n` +
      `<b>Type:</b> <code>${chatType}</code>\n` +
      `<b>Link:</b> ${chatLink}`;
    enqueue(
      () => bot.sendMessage(groupId, notif, {
        parse_mode: "HTML",
        ...(logMsgId && { reply_to_message_id: logMsgId }),
      }),
      PRIORITY.HIGH
    ).catch(() => {});

    enqueue(
      () => bot.sendMessage(
        chatId,
        uiText(msg.from, "groupWelcome"),
        {
          reply_markup: {
            inline_keyboard: [
              [
                { text: uiText(msg.from, "officialChannel"), url: "https://t.me/lbrabo" },
                { text: uiText(msg.from, "bugReport"), url: "https://t.me/kylorensbot" },
              ],
            ],
          },
        }
      ),
      PRIORITY.HIGH
    ).catch(() => {});
  }

  const devMembers = msg.new_chat_members?.filter((m) => !m.is_bot && is_dev(m.id));
  if (devMembers?.length) {
    enqueue(
      () => bot.sendMessage(
        chatId,
        `👨‍💻 <b>Um dos meus desenvolvedores entrou no grupo:</b> <a href="tg://user?id=${devMembers[0].id}">${devMembers[0].first_name}</a> 😎`,
        { parse_mode: "HTML" }
      ),
      PRIORITY.HIGH
    ).catch(() => {});
  }
  } catch (err) {
    console.error(`[CHAT-SAVE-FATAL] Erro fatal ao salvar grupo:`, err.message);
  }
}

async function removeLeftChatMember(msg) {
    const botId = await getBotId();
    if (msg.left_chat_member.id !== botId) return;
    const chatId = msg.chat.id;
    const chat = await ChatModel.findOne({ chatId });
    if (!chat || chat.is_ban) return;
    await ChatModel.findOneAndDelete({ chatId }).catch(() => {});
}

// ─── ensure user/group are saved ──────────────────────────────────────────────

async function ensureUserSaved(message) {
  const user = message.from;
  if (!user || user.is_bot) return false;

  const langCode = user.language_code || "unknown";
  const now = new Date();
  const today = dateKey(now);
  const source = extractStartSource(message.text || "");
  const update = {
    $setOnInsert: {
      user_id: user.id,
      is_dev: false,
      first_seen_at: now,
      first_seen_day: today,
      source,
      ...(message.text && !message.text.startsWith("/start") ? { first_action_at: now } : {}),
    },
    $set: {
      username: user.username,
      firstname: user.first_name,
      lastname: user.last_name,
      lang_code: langCode,
      last_seen_at: now,
      last_seen_day: today,
    },
    $addToSet: { active_days: today },
    $inc: { action_count: 1 },
  };

  try {
    const result = await UserModel.findOneAndUpdate(
      { user_id: user.id },
      update,
      { upsert: true, new: true }
    );
    if (result._id) return true;
    return false;
  } catch (err) {
    console.error(`[ENSURE-USER-ERROR] Falha ao salvar usuário ${user.id}:`, err.message);
    return false;
  }
}

function inferGroupLangCode(msg) {
  if (msg.from && msg.from.language_code) return msg.from.language_code;
  const members = msg.new_chat_members;
  if (Array.isArray(members) && members.length > 0) {
    const codes = members.map(m => m.language_code).filter(Boolean);
    if (codes.length > 0) return codes[0];
  }
  return "unknown";
}

async function ensureGroupSaved(msg) {
  const chatId = msg.chat.id;
  const chatName = msg.chat.title || msg.chat.username || `Group-${chatId}`;
  const chatType = msg.chat.type || "unknown";
  const langCode = inferGroupLangCode(msg);

  try {
    const result = await ChatModel.findOneAndUpdate(
      { chatId },
      {
        $setOnInsert: { is_ban: false, lang_code: langCode },
        $set: { chatName, chat_type: chatType },
      },
      { upsert: true, new: true }
    );

    if (result.is_ban) return false;

    if (langCode !== "unknown" && result.lang_code === "unknown") {
      await ChatModel.updateOne({ chatId }, { $set: { lang_code: langCode } }).catch(() => {});
    }

    return true;
  } catch (err) {
    console.error(`[ENSURE-GROUP-ERROR] Falha ao salvar grupo ${chatId}:`, err.message);
    return false;
  }
}


// ─── /start ───────────────────────────────────────────────────────────────────

async function start(message) {
    if (message.chat.type !== "private") return;
    
    // Garantir que usuário seja salvo
    await ensureUserSaved(message);
    
    const userId = message.from.id;
    const firstName = message.from.first_name;

    const devText = uiText(message.from, "devStart", firstName);
    const userText = uiText(message.from, "userStart", firstName);

  if (is_dev(userId)) {
    await enqueue(
      () => bot.sendMessage(userId, devText, {
        parse_mode: "HTML",
        disable_web_page_preview: true,
        reply_markup: {
          inline_keyboard: [
            [{ text: "📦 Github", url: "https://github.com/leviobrabo/togurosbot" }],
            [
              { text: uiText(message.from, "officialChannel"), url: "https://t.me/lbrabo" },
              { text: uiText(message.from, "support"), url: "https://t.me/kylorensbot" },
            ],
            [{ text: uiText(message.from, "devCommands"), callback_data: "dev_commands" }],
          ],
        },
      }),
      PRIORITY.HIGH
    );
  } else {
    await enqueue(
      () => bot.sendMessage(message.chat.id, userText, {
        parse_mode: "HTML",
        disable_web_page_preview: true,
        reply_markup: {
          inline_keyboard: [
            [{ text: uiText(message.from, "addGroup"), url: "https://t.me/togurosbot?startgroup=true" }],
            [
              { text: uiText(message.from, "officialChannel"), url: "https://t.me/lbrabo" },
              { text: uiText(message.from, "support"), url: "https://t.me/kylorensbot" },
            ],
            [{ text: "📦 Github", url: "https://github.com/leviobrabo/togurosbot" }],
          ],
        },
      }),
      PRIORITY.HIGH
    );
  }
}

// ─── /stats ───────────────────────────────────────────────────────────────────

async function stats(message) {
  if (!is_dev(message.from.id)) return;
  await ensureUserSaved(message);

  const [numUsers, numChats, numMessages, usersByLang, groupsByLang, groupsByType, productMetrics] = await Promise.all([
    UserModel.countDocuments(),
    ChatModel.countDocuments({ is_ban: false }),
    MessageModel.countDocuments(),
    UserModel.aggregate([
      { $group: { _id: "$lang_code", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    ChatModel.aggregate([
      { $match: { is_ban: false } },
      { $group: { _id: "$lang_code", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    ChatModel.aggregate([
      { $match: { is_ban: false } },
      { $group: { _id: "$chat_type", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    calculateProductMetrics(UserModel),
  ]);

  const pages = [];

  const typeBreakdown = groupsByType.map(({ _id, count }) => `${_id || "unknown"}: ${count}`).join(" | ");

  pages.push(
    `📊 <b>Estatísticas — Toguro</b>\n\n` +
    `👥 <b>Usuários:</b> <code>${numUsers}</code>\n` +
    `DAU: <code>${productMetrics.dau}</code>\n` +
    `WAU: <code>${productMetrics.wau}</code> (<code>${productMetrics.wauTotalRate}</code>)\n` +
    `MAU: <code>${productMetrics.mau}</code>\n` +
    `🏘 <b>Grupos ativos:</b> <code>${numChats}</code>\n` +
    `📋 <b>Tipos:</b> <code>${typeBreakdown}</code>\n` +
    `💬 <b>Mensagens aprendidas:</b> <code>${numMessages}</code>\n\n` +
    `📅 <b>Última atualização:</b> <code>${new Date().toLocaleString('pt-BR')}</code>`
  );

  const usersLangText = `👥 <b>Usuários por idioma</b>\n\n`;
  const groupsLangText = `🏘 <b>Grupos por idioma</b>\n\n`;

  let usersLangDetail = usersLangText;
  let groupsLangDetail = groupsLangText;

  for (const { _id, count } of usersByLang) {
    usersLangDetail += `🌐 <code>${_id || "unknown"}</code> — <b>${count}</b> usuário(s)\n`;
  }

  for (const { _id, count } of groupsByLang) {
    groupsLangDetail += `🌐 <code>${_id || "unknown"}</code> — <b>${count}</b> grupo(s)\n`;
  }

  pages.push(usersLangDetail);
  pages.push(groupsLangDetail);
  pages.push(buildProductMetricsText(productMetrics));

  const sourceText =
    `<b>Origem dos usuarios</b>\n\n` +
    (productMetrics.sourceBreakdown.length
      ? productMetrics.sourceBreakdown.map((item) => `<code>${item.source}</code> - <b>${item.count}</b>`).join("\n")
      : "Sem origem registrada.");

  const vipText =
    `<b>Top usuarios por acoes</b>\n\n` +
    (productMetrics.vipUsers.length
      ? productMetrics.vipUsers
          .map((user, index) => {
            const name = user.username ? `@${user.username}` : (user.firstname || `ID ${user.user_id}`);
            return `<b>${index + 1}.</b> ${name} - <code>${user.action_count || 0}</code>`;
          })
          .join("\n")
      : "Sem atividade registrada.");

  pages.push(sourceText);
  pages.push(vipText);

  const memUsage = process.memoryUsage();
  const memUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
  const memTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);

  const perfText = `⚡ <b>Performance</b>\n\n` +
    `💾 <b>Memória:</b> <code>${memUsedMB}</code>MB / <code>${memTotalMB}</code>MB\n` +
    `🕒 <b>Uptime:</b> <code>${timeFormatter(process.uptime())}</code>\n` +
    `🔄 <b>Status:</b> <code>Online</code>`;

  pages.push(perfText);

  await sendPaginated(message.chat.id, message.from.id, "stats", pages);
}

async function productstats(message) {
  if (!is_dev(message.from.id)) return;
  if (message.chat.type !== "private") return;
  await ensureUserSaved(message);

  const metrics = await calculateProductMetrics(UserModel);
  const sourceText = metrics.sourceBreakdown.length
    ? "\n\n<b>Top origens</b>\n" + metrics.sourceBreakdown.map((item) => `<code>${item.source}</code>: <b>${item.count}</b>`).join("\n")
    : "";
  const vipText = metrics.vipUsers.length
    ? "\n\n<b>Top VIPs</b>\n" + metrics.vipUsers.map((user, index) => {
        const name = user.username ? `@${user.username}` : (user.firstname || `ID ${user.user_id}`);
        return `<b>${index + 1}.</b> ${name}: <code>${user.action_count || 0}</code>`;
      }).join("\n")
    : "";

  await enqueue(
    () => bot.sendMessage(message.chat.id, buildProductMetricsText(metrics) + sourceText + vipText, { parse_mode: "HTML" }),
    PRIORITY.HIGH
  );
}

// ─── /grupos ──────────────────────────────────────────────────────────────────

async function groups(message) {
    if (!is_dev(message.from.id)) return;
    if (message.chat.type !== "private") return;
    await ensureUserSaved(message);

    const chats = await ChatModel.find({ is_ban: false }).sort({ chatId: 1 });
  if (!chats.length) {
    return enqueue(() => bot.sendMessage(message.chat.id, "Nenhum grupo ativo encontrado."), PRIORITY.HIGH);
  }

  const chunks = chunkArray(chats, 20);
  const pages = chunks.map((chunk, i) => {
    let text =
      `🏘 <b>Grupos ativos</b> — Total: <code>${chats.length}</code>\n` +
      `<i>Página ${i + 1}/${chunks.length}</i>\n\n`;
    chunk.forEach((chat, idx) => {
      text += `<b>${i * 20 + idx + 1}.</b> ${chat.chatName}\n`;
      text += ` ├ ID: <code>${chat.chatId}</code>\n`;
      text += ` ├ Tipo: <code>${chat.chat_type || "unknown"}</code>\n`;
      text += ` └ Lang: <code>${chat.lang_code || "unknown"}</code>\n\n`;
    });
    return text;
  });

  await sendPaginated(message.chat.id, message.from.id, "grupos", pages);
}

// ─── /banned ──────────────────────────────────────────────────────────────────

async function banned(message) {
  if (message.chat.type !== "private") {
    return enqueue(() => bot.sendMessage(message.chat.id, "Use este comando no PV com o bot."), PRIORITY.HIGH);
  }
  if (!is_dev(message.from.id)) {
    return enqueue(() => bot.sendMessage(message.chat.id, "Você não está autorizado."), PRIORITY.HIGH);
  }
    await ensureUserSaved(message);

    const bannedChats = await ChatModel.find({ is_ban: true });
  if (!bannedChats.length) {
    return enqueue(() => bot.sendMessage(message.chat.id, "Nenhum grupo banido encontrado."), PRIORITY.HIGH);
  }

    const chunks = chunkArray(bannedChats, 20);
    const pages = chunks.map((chunk, i) => {
        let text =
            `🚫 <b>Grupos banidos</b> — Total: <code>${bannedChats.length}</code>\n` +
            `<i>Página ${i + 1}/${chunks.length}</i>\n\n`;
        chunk.forEach((chat, idx) => {
            text += `<b>${i * 20 + idx + 1}.</b> ${chat.chatName}\n`;
            text += `    └ ID: <code>${chat.chatId}</code>\n\n`;
        });
        return text;
    });

    await sendPaginated(message.chat.id, message.from.id, "banned", pages);
}

// ─── /ban ─────────────────────────────────────────────────────────────────────

async function ban(message) {
  if (message.chat.type !== "private") {
    return enqueue(() => bot.sendMessage(message.chat.id, "Use este comando no PV com o bot."), PRIORITY.HIGH);
  }
  if (!is_dev(message.from.id)) {
    return enqueue(() => bot.sendMessage(message.chat.id, "Você não está autorizado."), PRIORITY.HIGH);
  }

  const rawId = message.text.split(" ")[1];
  if (!rawId || isNaN(rawId)) {
    return enqueue(() => bot.sendMessage(message.chat.id, "Uso: /ban <chatId>"), PRIORITY.HIGH);
  }

  const chatId = Number(rawId);
  const chat = await ChatModel.findOne({ chatId });
  if (!chat) return enqueue(() => bot.sendMessage(message.chat.id, `Grupo não encontrado: ${chatId}`), PRIORITY.HIGH);
  if (chat.is_ban) return enqueue(() => bot.sendMessage(message.chat.id, `Grupo <b>${chat.chatName}</b> já está banido.`, { parse_mode: "HTML" }), PRIORITY.HIGH);

  await ChatModel.updateOne({ chatId }, { $set: { is_ban: true } });
  await enqueue(() => bot.sendMessage(chatId, "Toguro saindo do grupo!"), PRIORITY.HIGH).catch(() => {});
  await enqueue(() => bot.leaveChat(chatId), PRIORITY.CRITICAL).catch(() => {});
  await enqueue(() => bot.sendMessage(message.chat.id, `✅ Grupo <b>${chat.chatName}</b> banido com sucesso.`, { parse_mode: "HTML" }), PRIORITY.HIGH);

  enqueue(
    () => bot.sendMessage(
      groupId,
      `#Togurosbot #Banned\n<b>Group:</b> ${chat.chatName}\n<b>ID:</b> <code>${chatId}</code>`,
      { parse_mode: "HTML", ...(logMsgId && { reply_to_message_id: logMsgId }) }
    ),
    PRIORITY.HIGH
  ).catch(() => {});
}

// ─── /unban ───────────────────────────────────────────────────────────────────

async function unban(message) {
  if (message.chat.type !== "private") {
    return enqueue(() => bot.sendMessage(message.chat.id, "Use este comando no PV com o bot."), PRIORITY.HIGH);
  }
  if (!is_dev(message.from.id)) {
    return enqueue(() => bot.sendMessage(message.chat.id, "Você não está autorizado."), PRIORITY.HIGH);
  }

  const rawId = message.text.split(" ")[1];
  if (!rawId || isNaN(rawId)) {
    return enqueue(() => bot.sendMessage(message.chat.id, "Uso: /unban <chatId>"), PRIORITY.HIGH);
  }

  const chatId = Number(rawId);
  const chat = await ChatModel.findOne({ chatId });
  if (!chat) return enqueue(() => bot.sendMessage(message.chat.id, `Nenhum grupo encontrado com ID ${chatId}.`), PRIORITY.HIGH);
  if (!chat.is_ban) return enqueue(() => bot.sendMessage(message.chat.id, `Grupo <b>${chat.chatName}</b> não está banido.`, { parse_mode: "HTML" }), PRIORITY.HIGH);

  await ChatModel.updateOne({ chatId }, { $set: { is_ban: false } });
  await enqueue(() => bot.sendMessage(message.chat.id, `✅ Grupo <b>${chat.chatName}</b> desbanido com sucesso.`, { parse_mode: "HTML" }), PRIORITY.HIGH);

  enqueue(
    () => bot.sendMessage(
      groupId,
      `#Togurosbot #Unban\n<b>Group:</b> ${chat.chatName}\n<b>ID:</b> <code>${chatId}</code>`,
      { parse_mode: "HTML", ...(logMsgId && { reply_to_message_id: logMsgId }) }
    ),
    PRIORITY.HIGH
  ).catch(() => {});
}

// ─── /delmsg ──────────────────────────────────────────────────────────────────

async function removeMessage(message) {
  if (!is_dev(message.from.id)) return;

  const repliedMessage = message.reply_to_message
    ? buildMessageKey(message.reply_to_message)
    : null;

  if (!repliedMessage) {
    return enqueue(() => bot.sendMessage(message.chat.id, "Responda a uma mensagem para deletar do banco."), PRIORITY.HIGH);
  }

  const lang = await resolveLearningLang(message);
  const exists = await MessageModel.exists(buildMessageQuery(lang, repliedMessage));
  if (!exists) {
    return console.log("Mensagem não encontrada no banco de dados.");
  }

  await MessageModel.deleteMany({
    $or: [
      { l: lang, m: repliedMessage },
      { l: lang, "r.v": repliedMessage },
    ],
  });

  enqueue(
    () => bot.sendMessage(
      message.chat.id,
      `✅ Deletado por <a href="tg://user?id=${message.from.id}">${message.from.first_name}</a>.\n\nTodas as respostas associadas foram apagadas.`,
      { parse_mode: "HTML", reply_to_message_id: message.message_id }
    ),
    PRIORITY.HIGH
  );
}

// ─── /lang ───────────────────────────────────────────────────────────────────

async function isGroupAdminOrOwner(chatId, userId) {
  if (is_dev(userId)) return true;

  const member = await bot.getChatMember(chatId, userId).catch(() => null);
  return member?.status === "creator" || member?.status === "administrator";
}

function langLabel(langCode) {
  const normalized = normalizeLangCode(langCode);
  if (normalized === "pt") return "Português";
  const found = GROUP_LANG_OPTIONS.find(([code]) => code === normalized);
  return found ? found[1] : normalized;
}

async function setGroupLang(message) {
  if (!isGroupChat(message.chat)) {
    return enqueue(() => bot.sendMessage(message.chat.id, uiText(message.from, "useInGroup")), PRIORITY.HIGH);
  }

  const allowed = await isGroupAdminOrOwner(message.chat.id, message.from.id);
  if (!allowed) {
    return enqueue(() => bot.sendMessage(message.chat.id, uiText(message.from, "adminOnly")), PRIORITY.HIGH);
  }

  const groupSaved = await ensureGroupSaved(message);
  if (!groupSaved) return;

  const [, rawLang] = (message.text || "").trim().split(/\s+/, 2);
  if (!rawLang) {
    return enqueue(
      () => bot.sendMessage(message.chat.id, uiText(message.from, "chooseLang"), {
        reply_markup: buildLangKeyboard(),
      }),
      PRIORITY.HIGH
    );
  }

  const lang = normalizeLangCode(rawLang);
  await ChatModel.updateOne({ chatId: message.chat.id }, { $set: { lang_code: lang } });
  return enqueue(
    () => bot.sendMessage(message.chat.id, uiText(message.from, "langSet", langLabel(lang)), { parse_mode: "HTML" }),
    PRIORITY.HIGH
  );
}

// ─── /devs ────────────────────────────────────────────────────────────────────

async function devs(message) {
  if (!is_dev(message.from.id)) {
    return enqueue(() => bot.sendMessage(message.chat.id, "Este comando é apenas para desenvolvedores!"), PRIORITY.HIGH);
  }
  if (message.chat.type !== "private") {
    return enqueue(() => bot.sendMessage(message.chat.id, "Use este comando no PV com o bot."), PRIORITY.HIGH);
  }
  await ensureUserSaved(message);

  const devsData = await UserModel.find({ is_dev: true }).catch(() => []);
    let text = "<b>👨‍💻 Desenvolvedores:</b>\n\n";
    for (const user of devsData) {
        text += `• <a href="tg://user?id=${user.user_id}">${user.firstname}</a> — <code>${user.user_id}</code>\n`;
    }
  if (!devsData.length) text += "Nenhum dev cadastrado no banco.";
  enqueue(() => bot.sendMessage(message.chat.id, text, { parse_mode: "HTML" }), PRIORITY.HIGH);
}

// ─── /dbstats (diagnóstico) ────────────────────────────────────────────────────

async function dbstats(message) {
  if (!is_dev(message.from.id)) {
    return enqueue(() => bot.sendMessage(message.chat.id, "Este comando é apenas para desenvolvedores!"), PRIORITY.HIGH);
  }
  if (message.chat.type !== "private") {
    return enqueue(() => bot.sendMessage(message.chat.id, "Use este comando no PV com o bot."), PRIORITY.HIGH);
  }
  await ensureUserSaved(message);

  try {
    const totalUsers = await UserModel.countDocuments();
        const totalChats = await ChatModel.countDocuments();
        const totalChatsBanned = await ChatModel.countDocuments({ is_ban: true });
        const totalChatsActive = await ChatModel.countDocuments({ is_ban: false });
        const totalMessages = await MessageModel.countDocuments();

        const text = 
            `🗄 <b>Diagnóstico do Banco de Dados</b>\n\n` +
            `👥 <b>Usuários Totais:</b> <code>${totalUsers}</code>\n` +
            `🏘 <b>Grupos Totais:</b> <code>${totalChats}</code>\n` +
            `  ├─ Ativos: <code>${totalChatsActive}</code>\n` +
            `  └─ Banidos: <code>${totalChatsBanned}</code>\n` +
            `💬 <b>Mensagens Aprendidas:</b> <code>${totalMessages}</code>\n\n` +
            `📅 <code>${new Date().toLocaleString('pt-BR')}</code>`;

    enqueue(() => bot.sendMessage(message.chat.id, text, { parse_mode: "HTML" }), PRIORITY.HIGH);
  } catch (err) {
    console.error("[DBSTATS] Erro:", err.message);
    enqueue(() => bot.sendMessage(message.chat.id, `❌ Erro ao consultar banco: ${err.message}`), PRIORITY.HIGH);
    }
}

// ─── /syncdb (forçar sincronização de usuários/grupos via Telegram) ───────────

async function unlockbulk(message) {
  if (!is_dev(message.from.id)) return;
  if (message.chat.type !== "private") return;

  const before = getBulkStatus();
  const unlocked = forceEndBulk();
  const text = unlocked
    ? `? Bulk liberado: <code>${before.type}</code>`
    : "Nenhum bulk ativo para liberar.";

  await enqueue(() => bot.sendMessage(message.chat.id, text, { parse_mode: "HTML" }), PRIORITY.HIGH);
}

async function syncdb(message) {
  if (!is_dev(message.from.id)) {
    return enqueue(() => bot.sendMessage(message.chat.id, "Este comando é apenas para desenvolvedores!"), PRIORITY.HIGH);
  }
  if (message.chat.type !== "private") {
    return enqueue(() => bot.sendMessage(message.chat.id, "Use este comando no PV com o bot."), PRIORITY.HIGH);
  }
  await ensureUserSaved(message);

    const sentMsg = await enqueue(() => bot.sendMessage(message.chat.id, "🔄 <i>Sincronizando banco de dados...</i>", { parse_mode: "HTML" }), PRIORITY.HIGH);

    try {
        // Obter lista de chats do bot
        const botChats = await bot.getChatAdministrators(-1).catch(() => []);
        
        // Nota: getChatAdministrators funciona apenas para grupos específicos
        // Uma abordagem melhor é usar o histórico de mensagens
        // Por enquanto, vamos apenas avisar que a sincronização de grupos é feita automaticamente
        
        const totalUsers = await UserModel.countDocuments();
        const totalGroups = await ChatModel.countDocuments();
        
  await enqueue(
    () => bot.editMessageText(
      `✅ <b>Sincronização Concluída</b>\n\n` +
      `👥 <b>Usuários salvos:</b> <code>${totalUsers}</code>\n` +
      `🏘 <b>Grupos salvos:</b> <code>${totalGroups}</code>\n\n` +
      `<i>ℹ️ Novos usuários são salvos ao enviar mensagens em PV.\n` +
      `Novos grupos são salvos quando o bot recebe mensagens.</i>`,
      { chat_id: sentMsg.chat.id, message_id: sentMsg.message_id, parse_mode: "HTML" }
    ),
    PRIORITY.HIGH
  );
  } catch (err) {
    console.error("[SYNCDB] Erro:", err.message);
    await enqueue(
      () => bot.editMessageText(
        `❌ Erro na sincronização: ${err.message}`,
        { chat_id: sentMsg.chat.id, message_id: sentMsg.message_id }
      ),
      PRIORITY.HIGH
    );
  }
}

// ─── /bc ─────────────────────────────────────────────────────────────────────

async function bc(msg) {
  if (!is_dev(msg.from.id)) return;
  if (msg.chat.type !== "private") return;
  await ensureUserSaved(msg);

  const query = msg.text.replace(/^\/bc(?:@\w+)?\s*/, "").trim();
  if (!query) {
    return enqueue(() => bot.sendMessage(msg.chat.id, "<i>Uso: /bc [-d] &lt;texto&gt;</i>", { parse_mode: "HTML" }), PRIORITY.HIGH);
  }

  if (!canStartBulk("BC")) {
    return enqueue(() => bot.sendMessage(msg.chat.id, `❌ Campanha em andamento (${getBulkType()}). Aguarde.`, { parse_mode: "HTML" }), PRIORITY.HIGH);
  }

  const webPreview = query.startsWith("-d");
  const text = webPreview ? query.substring(2).trim() : query;
  if (!text) {
    return enqueue(() => bot.sendMessage(msg.chat.id, "<i>Uso: /bc [-d] &lt;texto&gt;</i>", { parse_mode: "HTML" }), PRIORITY.HIGH);
  }

  const sentMsg = await enqueue(() => bot.sendMessage(msg.chat.id, "<i>⏳ Enviando broadcast...</i>", { parse_mode: "HTML" }), PRIORITY.HIGH);
  const ulist = await UserModel.find().lean().select("user_id");
  console.log(`[BC] Iniciando broadcast para ${ulist.length} usuários`);

  startBulk("BC");
  let success = 0, blocked = 0, failed = 0;
  const total = ulist.length;

  runBackgroundTask("BC", async () => {
    try {
      for (let i = 0; i < ulist.length; i++) {
        const { user_id } = ulist[i];
        try {
          await enqueue(
            () => safeSendMessage(user_id, text, { disable_web_page_preview: !webPreview }),
            PRIORITY.LOW
          );
          success++;
        } catch (err) {
          const code = err?.response?.body?.error_code;
          const desc = err?.response?.body?.description || "";
          if (code === 403) {
            blocked++;
            await UserModel.deleteOne({ user_id }).catch(() => {});
          } else if (code === 400 && /chat not found|bot can't initiate/i.test(desc)) {
            blocked++;
            await UserModel.deleteOne({ user_id }).catch(() => {});
          } else {
            failed++;
          }
        }
        await delay(DELAY_USER);

        if ((i + 1) % 50 === 0) {
          const pct = Math.round(((i + 1) / total) * 100);
          console.log(`[BC] Progresso: ${pct}% | OK: ${success} | Block: ${blocked} | Fail: ${failed} | Queue: ${queueSize()}`);
          await enqueue(
            () => bot.editMessageText(
              `╭─❑ 「 <b>Broadcast em Progresso</b> 」 ❑\n` +
              `│ 📤 Progresso: <code>${pct}%</code>\n` +
              `│ ✅ Enviados: <code>${success}</code>\n` +
              `│ 🚫 Bloqueados: <code>${blocked}</code>\n` +
              `│ ❌ Falhas: <code>${failed}</code>\n` +
              `│ 📊 Fila: <code>${queueSize()}</code>\n` +
              `╰❑`,
              { chat_id: sentMsg.chat.id, message_id: sentMsg.message_id, parse_mode: "HTML" }
            ),
            PRIORITY.HIGH
          ).catch(() => {});
        }
      }
    } finally {
      console.log(`[BC] Concluído: ${success}/${total} enviados | ${blocked} bloqueados | ${failed} falhas`);
      endBulk("BC");
      await enqueue(
        () => bot.editMessageText(
          `╭─❑ 「 <b>Broadcast Concluído</b> 」 ❑\n` +
          `│ 📤 Total: <code>${total}</code>\n` +
          `│ ✅ Enviados: <code>${success}</code>\n` +
          `│ 🚫 Bloqueados (removidos): <code>${blocked}</code>\n` +
          `│ ❌ Falhas: <code>${failed}</code>\n` +
          `╰❑`,
          { chat_id: sentMsg.chat.id, message_id: sentMsg.message_id, parse_mode: "HTML" }
        ),
        PRIORITY.HIGH
      ).catch(() => {});
    }
  });
}

// ─── /broadcast ───────────────────────────────────────────────────────────────

async function broadcast(msg) {
  if (!is_dev(msg.from.id)) return;
  if (msg.chat.type !== "private") return;
  await ensureUserSaved(msg);

  if (!msg.reply_to_message) {
    return enqueue(() => bot.sendMessage(msg.chat.id, "<i>Responda a uma mensagem para fazer broadcast.</i>", { parse_mode: "HTML" }), PRIORITY.HIGH);
  }

  if (!canStartBulk("BROADCAST")) {
    return enqueue(() => bot.sendMessage(msg.chat.id, `❌ Campanha em andamento (${getBulkType()}). Aguarde.`, { parse_mode: "HTML" }), PRIORITY.HIGH);
  }

  const reply = msg.reply_to_message;
  const sentMsg = await enqueue(() => bot.sendMessage(msg.chat.id, "<i>⏳ Broadcast iniciando...</i>", { parse_mode: "HTML" }), PRIORITY.HIGH);
  const ulist = await UserModel.find().lean().select("user_id");
  console.log(`[BROADCAST] Iniciando broadcast para ${ulist.length} usuários`);

  startBulk("BROADCAST");
  let success = 0, blocked = 0, failed = 0;
  const total = ulist.length;

  runBackgroundTask("BROADCAST", async () => {
    try {
      for (let i = 0; i < ulist.length; i++) {
        const { user_id } = ulist[i];
        try {
          await enqueue(
            () => safeCopyMessage(user_id, msg.chat.id, reply.message_id),
            PRIORITY.LOW
          );
          success++;
        } catch (err) {
          const code = err?.response?.body?.error_code;
          const desc = err?.response?.body?.description || "";
          if (code === 403) {
            blocked++;
            await UserModel.deleteOne({ user_id }).catch(() => {});
          } else if (code === 400 && /chat not found|bot can't initiate/i.test(desc)) {
            blocked++;
            await UserModel.deleteOne({ user_id }).catch(() => {});
          } else {
            failed++;
          }
        }
        await delay(DELAY_USER);

        if ((i + 1) % 50 === 0) {
          const pct = Math.round(((i + 1) / total) * 100);
          console.log(`[BROADCAST] Progresso: ${pct}% | OK: ${success} | Block: ${blocked} | Fail: ${failed} | Queue: ${queueSize()}`);
          await enqueue(
            () => bot.editMessageText(
              `╭─❑ 「 <b>Broadcast em Progresso</b> 」 ❑\n` +
              `│ 📤 Progresso: <code>${pct}%</code>\n` +
              `│ ✅ Enviados: <code>${success}</code>\n` +
              `│ 🚫 Bloqueados: <code>${blocked}</code>\n` +
              `│ ❌ Falhas: <code>${failed}</code>\n` +
              `│ 📊 Fila: <code>${queueSize()}</code>\n` +
              `╰❑`,
              { chat_id: sentMsg.chat.id, message_id: sentMsg.message_id, parse_mode: "HTML" }
            ),
            PRIORITY.HIGH
          ).catch(() => {});
        }
      }
    } finally {
      console.log(`[BROADCAST] Concluído: ${success}/${total} enviados | ${blocked} bloqueados | ${failed} falhas`);
      endBulk("BROADCAST");
      await enqueue(
        () => bot.editMessageText(
          `╭─❑ 「 <b>Broadcast Concluído</b> 」 ❑\n` +
          `│ 📤 Total: <code>${total}</code>\n` +
          `│ ✅ Enviados: <code>${success}</code>\n` +
          `│ 🚫 Bloqueados (removidos): <code>${blocked}</code>\n` +
          `│ ❌ Falhas: <code>${failed}</code>\n` +
          `╰❑`,
          { chat_id: sentMsg.chat.id, message_id: sentMsg.message_id, parse_mode: "HTML" }
        ),
        PRIORITY.HIGH
      ).catch(() => {});
    }
  });
}

// ─── /sendgp ──────────────────────────────────────────────────────────────────

async function sendgp(msg) {
  if (!is_dev(msg.from.id)) return;
  if (msg.chat.type !== "private") return;
  await ensureUserSaved(msg);

  if (!canStartBulk("SENDGP")) {
    return enqueue(() => bot.sendMessage(msg.chat.id, `❌ Campanha em andamento (${getBulkType()}). Aguarde.`, { parse_mode: "HTML" }), PRIORITY.HIGH);
  }

  const sentMsg = await enqueue(() => bot.sendMessage(msg.chat.id, "<i>⏳ Enviando para grupos...</i>", { parse_mode: "HTML" }), PRIORITY.HIGH);
  const glist = await ChatModel.find({ is_ban: false }).lean().select("chatId");
  console.log(`[SENDGP] Iniciando envio para ${glist.length} grupos`);

  startBulk("SENDGP");
  let success = 0, removed = 0, failed = 0;
  const total = glist.length;

  runBackgroundTask("SENDGP", async () => {
  try {
  if (msg.reply_to_message) {
    const replyMsg = msg.reply_to_message;

    for (let i = 0; i < glist.length; i++) {
      const { chatId } = glist[i];
      try {
        await enqueue(
          () => safeCopyMessage(chatId, replyMsg.chat.id, replyMsg.message_id),
          PRIORITY.LOW
        );
        success++;
      } catch (err) {
        const code = err?.response?.body?.error_code;
        const desc = err?.response?.body?.description || "";
        if (code === 403 || (code === 400 && /chat not found|group is deactivated|not enough rights/i.test(desc))) {
          removed++;
          await ChatModel.deleteOne({ chatId }).catch(() => {});
        } else {
          failed++;
        }
      }
      await delay(DELAY_GROUP);

      if ((i + 1) % 20 === 0) {
        const pct = Math.round(((i + 1) / total) * 100);
        console.log(`[SENDGP] Progresso: ${pct}% | OK: ${success} | Del: ${removed} | Fail: ${failed} | Queue: ${queueSize()}`);
        await enqueue(
          () => bot.editMessageText(
            `╭─❑ 「 <b>Envio para Grupos em Progresso</b> 」 ❑\n` +
            `│ 📤 Progresso: <code>${pct}%</code>\n` +
            `│ ✅ Enviados: <code>${success}</code>\n` +
            `│ 🗑 Removidos: <code>${removed}</code>\n` +
            `│ ❌ Falhas: <code>${failed}</code>\n` +
            `│ 📊 Fila: <code>${queueSize()}</code>\n` +
            `╰❑`,
            { chat_id: sentMsg.chat.id, message_id: sentMsg.message_id, parse_mode: "HTML" }
          ),
          PRIORITY.HIGH
        ).catch(() => {});
      }
    }
  } else {
    const rawText = msg.text.replace(/^\/sendgp(?:@\w+)?\s*/, "").trim();
    const webPreview = rawText.startsWith("-d");
    const text = webPreview ? rawText.substring(2).trim() : rawText;

    if (!text) {
      endBulk("SENDGP");
      await enqueue(
        () => bot.editMessageText("Uso: /sendgp [-d] <texto> ou responda uma mensagem.", {
          chat_id: sentMsg.chat.id,
          message_id: sentMsg.message_id,
        }),
        PRIORITY.HIGH
      );
      return;
    }

    for (let i = 0; i < glist.length; i++) {
      const { chatId } = glist[i];
      try {
        await enqueue(
          () => safeSendMessage(chatId, text, { disable_web_page_preview: !webPreview }),
          PRIORITY.LOW
        );
        success++;
      } catch (err) {
        const code = err?.response?.body?.error_code;
        const desc = err?.response?.body?.description || "";
        if (code === 403 || (code === 400 && /chat not found|group is deactivated|not enough rights/i.test(desc))) {
          removed++;
          await ChatModel.deleteOne({ chatId }).catch(() => {});
        } else {
          failed++;
        }
      }
      await delay(DELAY_GROUP);

      if ((i + 1) % 20 === 0) {
        const pct = Math.round(((i + 1) / total) * 100);
        console.log(`[SENDGP] Progresso: ${pct}% | OK: ${success} | Del: ${removed} | Fail: ${failed} | Queue: ${queueSize()}`);
        await enqueue(
          () => bot.editMessageText(
            `╭─❑ 「 <b>Envio para Grupos em Progresso</b> 」 ❑\n` +
            `│ 📤 Progresso: <code>${pct}%</code>\n` +
            `│ ✅ Enviados: <code>${success}</code>\n` +
            `│ 🗑 Removidos: <code>${removed}</code>\n` +
            `│ ❌ Falhas: <code>${failed}</code>\n` +
            `│ 📊 Fila: <code>${queueSize()}</code>\n` +
            `╰❑`,
            { chat_id: sentMsg.chat.id, message_id: sentMsg.message_id, parse_mode: "HTML" }
          ),
          PRIORITY.HIGH
        ).catch(() => {});
      }
    }
  }

  console.log(`[SENDGP] Concluído: ${success}/${total} enviados | ${removed} removidos | ${failed} falhas`);
  endBulk("SENDGP");

  await enqueue(
    () => bot.editMessageText(
      `╭─❑ 「 <b>Envio para Grupos Concluído</b> 」 ❑\n` +
      `│ 🏘 Total: <code>${total}</code>\n` +
      `│ ✅ Enviados: <code>${success}</code>\n` +
      `│ 🗑 Removidos (inativos): <code>${removed}</code>\n` +
      `│ ❌ Falhas: <code>${failed}</code>\n` +
      `╰❑`,
      { chat_id: sentMsg.chat.id, message_id: sentMsg.message_id, parse_mode: "HTML" }
    ),
    PRIORITY.HIGH
  );
  } finally {
    endBulk("SENDGP");
  }
  });
}

// ─── Adsterra ads (com fila + bulk lock + retry_after) ──────────────────────

async function sendAdWithRateLimit(chatId, text, replyMarkup, isGroup) {
  try {
    await enqueue(
      () => safeSendMessage(chatId, text, {
        disable_web_page_preview: true,
        reply_markup: replyMarkup,
      }),
      PRIORITY.LOW
    );
    return true;
  } catch (err) {
    const code = err?.response?.body?.error_code;
    const desc = err?.response?.body?.description || "";
    const invalidUser = code === 403 || (code === 400 && /chat not found|bot can't initiate/i.test(desc));
    const invalidGroup = code === 403 || (code === 400 && /chat not found|group is deactivated|not enough rights/i.test(desc));

    if (isGroup && invalidGroup) {
      await ChatModel.deleteOne({ chatId }).catch(() => {});
    } else if (!isGroup && invalidUser) {
      await UserModel.deleteOne({ user_id: chatId }).catch(() => {});
    } else {
      console.warn(`[ADS] Falha ao enviar para ${chatId}: ${desc || err.message}`);
    }
    return false;
  }
}

async function sendAdsToUsers() {
  if (!canStartBulk("ADS-USERS")) {
    console.warn(`[ADS-USERS] Bulk ${getBulkType()} em andamento — pulando`);
    return;
  }

  const cutoff = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
  const users = await UserModel.find({
    $or: [{ last_ad_sent: null }, { last_ad_sent: { $lt: cutoff } }],
  })
    .lean()
    .select("user_id")
    .limit(300);

  if (!users.length) return;

  startBulk("ADS-USERS");
  const now = new Date();
  let success = 0, failed = 0;
  const total = users.length;

  try {
    for (let i = 0; i < users.length; i++) {
      const { user_id } = users[i];
      const link = randomItem(adsterra.links);
      const tpl = randomItem(adsterra.userTemplates);
      const replyMarkup = { inline_keyboard: [[{ text: tpl.buttonText, url: link }]] };

      const ok = await sendAdWithRateLimit(user_id, tpl.text, replyMarkup, false);
      if (ok) {
        await UserModel.updateOne({ user_id }, { $set: { last_ad_sent: now } });
        success++;
      } else {
        failed++;
      }

      await delay(DELAY_USER);

      if ((i + 1) % 50 === 0) {
        console.log(`[ADS-USERS] Progresso: ${i + 1}/${total} | OK: ${success} | Fail: ${failed} | Queue: ${queueSize()}`);
        await delay(5000);
      }
    }
  } finally {
    console.log(`[ADS-USERS] Concluído: ${success}/${total} | Falhas: ${failed}`);
    endBulk("ADS-USERS");
  }
}

async function sendAdsToGroups() {
  if (!canStartBulk("ADS-GROUPS")) {
    console.warn(`[ADS-GROUPS] Bulk ${getBulkType()} em andamento — pulando`);
    return;
  }

  const cutoff = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
  const groups = await ChatModel.find({
    is_ban: false,
    $or: [{ last_ad_sent: null }, { last_ad_sent: { $lt: cutoff } }],
  })
    .lean()
    .select("chatId")
    .limit(200);

  if (!groups.length) return;

  startBulk("ADS-GROUPS");
  const now = new Date();
  let success = 0, failed = 0;
  const total = groups.length;

  try {
    for (let i = 0; i < groups.length; i++) {
      const { chatId } = groups[i];
      const link = randomItem(adsterra.links);
      const tpl = randomItem(adsterra.groupTemplates);
      const replyMarkup = { inline_keyboard: [[{ text: tpl.buttonText, url: link }]] };

      const ok = await sendAdWithRateLimit(chatId, tpl.text, replyMarkup, true);
      if (ok) {
        await ChatModel.updateOne({ chatId }, { $set: { last_ad_sent: now } });
        success++;
      } else {
        failed++;
      }

      await delay(DELAY_GROUP);

      if ((i + 1) % 30 === 0) {
        console.log(`[ADS-GROUPS] Progresso: ${i + 1}/${total} | OK: ${success} | Fail: ${failed} | Queue: ${queueSize()}`);
        await delay(5000);
      }
    }
  } finally {
    console.log(`[ADS-GROUPS] Concluído: ${success}/${total} | Falhas: ${failed}`);
    endBulk("ADS-GROUPS");
  }
}

// ─── status cron ──────────────────────────────────────────────────────────────

async function sendStatus() {
  const start = new Date();
  const replied = await enqueue(() => bot.sendMessage(channelStatusId, "Bot is ON"), PRIORITY.HIGH).catch(() => null);
  if (!replied) return;
  const ping = new Date() - start;
  const numUsers = await UserModel.countDocuments();
  const numChats = await ChatModel.countDocuments({ is_ban: false });
  await enqueue(
    () => bot.editMessageText(
      `#Togurosbot #Status\n\nStatus: ON\nPing: \`${ping}ms\`\nUptime: \`${timeFormatter(process.uptime())}\`\nUsuários: \`${numUsers}\`\nGrupos: \`${numChats}\`\nFila: \`${queueSize()}\``,
      { chat_id: replied.chat.id, message_id: replied.message_id, parse_mode: "Markdown" }
    ),
    PRIORITY.HIGH
  ).catch(() => {});
}

// ─── lifecycle ────────────────────────────────────────────────────────────────

function sendBotOnlineMessage() {
  console.log("Toguro iniciado com sucesso...");
  enqueue(
    () => bot.sendMessage(groupId, "#Toguro #ONLINE\n\nBot is now playing ...", {
      ...(logMsgId && { reply_to_message_id: logMsgId }),
    }),
    PRIORITY.HIGH
  ).catch(() => {});
}

function sendBotOfflineMessage() {
  console.log("Toguro encerrado...");
  enqueue(
    () => bot.sendMessage(groupId, "#Toguro #OFFLINE\n\nBot is now off ...", {
      ...(logMsgId && { reply_to_message_id: logMsgId }),
    }),
    PRIORITY.HIGH
  ).catch(() => {}).finally(() => {
    setTimeout(() => process.exit(0), 1000);
  });
}

function pollingError(error) {
  const msg = error?.message ?? String(error);
  if (msg.includes("ETELEGRAM") || msg.includes("timeout") || msg.includes("Conflict")) {
    console.warn(`[POLLING-WARN] ${msg}`);
    return;
  }
  console.error("Polling error:", msg);
}

// ─── global callback_query handler ───────────────────────────────────────────

function registerCallbackHandler() {
    bot.on("callback_query", async (q) => {
        await bot.answerCallbackQuery(q.id).catch(() => {});

        const data = q.data;
        const userId = q.from.id;

        if (data === "noop") return;

  if (data.startsWith("group_lang:")) {
    if (!isGroupChat(q.message?.chat)) return;

    const allowed = await isGroupAdminOrOwner(q.message.chat.id, q.from.id);
    if (!allowed) {
      await enqueue(
        () => bot.sendMessage(q.message.chat.id, uiText(q.from, "adminOnly")),
        PRIORITY.HIGH
      ).catch(() => {});
      return;
    }

    const lang = normalizeLangCode(data.slice("group_lang:".length));
    await ChatModel.updateOne(
      { chatId: q.message.chat.id },
      {
        $setOnInsert: {
          chatName: q.message.chat.title || q.message.chat.username || `Group-${q.message.chat.id}`,
          chat_type: q.message.chat.type || "unknown",
          is_ban: false,
        },
        $set: { lang_code: lang },
      },
      { upsert: true }
    ).catch(() => {});

    await enqueue(
      () => bot.editMessageText(uiText(q.from, "langSet", langLabel(lang)), {
        chat_id: q.message.chat.id,
        message_id: q.message.message_id,
        parse_mode: "HTML",
      }),
      PRIORITY.HIGH
    ).catch(() => {});
    return;
  }

  if (data === "dev_commands") {
    const commands = [
      "/stats — Estatísticas com paginação e breakdown por idioma",
      "/ban &lt;id&gt; — Bane um grupo e remove o bot",
      "/unban &lt;id&gt; — Desbane um grupo",
      "/banned — Lista de grupos banidos",
      "/grupos — Lista de grupos ativos",
      "/bc — Broadcast de texto para usuários",
      "/broadcast — Copia mensagem para todos usuários",
      "/ping — Latência e uptime",
      "/productstats — Métricas de produto (DAU, WAU, MAU, retenção)",
      "/unlockbulk — Libera campanha travada manualmente",
      "/delmsg — Apaga mensagem do banco (reply)",
      "/devs — Lista de desenvolvedores",
      "/sendgp — Envia mensagem para todos os grupos",
    ];
    await enqueue(
      () => bot.editMessageText("<b>🗃 Comandos do Dev:</b>\n\n" + commands.join("\n"), {
        parse_mode: "HTML",
        disable_web_page_preview: true,
        chat_id: q.message.chat.id,
        message_id: q.message.message_id,
        reply_markup: {
          inline_keyboard: [[{ text: "⬅️ Voltar", callback_data: "back_to_start" }]],
        },
      }),
      PRIORITY.HIGH
    ).catch(() => {});
    return;
  }

  if (data === "back_to_start") {
    const firstName = q.from.first_name;
    const devText = uiText(q.from, "devStart", firstName);
    await enqueue(
      () => bot.editMessageText(devText, {
        parse_mode: "HTML",
        disable_web_page_preview: true,
        chat_id: q.message.chat.id,
        message_id: q.message.message_id,
        reply_markup: {
          inline_keyboard: [
            [{ text: "📦 Github", url: "https://github.com/leviobrabo/togurosbot" }],
            [
              { text: uiText(q.from, "officialChannel"), url: "https://t.me/lbrabo" },
              { text: uiText(q.from, "support"), url: "https://t.me/kylorensbot" },
            ],
            [{ text: uiText(q.from, "devCommands"), callback_data: "dev_commands" }],
          ],
        },
      }),
      PRIORITY.HIGH
    ).catch(() => {});
    return;
  }

  // pagination: `type:pageNumber`
  const match = data.match(/^(stats|grupos|banned):(\d+)$/);
  if (!match) return;

  const [, type, pageStr] = match;
  const page = parseInt(pageStr, 10);
  const state = paginationState.get(`${type}:${userId}`);
  if (!state || page < 0 || page >= state.pages.length) return;

  state.currentPage = page;
  await enqueue(
    () => bot.editMessageText(state.pages[page], {
      chat_id: q.message.chat.id,
      message_id: q.message.message_id,
      ...buildNavMarkup(type, page, state.pages.length),
    }),
    PRIORITY.HIGH
  ).catch(() => {});
    });
}

async function updateUserLanguage(userId, langCode) {
    await UserModel.findOneAndUpdate(
        { user_id: userId },
        { $set: { lang_code: langCode } }
    ).catch(() => {});
}

async function updateGroupLanguage(chatId, langCode) {
    await ChatModel.findOneAndUpdate(
        { chatId },
        { $set: { lang_code: langCode } }
    ).catch(() => {});
}

async function migrateUsersLangCode() {
    // Verifica se migração está habilitada
    if (process.env.ENABLE_LANG_MIGRATION !== 'true') {
        console.log("⚠️ Migração de lang_code desabilitada. Use ENABLE_LANG_MIGRATION=true para ativar.");
        return;
    }
    
    const usersWithoutLang = await UserModel.find({ lang_code: "unknown" });
    console.log(`Migrando ${usersWithoutLang.length} usuários para adicionar lang_code...`);
    
    for (const user of usersWithoutLang) {
        try {
            const chatInfo = await bot.getChat(user.user_id);
            const langCode = chatInfo?.language_code || "unknown";
            await updateUserLanguage(user.user_id, langCode);
            console.log(`Usuário ${user.user_id} migrado: ${langCode}`);
        } catch (err) {
            console.error(`Erro ao migrar usuário ${user.user_id}:`, err.message);
        }
        await delay(50);
    }
    console.log("✅ Migração de usuários concluída!");
}

async function migrateGroupsLangCode() {
  if (process.env.ENABLE_LANG_MIGRATION !== 'true') {
    console.log("Migração de lang_code desabilitada. Use ENABLE_LANG_MIGRATION=true para ativar.");
    return;
  }

  const groupsWithoutType = await ChatModel.find({ chat_type: { $in: ["unknown", null] } });
  console.log(`Migrando ${groupsWithoutType.length} grupos para adicionar chat_type...`);

  for (const group of groupsWithoutType) {
    try {
      const chatInfo = await bot.getChat(group.chatId);
      const chatType = chatInfo?.type || "unknown";
      await ChatModel.findOneAndUpdate(
        { chatId: group.chatId },
        { $set: { chat_type: chatType } }
      ).catch(() => {});
      console.log(`Grupo ${group.chatId} chat_type: ${chatType}`);
    } catch (err) {
      console.error(`Erro ao migrar grupo ${group.chatId}:`, err.message);
    }
    await delay(50);
  }
  console.log("Migracao de chat_type dos grupos concluida!");
}

const REPLY_MAX_SIZE = 50;

// ─── exports ──────────────────────────────────────────────────────────────────

exports.initHandler = () => {
  registerCallbackHandler();

  bot.on("message", main);
  bot.on("message", saveUserInformation);
  bot.on("polling_error", pollingError);
  bot.on("new_chat_members", saveNewChatMembers);
  bot.on("left_chat_member", removeLeftChatMember);

    bot.onText(/^\/start$/, start);
    bot.onText(/^\/stats$/, stats);
    bot.onText(/^\/grupos$/, groups);
    bot.onText(/^\/ban/, ban);
    bot.onText(/^\/unban/, unban);
    bot.onText(/^\/banned/, banned);
    bot.onText(/^\/delmsg/, removeMessage);
    bot.onText(/^\/lang(?:\s+.+)?$/, setGroupLang);
    bot.onText(/^\/devs/, devs);
    bot.onText(/^\/dbstats/, dbstats);
    bot.onText(/^\/productstats$/, productstats);
    bot.onText(/^\/unlockbulk$/, unlockbulk);
    bot.onText(/^\/syncdb/, syncdb);

  bot.onText(/\/ping/, async (msg) => {
    const start = new Date();
    const replied = await enqueue(() => bot.sendMessage(msg.chat.id, uiText(msg.from, "pong")), PRIORITY.HIGH);
    const ms = new Date() - start;
    await enqueue(
      () => bot.editMessageText(
        uiText(msg.from, "pingResult", ms, timeFormatter(process.uptime())),
        { chat_id: replied.chat.id, message_id: replied.message_id, parse_mode: "Markdown" }
      ),
      PRIORITY.HIGH
    );
  });

    bot.onText(/^\/bc\b/, bc);
    bot.onText(/^\/broadcast\b/, broadcast);
    bot.onText(/^\/sendgp/, sendgp);

    // Status diário às 12:02
    new CronJob("02 00 12 * * *", sendStatus, null, true, "America/Sao_Paulo");

  // Ads para usuários: todo dia às 10h e 16h
  new CronJob("0 0 10 * * *", sendAdsToUsers, null, true, "America/Sao_Paulo");
  new CronJob("0 0 16 * * *", sendAdsToUsers, null, true, "America/Sao_Paulo");

  // Ads para grupos: 30min depois dos usuários (nunca paralelo)
  new CronJob("0 30 10 * * *", sendAdsToGroups, null, true, "America/Sao_Paulo");
  new CronJob("0 30 16 * * *", sendAdsToGroups, null, true, "America/Sao_Paulo");

  // Monitor de memória: a cada 5min, restart via pm2 se > 500MB
  new CronJob("0 */5 * * * *", async () => {
    const mem = process.memoryUsage();
    const qsize = queueSize();
    if (qsize > 0) {
      console.log(`[QUEUE] Tamanho: ${qsize} | Bulk: ${isBulkActive() ? getBulkType() : "nenhum"}`);
    }
    if (mem.heapUsed > 450 * 1024 * 1024) {
      console.log(`[MEM] Heap ${Math.round(mem.heapUsed / 1024 / 1024)}MB > 450MB — parando polling e encerrando...`);
      try { bot.stopPolling(); } catch (_) {}
      process.exit(1);
    }
  }, null, true, "America/Sao_Paulo");

    sendBotOnlineMessage();
};
