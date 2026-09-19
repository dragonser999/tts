# Stadium Striker

An original football (soccer) game — pure HTML, CSS, JavaScript and a small
Node backend. No images anywhere: the stadium, pitch, stands, floodlights,
player, ball and goalkeeper are all drawn with CSS gradients and HTML5 Canvas
shapes.

Two ways to play:
- **Practice Mode** — jump straight in, no account needed. Dribble and shoot
  past an AI keeper before the 90-second clock runs out.
- **Online Mode** — enter your name, then either **Create Room** (pick a room
  name + password) or **Join Room** with a friend's room name + password, and
  play a live 1v1 penalty shootout (5 kicks each, sudden death if tied)
  synced in real time over Socket.IO.

No login provider, no accounts, no database — rooms are just a name +
password pair that live in server memory while both players are in them.

## Files
- `index.html`, `style.css` — page structure and stadium/UI styling
- `script.js` — solo practice game engine (movement, physics, AI keeper)
- `lobby.js` — screen switching + create/join room via Socket.IO
- `multiplayer.js` — the online penalty-shootout game client
- `server.js` — Express server: static hosting + Socket.IO room/match logic
  (server is authoritative for scoring, so it can't be cheated from the client)
- `package.json` — dependencies + start script

## Run locally
```
npm install
npm start
```
Visit `http://localhost:3000`.

## Deploy on Render
1. Push these files to a GitHub repo.
2. Render → **New → Web Service** → connect the repo.
3. Build command: `npm install`  |  Start command: `npm start`
4. Deploy — Render gives you a public URL.

## Deploy on Railway
1. Push these files to a GitHub repo.
2. Railway → **New Project → Deploy from GitHub repo**.
3. Railway auto-detects Node.js (`npm install` + `npm start`).
4. Click **Generate Domain** to get a public URL.

## How online rooms work
- **Create Room**: pick any room name (must not already be in use) and a
  password. You'll see a waiting screen with the room name to share.
- **Join Room**: your friend enters that same room name + password from their
  own device/browser. As soon as they join, the match starts automatically
  for both players.
- Each round, the shooter picks one of 5 target zones in the goal and the
  keeper (the other player) picks one of 5 zones to dive to, at the same
  time. Match is best-of-5 kicks each, alternating who shoots; sudden death
  if it's tied after that.
- Room names are case-insensitive and freed up as soon as a player leaves or
  disconnects, so the same name can be reused.

## Notes
- Rooms/match state live in server memory only — restarting the service
  clears any open rooms. Fine for casual play.
- Needs a persistent Node process (for Socket.IO), so use a **Web Service**
  on Render (not a Static Site) or Railway, both covered above.
