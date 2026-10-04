import type { z } from 'zod';
import { DiffFlag } from '@/lib/contracts';

export type DiffFlagValue = z.infer<typeof DiffFlag>;
const harakat = /[\u064B-\u0652\u0670]/gu;
const punctuation = /\p{P}/gu;

export function flagsForStrings(oldValue: string, newValue: string): DiffFlagValue[] {
  const oldTokens = oldValue.split(/\s+/u).filter(Boolean);
  const newTokens = newValue.split(/\s+/u).filter(Boolean);
  if (oldTokens.length === newTokens.length && oldTokens.every((token, index) => token === newTokens[index])) {
    return ['WHITESPACE_ONLY'];
  }
  if (oldValue.normalize('NFC') === newValue.normalize('NFC')) return ['UNICODE_EQUIVALENT'];
  if (oldValue.replace(harakat, '') === newValue.replace(harakat, '')) return ['HARAKAT_ONLY'];
  if (oldValue.replace(punctuation, '') === newValue.replace(punctuation, '')) return ['PUNCTUATION_ONLY'];
  return [];
}

export function isEquivalent(flags: readonly DiffFlagValue[]): boolean {
  return flags.includes('WHITESPACE_ONLY') || flags.includes('UNICODE_EQUIVALENT');
}
