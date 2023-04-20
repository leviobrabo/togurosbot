const { Schema } = require("mongoose");

const userSchema = new Schema({
    user_id: { type: Number, required: true, unique: true },
    username: { type: String, required: false },
    firstname: { type: String, required: true },
    lastname: { type: String, required: false },
    is_dev: { type: Boolean, required: true, default: false },
});

module.exports = userSchema;
