const { MessageModel } = require("../database");
const { ChatModel } = require("../database");
const { UserModel } = require("../database");
const { bot } = require("../bot");
const { setTimeout } = require("timers/promises");

require("./errors.js");
const groupId = process.env.groupId;
function is_dev(user_id) {
    const devUsers = process.env.DEV_USERS.split(",");
    return devUsers.includes(user_id.toString());
}

const forbiddenWords = [
    "Puta",
    "Krl",
    "Pica",
    "Vtnc",
    "Xota",
    "Pnc",
    "Caralho",
    "Porra",
    "Status",
];

async function createMessageAndAddReply(message) {
    const repliedMessage =
        message.reply_to_message.sticker?.file_unique_id ??
        message.reply_to_message.text;
    const replyMessage = message.sticker?.file_id ?? message.text;

    const regex = /^[\/.!]/;
    if (regex.test(repliedMessage) || regex.test(replyMessage)) {
        console.log("Mensagem não salva começa com /");
        return;
    }

    if (
        forbiddenWords.some(
            (word) =>
                repliedMessage.includes(word) || replyMessage.includes(word)
        )
    ) {
        console.log("Mensagem proibida, não será salva");
        return;
    }

    const Message = new MessageModel({
        message: repliedMessage,
        reply: replyMessage,
    });

    await Message.save();
}

async function addReply(message) {
    const repliedMessage =
        message.reply_to_message.sticker?.file_unique_id ??
        message.reply_to_message.text;

    const regex = /^[\/.!]/;
    if (regex.test(repliedMessage)) {
        console.log("Mensagem não salva começa com /, . ou !");
        return;
    }

    const exists = await MessageModel.exists({ message: repliedMessage });

    if (exists)
        return await MessageModel.findOneAndUpdate(
            { message: repliedMessage },
            {
                $push: {
                    reply: message.sticker?.file_id ?? message.text,
                },
            }
        );

    createMessageAndAddReply(message);
}

const audioList = [
    {
        keyword: "Em pleno 2022",
        audioUrl:
            "https://www.myinstants.com/media/sounds/toguro-motivacional.mp3",
    },
    {
        keyword: "Laele",
        audioUrl: "https://www.myinstants.com/media/sounds/giria-ba-laele.mp3",
    },
    {
        keyword: "Bom dia, galera",
        audioUrl:
            "https://www.myinstants.com/media/sounds/ptt-20150301-wa0022.mp3",
    },
    {
        keyword: "Visão",
        audioUrl:
            "https://www.myinstants.com/media/sounds/o-sistema-e-foda.mp3",
    },
    {
        keyword: "Ele gosta",
        audioUrl: "https://www.myinstants.com/media/sounds/tmpd9mca4be.mp3",
    },
    {
        keyword: "Foda-se",
        audioUrl:
            "https://www.myinstants.com/media/sounds/cavalo-rodrigo-faro.mp3",
    },
    {
        keyword: "Brabo",
        audioUrl: "https://www.myinstants.com/media/sounds/tmpd9mca4be.mp3",
    },
    {
        keyword: "Boa noite, galera",
        audioUrl: "https://www.myinstants.com/media/sounds/tmpycvw5co0.mp3",
    },
    {
        keyword: "Boa tarde, galera",
        audioUrl:
            "https://www.myinstants.com/media/sounds/free-converter_B4jyuF8.mp3",
    },
    {
        keyword: "SIGMA 🗿 🍷",
        audioUrl: "https://www.myinstants.com/media/sounds/sigmamusic.mp3",
    },
    {
        keyword: "Errei",
        audioUrl: "https://www.myinstants.com/media/sounds/errou-rude.mp3",
    },
    {
        keyword: "Vamos pv",
        audioUrl:
            "https://www.myinstants.com/media/sounds/o-rei-do-gado-classificacao-abertura-e-encerramento-2015.mp3",
    },
    {
        keyword: "Chama pv",
        audioUrl: "https://www.myinstants.com/media/sounds/tmp7palvm7o.mp3",
    },
    {
        keyword: "PV",
        audioUrl:
            "https://www.myinstants.com/media/sounds/gado-demais-spider.mp3",
    },
    {
        keyword: "Não ligo",
        audioUrl: "https://www.myinstants.com/media/sounds/corte-rapido.mp3",
    },
    {
        keyword: "Sou o melhor",
        audioUrl:
            "https://www.myinstants.com/media/sounds/cr7-eu-sou-o-melhor.mp3",
    },
    {
        keyword: "Treta",
        audioUrl: "https://www.myinstants.com/media/sounds/tthbp.mp3",
    },
    {
        keyword: "Se fodeu",
        audioUrl:
            "https://www.myinstants.com/media/sounds/gta-v-death-sound-effect-102.mp3",
    },
    {
        keyword: "Deu bom",
        audioUrl:
            "https://www.myinstants.com/media/sounds/gta-san-andreas-mission-complete-sound-hq.mp3",
    },
];

