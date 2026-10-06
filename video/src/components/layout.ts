// Fixed video geometry (1920×1080). Footage sits in FRAME; captions and the chapter/disclosure
// tags live in BAND underneath it, so overlays never sit on top of product text by default.
export const W = 1920, H = 1080;
export const FRAME = { x: 160, y: 36, w: 1600, h: 900, r: 18 } as const;
export const BAND = { y: 944, h: 112 } as const;
