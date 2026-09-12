const { MessageModel, ChatModel, UserModel } = require("../database");
const { bot } = require("../bot");
const palavrasProibidas = require("./palavrasproibida.json");
const { audioList, photoList } = require("../config/media");

require("./errors.js");

const groupId = process.env.groupId;
const logMsgId = parseInt(process.env.LOG_MSG_ID) || null;
const channelStatusId = process.env.channelStatusId;

// ─── helpers ─────────────────────────────────────────────────────────────────

function is_dev(user_id) {
    const devUsers = (process.env.DEV_USERS || "").split(",").map((s) => s.trim());
    return devUsers.includes(user_id.toString());
}

function normalizeLangCode(langCode) {
  const normalized = String(langCode || "unknown").trim().toLowerCase().replace("_", "-");
  if (normalized === "auto") return "unknown";
  if (/^[a-z]{2,3}(?:-[a-z]{2})?$/.test(normalized)) return normalized;
  return "unknown";
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
  if (item.t === "s") {
    return { type: "sticker", value: item.v, emoji_entities: [] };
  }
  if (item.t === "e") {
    const emojiEntities = Array.isArray(item.e)
      ? item.e.map((e) => ({
          offset: e.o,
          length: e.l || 2,
          custom_emoji_id: e.c,
        })).filter((e) => e.offset !== undefined && e.custom_emoji_id)
      : [];
    return { type: "custom_emoji", value: item.v, emoji_entities: emojiEntities };
  }
  return { type: "text", value: item.v || "", emoji_entities: [] };
}

function chunkArray(arr, size) {
    const chunks = [];
    for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
    return chunks.length ? chunks : [[]];
}