async function answerUser(message) {
    const receivedMessage = message.sticker?.file_unique_id ?? message.text;
    const chatId = message.chat.id;

    const regex = /^[\/.!]/;
    if (regex.test(receivedMessage)) {
        return;
    }

    const sendMessageOptions = { reply_to_message_id: message.message_id };

    const audioMatch = audioList.find((audio) =>
        receivedMessage.includes(audio.keyword)
    );

    if (audioMatch) {
        await bot.sendChatAction(chatId, "record_audio");
        await bot.sendVoice(chatId, audioMatch.audioUrl, sendMessageOptions);
    } else {
        let exists = await MessageModel.exists({ message: receivedMessage });

        if (exists) {
            const { reply } = await MessageModel.findOne({
                message: receivedMessage,
            });
            const replyToSend = reply[Math.floor(Math.random() * reply.length)];

            if (!replyToSend) return;

            const typingTime = 50 * replyToSend?.length || 6000;

            await bot.sendChatAction(chatId, "typing");
            setTimeout(typingTime).then(async () => {
                await bot
                    .sendSticker(chatId, replyToSend, sendMessageOptions)
                    .catch((error) =>
                        bot.sendMessage(chatId, replyToSend, sendMessageOptions)
                    );
            });
        }
    }
}

async function saveUserInformation(message) {
    const chatId = message.chat.id;
    const user = message.from;

    if (message.chat.type !== "private") {
        return;
    }

    const exists = await UserModel.exists({ user_id: user.id });

    if (!exists) {
        const newUser = new UserModel({
            user_id: user.id,
            username: user.username,
            firstname: user.first_name,
            lastname: user.last_name,
        });

        await newUser.save();

        const notificationMessage = `#Togurosbot #New_User
      <b>User:</b> <a href="tg://user?id=${user.id}">${user.first_name}</a>
      <b>ID:</b> <code>${user.id}</code>
      <b>Username:</b> ${
          user.username ? `@${user.username}` : "Não informado"
      }`;

        bot.sendMessage(groupId, notificationMessage, { parse_mode: "HTML" });
    }
}

async function main(message) {
    const replyToMessage = message?.reply_to_message ?? false;
    const { id: botId } = await bot.getMe();

    if (message.chat.type === "private") {
        await saveUserInformation(message);
    }

    if (message.sticker || message.text) {
        if (replyToMessage && replyToMessage.from.id != botId)
            addReply(message);
        if (!replyToMessage || replyToMessage.from.id == botId)
            answerUser(message);
    }
}

async function removeMessage(message) {
    const user_id = message.from.id;
    if (!is_dev(user_id)) {
        console.log("Usuário não autorizado a usar esse comando");
        return;
    }

    const repliedMessage =
        message.reply_to_message &&
        (message.reply_to_message.sticker?.file_unique_id ??
            message.reply_to_message.text);

    const exists = await MessageModel.exists({ message: repliedMessage });
    if (!exists) {
        console.log("Mensagem não encontrada no banco de dados");
        return;
    }

    await MessageModel.deleteMany({
        $or: [
            { message: repliedMessage },
            { reply: { $elemMatch: { $eq: repliedMessage } } },
        ],
    });

    console.log("Mensagem removida com sucesso");
    const chatId = message.chat.id;
    const user = message.from;
    bot.sendMessage(
        chatId,
        `Mensagem deletada com sucesso do banco de dados pelo usuário: <b><a href="tg://user?id=${user.id}">${user.first_name}</a></b>. Lembrando que todas as respostas que estavam adicionadas a essa mensagem foram apagadas.`,
        { parse_mode: "HTML" }
    );
}

