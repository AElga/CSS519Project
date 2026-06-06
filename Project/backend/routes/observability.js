const express = require("express");
const { recordUiInteraction } = require("../metrics");
const { logEvent } = require("../logger");

const router = express.Router();

router.post("/ui-event", (req, res) => {
    const {
        surface = "unknown",
        event = "unknown",
        metadata = {}
    } = req.body || {};

    recordUiInteraction(surface, event);
    logEvent("info", "ui_interaction", {
        surface,
        interaction_event: event,
        metadata
    });

    res.status(202).json({ accepted: true });
});

module.exports = router;
