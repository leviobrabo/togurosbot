const dotenv = require("dotenv");
dotenv.config();

const { initHandler } = require("./handlers/main.js");

const http = require("http");
const port = process.env.PORT || 8081;

initHandler();

const server = http.createServer((request, response) =>
    response.writeHead(200, { "content-type": "aplication/json" })
);

server.listen(port);