async function start(message) {
    const userId = message.from.id;
    if (message.chat.type !== "private") {
        return;
    }
    const firstName = message.from.first_name;
    const message_start_dev = `Olá, <b>${firstName}</b>! Você é um dos desenvolvedores 🧑‍💻\n\nVocê está no painel do desenvolvedor do Toguro, então aproveite a responsabilidade e use os comandos com consciências`;
    const message_start = `Olá, <b>${firstName}</b>!\n\nEu sou <b>Toguro</b>, um bot que não gosta de ser chamado de bot kkkkk e que envia mensagens, áudios e figurinhas. Aproveite as funções que eu tenho.\n\n👾 <b>Canal de figurinhas:</b> <a href="https://t.me/lbrabo">Clique aqui</a>\n\n<b>BTC:</b> <code>bc1qjxzlug0cwnfjrhacy9kkpdzxfj0mcxc079axtl</code>\n<b>ETH/USDT:</b> <code>0x1fbde0d2a96869299049f4f6f78fbd789d167d1b</code>`;
    const options_start = {
        parse_mode: "HTML",
        disable_web_page_preview: true,
        reply_markup: {
            inline_keyboard: [
                [
                    {
                        text: "✨ Adicione-me em seu grupo",
                        url: "https://t.me/togurosbot?startgroup=true",
                    },
                ],
                [
                    {
                        text: "📬 Canal Oficial",
                        url: "https://t.me/togurovisao",
                    },
                    {
                        text: "👨‍💻 Suporte",
                        url: "https://t.me/kylorensbot",
                    },
                ],
                [
                    {
                        text: "📦 Github",
                        url: "https://github.com/leviobrabo/togurosbot",
                    },
                ],
            ],
        },
    };
    const options_start_dev = {
        parse_mode: "HTML",
        disable_web_page_preview: true,
        reply_markup: {
            inline_keyboard: [
                [
                    {
                        text: "📦 Github",
                        url: "https://github.com/leviobrabo/togurosbot",
                    },
                ],
                [
                    {
                        text: "📬 Canal Oficial",
                        url: "https://t.me/togurovisao",
                    },
                    {
                        text: "👨‍💻 Suporte",
                        url: "https://t.me/kylorensbot",
                    },
                ],
                [
                    {
                        text: "🗃 Lista de para desenvolvedores",
                        callback_data: "commands",
                    },
                ],
            ],
        },
    };
    bot.on("callback_query", async (callbackQuery) => {
        if (callbackQuery.message.chat.type !== "private") {
            return;
        }
        const chatId = callbackQuery.message.chat.id;
        const messageId = callbackQuery.message.message_id;

        if (callbackQuery.data === "commands") {
            const commands = [
                "/stats - Estatística de grupos, usuarios e mensagens enviadas",
                "/ban - retirar o bot do chat",
                "/unban - permite o bot do chat",
                "/banned - lista de grupos conectados",
                "/groups - permite o bot do chat",
                "/broadcast ou /bc - envia mensagem para todos usuários",
                "/ping - veja a latência da VPS",
            ];
            await bot.editMessageText(
                "<b>Lista de Comandos:</b> \n\n" + commands.join("\n"),
                {
                    parse_mode: "HTML",
                    disable_web_page_preview: true,
                    chat_id: chatId,
                    message_id: messageId,
                    reply_markup: {
                        inline_keyboard: [
                            [
                                {
                                    text: "⬅️ Voltar",
                                    callback_data: "back_to_start",
                                },
                            ],
                        ],
                    },
                }
            );
        } else if (callbackQuery.data === "back_to_start") {
            await bot.editMessageText(message_start_dev, {
                parse_mode: "HTML",
                chat_id: chatId,
                message_id: messageId,
                disable_web_page_preview: true,
                reply_markup: options_start_dev.reply_markup,
            });
        }
    });
    if (is_dev(userId)) {
        bot.sendMessage(userId, message_start_dev, options_start_dev);
    } else {
        bot.sendMessage(message.chat.id, message_start, options_start);
    }
}

