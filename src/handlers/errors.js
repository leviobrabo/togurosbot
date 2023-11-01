const { v4: uuidv4 } = require("uuid");

process.on("unhandledRejection", async (reason, promise) => {
    const errorMessage = `Error: ${reason?.message ?? reason}`;
    const errorId = uuidv4();

    console.error(`Error = ${errorMessage}`);
});

module.exports = process;
