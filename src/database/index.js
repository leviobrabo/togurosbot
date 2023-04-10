const mongoose = require("mongoose");
const dotenv = require("dotenv");
const MessageSchema = require("./models/message");
const ChatSchema = require("./models/groups");
const userSchema = require("./models/users");

dotenv.config();

mongoose.connect(process.env.DB_STRING, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});

const MessageModel = mongoose.model("Reply", MessageSchema);
const ChatModel = mongoose.model("Chat", ChatSchema);
const UserModel = mongoose.model("User", userSchema);

module.exports = { MessageModel, ChatModel, UserModel };