async function stats(message) {
    const user_id = message.from.id;
    if (!(await is_dev(user_id))) {
        if (message.message_id) {
            bot.sendMessage(message.chat.id, `Você não é *desenvolvedor*. 👨‍💻`, {
                reply_to_message_id: message.message_id,
                parse_mode: "Markdown",
            });
        } else {
            bot.sendMessage(message.chat.id, `Você não é *desenvolvedor*. 👨‍💻`, {
                parse_mode: "Markdown",
            });
            return;
        }
    }
    const chatId = message.chat.id;
    const numUsers = await UserModel.countDocuments();
    const numChats = await ChatModel.countDocuments();
    const numMessages = await MessageModel.countDocuments();
    const messageText = `\n──❑ 「 Bot Stats 」 ❑──\n\n ☆ ${numUsers} usuários\n ☆ ${numChats} grupos\n ☆ ${numMessages} mensagens aprendidas`;

    if (await is_dev(user_id)) {
        bot.sendMessage(chatId, messageText);
    }
}

async function groups(message) {
    const user_id = message.from.id;
    if (!(await is_dev(user_id))) {
        return;
    }
    if (message.chat.type !== "private") {
        return;
    }

    try {
        const chats = await ChatModel.find().sort({ chatId: 1 });

        let contador = 1;
        let chunkSize = 3900 - message.text.length;
        let messageChunks = [];
        let currentChunk = "";

        for (let chat of chats) {
            if (chat.chatId < 0) {
                let groupMessage = `<b>${contador}:</b> <b>Group=</b> ${chat.chatName} || <b>ID:</b> <code>${chat.chatId}</code>\n`;
                if (currentChunk.length + groupMessage.length > chunkSize) {
                    messageChunks.push(currentChunk);
                    currentChunk = "";
                }
                currentChunk += groupMessage;
                contador++;
            }
        }
        messageChunks.push(currentChunk);

        let index = 0;

        const markup = (index) => {
            return {
                reply_markup: {
                    inline_keyboard: [
                        [
                            {
                                text: `<< ${index + 1}`,
                                callback_data: `groups:${index - 1}`,
                                disabled: index === 0,
                            },
                            {
                                text: `>> ${index + 2}`,
                                callback_data: `groups:${index + 1}`,
                                disabled: index === messageChunks.length - 1,
                            },
                        ],
                    ],
                },
                parse_mode: "HTML",
            };
        };

        await bot.sendMessage(
            message.chat.id,
            messageChunks[index],
            markup(index)
        );

        bot.on("callback_query", async (query) => {
            if (query.data.startsWith("groups:")) {
                index = Number(query.data.split(":")[1]);
                if (
                    markup(index).reply_markup &&
                    markup(index).reply_markup.inline_keyboard
                ) {
                    markup(index).reply_markup.inline_keyboard[0][0].disabled =
                        index === 0;
                    markup(index).reply_markup.inline_keyboard[0][1].disabled =
                        index === messageChunks.length - 1;
                }
                await bot.editMessageText(messageChunks[index], {
                    chat_id: query.message.chat.id,
                    message_id: query.message.message_id,
                    ...markup(index),
                });
                await bot.answerCallbackQuery(query.id);
            }
        });
    } catch (error) {
        console.error(error);
    }
}

