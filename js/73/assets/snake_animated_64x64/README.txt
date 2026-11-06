Snake Game: Animated Sprite Set
--------------------------------
All nine GIFs are exactly 64 x 64 pixels with transparent backgrounds.
Each loops continuously for a 1.2-second cycle (12 frames, 100 ms per frame).

snake_head_idle.gif     - subtle side-to-side twitch, mouth closed
snake_head_chomp.gif    - subtle twitch, mouth opens and closes
snake_body_1.gif       - gentle center ripple; stationary segment endpoints
snake_body_2.gif       - alternate scale design and ripple
snake_body_3.gif       - alternate scale design and ripple
snake_tail.gif         - small tail-tip wag; base remains anchored
apple_green.gif        - subtle glow animation
apple_yellow.gif       - subtle glow animation
apple_red.gif          - subtle glow animation

GIFs can be loaded with HTML <img src="snake_head_chomp.gif"> or drawn
in JavaScript using drawImage, but animated GIFs drawn to a canvas do
not guarantee that every browser will animate as expected.
Note: GIF supports only one transparent palette index, so edges may be
less smooth than the original transparent PNG files.
