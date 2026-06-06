const app = require("./app");
const { logEvent } = require("./logger");
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    logEvent("info", "server_started", { port: PORT });
    console.log(`Server running on port ${PORT}`);
});
