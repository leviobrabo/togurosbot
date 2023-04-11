const { MessageModel } = require("../database");
const { ChatModel } = require("../database");
const { UserModel } = require("../database");
const { bot } = require("../bot");
const { setTimeout } = require("timers/promises");

require("./errors.js");
const groupId = process.env.groupId;

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

async function start(message) {
    if (message.chat.type !== "private") {
        return;
    }
    const firstName = message.from.first_name;

    const message_start = `Olá, <b>${firstName}</b>!\n\nEu sou <b>Toguro</b>, um bot que não gosta de ser chamado de bot kkkkk e que envia mensagens, áudios e figurinhas. Aproveite as funções que eu tenho.\n\n👾 <b>Canal de figurinhas:</b> <a href="https://t.me/lbrabo">Clique aqui</a>\n\n<b>BTC:</b> <code>bc1qjxzlug0cwnfjrhacy9kkpdzxfj0mcxc079axtl</code>\n<b>ETH/USDT:</b> <code>0x1fbde0d2a96869299049f4f6f78fbd789d167d1b</code>`;
    const options_start = {
        parse_mode: "HTML",
        disable_web_page_preview: true,
        reply_markup: {
            inline_keyboard: [
                [
                    {
                        text: "Adicione-me em seu grupo",
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
    bot.sendMessage(message.chat.id, message_start, options_start);
}

async function stats(message) {
    const chatId = message.chat.id;
    const numUsers = await UserModel.countDocuments();
    const numChats = await ChatModel.countDocuments();
    const numMessages = await MessageModel.countDocuments();
    const messageText = `\n──❑ 「 Bot Stats 」 ❑──\n\n ☆ ${numUsers} usuários\n ☆ ${numChats} grupos\n ☆ ${numMessages} mensagens aprendidas`;
    bot.sendMessage(chatId, messageText);
}

async function groups(message) {
    if (message.chat.type !== "private") {
        return;
    }

    try {
        const chats = await ChatModel.find();

        let contador = 1;
        let chunkSize = 3500 - message.text.length;
        let messageChunks = [];
        let currentChunk = "";

        for (let chat of chats) {
            if (chat.chatId < 0) {
                let groupMessage = `*${contador}:* *Grupo:* ${chat.chatName} *ID:* \`${chat.chatId}\`\n`;
                if (currentChunk.length + groupMessage.length > chunkSize) {
                    messageChunks.push(currentChunk);
                    currentChunk = "";
                }
                currentChunk += groupMessage;
                contador++;
            }
        }
        messageChunks.push(currentChunk);

        for (let i = 0; i < messageChunks.length; i++) {
            await bot.sendMessage(message.chat.id, messageChunks[i], {
                parse_mode: "Markdown",
            });
        }
    } catch (error) {
        console.error(error);
    }
}
async function saveNewChatMembers(msg) {
    const chatId = msg.chat.id;
    const chatName = msg.chat.title;

    try {
        const exists = await ChatModel.exists({ chatId: chatId });
        if (exists) {
            console.log(
                `Grupo ${chatName} (${chatId}) já existe no banco de dados`
            );
            return;
        }

        const chat = await ChatModel.create({ chatId, chatName });
        console.log(
            `Grupo ${chat.chatName} (${chat.chatId}) adicionado ao banco de dados`
        );
        const message = `#Togurosbot #New_Group
    <b>Group:</b> <a href="tg://resolve?domain=${chat.chatName}&amp;id=${chat.chatId}">${chat.chatName}</a>
    <b>ID:</b> <code>${chat.chatId}</code>`;
        bot.sendMessage(groupId, message, { parse_mode: "HTML" }).catch(
            (error) => {
                console.error(
                    `Erro ao enviar mensagem para o grupo ${groupId}: ${error}`
                );
            }
        );
        const botUser = await bot.getMe();
        const newMembers = msg.new_chat_members.filter(
            (member) => member.id === botUser.id
        );

        if (newMembers.length > 0) {
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
    } catch (err) {
        console.error(err);
    }
}

async function removeLeftChatMember(msg) {
    const chatId = msg.chat.id;

    try {
        const chat = await ChatModel.findOneAndDelete({ chatId });
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

exports.initHandler = () => {
    bot.on("message", main);
    bot.on("polling_error", pollingError);
    bot.on("message", saveUserInformation);
    bot.onText(/^\/start$/, start);
    bot.onText(/^\/stats$/, stats);
    bot.onText(/^\/grupos$/, groups);
    bot.on("new_chat_members", saveNewChatMembers);
    bot.on("left_chat_member", removeLeftChatMember);
};
