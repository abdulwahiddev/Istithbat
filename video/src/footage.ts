/**
 * THE ONE LITERAL SCREEN RECORDING — authenticity for the publish action.
 *
 * Everything after the publish click is choreographed from verified Production state with the
 * product's own components. This slot is the real /sandbox recording: drop it into
 * public/footage/01-sandbox-baseline-publish/capture.mp4 (or .webm/.mov/.png).
 * Coordinates are normalised to the frame (0..1).
 */
export type Segment = {
  /** base name inside public/footage/<slot>/; resolved as .mp4, .webm, .mov, .png or .jpg (or give the extension) */
  file: string;
  /** journey-relative second (0 = 0:17) at which this segment starts showing */
  at: number;
  /** second within the source video to start from */
  from?: number;
  /** playback rate */
  rate?: number;
};
export type CamKey = { t: number; x: number; y: number; s: number };
export type Pt = { x: number; y: number };
export type Slot = { id: string; title: string; route: string; mustShow: string[]; segments: Segment[]; camera: CamKey[]; anchors: Record<string, Pt> };

export const SANDBOX: Slot = {
  id: '01-sandbox-baseline-publish', title: 'Production /sandbox · baseline, then publish', route: '/sandbox (Production)',
  mustShow: [
    'Clean baseline: upstream, trusted and served all v13 (“Ready to run”)',
    'Operator clicks “Publish controlled candidate”',
    'Run starts (“Publishing…” → pipeline appears)',
  ],
  segments: [{ file: 'capture', at: 0 }],
  // gentle push toward the publish button around the click
  camera: [{ t: 0, x: 0.5, y: 0.5, s: 1 }, { t: 3.5, x: 0.5, y: 0.5, s: 1 }, { t: 5.5, x: 0.4, y: 0.6, s: 1.04 }, { t: 13, x: 0.4, y: 0.6, s: 1.04 }],
  // where "Publish controlled candidate" sits in the recording (tune after dropping the capture)
  anchors: { publish: { x: 0.3, y: 0.62 } },
};
