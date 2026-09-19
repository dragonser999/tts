# Stadium Striker

An original football (soccer) game — pure HTML, CSS, JavaScript and a small
Node backend. No images anywhere: the stadium, pitch, stands, floodlights,
player, ball and goalkeeper are all drawn with CSS gradients and HTML5 Canvas
shapes.

Two ways to play:
- **Practice Mode** — no login needed. Dribble and shoot past an AI keeper
  before the 90-second clock runs out.
- **Online Mode** — sign in with Google, then **Create Room** (get a 5-letter
  code) or **Join Room** with a friend's code, and play a live 1v1 penalty
  shootout (5 kicks each, sudden death if tied) synced in real time.

## Files
- `index.html`, `style.css` — page structure and stadium/UI styling
- `script.js` — solo practice game engine (movement, physics, AI keeper)
- `auth.js` — Google Sign-In handling on the client
- `lobby.js` — screen switching + create/join room via Socket.IO
- `multiplayer.js` — the online penalty-shootout game client
- `server.js` — Express server: static hosting, Google ID token verification,
  session, and the Socket.IO room/match logic (authoritative on the server)
- `package.json` — dependencies + start script
- `.env.example` — environment variables you need to set

## 1. Get a Google OAuth Client ID
1. Go to the [Google Cloud Console](https://console.cloud.google.com/apis/credentials).
2. Create (or select) a project → **Create Credentials → OAuth client ID**.
3. Application type: **Web application**.
4. Under **Authorized JavaScript origins**, add the exact URL you'll deploy to,
   e.g. `https://your-app.onrender.com` or `https://your-app.up.railway.app`
   (and `http://localhost:3000` for local testing).
5. Copy the generated **Client ID** (looks like `xxxx.apps.googleusercontent.com`).
   You do **not** need the client secret — this app uses Google Identity
   Services' token-verification flow, not a redirect OAuth flow.

## 2. Set environment variables
Copy `.env.example` to `.env` for local testing, or add these in your
Render / Railway dashboard's **Environment** tab:

```
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
SESSION_SECRET=any-random-long-string
```

## 3. Run locally
```
npm install
npm start
```
Visit `http://localhost:3000`.

## 4. Deploy on Render
1. Push these files to a GitHub repo.
2. Render → **New → Web Service** → connect the repo.
3. Build command: `npm install`  |  Start command: `npm start`
4. Add the environment variables from step 2.
5. Deploy, then add the resulting `https://...onrender.com` URL to your
   Google OAuth client's Authorized JavaScript origins.

## 5. Deploy on Railway
1. Push these files to a GitHub repo.
2. Railway → **New Project → Deploy from GitHub repo**.
3. Railway auto-detects Node.js (`npm install` + `npm start`).
4. Add the environment variables from step 2 in the **Variables** tab.
5. Click **Generate Domain**, then add that URL to your Google OAuth client's
   Authorized JavaScript origins.

## Notes
- Rooms and match state live in server memory — fine for casual play; restart
  the service and open rooms are cleared.
- The game needs a persistent Node process (for Socket.IO), so use a **Web
  Service** on Render (not a Static Site) or Railway, both included above.
