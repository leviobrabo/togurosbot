const { Schema } = require("mongoose");

const EmojiEntitySchema = new Schema({
  o: { type: Number, required: true },
  l: { type: Number, default: 2 },
  c: { type: String, required: true },
}, { _id: false });

const ReplyItemSchema = new Schema({
  t: {
    type: String,
    enum: ["s", "e"],
  },
  v: {
    type: String,
    required: true,
  },
  e: {
    type: [EmojiEntitySchema],
  },
}, { _id: false });

const MessageSchema = new Schema({
  l: {
    type: String,
    required: true,
    default: "unknown",
  },
  m: {
    required: true,
    type: String,
  },
  r: {
    type: [ReplyItemSchema],
    default: [],
  },
});

MessageSchema.index({ l: 1, m: 1 }, { unique: true });

module.exports = MessageSchema;
