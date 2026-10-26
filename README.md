# Touchline Duel

[Play at soccer.walju.net](https://soccer.walju.net) · [Vercel fallback URL](https://touchline-duel.vercel.app)

[Try the basic 3D version](https://soccer.walju.net/?view=3d). On browsers with WebGL2, 3D is the default and opens with the closer broadcast camera, intended receiving-space marker, and full-pitch radar. The **Camera** button switches to the full-pitch view, while **2D** switches views without restarting the match.

A playable soccer prototype: two human rivals, each controlling a full team of eleven. Passes transfer control only when a receiver or interceptor controls the ball; teammates build passing angles, make runs, and defend from a flexible 4–4–2 base.

## Movement and team play

Players accelerate, brake, and turn with momentum. Off the ball, they make individual decisions: midfielders show for a pass, forwards alternate channel runs and dropping short, wingers hold width or cut inside, and a fullback can overlap on the ball side. The defending team commits a presser, keeps cover behind them, and tracks runners instead of sending everyone toward the ball.

After a pass, you keep control of the passer while the intended receiver independently attacks the ball. Control transfers on the receiver's first touch, or to an opponent who intercepts it. Passing targets account for space and blocked lanes. When an AI defender wins possession, control transfers to that player; goalkeepers settle and distribute the ball automatically. Quick passes are available after a ball win while repeated tackles still need recovery time.

The 3D gait follows actual travel speed, with separate stride phases, bent knees/elbows, and easing in and out of motion. A short visual extrapolation smooths online snapshots without changing authoritative match state. These are prototype football behaviors, not a professional simulation; feel and team balance still need playtesting.

## Run the multiplayer game

Install Node.js 20 or newer, open a terminal in this folder, and run:

```sh
npm ci
npm start
```

Open http://localhost:3000, or http://localhost:3000/?view=3d for the 3D experiment. `npm start` first bundles the 3D renderer; the local HTTP server uses Node's built-in modules. The Neon dependency supports Vercel's shared room storage.

## Basic 3D experiment

The 3D view uses Three.js, served from this project, with simple articulated footballers, team kits and jersey numbers, a faceted ball, goals and nets, pitch markings, lighting, and shadows. Player movement drives a basic running animation. The lime selection marker, aiming arrow, stamina bar, and shot charge remain visible in 3D.

This is a visual experiment using the existing shared match simulation. The ball and players still move on a flat pitch; there is no aerial physics. Camera orientation stays aligned with the pitch so WASD/arrows, passing, shooting, and switching retain their controls. Each opponent can choose either view, and copied invites preserve the 3D option. Browsers that cannot start WebGL2 keep the 2D view.

The editable models and scene are in `src/view-3d.js`. `npm run build:assets` bundles them into `public/view-3d.js`; that generated file is ignored by Git and rebuilt locally, in CI, and on Vercel. The single-file downloaded warm-up remains 2D. Three.js's license ships as `/three-LICENSE.txt`.

For a first test, open the page in two separate browser profiles or browsers. Create a match in one and enter its six-character code in the other. Each browser tab has its own player session; reloading a tab reconnects to that seat. Both players must remain connected for the clock to run.

For two devices on the same Wi-Fi network, use the host computer's local IP address and port 3000 (for example http://192.168.1.10:3000). Allow that port through the host firewall if necessary. Copying an invite from localhost will only work on the same computer; use the network address when sharing with another device.

## Standalone warm-up

Open `touchline-duel-demo.html` directly in a browser. This self-contained demo supports warm-up against the computer. Online room play requires the Node server; the downloaded HTML does not connect two devices by itself.

## Controls

| Action | Keyboard | Standard controller |
| --- | --- | --- |
| Move / aim | WASD or arrow keys | Left stick or D-pad |
| Sprint | Shift | RT / R2 |
| Pass | J | A / × |
| Through ball | L | Y / △ |
| Shoot | Hold K, then release | Hold X / □, then release |
| Switch defender | Q | LB / L1 |
| Tackle | E | B / ○ |

Phone controls appear automatically on touch devices. Aim with movement. When standing still, shots aim toward the center of the opponent's goal. Your selected player has a lime ring; the small bar is sprint stamina. Goalkeepers distribute possession automatically.

## Current scope

- Two teams of eleven, one human per team; separate computer-opponent warm-up.
- Shared simulation at 30 steps/second; local snapshots stream at 30 updates/second. On Vercel, clients synchronize at up to 20 updates/second, depending on network latency.
- Directional passing, through balls, charged shots, tackling, interceptions, simple supporting movement, and automated goalkeepers.
- Three-minute matches, scoring, kickoffs, simplified throw-ins/corners/goal kicks, and mutual online rematch votes.
- Room codes, invite links, automatic reconnect to the same seat, and match pause on disconnect.
- Original fictional teams and procedurally built 2D/3D visuals; no downloaded player artwork. Three.js supplies the 3D renderer and esbuild bundles the browser asset.

This is a prototype, not a finished simulation. There is no offside, foul system, aerial ball physics, substitutions, account system, or skill-based matchmaking. Players' tactical behavior is intentionally basic. The first build prioritizes a complete match loop and a working two-device architecture; gameplay tuning and testing over real internet connections remain necessary.

## Publish for the challenge

### Vercel: soccer.walju.net

The Vercel project is `touchline-duel` in `realwaljus-projects`. `vercel.json` serves the game and routes its API to a Node function. A **free Neon Postgres database** stores rooms so opponents reach the same match even when requests run on different Vercel instances. Secrets stay on the server in `DATABASE_URL`; never copy this value into public JavaScript.

1. Connect the `touchline-duel-rooms` Neon database to the project, using the Free plan and the `iad1` region. The integration supplies `DATABASE_URL` to the project.
2. Deploy this repository. `npm run build` creates the two room-storage tables if needed and runs the automated tests; a failed setup or test blocks the build.
3. Attach `soccer.walju.net` to the project. DNS is hosted by Cloudflare: set **CNAME** `soccer` to **`b84472f02dad497e.vercel-dns-017.com`**, with **DNS only** (proxy disabled), as recommended by Vercel for this project. Leave other domain records unchanged. Recheck Vercel's current recommendation before changing it in the future.
4. Verify `https://soccer.walju.net/health` returns `ok: true`, then test two devices using the checklist below.

Vercel uses short authenticated polling requests. Each request advances the shared simulation in fixed steps, and version-checked writes prevent competing requests from overwriting each other. No background timer or in-memory room registry is required in the function. Presence expires after two seconds without a sync, and movement input expires after 400 ms. Rooms expire after 20 minutes without authenticated activity; creating rooms is limited to eight per minute per IP and 128 active rooms overall. These limits are for an initial public playtest, not a load-test result.

For deployment from a signed-in CLI:

```sh
npx vercel link --project touchline-duel --scope realwaljus-projects
npx vercel --prod
```

### Alternative: standalone Node host

[Deploy to Render](https://render.com/deploy?repo=https://github.com/realwalju/handshakefootball)

This repository includes `render.yaml` for a single **free Node web service**. After pushing to GitHub, open the deploy link, sign in to Render, and review the Blueprint. Keep the Free plan selected. Render runs `npm test` before starting the server, uses `/health` for its health check, and provides an HTTPS `onrender.com` URL. Do not create a Static Site. See [Render's Blueprint reference](https://render.com/docs/blueprint-spec).

Render's free service sleeps after 15 minutes without incoming traffic and can take about a minute to wake up. Rooms are in memory, so restarts or sleeping discard them. Open the published page ahead of a playtest and create a fresh room. See [free-service limits](https://render.com/docs/free).

Deploy this folder to a host that runs a **persistent Node process** and supports streaming HTTP responses. Set its start command to `npm start`; the app listens on `0.0.0.0` and uses the supplied `PORT` environment variable. Use one server instance. Static-only hosting cannot run the multiplayer server.

For standalone hosting, use HTTPS and ensure the reverse proxy does not buffer `/api/events`. The local Node server sends event-stream snapshots; buffering them will cause lag or freeze updates. In this mode, rooms live in memory and disappear when the server restarts. This mode caps active rooms at 128, expires abandoned rooms after 20 minutes, checks room tokens for player actions, and limits request sizes; it is not load-tested or hardened for large public traffic. A public standalone release should add request-rate limiting, monitoring, and a cap on connection creation appropriate to its host.

Before submission, test two physical devices on different networks: room creation, joining, passing, switching, shooting, match completion, disconnect/reconnect, phone controls, and rematch. Verify the published link without a logged-in session.

Use [PLAYTEST.md](PLAYTEST.md) for a short two-player test and the current verification results.

## Verification

```sh
npm ci
npm test
```

The 36-test automated suite covers team composition and role traits, possession restrictions, pass-completion and interception handoffs, readable pass and through-ball speed, controller input, directional wall/forward/recycle options, first-touch buffering, loose-ball tackles, parries and recovery, goals, restarts, keeper distribution, full-match numerical stability, two-player room authentication/synchronization/disconnect/rematch, cross-instance room updates, the polling client, articulated 3D models and animation, broadcast and full-pitch camera framing, a 2D fallback without WebGL, acceleration/braking, coordinated support options, defensive cover, receiving runs, and deterministic movement. See [the eFootball pacing study](docs/gameplay-analysis.md) for the measured problems, reference principles, current calibration, and known limits. A separate real-database integration check is available after the Neon integration is connected:

```sh
npx vercel env pull .env.local
node --env-file=.env.local --test test/postgres.integration.mjs
```

The public HTTPS smoke test runs a complete three-minute two-player match and rematch against the published game:

```sh
node --test test/live.integration.mjs
```

For a freshly configured domain, some local DNS caches can take longer to update. The Vercel fallback URL serves the same deployment. The live test optionally accepts `TOUCHLINE_TEST_IPV4` for a DNS override; TLS certificate verification remains enabled.

## Suggested remaining schedule

- October 26: playtest movement, passing targets, and receiver control; fix confusing behavior.
- October 27: tune supporting runs, pressing, keeper saves, and shot balance.
- October 28: deploy, then test two devices on different networks.
- October 29: fix gameplay/network issues and prepare the cover image and description.
- October 30: submit the tested public URL with title, cover image, and description.

Handshake's landing page says October 31, but the linked official rules specify **October 30, 2026, 11:59 p.m. Pacific**. Use the earlier deadline. Sources checked October 25, 2026:

- https://joinhandshake.com/learn/create-a-multiplayer-game-8d7d59b5/
- https://go.joinhandshake.com/rs/390-ZTF-353/images/%5BAI_Skills_Studio_Challenge%5D_Contest_Official_Rules.pdf?version=0

Project title: **Touchline Duel**. Published on Vercel at https://soccer.walju.net, with https://touchline-duel.vercel.app as its fallback URL. Challenge submission is still pending.
