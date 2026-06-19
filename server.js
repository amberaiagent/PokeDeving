import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

/*
 * Whitelist endpoint — intentionally a STUB.
 * Nothing is persisted to disk: the Set lives only for the current server run,
 * so a restart clears it. Its single job is to (a) confirm a submission to the
 * player and (b) reject the same wallet being submitted twice in one run.
 * The real "you already played" guard lives client-side (localStorage); this is
 * the server-side backstop so a wallet can't be double-counted in a session.
 */
const whitelist = new Set();

// Solana addresses are base58, 32–44 chars (no 0, O, I, l).
const SOLANA_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

app.post("/api/whitelist", (req, res) => {
  const wallet = String(req.body?.wallet || "").trim();

  if (!SOLANA_RE.test(wallet)) {
    return res.status(400).json({
      ok: false,
      error: "invalid_wallet",
      message: "That doesn't look like a valid Solana wallet.",
    });
  }

  if (whitelist.has(wallet)) {
    return res.status(409).json({
      ok: false,
      error: "already_joined",
      message: "This wallet is already on the whitelist.",
    });
  }

  whitelist.add(wallet);
  return res.json({
    ok: true,
    message: "You're on the $RIPPED airdrop whitelist!",
  });
});

// Tiny read-only peek at how many wallets joined this run (handy while testing).
app.get("/api/whitelist/count", (_req, res) => {
  res.json({ count: whitelist.size });
});

app.listen(PORT, () => {
  console.log(`\n  PokeDungeon is live  →  http://localhost:${PORT}\n`);
});