async function retryWithBackoff(fn, maxRetries = 3, delayMs = 1000) {
  let lastError;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const errorCode = error?.response?.body?.error_code;
      if (errorCode === 429) {
        const retryAfter = error?.response?.body?.parameters?.retry_after || 10;
        console.warn(`[RATE-LIMIT] 429 — aguardando ${retryAfter}s (tentativa ${i + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
        continue;
      }
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, delayMs * Math.pow(2, i)));
    }
  }
  throw lastError;
}

async function safeSendMessage(chatId, text, options = {}) {
  return retryWithBackoff(async () => {
    return await bot.sendMessage(chatId, text, {
      ...options,
      parse_mode: options.parse_mode || "HTML",
    });
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
  const sent = await bot.sendMessage(chatId, pages[0], buildNavMarkup(type, 0, pages.length));
  paginationState.set(`${type}:${userId}`, { pages, currentPage: 0, msgId: sent.message_id, createdAt: Date.now() });
}

// ─── learning system ──────────────────────────────────────────────────────────

const REPLY_MAX_SIZE = 50;

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

function containsUrl(text) {
    if (typeof text !== "string") return false;
    return /\b(?:https?:\/\/|www\.)\S+\.(?:[a-z]{2,})(?:\S*)?\b/gi.test(text);
}

function hasForbiddenWord(text) {
    if (typeof text !== "string") return false;
    const lower = text.toLowerCase();
    return palavrasProibidas.palavras_proibidas.some((w) => lower.includes(w.toLowerCase()));
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
  if (containsUrl(repliedMessage) || (replyItem.type === "text" && containsUrl(replyItem.value))) return;
  if (hasForbiddenWord(repliedMessage) || (replyItem.type === "text" && hasForbiddenWord(replyItem.value))) return;

  await MessageModel.findOneAndUpdate(
    buildMessageQuery(lang, repliedMessage),
    {
      $setOnInsert: { l: lang, m: repliedMessage },
      $push: { r: { $each: [replyItem], $slice: REPLY_MAX_SIZE } },
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
      await safeSendMessage(chatId, audioMatch.audioUrl, sendOpts);
      return;
    }

    const photoMatch = photoList.find((p) => received === p.keyword);
    if (photoMatch) {
      await bot.sendChatAction(chatId, "upload_photo").catch(() => {});
      await safeSendMessage(chatId, photoMatch.photoUrl, sendOpts);
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
      await new Promise(resolve => setTimeout(resolve, typingTime));

      if (replyItem.type === "sticker") {
        await bot.sendSticker(chatId, replyItem.value, sendOpts).catch(() => {});
      } else if (replyItem.type === "custom_emoji" && replyItem.emoji_entities?.length > 0) {
        await bot.sendMessage(chatId, replyItem.value, {
          ...sendOpts,
          disable_web_page_preview: true,
          entities: buildEntitiesFromStored(replyItem.emoji_entities),
        }).catch(() => {});
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

async function ensureUserSaved(message) {
  const user = message.from;
  if (!user || user.is_bot) return false;

  const langCode = user.language_code || "unknown";
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const source = "direct";
  const update = {
    $setOnInsert: {
      user_id: user.id,
      is_dev: false,
      first_seen_at: now,
      first_seen_day: today,
      source,
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
    return !!result._id;
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
    return true;
  } catch (err) {
    console.error(`[ENSURE-GROUP-ERROR] Falha ao salvar grupo ${chatId}:`, err.message);
    return false;
  }
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
      await bot.leaveChat(chatId).catch(() => {});
      return;
    }

    const addedNow = msg.new_chat_members?.some((m) => m.id === BOT_ID);
    const chatLink = msg.chat.username ? `@${msg.chat.username}` : "Private Group";

    if (addedNow) {
      const welcomeMessages = [
        `Olá, me chamo Toguro! Obrigado por me adicionar ao grupo 😄\n\n🌐 Minhas linguagens:\n• Português\n• English\n• Español\n• Italiano\n• Français\n• Deutsch`,
        `Hey there! I'm Toguro! Thanks for adding me to your group! 🤖\n\n💬 I'll start learning and responding to messages right away!`,
        `¡Hola! Soy Toguro. Gracias por agregarme al grupo 👋\n\n🎓 Voy a empezar a aprender y responder mensajes.`
      ];
      
      await bot.sendMessage(
        chatId,
        welcomeMessages[Math.floor(Math.random() * welcomeMessages.length)],
        { parse_mode: "HTML" }
      );

      const notif =
        `#Togurosbot #New_Group\n` +
        `<b>Group:</b> ${chat.chatName}\n` +
        `<b>ID:</b> <code>${chatId}</code>\n` +
        `<b>Type:</b> <code>${chatType}</code>\n` +
        `<b>Link:</b> ${chatLink}`;
      
      if (groupId) {
        await bot.sendMessage(groupId, notif, {
          parse_mode: "HTML",
          ...(logMsgId && { reply_to_message_id: logMsgId }),
        }).catch(() => {});
      }
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
    await ChatModel.deleteOne({ chatId }).catch(() => {});
}

// ─── /start ───────────────────────────────────────────────────────────────────

async function start(message) {
    if (message.chat.type !== "private") return;
    
    await ensureUserSaved(message);
    
    const userId = message.from.id;
    const firstName = message.from.first_name;

    const devText = `Olá, <b>${firstName}</b>! Você é um dos desenvolvedores 🧑‍💻`;
    const userText = `Olá, <b>${firstName}</b>!\n\nEu sou <b>Toguro</b>, um bot que responde mensagens, áudios e figurinhas da galera 😄`;

    if (is_dev(userId)) {
      await bot.sendMessage(userId, devText, {
        parse_mode: "HTML",
        disable_web_page_preview: true,
        reply_markup: {
          inline_keyboard: [
            [{ text: "📦 Github", url: "https://github.com/leviobrabo/togurosbot" }],
            [
              { text: "📣 Canal Oficial", url: "https://t.me/lbrabo" },
              { text: "👨‍💻 Suporte", url: "https://t.me/kylorensbot" },
            ],
            [{ text: "🗃 Comandos Dev", callback_data: "dev_commands" }],
          ],
        },
      });
    } else {
      await bot.sendMessage(message.chat.id, userText, {
        parse_mode: "HTML",
        disable_web_page_preview: true,
        reply_markup: {
          inline_keyboard: [
            [{ text: "✨ Adicione-me em seu grupo", url: "https://t.me/togurosbot?startgroup=true" }],
            [
              { text: "📣 Canal Oficial", url: "https://t.me/lbrabo" },
              { text: "👨‍💻 Suporte", url: "https://t.me/kylorensbot" },
            ],
            [{ text: "📚 Cursos", url: "https://t.me/cursobroff" }],
            [{ text: "📦 Github", url: "https://github.com/leviobrabo/togurosbot" }],
          ],
        },
      });
    }
}

// ─── /stats ───────────────────────────────────────────────────────────────────

async function stats(message) {
  if (!is_dev(message.from.id)) return;
  if (message.chat.type !== "private") return;
  await ensureUserSaved(message);

  const [numUsers, numChats, numMessages, usersByLang, groupsByLang] = await Promise.all([
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
  ]);

  const memUsage = process.memoryUsage();
  const memUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
  const memTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);

  const text = 
    `📊 <b>Estatísticas — Toguro</b>\n\n` +
    `👥 <b>Usuários:</b> <code>${numUsers}</code>\n` +
    `🏘 <b>Grupos ativos:</b> <code>${numChats}</code>\n` +
    `💬 <b>Mensagens aprendidas:</b> <code>${numMessages}</code>\n\n` +
    `⚡ <b>Performance</b>\n` +
    `💾 <b>Memória:</b> <code>${memUsedMB}</code>MB / <code>${memTotalMB}</code>MB\n` +
    `🕒 <b>Uptime:</b> <code>${timeFormatter(process.uptime())}</code>\n\n` +
    `👥 <b>Usuários por idioma</b>\n`;

  usersByLang.forEach(({ _id, count }) => {
    text += `🌐 <code>${_id || "unknown"}</code> — <b>${count}</b> usuário(s)\n`;
  });

  text += `\n🏘 <b>Grupos por idioma</b>\n`;
  
  groupsByLang.forEach(({ _id, count }) => {
    text += `🌐 <code>${_id || "unknown"}</code> — <b>${count}</b> grupo(s)\n`;
  });

  text += `\n📅 <code>${new Date().toLocaleString('pt-BR')}</code>`;

  await bot.sendMessage(message.chat.id, text, { parse_mode: "HTML" });
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
  await bot.sendMessage(chatId, "Toguro saindo do grupo!");
  await bot.leaveChat(chatId).catch(() => {});
  await bot.sendMessage(message.chat.id, `✅ Grupo <b>${chat.chatName}</b> banido com sucesso.`, { parse_mode: "HTML" });

  if (groupId) {
    await bot.sendMessage(groupId, `#Togurosbot #Banned\n<b>Group:</b> ${chat.chatName}\n<b>ID:</b> <code>${chatId}</code>`, {
      parse_mode: "HTML",
      ...(logMsgId && { reply_to_message_id: logMsgId })
    }).catch(() => {});
  }
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

  if (groupId) {
    await bot.sendMessage(groupId, `#Togurosbot #Unban\n<b>Group:</b> ${chat.chatName}\n<b>ID:</b> <code>${chatId}</code>`, {
      parse_mode: "HTML",
      ...(logMsgId && { reply_to_message_id: logMsgId })
    }).catch(() => {});
  }
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

  await bot.sendMessage(message.chat.id, `✅ Deletado por <a href="tg://user?id=${message.from.id}">${message.from.first_name}</a>.`, { parse_mode: "HTML", reply_to_message_id: message.message_id });
}

// ─── /lang ───────────────────────────────────────────────────────────────────

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
    return bot.sendMessage(message.chat.id, "Use este comando em um grupo.");
  }

  const allowed = await isGroupAdminOrOwner(message.chat.id, message.from.id);
  if (!allowed) {
    return bot.sendMessage(message.chat.id, "Apenas admins podem alterar o idioma do grupo.");
  }

  const groupSaved = await ensureGroupSaved(message);
  if (!groupSaved) return;

  const [, rawLang] = (message.text || "").trim().split(/\s+/, 2);
  if (!rawLang) {
    const buttons = GROUP_LANG_OPTIONS.map(([code, label]) => ({
      text: label,
      callback_data: `group_lang:${code}`,
    }));
    const rows = [];
    for (let i = 0; i < buttons.length; i += 2) rows.push(buttons.slice(i, i + 2));
    
    return bot.sendMessage(message.chat.id, "Escolha o idioma das respostas do Toguro:", {
      reply_markup: { inline_keyboard: rows },
    });
  }

  const lang = normalizeLangCode(rawLang);
  await ChatModel.updateOne({ chatId: message.chat.id }, { $set: { lang_code: lang } });
  return bot.sendMessage(message.chat.id, `Idioma das respostas definido para: <b>${langLabel(lang)}</b>`, { parse_mode: "HTML" });
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
  await bot.sendMessage(message.chat.id, text, { parse_mode: "HTML" });
}

