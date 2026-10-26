# Touchline Duel playtest

## Current verification (October 25, 2026)

- Imported the complete project from `handshakefootball.bundle` and preserved it locally.
- All 13 automated tests pass on Windows with Node.js 24.22.1.
- Fixed a Windows line-ending assumption in the client test harness.
- Verified both teams can switch defenders and transfer control with through balls.
- Rejected malformed action directions before they can corrupt shared game state; invalid JSON payload shapes and oversized room-creation requests return client errors.
- Automated network checks cover two authenticated players, shared snapshots, disconnect pause, reconnect, mutual rematch, and health/static routes.
- Browser automation stopped because it could not verify the current Chrome URL. Visual rendering, touch interaction, and two physical devices have **not** been verified.
- Public deployment and challenge submission are still pending.

## Five-minute test with a friend

1. Start the server with `npm start` and open http://localhost:3000. Create a match; the clock should wait at 03:00.
2. On the second device, open the host computer's LAN address (or the published HTTPS URL) and join with the six-character code. Each player should see the same clock and score, with 11 players per team. Coral attacks right; Sky attacks left.
3. Move with WASD/arrows and sprint with Shift. Aim and tap J to pass: the lime selection ring should immediately move to the intended teammate. Use L to lead a receiver with a through ball. Try this on both teams.
4. Defend with Q to switch near the ball and E to tackle. Hold and release K to shoot. Check that a goal updates both screens once and gives the conceding team kickoff.
5. Reload one browser. It should return to the same team; the opponent should see a brief pause, then play should resume. Briefly take one device offline and verify the other pauses; restore its connection with the original tab still open to reconnect.
6. Finish the three-minute match. One rematch vote should wait; the second should reset score and clock. Leave and create a new room for another opponent.
7. On a phone, repeat moving, passing, switching, sprinting, and charging a shot. Check portrait and landscape, including whether controls fit and the selection ring is easy to see.

For same-computer testing, open two independently created tabs or different browsers. Avoid duplicating an existing match tab: browsers can copy its saved player session.

## Before sharing the final challenge link

- Deploy the Render Blueprint from the README and wait for a successful build and health check.
- Visit the HTTPS URL while signed out; no login should be needed to play.
- Run the test above on two physical devices on different networks.
- Confirm `/api/events` updates continuously; a frozen match can indicate buffered streaming responses.
- After free hosting wakes up, create a new room rather than relying on an old code.
- Prepare the project title, cover image, description, and tested public URL. Submit through Handshake yourself after reviewing its rules.

## Record feedback

Record device/browser, network, action, expected result, actual result, and whether both screens agreed. Focus the first round on pass targeting, receiver movement, switching, and connection delay.

Suggested description: **Two rivals. Twenty-two players. One pitch. Touchline Duel is a three-minute browser soccer game where each human controls an eleven-player team. Read the space, pass to switch control, and build the winning move. Invite a friend with a room code and play from your phone or laptop.**
