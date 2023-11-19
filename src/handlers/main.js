const { MessageModel } = require("../database");
const { ChatModel } = require("../database");
const { UserModel } = require("../database");
const { bot } = require("../bot");
const CronJob = require("cron").CronJob;
const { setTimeout } = require("timers/promises");
const palavrasProibidas = require("./palavrasproibida.json");


require("./errors.js");
const groupId = process.env.groupId;

function is_dev(user_id) {
    const devUsers = process.env.DEV_USERS.split(",");
    return devUsers.includes(user_id.toString());
}


const forbiddenWords = palavrasProibidas.palavras_proibidas;

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
        // console.log("Mensagem proibida, não será salva");
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
        "keyword": "Em pleno 2022",
        "audioUrl": "https://www.myinstants.com/media/sounds/toguro-motivacional.mp3"
    },
    {
        "keyword": "Laele",
        "audioUrl": "https://www.myinstants.com/media/sounds/giria-ba-laele.mp3"
    },
    {
        "keyword": "Bom dia, galera",
        "audioUrl": "https://www.myinstants.com/media/sounds/ptt-20150301-wa0022.mp3"
    },
    {
        "keyword": "Visão",
        "audioUrl": "https://www.myinstants.com/media/sounds/o-sistema-e-foda.mp3"
    },
    {
        "keyword": "Ele gosta",
        "audioUrl": "https://www.myinstants.com/media/sounds/tmpd9mca4be.mp3"
    },
    {
        "keyword": "Foda-se",
        "audioUrl": "https://www.myinstants.com/media/sounds/cavalo-rodrigo-faro.mp3"
    },
    {
        "keyword": "Brabo",
        "audioUrl": "https://www.myinstants.com/media/sounds/tmpd9mca4be.mp3"
    },
    {
        "keyword": "Boa noite, galera",
        "audioUrl": "https://www.myinstants.com/media/sounds/tmpycvw5co0.mp3"
    },
    {
        "keyword": "Boa tarde, galera",
        "audioUrl": "https://www.myinstants.com/media/sounds/free-converter_B4jyuF8.mp3"
    },
    {
        "keyword": "SIGMA 🗿 🍷",
        "audioUrl": "https://www.myinstants.com/media/sounds/sigmamusic.mp3"
    },
    {
        "keyword": "Errei",
        "audioUrl": "https://www.myinstants.com/media/sounds/errou-rude.mp3"
    },
    {
        "keyword": "Vamos pv",
        "audioUrl": "https://www.myinstants.com/media/sounds/o-rei-do-gado-classificacao-abertura-e-encerramento-2015.mp3"
    },
    {
        "keyword": "Chama pv",
        "audioUrl": "https://www.myinstants.com/media/sounds/tmp7palvm7o.mp3"
    },
    {
        "keyword": "PV",
        "audioUrl": "https://www.myinstants.com/media/sounds/gado-demais-spider.mp3"
    },
    {
        "keyword": "Não ligo",
        "audioUrl": "https://www.myinstants.com/media/sounds/corte-rapido.mp3"
    },
    {
        "keyword": "Sou o melhor",
        "audioUrl": "https://www.myinstants.com/media/sounds/cr7-eu-sou-o-melhor.mp3"
    },
    {
        "keyword": "Treta",
        "audioUrl": "https://www.myinstants.com/media/sounds/tthbp.mp3"
    },
    {
        "keyword": "Se fodeu",
        "audioUrl": "https://www.myinstants.com/media/sounds/gta-v-death-sound-effect-102.mp3"
    },
    {
        "keyword": "Deu bom",
        "audioUrl": "https://www.myinstants.com/media/sounds/gta-san-andreas-mission-complete-sound-hq.mp3"
    },
    {
        "keyword": "Pix",
        "audioUrl": "https://www.myinstants.com/media/sounds/e-o-pix-nada-ainda.mp3"
    },
    {
        "keyword": "Ódio",
        "audioUrl": "https://www.myinstants.com/media/sounds/que-isso-moreno.mp3"
    },
    {
        "keyword": "Olha pv",
        "audioUrl": "https://www.myinstants.com/media/sounds/ze-da-manga.mp3"
    },
    {
        "keyword": "Xvideos",
        "audioUrl": "https://www.myinstants.com/media/sounds/e-o-brazino.mp3"
    },
    {
        "keyword": "Boa tarde!",
        "audioUrl": "https://www.myinstants.com/media/sounds/boa-tarde-bando-de-calabresos.mp3"
    },
    {
        "keyword": "Que isso?",
        "audioUrl": "https://www.myinstants.com/media/sounds/abriu-o-audio.mp3"
    },
    {
        "keyword": "Não entendi",
        "audioUrl": "https://www.myinstants.com/media/sounds/como-e-amigo.mp3"
    },
    {
        "keyword": "rsrs",
        "audioUrl": "https://www.myinstants.com/media/sounds/sabe-porque-as-meninas-dao-maior-valor-na-risada-de-ladrao-mp3cut.mp3"
    },
    {
        "keyword": "Fds",
        "audioUrl": "https://www.myinstants.com/media/sounds/wndzp.mp3"
    },
    {
        "keyword": "Vou ganhar",
        "audioUrl": "https://www.myinstants.com/media/sounds/louco-e-sonhador.mp3"
    },
    {
        "keyword": "Toguroo",
        "audioUrl": "https://www.myinstants.com/media/sounds/manda-a-foto.mp3"
    },
    {
        "keyword": "Áudio",
        "audioUrl": "https://www.myinstants.com/media/sounds/para-de-mandar-audio-to-na-ucrania.mp3"
    },
    {
        "keyword": "Errei",
        "audioUrl": "https://www.myinstants.com/media/sounds/neymar-errei-fui-moleque.mp3"
    },
    {
        "keyword": "Sai",
        "audioUrl": "https://www.myinstants.com/media/sounds/calma-cnpjoto.mp3"
    },
    {
        "keyword": "Treta",
        "audioUrl": "https://www.myinstants.com/media/sounds/tao-fugindo-do-foco-do-grupo-online-audio-converter.mp3"
    },
    {
        "keyword": "Faz o L",
        "audioUrl": "https://www.myinstants.com/media/sounds/faz-o-l-vinheta.mp3"
    },
    {
        "keyword": "Zap",
        "audioUrl": "https://www.myinstants.com/media/sounds/olha-a-mensagem-a.mp3"
    },
    {
        "keyword": "Suspeito",
        "audioUrl": "https://www.myinstants.com/media/sounds/among.mp3"
    },
    {
        "keyword": "Te amo",
        "audioUrl": "https://www.myinstants.com/media/sounds/george-micael-wham-careless-whisper-1.mp3"
    },
    {
        "keyword": "Triste kkk",
        "audioUrl": "https://www.myinstants.com/media/sounds/tf_nemesis.mp3"
    }
];