async function saveNewChatMembers(msg) {
    const chatId = msg.chat.id;
    const chatName = msg.chat.title;

    try {
        const chat = await ChatModel.findOne({ chatId: chatId });

        if (chat) {
            console.log(
                `Grupo ${chatName} (${chatId}) já existe no banco de dados`
            );
        } else {
            const newChat = await ChatModel.create({ chatId, chatName });
            console.log(
                `Grupo ${newChat.chatName} (${newChat.chatId}) adicionado ao banco de dados`
            );

            const botUser = await bot.getMe();
            const newMembers = msg.new_chat_members.filter(
                (member) => member.id === botUser.id
            );

            if (newMembers.length > 0) {
                const message = `#Togurosbot #New_Group
    <b>Group:</b> ${chatName}
    <b>ID:</b> <code>${chatId}</code>`;
                bot.sendMessage(groupId, message, { parse_mode: "HTML" }).catch(
                    (error) => {
                        console.error(
                            `Erro ao enviar mensagem para o grupo ${groupId}: ${error}`
                        );
                    }
                );
            }

            bot.sendMessage(
                chatId,
                "Olá, me chamo o Toguro! Obrigado por me adicionado em seu grupo. Eu responderei a mensagem da galera no grupo kkkkk.",
                {
                    reply_markup: {
                        inline_keyboard: [
                            [
                                {
                                    text: "Visite nosso canal",
                                    url: "https://t.me/togurovisao",
                                },
                                {
                                    text: "Relate bugs",
                                    url: "https://t.me/kylorensbot",
                                },
                            ],
                        ],
                    },
                }
            );
        }
        const developerMembers = msg.new_chat_members.filter(
            (member) => member.is_bot === false && is_dev(member.id)
        );

        if (developerMembers.length > 0) {
            const message = `👨‍💻 <b>ᴜᴍ ᴅᴏs ᴍᴇᴜs ᴅᴇsᴇɴᴠᴏʟᴠᴇᴅᴏʀᴇs ᴇɴᴛʀᴏᴜ ɴᴏ ɢʀᴜᴘᴏ</b> <a href="tg://user?id=${developerMembers[0].id}">${developerMembers[0].first_name}</a> 😎👍`;
            bot.sendMessage(chatId, message, { parse_mode: "HTML" }).catch(
                (error) => {
                    console.error(
                        `Erro ao enviar mensagem para o grupo ${chatId}: ${error}`
                    );
                }
            );
        }
    } catch (error) {
        console.error(error);
    }
}

async function removeLeftChatMember(msg) {
    const botUser = await bot.getMe();
    if (msg.left_chat_member.id !== botUser.id) {
        return;
    }

    const chatId = msg.chat.id;

    try {
        const chat = await ChatModel.findOne({ chatId });
        if (!chat) {
            console.log(
                `Chat com id ${chatId} não foi encontrado no banco de dados`
            );
            return;
        }
        if (chat.is_ban) {
            console.log(
                `Grupo ${chat.chatName} (${chat.chatId}) não removido do banco de dados, pois está banido`
            );
            return;
        }
        await ChatModel.findOneAndDelete({ chatId });
        console.log(
            `Grupo ${chat.chatName} (${chat.chatId}) removido do banco de dados`
        );
    } catch (err) {
        console.error(err);
    }
}

function pollingError(error) {
    console.log(error);
}

async function ban(message) {
    const userId = message.from.id;
    const chatId = message.text.split(" ")[1];

    if (message.chat.type !== "private") {
        await bot.sendMessage(
            message.chat.id,
            "Por favor, envie este comando em um chat privado com o bot."
        );
        return;
    }

    if (!is_dev(userId)) {
        await bot.sendMessage(
            message.chat.id,
            "Você não está autorizado a executar este comando."
        );
        return;
    }

    const chat = await ChatModel.findOne({ chatId: chatId });

    if (!chat) {
        await bot.sendMessage(message.chat.id);
        return;
    }

    await ChatModel.updateOne({ chatId: chatId }, { $set: { is_ban: true } });
    await bot.sendMessage(message.chat.id, `Chat ${chatId} foi banido.`);
    await bot.leaveChat(chatId);
}

async function unban(message) {
    const userId = message.from.id;
    const chatId = message.text.split(" ")[1];

    if (message.chat.type !== "private") {
        await bot.sendMessage(
            message.chat.id,
            "Por favor, envie este comando em um chat privado com o bot."
        );
        return;
    }

    if (!is_dev(userId)) {
        await bot.sendMessage(
            message.chat.id,
            "Você não está autorizado a executar este comando."
        );
        return;
    }

    const chat = await ChatModel.findOne({ chatId: chatId });

    if (!chat) {
        await bot.sendMessage(message.chat.id);
        return;
    }

    await ChatModel.updateOne({ chatId: chatId }, { $set: { is_ban: false } });
    await bot.sendMessage(message.chat.id, `Chat ${chatId} foi desbanido.`);
}

