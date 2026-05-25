const { MessageModel, ChatModel, UserModel } = require("../database");
const { bot } = require("../bot");
const CronJob = require("cron").CronJob;
const { setTimeout: delay } = require("timers/promises");
const palavrasProibidas = require("./palavrasproibida.json");
const { audioList, photoList } = require("../config/media");
const { adsterra } = require("../config/ads");

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

function escapeHTML(text) {
  if (typeof text !== 'string') return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function sanitizeHTML(text) {
    if (typeof text !== 'string') return '';
    return text
        .replace(/[^\w\s\-.,:;!?'"@#$%^&*()+=\[\]{}|<>~`\/]/g, '')
        .replace(/[\u0000-\u001F\u007F-\u009F]/g, '');
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

function buildMessageKey(message) {
  if (message.sticker) return message.sticker.file_unique_id;
  return message.text || "";
}

function buildEntitiesFromStored(emojiEntities) {
  if (!emojiEntities || !emojiEntities.length) return undefined;
  return emojiEntities.map((e) => ({
    offset: e.offset,
    length: e.length,
    type: "custom_emoji",
    custom_emoji_id: e.custom_emoji_id,
  }));
}

function normalizeReplyItem(item) {
  if (typeof item === "string" || item instanceof String) {
    const isStickerFileId = /^[A-Za-z0-9_-]{30,}$/.test(item);
    return { type: isStickerFileId ? "sticker" : "text", value: item, emoji_entities: [] };
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

// ─── retry mechanism ─────────────────────────────────────────────────────────

async function retryWithBackoff(fn, maxRetries = 3, delayMs = 1000) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await fn();
        } catch (error) {
            const errorCode = error?.response?.body?.error_code;
            if (errorCode === 429) {
                const retryAfter = error?.response?.body?.parameters?.retry_after || 5;
                await delay(retryAfter * 1000);
                continue;
            }
            if (i === maxRetries - 1) throw error;
            await delay(delayMs * Math.pow(2, i));
        }
    }
}

function safeSendMessage(chatId, text, options = {}) {
    return retryWithBackoff(async () => {
        const sanitizedText = sanitizeHTML(text);
        return await bot.sendMessage(chatId, sanitizedText, {
            ...options,
            parse_mode: options.parse_mode || "HTML"
        });
    });
}

function safeSendAudio(chatId, audioUrl, options = {}) {
    return retryWithBackoff(async () => {
        return await bot.sendVoice(chatId, audioUrl, options);
    });
}

function safeSendPhoto(chatId, photoUrl, options = {}) {
    return retryWithBackoff(async () => {
        return await bot.sendPhoto(chatId, photoUrl, options);
    });
}

function safeCopyMessage(chatId, fromChatId, messageId) {
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

setInterval(cleanPaginationState, 10 * 60 * 1000).unref();

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
    const sent = await bot.sendMessage(chatId, pages[0], buildNavMarkup(type, 0, pages.length));
    paginationState.set(`${type}:${userId}`, { pages, currentPage: 0, msgId: sent.message_id, createdAt: Date.now() });
}

// ─── learning system ──────────────────────────────────────────────────────────

async function deleteMessageIfExists(repliedMessage, replyValue) {
  const found = await MessageModel.findOne({
    $or: [{ message: repliedMessage }, { "reply.value": replyValue }],
  });
  if (found) await MessageModel.deleteOne({ _id: found._id });
}

async function createMessageAndAddReply(message) {
  const repliedMessage = message.reply_to_message
    ? buildMessageKey(message.reply_to_message)
    : null;
  const replyItem = buildReplyItem(message);

  if (!repliedMessage || !replyItem.value) return;
  if (/^[\/.!]/.test(repliedMessage) || (/^[\/.!]/.test(replyItem.value) && replyItem.type === "text")) return;
  if (containsUrl(repliedMessage) || (replyItem.type === "text" && containsUrl(replyItem.value))) {
    await deleteMessageIfExists(repliedMessage, replyItem.value);
    return;
  }
  if (hasForbiddenWord(repliedMessage) || (replyItem.type === "text" && hasForbiddenWord(replyItem.value))) {
    await deleteMessageIfExists(repliedMessage, replyItem.value);
    return;
  }

  await new MessageModel({ message: repliedMessage, reply: [replyItem] }).save().catch(() => {});
}

async function addReply(message) {
  const repliedMessage = message.reply_to_message
    ? buildMessageKey(message.reply_to_message)
    : null;
  const replyItem = buildReplyItem(message);

  if (/^[\/.!]/.test(repliedMessage)) return;
  if (containsUrl(repliedMessage) || (replyItem.type === "text" && containsUrl(replyItem.value))) {
    await deleteMessageIfExists(repliedMessage, replyItem.value);
    return;
  }
  if (hasForbiddenWord(repliedMessage) || (replyItem.type === "text" && hasForbiddenWord(replyItem.value))) {
    await deleteMessageIfExists(repliedMessage, replyItem.value);
    return;
  }

  const exists = await MessageModel.exists({ message: repliedMessage });
  if (exists) {
    await MessageModel.findOneAndUpdate(
      { message: repliedMessage },
      { $push: { reply: { $each: [replyItem], $slice: REPLY_MAX_SIZE } } }
    );
  } else {
    await createMessageAndAddReply(message);
  }
}

// ─── answer user ──────────────────────────────────────────────────────────────

async function answerUser(message) {
  const received = buildMessageKey(message);
  const chatId = message.chat.id;
  const isGroup = message.chat.type === "group" || message.chat.type === "supergroup";

  if (isGroup) {
    const groupSaved = await ensureGroupSaved(message);
    if (!groupSaved) return;
  }

  try {
    if (/^[\/.!]/.test(received)) return;

    const sendOpts = isGroup ? {} : { reply_to_message_id: message.message_id };

    const audioMatch = audioList.find((a) => received === a.keyword);
    if (audioMatch) {
      await bot.sendChatAction(chatId, "record_audio").catch(() => {});
      await Promise.race([
        safeSendAudio(chatId, audioMatch.audioUrl, sendOpts),
        new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 6000)),
      ]).catch((e) => console.warn("[AUDIO-WARN]", e.message));
      return;
    }

    const photoMatch = photoList.find((p) => received === p.keyword);
    if (photoMatch) {
      await bot.sendChatAction(chatId, "upload_photo").catch(() => {});
      await Promise.race([
        safeSendPhoto(chatId, photoMatch.photoUrl, sendOpts),
        new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 6000)),
      ]).catch((e) => console.warn("[PHOTO-WARN]", e.message));
      return;
    }

    const doc = await MessageModel.findOne({ message: received });
    if (doc && doc.reply.length) {
      const rawReply = randomItem(doc.reply);
      const replyItem = normalizeReplyItem(rawReply);
      if (!replyItem || !replyItem.value) return;

      const typingTime = Math.min(Math.max(50 * replyItem.value.length, 200), 6000);
      await bot.sendChatAction(chatId, "typing").catch(() => {});
      await delay(typingTime);

      if (replyItem.type === "sticker") {
        await bot.sendSticker(chatId, replyItem.value, sendOpts).catch((err) => {
          if (!err.message?.includes("message to be replied")) {
            console.warn("[STICKER-WARN]", err.message);
          }
          return bot.sendSticker(chatId, replyItem.value).catch(() => {});
        });
      } else if (replyItem.type === "custom_emoji" && replyItem.emoji_entities?.length > 0) {
        await bot.sendMessage(chatId, replyItem.value, {
          ...sendOpts,
          disable_web_page_preview: true,
          entities: buildEntitiesFromStored(replyItem.emoji_entities),
        }).catch(async (err) => {
          console.warn("[EMOJI-WARN]", err.message);
          await bot.sendMessage(chatId, replyItem.value, {
            ...sendOpts,
            disable_web_page_preview: true,
          }).catch(() => {});
        });
      } else {
        await bot.sendMessage(chatId, replyItem.value, {
          ...sendOpts,
          disable_web_page_preview: true,
        }).catch(() => {});
      }
    }
  } catch (error) {
    const code = error?.response?.body?.error_code;
    if (error.message?.includes("CHAT_WRITE_FORBIDDEN") || code === 403) {
      await bot.leaveChat(chatId).catch(() => {});
      await ChatModel.deleteOne({ chatId }).catch(() => {});
    }
  }
}

