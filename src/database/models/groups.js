const { Schema } = require("mongoose");

const ChatSchema = new Schema({
    chatId: {
        type: Number,
        required: true,
        unique: true,
    },
    chatName: {
        type: String,
        required: true,
    },
});

module.exports = ChatSchema;
