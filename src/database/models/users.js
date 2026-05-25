const { Schema } = require("mongoose");

const userSchema = new Schema({
  user_id: { type: Number, required: true, unique: true, index: true },
  username: { type: String },
  firstname: { type: String, required: true },
  lastname: { type: String },
  lang_code: { type: String, default: "unknown", index: true },
  is_dev: { type: Boolean, default: false, index: true },
  last_ad_sent: { type: Date, default: null, index: true },
});

module.exports = userSchema;