// ─── /ping ────────────────────────────────────────────────────────────────────

async function ping(message) {
  if (!is_dev(message.from.id)) return;
  if (message.chat.type !== "private") return;
  await ensureUserSaved(message);

  const startTime = Date.now();
  const sentMsg = await bot.sendMessage(message.chat.id, "Ping?");
  const endTime = Date.now();

  const uptime = timeFormatter(process.uptime());
  const latency = endTime - startTime;

  await bot.editMessageText(
    `𝚙𝚒𝚗𝚐: \`${latency}𝚖𝚜\`\n𝚞𝚙𝚝𝚒𝚖𝚎: \`${uptime}\``,
    { chat_id: sentMsg.chat.id, message_id: sentMsg.message_id, parse_mode: "HTML" }
  );
}

// ─── /dbstats ──────────────────────────────────────────────────────────────────

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

    await bot.sendMessage(message.chat.id, text, { parse_mode: "HTML" });
  } catch (err) {
    console.error("[DBSTATS] Erro:", err.message);
    await bot.sendMessage(message.chat.id, `❌ Erro ao consultar banco: ${err.message}`);
  }
}

// ─── /syncdb ──────────────────────────────────────────────────────────────────

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
    const totalUsers = await UserModel.countDocuments();
    const totalGroups = await ChatModel.countDocuments();
    
    await bot.editMessageText(
      `✅ <b>Sincronização Concluída</b>\n\n` +
      `👥 <b>Usuários salvos:</b> <code>${totalUsers}</code>\n` +
      `🏘 <b>Grupos salvos:</b> <code>${totalGroups}</code>\n\n` +
      `<i>ℹ️ Novos usuários são salvos ao enviar mensagens em PV.\nNovos grupos são salvos quando o bot recebe mensagens.</i>`,
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

// ─── /bc (simple version - just sends immediately without queue) ─────────────

async function bc(msg) {
  if (!is_dev(msg.from.id)) return;
  if (msg.chat.type !== "private") return;
  await ensureUserSaved(msg);

  const query = msg.text.replace(/^\/bc(?:@\w+)?\s*/, "").trim();
  if (!query) {
    return bot.sendMessage(msg.chat.id, "<i>Uso: /bc &lt;texto&gt;</i>", { parse_mode: "HTML" });
  }

  const text = query.startsWith("-d") ? query.substring(2).trim() : query;
  if (!text) {
    return bot.sendMessage(msg.chat.id, "<i>Uso: /bc [-d] &lt;texto&gt;</i>", { parse_mode: "HTML" });
  }

  const sentMsg = await bot.sendMessage(msg.chat.id, "<i>⏳ Enviando broadcast...</i>", { parse_mode: "HTML" });
  const ulist = await UserModel.find().lean().select("user_id");
  console.log(`[BC] Iniciando broadcast para ${ulist.length} usuários`);

  let success = 0, blocked = 0, failed = 0;
  const total = ulist.length;

  for (let i = 0; i < ulist.length; i++) {
    const { user_id } = ulist[i];
    try {
      await bot.sendMessage(user_id, text, { allow_paid_broadcast: false, disable_web_page_preview: !text.startsWith("-d") });
      success++;
    } catch (err) {
      if (err.response?.body?.error_code === 403 || err.message?.includes("chat not found")) {
        blocked++;
        await UserModel.deleteOne({ user_id }).catch(() => {});
      } else {
        failed++;
      }
    }
    await new Promise(resolve => setTimeout(resolve, 500));

    if ((i + 1) % 50 === 0) {
      const pct = Math.round(((i + 1) / total) * 100);
      console.log(`[BC] Progresso: ${pct}% | OK: ${success} | Block: ${blocked} | Fail: ${failed}`);
      await bot.editMessageText(
        `╭─❑ 「 <b>Broadcast em Progresso</b> 」 ❑\n` +
        `│ 📤 Progresso: <code>${pct}%</code>\n` +
        `│ ✅ Enviados: <code>${success}</code>\n` +
        `│ 🚫 Bloqueados: <code>${blocked}</code>\n` +
        `│ ❌ Falhas: <code>${failed}</code>\n` +
        `╰❑`,
        { chat_id: sentMsg.chat.id, message_id: sentMsg.message_id, parse_mode: "HTML" }
      ).catch(() => {});
    }
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

// ─── sendgp ───────────────────────────────────────────────────────────────────

async function sendgp(msg) {
  if (!is_dev(msg.from.id)) return;
  if (msg.chat.type !== "private") return;
  await ensureUserSaved(msg);

  const query = msg.text.replace(/^\/sendgp(?:@\w+)?\s*/, "").trim();
  if (!query) {
    return bot.sendMessage(msg.chat.id, "<i>Uso: /sendgp [-d] &lt;texto&gt;</i>", { parse_mode: "HTML" });
  }

  const text = query.startsWith("-d") ? query.substring(2).trim() : query;
  if (!text) {
    return bot.sendMessage(msg.chat.id, "<i>Uso: /sendgp [-d] &lt;texto&gt;</i>", { parse_mode: "HTML" });
  }

  const sentMsg = await bot.sendMessage(msg.chat.id, "<i>⏳ Enviando para grupos...</i>", { parse_mode: "HTML" });
  const chats = await ChatModel.find({ is_ban: false }).lean().select("chatId chatName");
  console.log(`[SENDGP] Iniciando envio para ${chats.length} grupos`);

  let success = 0, failed = 0;
  const total = chats.length;

  for (let i = 0; i < chats.length; i++) {
    const { chatId, chatName } = chats[i];
    try {
      await bot.sendMessage(chatId, text, { disable_web_page_preview: !text.startsWith("-d") });
      success++;
    } catch (err) {
      failed++;
      await ChatModel.deleteOne({ chatId }).catch(() => {});
    }
    await new Promise(resolve => setTimeout(resolve, 1000));

    if ((i + 1) % 20 === 0) {
      const pct = Math.round(((i + 1) / total) * 100);
      console.log(`[SENDGP] Progresso: ${pct}% | OK: ${success} | Fail: ${failed}`);
      await bot.editMessageText(
        `╭─❑ 「 <b>Envio em Grupos em Progresso</b> 」 ❑\n` +
        `│ 📤 Progresso: <code>${pct}%</code>\n` +
        `│ ✅ Enviados: <code>${success}</code>\n` +
        `│ ❌ Falhas: <code>${failed}</code>\n` +
        `╰❑`,
        { chat_id: sentMsg.chat.id, message_id: sentMsg.message_id, parse_mode: "HTML" }
      ).catch(() => {});
    }
  }

  console.log(`[SENDGP] Concluído: ${success}/${total} enviados | ${failed} falhas`);
  await bot.editMessageText(
    `╭─❑ 「 <b>Envio em Grupos Concluído</b> 」 ❑\n` +
    `│ 📤 Total: <code>${total}</code>\n` +
    `│ ✅ Enviados: <code>${success}</code>\n` +
    `│ ❌ Falhas: <code>${failed}</code>\n` +
    `╰❑`,
    { chat_id: sentMsg.chat.id, message_id: sentMsg.message_id, parse_mode: "HTML" }
  );
}

// ─── Callback Query Handler ────────────────────────────────────────────────────

async function onCallbackQuery(callbackQuery) {
  const data = callbackQuery.data;
  const userId = callbackQuery.from.id;

  if (data.startsWith("group_lang:")) {
    const langCode = data.split(":")[1];
    const chatId = callbackQuery.message.chat.id;
    
    await ChatModel.updateOne({ chatId }, { $set: { lang_code: normalizeLangCode(langCode) } });
    await bot.answerCallbackQuery(callbackQuery.id, {
      text: `Idioma definido para: ${langLabel(langCode)}`,
    });
    await bot.sendMessage(chatId, `Idioma das respostas definido para: <b>${langLabel(langCode)}</b>`, { parse_mode: "HTML" });
    return;
  }

  if (data.startsWith("stats:") || data.startsWith("grupos:") || data.startsWith("banned:")) {
    const parts = data.split(":");
    const type = parts[0];
    const pageNum = parseInt(parts[1]);

    const state = paginationState.get(`${type}:${userId}`);
    if (!state) {
      await bot.answerCallbackQuery(callbackQuery.id, { text: "Página expirada. Tente novamente." });
      return;
    }

    if (pageNum >= 0 && pageNum < state.pages.length) {
      state.currentPage = pageNum;
      await bot.editMessageText(state.pages[pageNum], {
        chat_id: callbackQuery.message.chat.id,
        message_id: state.msgId,
        parse_mode: "HTML",
        reply_markup: buildNavMarkup(type, pageNum, state.pages.length),
      });
    }
    await bot.answerCallbackQuery(callbackQuery.id);
    return;
  }

  await bot.answerCallbackQuery(callbackQuery.id, { text: "Comando não implementado" });
}

// ─── initHandler ──────────────────────────────────────────────────────────────

function initHandler() {
  bot.onText(/^\/start(?:\s+(\S+))?$/, start);
  bot.onText(/^\/stats$/, stats);
  bot.onText(/^\/groups?$/, groups);
  bot.onText(/^\/banned$/, banned);
  bot.onText(/^\/ban\s+(\S+)/, ban);
  bot.onText(/^\/unban\s+(\S+)/, unban);
  bot.onText(/^\/delmsg$/, removeMessage);
  bot.onText(/^\/lang(?:\s+(\S+))?$/, setGroupLang);
  bot.onText(/^\/devs$/, devs);
  bot.onText(/^\/ping$/, ping);
  bot.onText(/^\/dbstats$/, dbstats);
  bot.onText(/^\/syncdb$/, syncdb);
  bot.onText(/^\/bc\s+(.*)$/, bc);
  bot.onText(/^\/broadcast\s+(.*)$/, bc);
  bot.onText(/^\/sendgp\s+(.*)$/, sendgp);

  bot.on("message", main);
  bot.on("new_chat_members", saveNewChatMembers);
  bot.on("left_chat_member", removeLeftChatMember);
  bot.on("callback_query", onCallbackQuery);

  console.log("[INIT] Handler initialized successfully!");
}

exports.initHandler = initHandler;
exports.main = main;