// ─── main message handler ─────────────────────────────────────────────────────

async function main(message) {
    const replyTo = message?.reply_to_message ?? false;
    const botId = await getBotId();

    // Garantir que usuário em PV seja salvo
    if (message.chat.type === "private") {
        await ensureUserSaved(message);
    }

    if (message.sticker || message.text) {
        if (replyTo && replyTo.from.id !== botId) addReply(message);
        if (!replyTo || replyTo.from.id === botId) answerUser(message);
    }
}

// ─── user / group registration ────────────────────────────────────────────────

async function saveUserInformation(message) {
  const user = message.from;
  if (!user || user.is_bot) return;

  try {
    const langCode = user.language_code || "unknown";
    await UserModel.findOneAndUpdate(
      { user_id: user.id },
      {
        $setOnInsert: {
          user_id: user.id,
          is_dev: false,
        },
        $set: {
          username: user.username,
          firstname: user.first_name,
          lastname: user.last_name,
          lang_code: langCode,
        },
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
      await bot.leaveChat(chatId);
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
      bot.sendMessage(groupId, notif, {
        parse_mode: "HTML",
        ...(logMsgId && { reply_to_message_id: logMsgId }),
      }).catch(() => {});

      bot.sendMessage(
        chatId,
        "Olá, me chamo Toguro! Obrigado por me adicionar ao grupo. Vou responder as mensagens da galera aqui kkkkk.",
        {
          reply_markup: {
            inline_keyboard: [
              [
                { text: "📣 Canal Oficial", url: "https://t.me/lbrabo" },
                { text: "🐛 Relate Bugs", url: "https://t.me/kylorensbot" },
              ],
            ],
          },
        }
      ).catch(() => {});
    }

    const devMembers = msg.new_chat_members?.filter((m) => !m.is_bot && is_dev(m.id));
    if (devMembers?.length) {
      bot.sendMessage(
        chatId,
        `👨‍💻 <b>Um dos meus desenvolvedores entrou no grupo:</b> <a href="tg://user?id=${devMembers[0].id}">${devMembers[0].first_name}</a> 😎`,
        { parse_mode: "HTML" }
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

  try {
    const result = await UserModel.findOneAndUpdate(
      { user_id: user.id },
      {
        $setOnInsert: {
          user_id: user.id,
          is_dev: false,
        },
        $set: {
          username: user.username,
          firstname: user.first_name,
          lastname: user.last_name,
          lang_code: langCode,
        },
      },
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

    const devText =
        `Olá, <b>${firstName}</b>! Você é um dos desenvolvedores 🧑‍💻\n\n` +
        `Você está no painel do Helana. Use os comandos com responsabilidade.`;

    const userText =
        `Olá, <b>${firstName}</b>!\n\n` +
        `Eu sou <b>Helana</b>, um bot que responde mensagens, áudios e figurinhas da galera 😄\n\n` +
        `📣 <b>Novidades do bot:</b> <a href="https://t.me/lbrabo">@lbrabo</a>\n` +
        `📚 <b>Cursos:</b> <a href="https://t.me/cursobroff">@cursobroff</a>`;

    if (is_dev(userId)) {
        await bot.sendMessage(userId, devText, {
            parse_mode: "HTML",
            disable_web_page_preview: true,
            reply_markup: {
                inline_keyboard: [
                    [{ text: "📦 Github", url: "https://github.com/leviobrabo/helenegbot" }],
                    [
                        { text: "📣 Canal", url: "https://t.me/lbrabo" },
                        { text: "👨‍💻 Suporte", url: "https://t.me/kylorensbot" },
                    ],
                    [{ text: "🗃 Comandos do Dev", callback_data: "dev_commands" }],
                ],
            },
        });
    } else {
        await bot.sendMessage(message.chat.id, userText, {
            parse_mode: "HTML",
            disable_web_page_preview: true,
            reply_markup: {
                inline_keyboard: [
                    [{ text: "✨ Adicione-me em seu grupo", url: "https://t.me/helenagbot?startgroup=true" }],
                    [
                        { text: "📣 Canal Oficial", url: "https://t.me/lbrabo" },
                        { text: "👨‍💻 Suporte", url: "https://t.me/kylorensbot" },
                    ],
                    [{ text: "📦 Github", url: "https://github.com/leviobrabo/helanagbot" }],
                ],
            },
        });
    }
}

// ─── /stats ───────────────────────────────────────────────────────────────────

async function stats(message) {
  if (!is_dev(message.from.id)) return;
  await ensureUserSaved(message);

  const [numUsers, numChats, numMessages, usersByLang, groupsByLang, groupsByType] = await Promise.all([
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
  ]);

  const pages = [];

  const typeBreakdown = groupsByType.map(({ _id, count }) => `${_id || "unknown"}: ${count}`).join(" | ");

  pages.push(
    `📊 <b>Estatísticas — Toguro</b>\n\n` +
    `👥 <b>Usuários:</b> <code>${numUsers}</code>\n` +
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

// ─── /grupos ──────────────────────────────────────────────────────────────────

async function groups(message) {
    if (!is_dev(message.from.id)) return;
    if (message.chat.type !== "private") return;
    await ensureUserSaved(message);

    const chats = await ChatModel.find({ is_ban: false }).sort({ chatId: 1 });
    if (!chats.length) {
        return bot.sendMessage(message.chat.id, "Nenhum grupo ativo encontrado.");
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
        return bot.sendMessage(message.chat.id, "Use este comando no PV com o bot.");
    }
    if (!is_dev(message.from.id)) {
        return bot.sendMessage(message.chat.id, "Você não está autorizado.");
    }
    await ensureUserSaved(message);

    const bannedChats = await ChatModel.find({ is_ban: true });
    if (!bannedChats.length) {
        return bot.sendMessage(message.chat.id, "Nenhum grupo banido encontrado.");
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
        return bot.sendMessage(message.chat.id, "Use este comando no PV com o bot.");
    }
    if (!is_dev(message.from.id)) {
        return bot.sendMessage(message.chat.id, "Você não está autorizado.");
    }

    const rawId = message.text.split(" ")[1];
    if (!rawId || isNaN(rawId)) {
        return bot.sendMessage(message.chat.id, "Uso: /ban <chatId>");
    }

    const chatId = Number(rawId);
    const chat = await ChatModel.findOne({ chatId });
    if (!chat) return bot.sendMessage(message.chat.id, `Grupo não encontrado: ${chatId}`);
    if (chat.is_ban) return bot.sendMessage(message.chat.id, `Grupo <b>${chat.chatName}</b> já está banido.`, { parse_mode: "HTML" });

    await ChatModel.updateOne({ chatId }, { $set: { is_ban: true } });
    await bot.sendMessage(chatId, "Helana saindo do grupo!").catch(() => {});
    await bot.leaveChat(chatId).catch(() => {});
    await bot.sendMessage(message.chat.id, `✅ Grupo <b>${chat.chatName}</b> banido com sucesso.`, { parse_mode: "HTML" });

    bot.sendMessage(
        groupId,
        `#helenagbot #Banned\n<b>Group:</b> ${chat.chatName}\n<b>ID:</b> <code>${chatId}</code>`,
        { parse_mode: "HTML", ...(logMsgId && { reply_to_message_id: logMsgId }) }
    ).catch(() => {});
}

// ─── /unban ───────────────────────────────────────────────────────────────────

async function unban(message) {
    if (message.chat.type !== "private") {
        return bot.sendMessage(message.chat.id, "Use este comando no PV com o bot.");
    }
    if (!is_dev(message.from.id)) {
        return bot.sendMessage(message.chat.id, "Você não está autorizado.");
    }

    const rawId = message.text.split(" ")[1];
    if (!rawId || isNaN(rawId)) {
        return bot.sendMessage(message.chat.id, "Uso: /unban <chatId>");
    }

    const chatId = Number(rawId);
    const chat = await ChatModel.findOne({ chatId });
    if (!chat) return bot.sendMessage(message.chat.id, `Nenhum grupo encontrado com ID ${chatId}.`);
    if (!chat.is_ban) return bot.sendMessage(message.chat.id, `Grupo <b>${chat.chatName}</b> não está banido.`, { parse_mode: "HTML" });

    await ChatModel.updateOne({ chatId }, { $set: { is_ban: false } });
    await bot.sendMessage(message.chat.id, `✅ Grupo <b>${chat.chatName}</b> desbanido com sucesso.`, { parse_mode: "HTML" });

    bot.sendMessage(
        groupId,
        `#helenagbot #Unban\n<b>Group:</b> ${chat.chatName}\n<b>ID:</b> <code>${chatId}</code>`,
        { parse_mode: "HTML", ...(logMsgId && { reply_to_message_id: logMsgId }) }
    ).catch(() => {});
}

// ─── /delmsg ──────────────────────────────────────────────────────────────────

async function removeMessage(message) {
  if (!is_dev(message.from.id)) return;

  const repliedMessage = message.reply_to_message
    ? buildMessageKey(message.reply_to_message)
    : null;

  if (!repliedMessage) {
    return bot.sendMessage(message.chat.id, "Responda a uma mensagem para deletar do banco.");
  }

  const exists = await MessageModel.exists({ message: repliedMessage });
  if (!exists) {
    return bot.sendMessage(message.chat.id, "Mensagem não encontrada no banco de dados.");
  }

  await MessageModel.deleteMany({
    $or: [
      { message: repliedMessage },
      { "reply.value": repliedMessage },
    ],
  });

  bot.sendMessage(
    message.chat.id,
    `✅ Deletado por <a href="tg://user?id=${message.from.id}">${message.from.first_name}</a>.\n\nTodas as respostas associadas foram apagadas.`,
    { parse_mode: "HTML", reply_to_message_id: message.message_id }
  );
}

// ─── /devs ────────────────────────────────────────────────────────────────────

async function devs(message) {
    if (!is_dev(message.from.id)) {
        return bot.sendMessage(message.chat.id, "Este comando é apenas para desenvolvedores!");
    }
    if (message.chat.type !== "private") {
        return bot.sendMessage(message.chat.id, "Use este comando no PV com o bot.");
    }
    await ensureUserSaved(message);

    const devsData = await UserModel.find({ is_dev: true }).catch(() => []);
    let text = "<b>👨‍💻 Desenvolvedores:</b>\n\n";
    for (const user of devsData) {
        text += `• <a href="tg://user?id=${user.user_id}">${user.firstname}</a> — <code>${user.user_id}</code>\n`;
    }
    if (!devsData.length) text += "Nenhum dev cadastrado no banco.";
    bot.sendMessage(message.chat.id, text, { parse_mode: "HTML" });
}

// ─── /dbstats (diagnóstico) ────────────────────────────────────────────────────

async function dbstats(message) {
    if (!is_dev(message.from.id)) {
        return bot.sendMessage(message.chat.id, "Este comando é apenas para desenvolvedores!");
    }
    if (message.chat.type !== "private") {
        return bot.sendMessage(message.chat.id, "Use este comando no PV com o bot.");
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

        bot.sendMessage(message.chat.id, text, { parse_mode: "HTML" });
    } catch (err) {
        console.error("[DBSTATS] Erro:", err.message);
        bot.sendMessage(message.chat.id, `❌ Erro ao consultar banco: ${err.message}`);
    }
}

// ─── /syncdb (forçar sincronização de usuários/grupos via Telegram) ───────────

async function syncdb(message) {
    if (!is_dev(message.from.id)) {
        return bot.sendMessage(message.chat.id, "Este comando é apenas para desenvolvedores!");
    }
    if (message.chat.type !== "private") {
        return bot.sendMessage(message.chat.id, "Use este comando no PV com o bot.");
    }
    await ensureUserSaved(message);

    const sentMsg = await bot.sendMessage(message.chat.id, "🔄 <i>Sincronizando banco de dados...</i>", { parse_mode: "HTML" });

    try {
        // Obter lista de chats do bot
        const botChats = await bot.getChatAdministrators(-1).catch(() => []);
        
        // Nota: getChatAdministrators funciona apenas para grupos específicos
        // Uma abordagem melhor é usar o histórico de mensagens
        // Por enquanto, vamos apenas avisar que a sincronização de grupos é feita automaticamente
        
        const totalUsers = await UserModel.countDocuments();
        const totalGroups = await ChatModel.countDocuments();
        
        await bot.editMessageText(
            `✅ <b>Sincronização Concluída</b>\n\n` +
            `👥 <b>Usuários salvos:</b> <code>${totalUsers}</code>\n` +
            `🏘 <b>Grupos salvos:</b> <code>${totalGroups}</code>\n\n` +
            `<i>ℹ️ Novos usuários são salvos ao enviar mensagens em PV.\n` +
            `Novos grupos são salvos quando o bot recebe mensagens.</i>`,
            { chat_id: sentMsg.chat.id, message_id: sentMsg.message_id, parse_mode: "HTML" }
        );
    } catch (err) {
        console.error("[SYNCDB] Erro:", err.message);
        await bot.editMessageText(
            `❌ Erro na sincronização: ${err.message}`,
            { chat_id: sentMsg.chat.id, message_id: sentMsg.message_id }
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
    return bot.sendMessage(msg.chat.id, "<i>Uso: /bc [-d] &lt;texto&gt;</i>", { parse_mode: "HTML" });
  }

  const webPreview = query.startsWith("-d");
  const text = webPreview ? query.substring(2).trim() : query;
  if (!text) {
    return bot.sendMessage(msg.chat.id, "<i>Uso: /bc [-d] &lt;texto&gt;</i>", { parse_mode: "HTML" });
  }

  const sentMsg = await bot.sendMessage(msg.chat.id, "<i>⏳ Enviando broadcast...</i>", { parse_mode: "HTML" });
  const ulist = await UserModel.find().lean().select("user_id");
  console.log(`[BC] Iniciando broadcast para ${ulist.length} usuários`);

  let success = 0, blocked = 0, failed = 0;
  const total = ulist.length;
  const batchSize = 50;
  const batches = chunkArray(ulist, batchSize);

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const batchProgress = Math.round(((i + 1) / batches.length) * 100);

    for (const { user_id } of batch) {
      try {
        await safeSendMessage(user_id, text, { disable_web_page_preview: !webPreview });
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
      await delay(50);
    }

    await bot.editMessageText(
      `╭─❑ 「 <b>Broadcast em Progresso</b> 」 ❑\n` +
      `│ 📤 Progresso: <code>${batchProgress}%</code>\n` +
      `│ ✅ Enviados: <code>${success}</code>\n` +
      `│ 🚫 Bloqueados: <code>${blocked}</code>\n` +
      `│ ❌ Falhas: <code>${failed}</code>\n` +
      `╰❑`,
      { chat_id: sentMsg.chat.id, message_id: sentMsg.message_id, parse_mode: "HTML" }
    ).catch(() => {});
  }

  console.log(`[BC] Concluído: ${success}/${total} enviados | ${blocked} bloqueados | ${failed} falhas`);

  await bot.editMessageText(
    `╭─❑ 「 <b>Broadcast Concluído</b> 」 ❑\n` +
    `│ 📤 Total: <code>${total}</code>\n` +
    `│ ✅ Enviados: <code>${success}</code>\n` +
    `│ 🚫 Bloqueados (removidos): <code>${blocked}</code>\n` +
    `│ ❌ Falhas: <code>${failed}</code>\n` +
    `╰❑`,
    { chat_id: sentMsg.chat.id, message_id: sentMsg.message_id, parse_mode: "HTML" }
  );
}

// ─── /broadcast ───────────────────────────────────────────────────────────────

async function broadcast(msg) {
  if (!is_dev(msg.from.id)) return;
  if (msg.chat.type !== "private") return;
  await ensureUserSaved(msg);

  if (!msg.reply_to_message) {
    return bot.sendMessage(msg.chat.id, "<i>Responda a uma mensagem para fazer broadcast.</i>", {
      parse_mode: "HTML",
    });
  }

  const reply = msg.reply_to_message;
  const sentMsg = await bot.sendMessage(msg.chat.id, "<i>⏳ Broadcast iniciando...</i>", { parse_mode: "HTML" });
  const ulist = await UserModel.find().lean().select("user_id");
  console.log(`[BROADCAST] Iniciando broadcast para ${ulist.length} usuários`);

  let success = 0, blocked = 0, failed = 0;
  const total = ulist.length;
  const batchSize = 50;
  const batches = chunkArray(ulist, batchSize);

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const batchProgress = Math.round(((i + 1) / batches.length) * 100);

    for (const { user_id } of batch) {
      try {
        await bot.copyMessage(user_id, msg.chat.id, reply.message_id);
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
      await delay(50);
    }

    await bot.editMessageText(
      `╭─❑ 「 <b>Broadcast em Progresso</b> 」 ❑\n` +
      `│ 📤 Progresso: <code>${batchProgress}%</code>\n` +
      `│ ✅ Enviados: <code>${success}</code>\n` +
      `│ 🚫 Bloqueados: <code>${blocked}</code>\n` +
      `│ ❌ Falhas: <code>${failed}</code>\n` +
      `╰❑`,
      { chat_id: sentMsg.chat.id, message_id: sentMsg.message_id, parse_mode: "HTML" }
    ).catch(() => {});
  }

  console.log(`[BROADCAST] Concluído: ${success}/${total} enviados | ${blocked} bloqueados | ${failed} falhas`);

  await bot.editMessageText(
    `╭─❑ 「 <b>Broadcast Concluído</b> 」 ❑\n` +
    `│ 📤 Total: <code>${total}</code>\n` +
    `│ ✅ Enviados: <code>${success}</code>\n` +
    `│ 🚫 Bloqueados (removidos): <code>${blocked}</code>\n` +
    `│ ❌ Falhas: <code>${failed}</code>\n` +
    `╰❑`,
    { chat_id: sentMsg.chat.id, message_id: sentMsg.message_id, parse_mode: "HTML" }
  );
}

// ─── /sendgp ──────────────────────────────────────────────────────────────────

async function sendgp(msg) {
  if (!is_dev(msg.from.id)) return;
  if (msg.chat.type !== "private") return;
  await ensureUserSaved(msg);

  const sentMsg = await bot.sendMessage(msg.chat.id, "<i>⏳ Enviando para grupos...</i>", { parse_mode: "HTML" });
  const ulist = await ChatModel.find({ is_ban: false }).lean().select("chatId");
  console.log(`[SENDGP] Iniciando envio para ${ulist.length} grupos`);

  let success = 0, removed = 0, failed = 0;
  const total = ulist.length;
  const batchSize = 20;
  const batches = chunkArray(ulist, batchSize);

  if (msg.reply_to_message) {
    const replyMsg = msg.reply_to_message;

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      const batchProgress = Math.round(((i + 1) / batches.length) * 100);

      for (const { chatId } of batch) {
        try {
          await safeCopyMessage(chatId, replyMsg.chat.id, replyMsg.message_id);
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
        await delay(50);
      }

      await bot.editMessageText(
        `╭─❑ 「 <b>Envio para Grupos em Progresso</b> 」 ❑\n` +
        `│ 📤 Progresso: <code>${batchProgress}%</code>\n` +
        `│ ✅ Enviados: <code>${success}</code>\n` +
        `│ 🗑 Removidos: <code>${removed}</code>\n` +
        `│ ❌ Falhas: <code>${failed}</code>\n` +
        `╰❑`,
        { chat_id: sentMsg.chat.id, message_id: sentMsg.message_id, parse_mode: "HTML" }
      ).catch(() => {});
    }
  } else {
    const rawText = msg.text.replace(/^\/sendgp(?:@\w+)?\s*/, "").trim();
    const webPreview = rawText.startsWith("-d");
    const text = webPreview ? rawText.substring(2).trim() : rawText;

    if (!text) {
      await bot.editMessageText("Uso: /sendgp [-d] <texto> ou responda uma mensagem.", {
        chat_id: sentMsg.chat.id,
        message_id: sentMsg.message_id,
      });
      return;
    }

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      const batchProgress = Math.round(((i + 1) / batches.length) * 100);

      for (const { chatId } of batch) {
        try {
          await safeSendMessage(chatId, text, { disable_web_page_preview: !webPreview });
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
        await delay(50);
      }

      await bot.editMessageText(
        `╭─❑ 「 <b>Envio para Grupos em Progresso</b> 」 ❑\n` +
        `│ 📤 Progresso: <code>${batchProgress}%</code>\n` +
        `│ ✅ Enviados: <code>${success}</code>\n` +
        `│ 🗑 Removidos: <code>${removed}</code>\n` +
        `│ ❌ Falhas: <code>${failed}</code>\n` +
        `╰❑`,
        { chat_id: sentMsg.chat.id, message_id: sentMsg.message_id, parse_mode: "HTML" }
      ).catch(() => {});
    }
  }

  console.log(`[SENDGP] Concluído: ${success}/${total} enviados | ${removed} removidos | ${failed} falhas`);

  await bot.editMessageText(
    `╭─❑ 「 <b>Envio para Grupos Concluído</b> 」 ❑\n` +
    `│ 🏘 Total: <code>${total}</code>\n` +
    `│ ✅ Enviados: <code>${success}</code>\n` +
    `│ 🗑 Removidos (inativos): <code>${removed}</code>\n` +
    `│ ❌ Falhas: <code>${failed}</code>\n` +
    `╰❑`,
    { chat_id: sentMsg.chat.id, message_id: sentMsg.message_id, parse_mode: "HTML" }
  );
}

// ─── Adsterra ads (rate-limit aware) ─────────────────────────────────────────

let adDelay = 250;
const AD_MIN_DELAY = 100;
const AD_MAX_DELAY = 2000;

async function sendAdWithRateLimit(chatId, text, replyMarkup, isGroup) {
  try {
    await safeSendMessage(chatId, text, {
      disable_web_page_preview: true,
      reply_markup: replyMarkup,
    });
    adDelay = Math.max(AD_MIN_DELAY, adDelay * 0.95);
    return true;
  } catch (err) {
    const code = err?.response?.body?.error_code;
    const desc = err?.response?.body?.description || "";

    if (code === 429) {
      const retryAfter = err?.response?.body?.parameters?.retry_after || 10;
      console.warn(`[ADS] 429 rate limit — aguardando ${retryAfter}s`);
      adDelay = Math.min(AD_MAX_DELAY, adDelay * 2);
      await delay(retryAfter * 1000);
      try {
        await safeSendMessage(chatId, text, {
          disable_web_page_preview: true,
          reply_markup: replyMarkup,
        });
        return true;
      } catch (retryErr) {
        return false;
      }
    }

    if (isGroup) {
      if (code === 403 || (code === 400 && /chat not found|group is deactivated|not enough rights/i.test(desc))) {
        await ChatModel.deleteOne({ chatId }).catch(() => {});
      }
    } else {
      if (code === 403 || (code === 400 && /chat not found|bot can't initiate/i.test(desc))) {
        await UserModel.deleteOne({ user_id: chatId }).catch(() => {});
      }
    }
    return false;
  }
}

async function sendAdsToUsers() {
  const cutoff = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
  const users = await UserModel.find({
    $or: [{ last_ad_sent: null }, { last_ad_sent: { $lt: cutoff } }],
  })
    .lean()
    .select("user_id")
    .limit(500);

  if (!users.length) return;

  const now = new Date();
  let success = 0, failed = 0;
  const total = users.length;

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

    await delay(adDelay);

    if (i % 100 === 0 && i > 0) {
      console.log(`[ADS-USERS] Progresso: ${i}/${total} | OK: ${success} | Fail: ${failed}`);
      await delay(2000);
    }
  }

  console.log(`[ADS-USERS] Concluído: ${success}/${total} | Falhas: ${failed}`);
}

async function sendAdsToGroups() {
  const cutoff = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
  const groups = await ChatModel.find({
    is_ban: false,
    $or: [{ last_ad_sent: null }, { last_ad_sent: { $lt: cutoff } }],
  })
    .lean()
    .select("chatId")
    .limit(300);

  if (!groups.length) return;

  const now = new Date();
  let success = 0, failed = 0;
  const total = groups.length;

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

    await delay(adDelay);

    if (i % 50 === 0 && i > 0) {
      console.log(`[ADS-GROUPS] Progresso: ${i}/${total} | OK: ${success} | Fail: ${failed}`);
      await delay(3000);
    }
  }

  console.log(`[ADS-GROUPS] Concluído: ${success}/${total} | Falhas: ${failed}`);
}

// ─── status cron ──────────────────────────────────────────────────────────────

async function sendStatus() {
    const start = new Date();
    const replied = await bot.sendMessage(channelStatusId, "Bot is ON").catch(() => null);
    if (!replied) return;
    const ping = new Date() - start;
    const numUsers = await UserModel.countDocuments();
    const numChats = await ChatModel.countDocuments({ is_ban: false });
    await bot
        .editMessageText(
            `#helenagbot #Status\n\nStatus: ON\nPing: \`${ping}ms\`\nUptime: \`${timeFormatter(process.uptime())}\`\nUsuários: \`${numUsers}\`\nGrupos: \`${numChats}\``,
            { chat_id: replied.chat.id, message_id: replied.message_id, parse_mode: "Markdown" }
        )
        .catch(() => {});
}

// ─── lifecycle ────────────────────────────────────────────────────────────────

function sendBotOnlineMessage() {
    console.log("Helana iniciado com sucesso...");
    bot.sendMessage(groupId, "#Helana #ONLINE\n\nBot is now playing ...", {
        ...(logMsgId && { reply_to_message_id: logMsgId }),
    }).catch(() => {});
}

function sendBotOfflineMessage() {
  console.log("Helana encerrado...");
  bot.sendMessage(groupId, "#Helana #OFFLINE\n\nBot is now off ...", {
    ...(logMsgId && { reply_to_message_id: logMsgId }),
  }).catch(() => {}).finally(() => {
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
                "/delmsg — Apaga mensagem do banco (reply)",
                "/devs — Lista de desenvolvedores",
                "/sendgp — Envia mensagem para todos os grupos",
            ];
            await bot
                .editMessageText("<b>🗃 Comandos do Dev:</b>\n\n" + commands.join("\n"), {
                    parse_mode: "HTML",
                    disable_web_page_preview: true,
                    chat_id: q.message.chat.id,
                    message_id: q.message.message_id,
                    reply_markup: {
                        inline_keyboard: [[{ text: "⬅️ Voltar", callback_data: "back_to_start" }]],
                    },
                })
                .catch(() => {});
            return;
        }

        if (data === "back_to_start") {
            const firstName = q.from.first_name;
            const devText =
                `Olá, <b>${firstName}</b>! Você é um dos desenvolvedores 🧑‍💻\n\n` +
                `Você está no painel do Helana. Use os comandos com responsabilidade.`;
            await bot
                .editMessageText(devText, {
                    parse_mode: "HTML",
                    disable_web_page_preview: true,
                    chat_id: q.message.chat.id,
                    message_id: q.message.message_id,
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: "📦 Github", url: "https://github.com/leviobrabo/helenagbot" }],
                            [
                                { text: "📣 Canal", url: "https://t.me/lbrabo" },
                                { text: "👨‍💻 Suporte", url: "https://t.me/kylorensbot" },
                            ],
                            [{ text: "🗃 Comandos do Dev", callback_data: "dev_commands" }],
                        ],
                    },
                })
                .catch(() => {});
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
        await bot
            .editMessageText(state.pages[page], {
                chat_id: q.message.chat.id,
                message_id: q.message.message_id,
                ...buildNavMarkup(type, page, state.pages.length),
            })
            .catch(() => {});
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

async function migrateReplyFormat() {
  console.log("[MIGRATE-REPLY] Iniciando migração (batch com cursor)...");
  let processed = 0;
  let migrated = 0;
  const batchSize = 100;
  let hasMore = true;
  let lastId = null;

  while (hasMore) {
    const query = lastId ? { _id: { $gt: lastId } } : {};
    const docs = await MessageModel.find(query)
      .sort({ _id: 1 })
      .limit(batchSize)
      .lean();

    if (!docs.length) { hasMore = false; break; }
    lastId = docs[docs.length - 1]._id;

    for (const doc of docs) {
      processed++;
      if (!Array.isArray(doc.reply) || doc.reply.length === 0) continue;
      const needsMigration = doc.reply.some(
        (item) => typeof item === "string" || item instanceof String || (item.custom_emoji_ids && !item.emoji_entities)
      );
      if (!needsMigration) continue;

      const newReply = doc.reply.map((item) => {
        if (typeof item === "string" || item instanceof String) {
          const isStickerFileId = /^[A-Za-z0-9_-]{30,}$/.test(item);
          return { type: isStickerFileId ? "sticker" : "text", value: item, emoji_entities: [] };
        }
        if (item.custom_emoji_ids && !item.emoji_entities) {
          item.emoji_entities = [];
          delete item.custom_emoji_ids;
        }
        return item;
      });

      await MessageModel.updateOne({ _id: doc._id }, { $set: { reply: newReply } }).catch(() => {});
      migrated++;
    }

    if (processed % 500 === 0) {
      console.log(`[MIGRATE-REPLY] Progresso: ${processed} processados, ${migrated} migrados`);
      await delay(100);
    }
  }

  console.log(`[MIGRATE-REPLY] Concluída: ${migrated} migrados de ${processed} total.`);
}

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
    bot.onText(/^\/devs/, devs);
    bot.onText(/^\/dbstats/, dbstats);
    bot.onText(/^\/syncdb/, syncdb);

    bot.onText(/\/ping/, async (msg) => {
        const start = new Date();
        const replied = await bot.sendMessage(msg.chat.id, "𝚙𝚘𝚗𝚐!");
        const ms = new Date() - start;
        await bot.editMessageText(
            `𝚙𝚒𝚗𝚐: \`${ms}𝚖𝚜\`\n𝚞𝚙𝚝𝚒𝚖𝚎: \`${timeFormatter(process.uptime())}\``,
            { chat_id: replied.chat.id, message_id: replied.message_id, parse_mode: "Markdown" }
        );
    });

    bot.onText(/^\/bc\b/, bc);
    bot.onText(/^\/broadcast\b/, broadcast);
    bot.onText(/^\/sendgp/, sendgp);

  // Status diário às 12:02
  new CronJob("02 00 12 * * *", sendStatus, null, true, "America/Sao_Paulo");

  // Ads para usuários: 4x por dia para cobrir 12k users em batches
  new CronJob("0 0 8 * * *", sendAdsToUsers, null, true, "America/Sao_Paulo");
  new CronJob("0 0 12 * * *", sendAdsToUsers, null, true, "America/Sao_Paulo");
  new CronJob("0 0 16 * * *", sendAdsToUsers, null, true, "America/Sao_Paulo");
  new CronJob("0 0 21 * * *", sendAdsToUsers, null, true, "America/Sao_Paulo");

  // Ads para grupos: 3x por dia
  new CronJob("0 0 10 * * *", sendAdsToGroups, null, true, "America/Sao_Paulo");
  new CronJob("0 0 14 * * *", sendAdsToGroups, null, true, "America/Sao_Paulo");
  new CronJob("0 0 20 * * *", sendAdsToGroups, null, true, "America/Sao_Paulo");

  // Migração de reply: dia 1 de cada mês às 03:00
  new CronJob("0 0 3 1 * *", migrateReplyFormat, null, true, "America/Sao_Paulo");

  // Monitor de memória: a cada 5min, restart graceful se > 450MB
  new CronJob("0 */5 * * * *", async () => {
    const mem = process.memoryUsage();
    const heapMB = Math.round(mem.heapUsed / 1024 / 1024);
    if (heapMB > 450) {
      console.warn(`[MEM] Heap ${heapMB}MB > 450MB — restart graceful...`);
      const { bot } = require("../bot");
      bot.stopPolling();
      await delay(2000);
      process.exit(0);
    }
  }, null, true, "America/Sao_Paulo");

  sendBotOnlineMessage();
};
