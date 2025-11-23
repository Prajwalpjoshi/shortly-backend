// routes/links.js
const express = require("express");
const router = express.Router();
const db = require("../db");
const validUrl = require("valid-url");

const CODE_REGEX = /^[A-Za-z0-9]{6,8}$/;

// Create link
// POST /api/links
// body: { target: string, code?: string }
router.post("/", async (req, res) => {
  const { target, code } = req.body;
  if (!target || typeof target !== "string") {
    return res.status(400).json({ error: "target is required" });
  }
  // validate target URL
  if (!validUrl.isWebUri(target)) {
    return res.status(400).json({ error: "invalid target URL" });
  }

  let finalCode = code;
  if (finalCode) {
    if (typeof finalCode !== "string" || !CODE_REGEX.test(finalCode)) {
      return res
        .status(400)
        .json({ error: "custom code must match /^[A-Za-z0-9]{6,8}$/" });
    }
  } else {
    // auto-generate 6 char code
    finalCode = generateCode(6);
  }

  try {
    const insertQuery = `INSERT INTO links (code, target) VALUES ($1, $2) RETURNING code, target, clicks, last_clicked, created_at`;
    const result = await db.query(insertQuery, [finalCode, target]);
    return res.status(201).json(result.rows[0]);
  } catch (err) {
    // unique violation for code duplicates -> 409
    if (err.code === "23505") {
      return res.status(409).json({ error: "code already exists" });
    }
    console.error(err);
    return res.status(500).json({ error: "internal error" });
  }
});

// List all links
// GET /api/links
router.get("/", async (req, res) => {
  try {
    const q = `SELECT code, target, clicks, last_clicked, created_at FROM links ORDER BY created_at DESC`;
    const result = await db.query(q);
    return res.json(result.rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "internal error" });
  }
});

// Get stats for one code
// GET /api/links/:code
router.get("/:code", async (req, res) => {
  const { code } = req.params;
  if (!CODE_REGEX.test(code)) {
    return res.status(400).json({ error: "invalid code format" });
  }
  try {
    const q = `SELECT code, target, clicks, last_clicked, created_at FROM links WHERE code=$1`;
    const result = await db.query(q, [code]);
    if (result.rowCount === 0)
      return res.status(404).json({ error: "not found" });
    return res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "internal error" });
  }
});

// Delete link
// DELETE /api/links/:code
router.delete("/:code", async (req, res) => {
  const { code } = req.params;
  if (!CODE_REGEX.test(code)) {
    return res.status(400).json({ error: "invalid code format" });
  }
  try {
    const del = `DELETE FROM links WHERE code=$1 RETURNING code`;
    const result = await db.query(del, [code]);
    if (result.rowCount === 0)
      return res.status(404).json({ error: "not found" });
    return res.status(204).send(); // no content
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "internal error" });
  }
});

function generateCode(len = 6) {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let c = "";
  for (let i = 0; i < len; i++)
    c += chars.charAt(Math.floor(Math.random() * chars.length));
  return c;
}

module.exports = router;
