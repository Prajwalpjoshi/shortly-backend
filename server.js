// server.js
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const linksRouter = require("./routes/links");
const db = require("./db");

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// healthcheck
app.get("/healthz", (req, res) => {
  res.json({ ok: true, version: "1.0", uptime_seconds: process.uptime() });
});

// API routes
app.use("/api/links", linksRouter);

// Redirect route: /:code
app.get("/:code", async (req, res) => {
  const code = req.params.code;
  const CODE_REGEX = /^[A-Za-z0-9]{6,8}$/;
  if (!CODE_REGEX.test(code)) {
    return res.status(404).send("Not found");
  }
  try {
    // select target
    const q = `SELECT target FROM links WHERE code=$1`;
    const result = await db.query(q, [code]);
    if (result.rowCount === 0) {
      return res.status(404).send("Not found");
    }
    const target = result.rows[0].target;

    // increment clicks and update last_clicked (do this asynchronously but ensure it completes)
    const updateQ = `UPDATE links SET clicks = clicks + 1, last_clicked = now() WHERE code=$1`;
    await db.query(updateQ, [code]);

    // redirect (302)
    return res.redirect(302, target);
  } catch (err) {
    console.error(err);
    return res.status(500).send("Server error");
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