async function banned(message) {
    const userId = message.from.id;

    if (message.chat.type !== "private") {
        await bot.sendMessage(
            message.chat.id,
            "Por favor, envie este comando em um chat privado com o bot."
        );
        return;
    }

    if (!is_dev(userId)) {
        await bot.sendMessage(
            message.chat.id,
            "Você não está autorizado a executar este comando."
        );
        return;
    }

    const bannedChats = await ChatModel.find({ is_ban: true });

    if (bannedChats.length === 0) {
        await bot.sendMessage(
            message.chat.id,
            "Nenhum chat encontrado no banco de dados que tenha sido banido."
        );
        return;
    }

    let messageText = "<b>Chats banidos:</b>\n";

    for (const chat of bannedChats) {
        messageText += `<b>Group:</b> <a href="tg://resolve?domain=${chat.chatName}&amp;id=${chat.chatId}">${chat.chatName}</a>\n`;
        messageText += `<b>ID:</b> <code>${chat.chatId}</code>\n\n`;
    }

    await bot.sendMessage(message.chat.id, messageText, { parse_mode: "HTML" });
}

exports.initHandler = () => {
    bot.on("message", main);
    bot.on("polling_error", pollingError);
    bot.on("message", saveUserInformation);
    bot.onText(/^\/start$/, start);
    bot.onText(/^\/stats$/, stats);
    bot.onText(/^\/grupos$/, groups);
    bot.on("new_chat_members", saveNewChatMembers);
    bot.on("left_chat_member", removeLeftChatMember);
    bot.onText(/^\/ban/, ban);
    bot.onText(/^\/unban/, unban);
    bot.onText(/^\/banned/, banned);
    bot.onText(/^\/delmsg/, removeMessage);
};

function timeFormatter(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    const hoursFormatted = String(hours).padStart(2, "0");
    const minutesFormatted = String(minutes).padStart(2, "0");
    const secondsFormatted = String(secs).padStart(2, "0");

    return `${hoursFormatted}:${minutesFormatted}:${secondsFormatted}`;
}

bot.onText(/\/ping/, async (msg) => {
    const start = new Date();
    const replied = await bot.sendMessage(msg.chat.id, "𝚙𝚘𝚗𝚐!");
    const end = new Date();
    const m_s = end - start;
    const uptime = process.uptime();
    const uptime_formatted = timeFormatter(uptime);
    await bot.editMessageText(
        `𝚙𝚒𝚗𝚐: \`${m_s}𝚖𝚜\`\n𝚞𝚙𝚝𝚒𝚖𝚎: \`${uptime_formatted}\``,
        {
            chat_id: replied.chat.id,
            message_id: replied.message_id,
            parse_mode: "Markdown",
        }
    );
});

bot.onText(/^(\/broadcast|\/bc)\b/, async (msg, match) => {
    const user_id = msg.from.id;
    if (!(await is_dev(user_id))) {
        return;
    }

    const query = match.input.substring(match[0].length).trim();
    if (!query) {
        return bot.sendMessage(
            msg.chat.id,
            "<i>I need text to broadcast.</i>",
            { parse_mode: "HTML" }
        );
    }
    const sentMsg = await bot.sendMessage(msg.chat.id, "<i>Processing...</i>", {
        parse_mode: "HTML",
    });
    const web_preview = query.startsWith("-d");
    const query_ = web_preview ? query.substring(2).trim() : query;
    const ulist = await UserModel.find().lean().select("user_id");
    let sucess_br = 0;
    let no_sucess = 0;
    let block_num = 0;
    for (const { user_id } of ulist) {
        try {
            await bot.sendMessage(user_id, query_, {
                disable_web_page_preview: !web_preview,
                parse_mode: "HTML",
            });
            sucess_br += 1;
        } catch (err) {
            if (
                err.response &&
                err.response.body &&
                err.response.body.error_code === 403
            ) {
                block_num += 1;
            } else {
                no_sucess += 1;
            }
        }
    }
    await bot.editMessageText(
        `
  ╭─❑ 「 <b>Broadcast Completed</b> 」 ❑──
  │- <i>Total Users:</i> \`${ulist.length}\`
  │- <i>Successful:</i> \`${sucess_br}\`
  │- <i>Blocked:</i> \`${block_num}\`
  │- <i>Failed:</i> \`${no_sucess}\`
  ╰❑
    `,
        {
            chat_id: sentMsg.chat.id,
            message_id: sentMsg.message_id,
            parse_mode: "HTML",
        }
    );
});
