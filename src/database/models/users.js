const { Schema } = require("mongoose");

const userSchema = new Schema(
  {
    user_id: { type: Number, required: true, unique: true },
    username: { type: String },
    firstname: { type: String, required: true },
    lastname: { type: String },
    lang_code: { type: String, default: "unknown" },
    is_dev: { type: Boolean, default: false },
    last_ad_sent: { type: Date, default: null },
  },
  { autoIndex: true }
);

userSchema.index({ user_id: 1 });
userSchema.index({ lang_code: 1 });
userSchema.index({ is_dev: 1 });
userSchema.index({ last_ad_sent: 1 });

module.exports = userSchema;
