const mongoose = require("mongoose");
require("dotenv").config();

const User = require("./src/database/models/users");
const Chat = require("./src/database/models/groups");

async function migrateLangCodes() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("[MIGRATION] Conectado ao MongoDB");

    const users = await User.find({ lang_code: { $exists: false } });
    console.log(`[MIGRATION] Usuários sem lang_code: ${users.length}`);

    for (const user of users) {
      await User.updateOne(
        { user_id: user.user_id },
        { $set: { lang_code: "unknown" } }
      ).catch(() => {});
    }

    const chats = await Chat.find({ lang_code: { $exists: false } });
    console.log(`[MIGRATION] Grupos sem lang_code: ${chats.length}`);

    for (const chat of chats) {
      await Chat.updateOne(
        { chatId: chat.chatId },
        { $set: { lang_code: "unknown" } }
      ).catch(() => {});
    }

    console.log("[MIGRATION] Migração concluída com sucesso!");
    process.exit(0);
  } catch (err) {
    console.error("[MIGRATION] Erro:", err.message);
    process.exit(1);
  }
}

migrateLangCodes();
