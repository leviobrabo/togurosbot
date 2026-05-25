const mongoose = require("mongoose");
const dotenv = require("dotenv");
const MessageSchema = require("./models/message");
const ChatSchema = require("./models/groups");
const userSchema = require("./models/users");

dotenv.config();

const MAX_RETRIES = 10;

async function connectWithRetry(retries = 0) {
  try {
    await mongoose.connect(process.env.DB_STRING, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      heartbeatFrequencyMS: 10000,
    });
    console.log("MongoDB conectado com sucesso.");
  } catch (err) {
    retries++;
    const wait = Math.min(1000 * Math.pow(2, retries), 30000);
    console.error(`MongoDB erro (tentativa ${retries}/${MAX_RETRIES}): ${err.message} — retry em ${wait}ms`);
    if (retries >= MAX_RETRIES) {
      console.error("[DB] Máximo de tentativas atingido. Encerrando.");
      process.exit(1);
    }
    await new Promise((r) => setTimeout(r, wait));
    await connectWithRetry(retries);
  }
}

connectWithRetry();

mongoose.connection.on("disconnected", () => {
  console.warn("[DB] MongoDB desconectado — tentando reconectar...");
});

mongoose.connection.on("reconnected", () => {
  console.log("[DB] MongoDB reconectado.");
});

const MessageModel = mongoose.model("Reply", MessageSchema);
const ChatModel = mongoose.model("Chat", ChatSchema);
const UserModel = mongoose.model("User", userSchema);

module.exports = { MessageModel, ChatModel, UserModel };
