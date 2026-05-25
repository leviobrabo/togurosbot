const mongoose = require("mongoose");
const dotenv = require("dotenv");
const MessageSchema = require("./models/message");
const ChatSchema = require("./models/groups");
const userSchema = require("./models/users");

dotenv.config();

let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;
const RECONNECT_BASE_DELAY = 2000;

async function connectWithRetry() {
  while (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
    try {
      await mongoose.connect(process.env.DB_STRING, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        serverSelectionTimeoutMS: 10000,
        heartbeatFrequencyMS: 10000,
      });
      reconnectAttempts = 0;
      console.log("MongoDB conectado com sucesso.");
      return;
    } catch (err) {
      reconnectAttempts++;
      const delay = RECONNECT_BASE_DELAY * Math.pow(2, Math.min(reconnectAttempts - 1, 5));
      console.error(`[DB] Tentativa ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS} falhou: ${err.message} — retry em ${delay}ms`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  console.error("[DB] Máximo de tentativas alcançado. Saindo.");
  process.exit(1);
}

mongoose.connection.on("disconnected", () => {
  console.warn("[DB] MongoDB desconectado. Reconectando...");
  connectWithRetry().catch(() => {});
});

mongoose.connection.on("error", (err) => {
  console.error(`[DB] Connection error: ${err.message}`);
});

connectWithRetry().catch(() => {});

const MessageModel = mongoose.model("Reply", MessageSchema);
const ChatModel = mongoose.model("Chat", ChatSchema);
const UserModel = mongoose.model("User", userSchema);

module.exports = { MessageModel, ChatModel, UserModel };
