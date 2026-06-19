# PokeDungeon — Zone I

A Pokémon-style dungeon crawler. Explore the lit cavern, catch all 10 creatures
with the Poké Ball timing mini-game, loot 5 chests, crack the Vault, and join the
**$RIPPED** airdrop whitelist.

## Run

```bash
npm install      # first time only
npm start        # → http://localhost:3000
```

Open **http://localhost:3000** in a browser.

## Controls

| Action | Keyboard | Touch |
| --- | --- | --- |
| Move | Arrow keys / WASD | swipe |
| Interact / throw ball | `E` (or `Space` in catch) | tap |
| Start | `Space` | tap |

## Gameplay & rewards

- **10 creatures** to catch (Electric, Fire, Water, Grass, Rock, Psychic, Dark, Ice, Dragon, Normal).
  Catching uses a timing bar — throw when the marker is in the green zone. Rare types
  (Psychic, Dragon) have a faster marker and narrower zone.
- **5 chests** × 10,000 = 50,000 $RIPPED.
- Catch all 10 → the **Vault** opens. Reach it to clear Zone I and earn the **100,000** bonus.
- **Total: up to 150,000 $RIPPED** (100,000 clear bonus + 50,000 from chests).
- **Zones II–VI are locked** (shown on the win screen) — reserved for future chapters.

## Whitelist (stub)

On winning, the player pastes a Solana wallet to join the airdrop whitelist.

- The backend (`POST /api/whitelist`) validates the address format, confirms the
  submission, and **rejects the same wallet twice** within a server run.
- It is intentionally a **stub**: nothing is persisted to disk — the in-memory list
  resets on restart. `GET /api/whitelist/count` reports how many joined this run.
- A device that has already joined is **locked out of re-submitting** via `localStorage`,
  so a player can't enter the whitelist a second time after playing.

## Project layout

```
server.js          Express server — serves the game + whitelist API (stub)
package.json
public/
  index.html       markup (intro + win/whitelist overlays)
  style.css        UI styling
  game.js          the game (dungeon gen, creatures, catch mini-game, render loop)
```
