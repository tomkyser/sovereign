import { debug } from '../../utils';

// =============================================================================
// Detector Types (shared across all patches)
// =============================================================================

export interface Detection {
  match: RegExpMatchArray | { 0: string; index: number };
  detector: string;
  confidence: 'high' | 'medium' | 'low';
}

export type Detector = () => Detection | null;

export function runDetectors(
  js: string,
  detectors: Array<{ name: string; fn: (js: string) => Detection | null }>
): Detection | null {
  for (const { name, fn } of detectors) {
    try {
      const result = fn(js);
      if (result) {
        debug(`  detector "${name}" matched (${result.confidence})`);
        return result;
      }
    } catch (err) {
      debug(`  detector "${name}" threw: ${err}`);
    }
  }
  return null;
}
