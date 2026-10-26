# eFootball pacing study

Touchline Duel uses an original simulation and original teams. eFootball is a reference for match readability, not a source of copied code, assets, animations, or exact hidden values.

## What was making the prototype hard to read

The pitch is modeled at ten simulation units per metre. Before this pass, human jogging and sprinting were 14.5 and 20.5 m/s, AI runners repeatedly reached 12.6–17.4 m/s, ordinary passes traveled at 35–62 m/s, and shots traveled at 61–91 m/s. Acceleration let a player reach jogging speed in about 0.18 seconds. A standing tackle could take possession from 3.2 metres away in one frame, while any loose-ball contact immediately attached the ball to a player's feet. The full-pitch 3D camera then rendered the oversized player figures very small, hiding the few movement cues the simulation provided.

Those systems combined to remove anticipation. A pass, interception, or change of possession could be over before either player had time to read the body direction.

## Principles taken from the reference

Konami's v5.0.0 notes say AI players had been reaching top speed too often and were adjusted to spend more time near 70% speed. The same notes connect acceleration differences to player identity and describe defenders stepping into better positions before challenging. The later v5.4.0 notes say defenders had reacted to turns too early and were changed to respond less perfectly before the ball-touch motion. They also distinguish controlled dribbling, dash dribbling, and a sharper touch.

The useful design principles for this prototype are:

- Most off-ball movement is jogging or shaped positioning; sprinting is a deliberate run.
- The ball and the player's feet communicate control through a visible first touch.
- A defender contains and approaches before attempting a challenge.
- A challenge exposes a loose ball instead of awarding possession immediately.
- The camera keeps the ball, controlled player, and likely receiving space readable.
- Wider tactical movement remains available through a small full-pitch map.

Official references:

- https://www.konami.com/efootball/en-us/page/v5/versioninfo_v5-00
- https://www.konami.com/efootball/en-us/page/v5/versioninfo_v5-40
- https://www.youtube.com/watch?v=Ijen5UPuG6U

## Touchline Duel calibration

Ten simulation units remain one metre. Current targets are 5.8 m/s jogging, 8.8 m/s sprinting, 5.0–7.2 m/s while dribbling, 15.5–24.5 m/s for passes, 22.5–28 m/s for through balls, and 22–31 m/s for shots. Acceleration, braking, and facing changes have been slowed so momentum is visible without making keyboard control feel delayed.

An incoming ball now creates a 0.14–0.38 second settling touch based on its relative speed and approach. A pass or shot pressed during that interval is buffered and plays when the ball is under control. Tackles have a facing and reach check, knock the ball loose, and impose a recovery window. AI pressers must remain close for a short commitment interval instead of taking possession on first contact.

The broadcast camera follows a weighted midpoint between the ball and controlled player and zooms out when they separate. A target marker identifies the intended receiving space, and the radar preserves awareness of the other twenty players. Player figures now use approximately human scale on the 105-by-68-metre pitch, and the goal is 7.32 metres wide by 2.44 metres high.

The second mechanics pass makes low-speed acceleration quicker and high-speed acceleration more gradual. Original player roles now have distinct pace, control, and awareness traits. During possession, teammates coordinate a wall-pass option, forward diagonal, recycle outlet, and line-breaking runner. Normal passes account for the receiver's velocity and ball drag; through balls lead a moving runner according to their pace and the space around them. The practice AI waits for the move to develop, recognizes open forward lanes, and uses through balls for suitable runs. Hard shots now parry or deflect into loose-ball situations instead of attaching to a goalkeeper or defender on contact.

The third presentation and finishing pass gives the intended receiver a modest control radius without preventing a defender from reaching the ball first. Shots retain their identity as they lose speed, use vertical input to select a point within the goal, and meet a smaller goalkeeper save radius. The rendered ball is reduced from 1.1 metres to 0.6 metres in diameter for readability without making it disappear. Human goalkeepers remain selected after a catch and can move or distribute; bot keepers retain automatic distribution. The procedural gait adds opposing stride cycles, knee flexion, foot planting, arm counter-swing, body sway, and acceleration/turning lean.

## Limits of this pass

The current player is an original articulated low-poly figure. It has readable limbs, facing, stride, kick, touch, and tackle poses, but it is not yet a skinned production character with motion-captured animation blending. Ball play remains ground-only, and the simulation does not yet model fouls, offside, aerial duels, or individual player attributes. Those are separate systems; adding detailed models alone would not correct the pacing and control problems recorded above.
