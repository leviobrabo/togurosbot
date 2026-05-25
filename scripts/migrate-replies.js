/**
 * Migra replies do formato antigo (string pura) para o novo formato ({type,value,emoji_entities}).
 * Executa uma vez: node scripts/migrate-replies.js
 */

require("dotenv").config();
const mongoose = require("mongoose");

const DB = process.env.DB_STRING || process.argv[2];
if (!DB) { console.error("Passe DB_STRING no .env ou como argumento"); process.exit(1); }

const MessageModel = mongoose.model("Reply", new mongoose.Schema({
  message: String,
  reply: { type: Array, default: [] },
}, { strict: false }));

function convertReply(raw) {
  const item = (raw && typeof raw.toObject === "function") ? raw.toObject() : raw;
  if (typeof item === "string") {
    const isSticker = /^[A-Za-z0-9_-]{30,}$/.test(item);
    return { type: isSticker ? "sticker" : "text", value: item, emoji_entities: [] };
  }
  if (item.value) return null; // já está no novo formato
  if (item["0"] !== undefined) {
    let i = 0, chars = [];
    while (item[String(i)] !== undefined) { chars.push(item[String(i)]); i++; }
    const str = chars.join("");
    if (!str) return null;
    const isSticker = /^[A-Za-z0-9_-]{30,}$/.test(str);
    return { type: isSticker ? "sticker" : "text", value: str, emoji_entities: [] };
  }
  return null;
}

async function run() {
  await mongoose.connect(DB, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log("Conectado ao MongoDB.");

  const total = await MessageModel.countDocuments();
  console.log(`Total de documentos: ${total}`);

  let processed = 0, migrated = 0, skipped = 0;
  const cursor = MessageModel.find().lean().cursor();

  for await (const doc of cursor) {
    processed++;
    if (!Array.isArray(doc.reply) || !doc.reply.length) { skipped++; continue; }

    const hasOldFormat = doc.reply.some(r => {
      if (typeof r === "string") return true;
      if (r && !r.value && r["0"] !== undefined) return true;
      return false;
    });

    if (!hasOldFormat) { skipped++; continue; }

    const newReplies = doc.reply.map(r => {
      const converted = convertReply(r);
      if (converted) return converted;
      const obj = (r && typeof r.toObject === "function") ? r.toObject() : r;
      return { type: obj.type || "text", value: obj.value, emoji_entities: obj.emoji_entities || [] };
    }).filter(r => r && r.value);

    if (!newReplies.length) { skipped++; continue; }

    await MessageModel.updateOne({ _id: doc._id }, { $set: { reply: newReplies } });
    migrated++;

    if (migrated % 1000 === 0) {
      console.log(`Progresso: ${processed}/${total} processados, ${migrated} migrados`);
    }
  }

  console.log(`\nConcluído: ${processed} processados, ${migrated} migrados, ${skipped} já ok/vazios.`);
  await mongoose.disconnect();
}

run().catch(err => { console.error(err); process.exit(1); });
