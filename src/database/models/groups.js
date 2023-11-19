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
    is_ban: {
        type: Boolean,
        default: false,
        unique: false,
    },
    thread_id: {
        type: Number,
        required: false,
    }
});

module.exports = ChatSchema;
