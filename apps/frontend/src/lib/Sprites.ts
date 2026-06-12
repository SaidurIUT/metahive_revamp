export const AVATAR_OPTIONS = [
  {
    id: "ash",
    label: "Boy",
    src: "/ash.png",
    thumbnail: {
      src: "/ash.png",
      sliceX: 52,
      sliceY: 1,
      frameIndex: 18, // idle-down, first frame — facing the player
    },
    sprite: {
      sliceX: 52,
      sliceY: 1,
      anims: {
        "idle-right": { from: 0,  to: 5,  speed: 10, loop: true },
        "idle-up":    { from: 6,  to: 11, speed: 10, loop: true },
        "idle-left":  { from: 12, to: 17, speed: 10, loop: true },
        "idle-down":  { from: 18, to: 23, speed: 10, loop: true },
        "run-right":  { from: 24, to: 29, speed: 15, loop: true },
        "run-up":     { from: 30, to: 35, speed: 15, loop: true },
        "run-left":   { from: 36, to: 41, speed: 15, loop: true },
        "run-down":   { from: 42, to: 47, speed: 15, loop: true },
        "sit-down":   { from: 48, to: 48, speed: 1,  loop: false },
        "sit-up":     { from: 49, to: 49, speed: 1,  loop: false },
        "sit-left":   { from: 50, to: 50, speed: 1,  loop: false },
        "sit-right":  { from: 51, to: 51, speed: 1,  loop: false },
      },
    },
  },
{
  id: "girl2",
  label: "Girl 2",
  src: "/girl2.png",
  thumbnail: {
    src: "/girl2.png",
    sliceX: 13,
    sliceY: 21,
    frameIndex: 78, // walk-down, first frame — facing the player
  },
  sprite: {
    sliceX: 13,
    sliceY: 21,
    anims: {
      // idle — pin to the neutral stance frame of each walk cycle
      "idle-up":    { from: 60, to: 60, speed: 8,  loop: true },
      "idle-left":  { from: 69, to: 69, speed: 8,  loop: true },
      "idle-down":  { from: 78, to: 78, speed: 8,  loop: true },
      "idle-right": { from: 87, to: 87, speed: 8,  loop: true },

      // run — full 9-frame walk cycle
      "run-up":     { from: 60, to: 68, speed: 12, loop: true },
      "run-left":   { from: 69, to: 77, speed: 12, loop: true },
      "run-down":   { from: 78, to: 86, speed: 12, loop: true },
      "run-right":  { from: 87, to: 95, speed: 12, loop: true },

      // sit — use slash frames (short, punchy) as sit stand-ins
      "sit-up":     { from: 96,  to: 96,  speed: 1, loop: false },
      "sit-left":   { from: 102, to: 102, speed: 1, loop: false },
      "sit-down":   { from: 108, to: 108, speed: 1, loop: false },
      "sit-right":  { from: 114, to: 114, speed: 1, loop: false },

      // bonus animations available on this sheet
      "spellcast-up":    { from: 0,   to: 6,   speed: 12, loop: false },
      "spellcast-left":  { from: 7,   to: 13,  speed: 12, loop: false },
      "spellcast-down":  { from: 14,  to: 20,  speed: 12, loop: false },
      "spellcast-right": { from: 21,  to: 27,  speed: 12, loop: false },
      "slash-up":        { from: 96,  to: 101, speed: 15, loop: false },
      "slash-left":      { from: 102, to: 107, speed: 15, loop: false },
      "slash-down":      { from: 108, to: 113, speed: 15, loop: false },
      "slash-right":     { from: 114, to: 119, speed: 15, loop: false },
      "shoot-up":        { from: 120, to: 132, speed: 10, loop: false },
      "shoot-left":      { from: 133, to: 145, speed: 10, loop: false },
      "shoot-down":      { from: 146, to: 158, speed: 10, loop: false },
      "shoot-right":     { from: 159, to: 171, speed: 10, loop: false },
      "hurt":            { from: 172, to: 177, speed: 10, loop: false },
    },
  },
},
];