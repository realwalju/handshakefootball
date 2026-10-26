# Touchline Duel

A first playable soccer prototype: two human rivals, each controlling a full team of eleven. Passes switch control to their intended receiver; the remaining footballers maintain a simple 4–4–2 shape.

## Run the multiplayer game

Install Node.js 20 or newer, open a terminal in this folder, and run:

```sh
npm start
```

Open http://localhost:3000. No npm install is required: the server uses Node's built-in modules.

For a first test, open the page in two separate browser profiles or browsers. Create a match in one and enter its six-character code in the other. Each browser tab has its own player session; reloading a tab reconnects to that seat. Both players must remain connected for the clock to run.

For two devices on the same Wi-Fi network, use the host computer's local IP address and port 3000 (for example http://192.168.1.10:3000). Allow that port through the host firewall if necessary. Copying an invite from localhost will only work on the same computer; use the network address when sharing with another device.

## Standalone warm-up

Open `touchline-duel-demo.html` directly in a browser. This self-contained demo supports warm-up against the computer. Online room play requires the Node server; the downloaded HTML does not connect two devices by itself.

## Controls

| Action | Keyboard |
| --- | --- |
| Move / aim | WASD or arrow keys |
| Sprint | Shift |
| Pass | J |
| Through ball | L |
| Shoot | Hold K, then release |
| Switch defender | Q |
| Tackle | E |

Phone controls appear automatically on touch devices. Aim with movement. When standing still, shots aim toward the center of the opponent's goal. Your selected player has a lime ring; the small bar is sprint stamina. Goalkeepers distribute possession automatically.

## Current scope

- Two teams of eleven, one human per team; separate computer-opponent warm-up.
- Shared server simulation at 30 updates/second; movement inputs sent at 20 updates/second.
- Directional passing, through balls, charged shots, tackling, interceptions, simple supporting movement, and automated goalkeepers.
- Three-minute matches, scoring, kickoffs, simplified throw-ins/corners/goal kicks, and mutual online rematch votes.
- Room codes, invite links, automatic reconnect to the same seat, and match pause on disconnect.
- Original fictional teams and a canvas pitch, with no third-party artwork or external dependencies.

This is a prototype, not a finished simulation. There is no offside, foul system, aerial ball physics, substitutions, gamepad support, account system, or skill-based matchmaking. Players' tactical behavior is intentionally basic. The first build prioritizes a complete match loop and a working two-device architecture; gameplay tuning and testing over real internet connections remain necessary.

## Publish for the challenge

[Deploy to Render](https://render.com/deploy?repo=https://github.com/realwalju/handshakefootball)

This repository includes `render.yaml` for a single **free Node web service**. After pushing to GitHub, open the deploy link, sign in to Render, and review the Blueprint. Keep the Free plan selected. Render runs `npm test` before starting the server, uses `/health` for its health check, and provides an HTTPS `onrender.com` URL. Do not create a Static Site. See [Render's Blueprint reference](https://render.com/docs/blueprint-spec).

Render's free service sleeps after 15 minutes without incoming traffic and can take about a minute to wake up. Rooms are in memory, so restarts or sleeping discard them. Open the published page ahead of a playtest and create a fresh room. See [free-service limits](https://render.com/docs/free).

Deploy this folder to a host that runs a **persistent Node process** and supports streaming HTTP responses. Set its start command to `npm start`; the app listens on `0.0.0.0` and uses the supplied `PORT` environment variable. Use one server instance. Static-only hosting cannot run the multiplayer server.

Use HTTPS and ensure the reverse proxy does not buffer `/api/events`. The server sends event-stream snapshots; buffering them will cause lag or freeze updates. Rooms live in memory and disappear when the server restarts. This prototype caps active rooms at 128, expires abandoned rooms after 20 minutes, checks room tokens for player actions, and limits request sizes; it is not load-tested or hardened for large public traffic. A public release should add request-rate limiting, monitoring, and a cap on connection creation appropriate to its host.

Before submission, test two physical devices on different networks: room creation, joining, passing, switching, shooting, match completion, disconnect/reconnect, phone controls, and rematch. Verify the published link without a logged-in session.

Use [PLAYTEST.md](PLAYTEST.md) for a short two-player test and the current verification results.

## Verification

```sh
npm test
```

The automated suite covers team composition, possession restrictions, pass/control transfer, fast-shot interception, goals, restarts, keeper distribution, full-match numerical stability, and two-player room authentication/synchronization/disconnect/rematch.

## Suggested remaining schedule

- October 26: playtest movement, passing targets, and receiver control; fix confusing behavior.
- October 27: tune supporting runs, pressing, keeper saves, and shot balance.
- October 28: deploy, then test two devices on different networks.
- October 29: fix gameplay/network issues and prepare the cover image and description.
- October 30: submit the tested public URL with title, cover image, and description.

Handshake's landing page says October 31, but the linked official rules specify **October 30, 2026, 11:59 p.m. Pacific**. Use the earlier deadline. Sources checked October 25, 2026:

- https://joinhandshake.com/learn/create-a-multiplayer-game-8d7d59b5/
- https://go.joinhandshake.com/rs/390-ZTF-353/images/%5BAI_Skills_Studio_Challenge%5D_Contest_Official_Rules.pdf?version=0

Project working title: **Touchline Duel**. This project has not been published or submitted.