const photoList = [
    {
        "keyword": "serioo",
        "photoUrl": "https://i.imgur.com/ZbpaTP2.jpeg"
    },
    {
        "keyword": "chorei aqui",
        "photoUrl": "https://i.imgur.com/TqViPC5.jpeg"
    },
    {
        "keyword": "nem te conto",
        "photoUrl": "https://i.imgur.com/5Ckk5yw.jpeg"
    },
    {
        "keyword": "nao fala comigo",
        "photoUrl": "https://i.imgur.com/SEdyQ3a.jpeg"
    },
    {
        "keyword": "diculpa",
        "photoUrl": "https://i.imgur.com/QumF8HB.jpeg"
    }
];

async function answerUser(message) {
    const receivedMessage = message.sticker?.file_unique_id ?? message.text;
    const chatId = message.chat.id;
    const chat = await ChatModel.findOne({ chatId });

    try {

        const regex = /^[\/.!]/;
        if (regex.test(receivedMessage)) {
            console.log("Mensagem não enviada, começa com /");
            return;
        }

        const sendMessageOptions = { reply_to_message_id: message.message_id };

        const audioMatch = audioList.find((audio) => receivedMessage === audio.keyword);
        if (audioMatch) {
            try {
                await bot.sendChatAction(chatId, "record_audio");
                const audioPromise = bot.sendVoice(chatId, audioMatch.audioUrl, sendMessageOptions);
                const timeoutPromise = new Promise((_, reject) => {
                    setTimeout(() => {
                        reject(new Error('Timeout: Audio operation took too long.'));
                    }, 6000);
                });

                await Promise.race([audioPromise, timeoutPromise]);
            } catch (error) {
                console.error("Error sending audio:", error);
            }
        } else {
            const photoMatch = photoList.find((photo) => receivedMessage === photo.keyword);
            if (photoMatch) {
                try {
                    await bot.sendChatAction(chatId, "upload_photo");
                    const photoPromise = bot.sendPhoto(chatId, photoMatch.photoUrl, sendMessageOptions);
                    const timeoutPromise = new Promise((_, reject) => {
                        setTimeout(() => {
                            reject(new Error('Timeout: Photo operation took too long.'));
                        }, 6000);
                    });

                    await Promise.race([photoPromise, timeoutPromise]);
                } catch (error) {
                    console.error("Error sending photo:", error);
                }
            } else {
                const exists = await MessageModel.exists({ message: receivedMessage });
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
    }
    catch (error) {
        if (error.message.includes("CHAT_WRITE_FORBIDDEN")) {
            console.error("Erro: CHAT_WRITE_FORBIDDEN. O bot sairá do grupo.");
            await bot.leaveChat(chatId);

            try {
                await ChatModel.deleteOne({ chatId: chatId });
                console.log("Grupo removido do banco de dados.");
            } catch (dbError) {
                console.error("Erro ao remover o grupo do banco de dados:", dbError);
            }
        } else if (error.message.includes("not enough rights to send text messages to the chat")) {
            console.error("Erro: not enough rights to send text messages to the chat.");
            await bot.leaveChat(chatId);

            try {
                await ChatModel.deleteOne({ chatId: chatId });
                console.log("Grupo removido do banco de dados.");
            } catch (dbError) {
                console.error("Erro ao remover o grupo do banco de dados:", dbError);
            }
        } else {
            console.error("Erro ao enviar mensagem:", error);
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
            is_dev: false,
        });

        await newUser.save();

        const notificationMessage = `#Togurosbot #New_User
      <b>User:</b> <a href="tg://user?id=${user.id}">${user.first_name}</a>
      <b>ID:</b> <code>${user.id}</code>
      <b>Username:</b> ${user.username ? `@${user.username}` : "Não informado"
            }`;

        bot.sendMessage(groupId, notificationMessage, { parse_mode: "HTML" });
    } else {
        const updatedUser = {
            username: user.username,
            firstname: user.first_name,
            lastname: user.last_name,
        };
        await UserModel.findOneAndUpdate({ user_id: user.id }, updatedUser);
    }
}

async function main(message) {
    const replyToMessage = message?.reply_to_message ?? false;
    const { id: botId } = await bot.getMe();

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
    if (message.message_id) {
        bot.sendMessage(
            chatId,
            `Mensagem deletada com sucesso do banco de dados pelo(a) dev: <b><a href="tg://user?id=${user.id}">${user.first_name}</a></b>. \n\nObs.: Lembrando que todas as respostas que estavam adicionadas a essa mensagem foram apagadas.`,
            { parse_mode: "HTML", reply_to_message_id: message.message_id }
        );
    } else {
        bot.sendMessage(
            chatId,
            `Mensagem deletada com sucesso do banco de dados pelo usuário: <b><a href="tg://user?id=${user.id}">${user.first_name}</a></b>. \n\nObs.: Lembrando que todas as respostas que estavam adicionadas a essa mensagem foram apagadas.`,
            { parse_mode: "HTML" }
        );
    }
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
                "/grupos - permite o bot do chat",
                "/bc e /broadcast - envia mensagem para todos os usuários",
                "/ping - veja a latência da VPS",
                "/delmsg - Apague uma mensagem do banco de dados do bot",
                "/devs - lista de desenvolvedores do bot ",
                "/sendgp - encaminha msg para grupos",
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
        let chats = await ChatModel.find().sort({ chatId: 1 });

        chats = chats.filter((chat) => !chat.is_ban);

        let contador = 1;
        let chunkSize = 3900 - message.text.length;
        let messageChunks = [];
        let currentChunk = "";

        for (let chat of chats) {
            let groupMessage = `<b>${contador}:</b> <b>Group=</b> ${chat.chatName} || <b>ID:</b> <code>${chat.chatId}</code>\n`;
            if (currentChunk.length + groupMessage.length > chunkSize) {
                messageChunks.push(currentChunk);
                currentChunk = "";
            }
            currentChunk += groupMessage;
            contador++;
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
            if (chat.is_ban) {
                console.log(
                    `Grupo ${chatName} (${chatId}) está banido, saindo do grupo`
                );
                await bot.leaveChat(chatId);
                return;
            }
        } else {
            const newChat = await ChatModel.create({ chatId, chatName });
            console.log(
                `Grupo ${newChat.chatName} (${newChat.chatId}) adicionado ao banco de dados`
            );

            const botUser = await bot.getMe();
            const newMembers = msg.new_chat_members.filter(
                (member) => member.id === botUser.id
            );

            if (msg.chat.username) {
                chatusername = `@${msg.chat.username}`;
            } else {
                chatusername = "Private Group";
            }

            if (newMembers.length > 0) {
                const message = `#Togurosbot #New_Group
                <b>Group:</b> ${chatName}
                <b>ID:</b> <code>${chatId}</code>
                <b>Link:</b> ${chatusername}`;

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
        console.log("Nenhum grupo encontrado com o ID informado.");
        return;
    }

    if (chat.is_ban) {
        await bot.sendMessage(
            message.chat.id,
            `Grupo ${chat.chatName} já foi banido.`
        );
        return;
    }

    let chatUsername;
    if (message.chat.username) {
        chatUsername = `@${message.chat.username}`;
    } else {
        chatUsername = "Private Group";
    }
    const banMessage = `#Togurosbot #Banned
    <b>Group:</b> ${chat.chatName}
    <b>ID:</b> <code>${chatId}</code>
    <b>Dev:</b> ${chatUsername}`;

    bot.sendMessage(groupId, banMessage, { parse_mode: "HTML" }).catch(
        (error) => {
            console.error(
                `Erro ao enviar mensagem para o grupo ${chatId}: ${error}`
            );
        }
    );

    await ChatModel.updateOne({ chatId: chatId }, { $set: { is_ban: true } });
    await bot.sendMessage(chatId, `Toguro sairá do grupo e não pode ficar!!`);
    await bot.leaveChat(chatId);

    await bot.sendMessage(
        message.chat.id,
        `Grupo ${chat.chatName} de ID: ${chatId} foi banido com sucesso.`
    );
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

    if (!(await is_dev(userId))) {
        await bot.sendMessage(
            message.chat.id,
            "Você não está autorizado a executar este comando."
        );
        return;
    }

    const chat = await ChatModel.findOne({ chatId: chatId });

    if (!chat) {
        await bot.sendMessage(
            message.chat.id,
            `Nenhum grupo encontrado com o ID ${chatId}.`
        );
        return;
    }

    if (!chat.is_ban) {
        await bot.sendMessage(
            message.chat.id,
            `O grupo ${chat.chatName} já está desbanido ou nunca foi banido.`
        );
        return;
    }

    let devUsername;
    if (message.chat.username) {
        devUsername = `@${message.chat.username}`;
    } else {
        devUsername = "Private Group";
    }
    const banMessage = `#Togurosbot #Unban
    <b>Group:</b> ${chat.chatName}
    <b>ID:</b> <code>${chatId}</code>
    <b>Dev:</b> ${devUsername}`;

    bot.sendMessage(groupId, banMessage, { parse_mode: "HTML" }).catch(
        (error) => {
            console.error(
                `Erro ao enviar mensagem para o grupo ${chatId}: ${error}`
            );
        }
    );

    await ChatModel.updateOne({ chatId: chatId }, { $set: { is_ban: false } });
    await bot.sendMessage(
        message.chat.id,
        `Grupo ${chat.chatName} foi desbanido.`
    );
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

    if (!(await is_dev(userId))) {
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

    let contador = 1;
    let chunkSize = 3900;
    let messageChunks = [];
    let currentChunk = "<b>Chats banidos:</b>\n";

    for (const chat of bannedChats) {
        const groupMessage = `<b>${contador}:</b> <b>Group:</b> <a href="tg://resolve?domain=${chat.chatName}&amp;id=${chat.chatId}">${chat.chatName}</a> || <b>ID:</b> <code>${chat.chatId}</code>\n`;
        if (currentChunk.length + groupMessage.length > chunkSize) {
            messageChunks.push(currentChunk);
            currentChunk = "";
        }
        currentChunk += groupMessage;
        contador++;
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
                            callback_data: `banned:${index - 1}`,
                            disabled: index === 0,
                        },
                        {
                            text: `>> ${index + 2}`,
                            callback_data: `banned:${index + 1}`,
                            disabled: index === messageChunks.length - 1,
                        },
                    ],
                ],
            },
            parse_mode: "HTML",
        };
    };

    await bot.sendMessage(message.chat.id, messageChunks[index], markup(index));

    bot.on("callback_query", async (query) => {
        if (query.data.startsWith("banned:")) {
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
}

async function devs(message) {
    const chatId = message.chat.id;
    const userId = message.from.id;

    if (!is_dev(userId)) {
        bot.sendMessage(
            chatId,
            "Este comando só pode ser usado por desenvolvedores!"
        );
        return;
    }

    if (message.chat.type !== "private" || chatId !== userId) {
        bot.sendMessage(
            chatId,
            "Este comando só pode ser usado em um chat privado com o bot!"
        );
        return;
    }

    try {
        const devsData = await UserModel.find({ is_dev: true });

        let message = "<b>Lista de desenvolvedores:</b>\n\n";
        for (let user of devsData) {
            const { firstname, user_id } = user;
            message += `<b>User:</b> ${firstname} ||`;
            message += `<b> ID:</b> <code>${user_id}</code>\n`;
        }

        bot.sendMessage(chatId, message, { parse_mode: "HTML" });
    } catch (error) {
        console.error(error);
        bot.sendMessage(
            chatId,
            "Ocorreu um erro ao buscar a lista de desenvolvedores!"
        );
    }
}



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
    if (msg.chat.type !== "private") {
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

bot.onText(/\/settopic/, async (msg) => {
    if (msg.chat.type !== 'group' && msg.chat.type !== 'supergroup') {
        await bot.sendMessage(msg.chat.id, 'Esse comando só pode ser enviado em grupos.');
        return;
    }

    const chatId = msg.chat.id;
    const threadId = msg.reply_to_message?.message_thread_id;
    const chatMember = await bot.getChatMember(chatId, msg.from.id);

    if (chatMember.status !== 'administrator' && chatMember.status !== 'creator') {
        return;
    }

    try {
        const chat = await ChatModel.findOne({ chatId });

        if (chat) {
            if (threadId === "1" || !threadId) {
                chat.thread_id = null;
                await chat.save();
                bot.sendMessage(chatId, "Será enviado as mensagens aqui!", { message_thread_id: chat.thread_id });
            } else if (chat.thread_id === threadId) {
                bot.sendMessage(chatId, `Este chat já está definido para receber mensagens do tópico ${threadId}.`, { message_thread_id: chat.thread_id });
            } else {
                chat.thread_id = threadId;
                await chat.save();
                bot.sendMessage(chatId, `Thread ID atualizado para: ${threadId}, agora você receberá as mensagens históricas aqui!`, { message_thread_id: threadId });
            }
        } else {
            const newChat = new ChatModel({ chatId, thread_id: threadId });
            await newChat.save();
            bot.sendMessage(chatId, `Thread ID definido como: ${threadId}, agora você receberá as mensagens históricas aqui!`, { message_thread_id: threadId });
        }
    } catch (error) {
        console.error("Error setting thread ID:", error.message);
    }
});

bot.onText(/\/cleartopic/, async (msg) => {
    if (msg.chat.type !== 'group' && msg.chat.type !== 'supergroup') {
        await bot.sendMessage(msg.chat.id, 'Esse comando só pode ser enviado em grupos.');
        return;
    }

    const chatId = msg.chat.id;
    const chatMember = await bot.getChatMember(chatId, msg.from.id);

    if (chatMember.status !== 'administrator' && chatMember.status !== 'creator') {
        return;
    }

    try {
        const chat = await ChatModel.findOne({ chatId });

        if (chat) {
            chat.thread_id = null;
            await chat.save();
            bot.sendMessage(chatId, "O tópico foi removido com sucesso. Você não receberá mais mensagens históricas aqui.");
        } else {
            bot.sendMessage(chatId, "Você ainda não definiu um tópico. Use o comando /settopic para definir um tópico.");
        }
    } catch (error) {
        console.error("Error clearing thread ID:", error.message);
    }
});

const channelStatusId = process.env.channelStatusId;

async function sendStatus() {
    const start = new Date();
    const replied = await bot.sendMessage(channelStatusId, "Bot is ON");
    const end = new Date();
    const m_s = end - start;
    const uptime = process.uptime();
    const uptime_formatted = timeFormatter(uptime);
    const numUsers = await UserModel.countDocuments();
    const numChats = await ChatModel.countDocuments();
    await bot.editMessageText(
        `#Togurosbot #Status\n\nStatus: ON\nPing: \`${m_s}ms\`\nUptime: \`${uptime_formatted}\`\nUsers: \`${numUsers}\`\nChats: \`${numChats}\``,
        {
            chat_id: replied.chat.id,
            message_id: replied.message_id,
            parse_mode: "Markdown",
        }
    );
}

function timeFormatter(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    const hoursFormatted = String(hours).padStart(2, "0");
    const minutesFormatted = String(minutes).padStart(2, "0");
    const secondsFormatted = String(secs).padStart(2, "0");

    return `${hoursFormatted}:${minutesFormatted}:${secondsFormatted}`;
}

const job = new CronJob(
    "02 00 12 * * *",
    sendStatus,
    null,
    true,
    "America/Sao_Paulo"
);

bot.onText(/\/sendgp/, async (msg, match) => {
    const user_id = msg.from.id;
    if (!(await is_dev(user_id))) {
        return;
    }
    if (msg.chat.type !== "private") {
        return;
    }

    const sentMsg = await bot.sendMessage(msg.chat.id, "<i>Processing...</i>", {
        parse_mode: "HTML",
    });
    const web_preview = match.input.startsWith("-d");
    const query = web_preview ? match.input.substring(6).trim() : match.input;
    const ulist = await ChatModel.find().lean().select("chatId");
    let success_br = 0;
    let no_success = 0;
    let block_num = 0;

    if (msg.reply_to_message) {
        const replyMsg = msg.reply_to_message;
        for (const { chatId } of ulist) {
            try {
                await bot.forwardMessage(
                    chatId,
                    replyMsg.chat.id,
                    replyMsg.message_id
                );
                success_br += 1;
            } catch (err) {
                if (
                    err.response &&
                    err.response.body &&
                    err.response.body.error_code === 403
                ) {
                    block_num += 1;
                } else {
                    no_success += 1;
                }
            }
        }
    } else {
        for (const { chatId } of ulist) {
            try {
                await bot.sendMessage(chatId, query, {
                    disable_web_page_preview: !web_preview,
                    parse_mode: "HTML",
                    reply_to_message_id: msg.message_id,
                });
                success_br += 1;
            } catch (err) {
                if (
                    err.response &&
                    err.response.body &&
                    err.response.body.error_code === 403
                ) {
                    block_num += 1;
                } else {
                    no_success += 1;
                }
            }
        }
    }

    await bot.editMessageText(
        `
  ╭─❑ 「 <b>Broadcast Completed</b> 」 ❑──
  │- <i>Total Group:</i> \`${ulist.length}\`
  │- <i>Successful:</i> \`${success_br}\`
  │- <i>Removed:</i> \`${block_num}\`
  │- <i>Failed:</i> \`${no_success}\`
  ╰❑
    `,
        {
            chat_id: sentMsg.chat.id,
            message_id: sentMsg.message_id,
            parse_mode: "HTML",
        }
    );
});

function sendBotOnlineMessage() {
    console.log(`Toguro iniciado com sucesso...`);
    bot.sendMessage(groupId, `#Toguro #ONLINE\n\nBot is now playing ...`);
}

function sendBotOfflineMessage() {
    console.log(`Toguro encerrado com sucesso...`);
    bot.sendMessage(groupId, `#Toguro #OFFLINE\n\nBot is now off ...`)
        .then(() => {
            process.exit(0); // Encerra o processo do bot após enviar a mensagem offline
        })
        .catch((error) => {
            console.error("Erro ao enviar mensagem de desligamento:", error);
            process.exit(1); // Encerra o processo com um código de erro
        });
}


function pollingError(error) {
    console.log(error);
}

process.on('SIGINT', () => {
    sendBotOfflineMessage();
});

sendBotOnlineMessage();



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
    bot.onText(/\/devs/, devs);
};