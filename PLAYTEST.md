# Touchline Duel playtest

## Current verification (October 26, 2026)

- Imported the complete project from `handshakefootball.bundle` and preserved it locally.
- All 31 automated tests pass on Windows with Node.js 24.22.1. The movement update adds acceleration/braking, independent supporting runs, pressing/cover, pass-and-move, receiving assistance with manual override, quick passes after ball wins, deterministic decisions, and compatibility with existing rooms.
- The real Postgres integration check also passed with the movement update before publication.
- The movement update was published on October 26. Its hands-on visual review was blocked by Chrome URL verification in browser automation; the new movement feel still needs a human comparison. The automated tests check the behavior and synchronization, not whether it feels natural to a player.
- The updated public match and mutual rematch passed: 1,359 requests, median 113 ms, p95 137 ms, and zero recovered upstream errors. Movement, passing, switching, room authentication, disconnect pause, and reconnect also passed on the published build.
- The basic 3D view was visually checked in Chrome on the local preview: full-pitch and follow-ball cameras, animated players, defender switching, and a warm-up reaching full time. Switching back to 2D retained the same clock, score, and match state. Phone/GPU performance and two physical devices still need a hands-on comparison.
- Fixed a Windows line-ending assumption in the client test harness.
- Verified both teams can switch defenders and transfer control with through balls.
- Rejected malformed action directions before they can corrupt shared game state; invalid JSON payload shapes and oversized room-creation requests return client errors.
- Automated network checks cover two authenticated players, shared snapshots, disconnect pause, reconnect, mutual rematch, and health/static routes.
- Published on Vercel at https://soccer.walju.net, with https://touchline-duel.vercel.app as its fallback. Free Neon room storage is connected; the custom domain is verified and its Cloudflare CNAME is correct.
- The real Postgres integration check passed: concurrent joins, version conflicts, two-player movement, passing, and disconnect state.
- Public HTTPS checks passed for the page, assets, database health, room authentication, passing, movement, switching, and reconnect. No login is needed to play.
- The complete public three-minute match and mutual rematch test passed: 1,333 requests, median response 115 ms, p95 171 ms, and zero recovered upstream errors in the successful run. These are observations from one test location, not a guarantee for every network.
- Visually checked the deployed lobby and 22-player pitch in Chrome and created a room through the browser client. Browser automation then stopped because it could not verify the current URL; a second browser seat, phone controls, and two physical devices remain unverified.
- An early full-match attempt encountered one transient Vercel `DEPLOYMENT_NOT_FOUND` response during initial domain propagation. Later health checks passed on both verified edge addresses. The live test retries temporary sync failures as the client does; room/auth failures and actions are not retried.
- Local DNS initially cached an earlier NXDOMAIN. It subsequently resolved normally, and the custom domain returned HTTP 200 without any DNS override. Use the fallback URL if another resolver has not updated yet.
- Challenge submission is still pending.

## Five-minute test with a friend

1. Start the server with `npm start` and open http://localhost:3000. Create a match; the clock should wait at 03:00.
2. On the second device, open the host computer's LAN address (or the published HTTPS URL) and join with the six-character code. Each player should see the same clock and score, with 11 players per team. Coral attacks right; Sky attacks left.
3. Move with WASD/arrows and sprint with Shift. Aim and tap J to pass: the lime selection ring should immediately move to the intended teammate. Use L to lead a receiver with a through ball. Try this on both teams.
4. Defend with Q to switch near the ball and E to tackle. Hold and release K to shoot. Check that a goal updates both screens once and gives the conceding team kickoff.
5. Reload one browser. It should return to the same team; the opponent should see a brief pause, then play should resume. Briefly take one device offline and verify the other pauses; restore its connection with the original tab still open to reconnect.
6. Finish the three-minute match. One rematch vote should wait; the second should reset score and clock. Leave and create a new room for another opponent.
7. On a phone, repeat moving, passing, switching, sprinting, and charging a shot. Check portrait and landscape, including whether controls fit and the selection ring is easy to see.

## Basic 3D comparison

Open https://soccer.walju.net/?view=3d or select **Try 3D** above the pitch. Start warm-up, then compare **Camera: wide** with **Camera: follow ball**. Check the animated players, ball visibility, selection marker, stamina, and shot charge. Pass with J, switch with Q, and try a charged shot with K. Switch back to **2D** during play; score, clock, and session should continue. For online play, let one rival use 3D and the other use 2D, then compare their score and selected players. Test phone performance separately.

## Movement feel

Carry the ball without sprinting and watch supporting midfielders and runners; they should offer different angles. Play a through ball and briefly release movement: the receiver should keep running, while the passer supports forward. Steer the receiver to override assistance. On defense, check that one player presses while others cover or follow runners. Compare starts, stops, and direction changes with the previous instant movement. Check that a goalkeeper distributes possession even after a save or tackle cooldown.

For same-computer testing, open two independently created tabs or different browsers. Avoid duplicating an existing match tab: browsers can copy its saved player session.

## Before sharing the final challenge link

- Deploy the Vercel project from the README and wait for a successful build and health check. Complete the Neon Free database connection and Cloudflare DNS setup if pending.
- Visit the HTTPS URL while signed out; no login should be needed to play.
- Run the test above on two physical devices on different networks.
- On Vercel, confirm `/api/sync` requests succeed continuously. For standalone Node hosting, confirm `/api/events` streams continuously without proxy buffering.
- On Vercel, disconnect detection can take up to two seconds. On an alternative host that discards rooms when sleeping, create a fresh room after it wakes up.
- Prepare the project title, cover image, description, and tested public URL. Submit through Handshake yourself after reviewing its rules.

## Record feedback

Record device/browser, network, action, expected result, actual result, and whether both screens agreed. Focus the first round on pass targeting, receiver movement, switching, and connection delay.

Suggested description: **Two rivals. Twenty-two players. One pitch. Touchline Duel is a three-minute browser soccer game where each human controls an eleven-player team. Read the space, pass to switch control, and build the winning move. Invite a friend with a room code and play from your phone or laptop.**
