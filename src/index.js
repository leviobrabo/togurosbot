const dotenv = require("dotenv");
dotenv.config();

const { initHandler } = require("./handlers/main.js");

const http = require("http");
const port = process.env.PORT || 8081;

let isShuttingDown = false;

async function gracefulShutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`[SHUTDOWN] Recebido ${signal}, encerrando graciosamente...`);
  server.close();
  const { bot } = require("./bot");
  bot.stopPolling();
  setTimeout(() => process.exit(0), 3000);
}

process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));

initHandler();

const server = http.createServer((request, response) =>
  response.writeHead(200, { "content-type": "application/json" })
);

server.listen(port);
