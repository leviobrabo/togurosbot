module.exports = {
    apps: [
        {
            name: "toguro",
            script: "./src/index.js",
            env: {
                DB_STRING: "",
                PORT: 8080,
                TELEGRAM_API: "",
            },
        },
    ],
};
