# Stadium Striker

An original football (soccer) game — pure HTML, CSS and JavaScript, no images at all
(the stadium, pitch, stands, floodlights, player, ball and goalkeeper are all drawn
with CSS gradients and HTML5 Canvas shapes).

**How to play:** move with arrow keys / WASD (or the on-screen pad on mobile),
hold Space (or the KICK button) to charge your shot, release to strike.
Beat the goalkeeper before the 90-second clock runs out.

## Files
- `index.html` — page structure
- `style.css` — stadium + UI styling
- `script.js` — game engine (movement, physics, AI keeper, scoring, timer)
- `server.js` + `package.json` — tiny Express server so the game can run as a
  Node web service

## Deploy on Render
1. Push these files to a GitHub repo.
2. On [render.com](https://render.com) → **New → Web Service** → connect the repo.
3. Build command: `npm install`
4. Start command: `npm start`
5. Deploy — Render gives you a public URL.

(Alternatively, use Render's **Static Site** option instead of a Web Service —
point it at the repo with no build command and publish directory `/`, since
`index.html`, `style.css` and `script.js` need no server logic.)

## Deploy on Railway
1. Push these files to a GitHub repo.
2. On [railway.app](https://railway.app) → **New Project → Deploy from GitHub repo**.
3. Railway auto-detects Node.js and runs `npm install` then `npm start`.
4. Once deployed, click **Generate Domain** to get a public URL.

That's it — no database, no API keys, no external assets required.
