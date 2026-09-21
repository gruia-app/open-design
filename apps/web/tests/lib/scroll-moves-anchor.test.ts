// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { scrollMovesAnchor } from '../../src/lib/scroll-moves-anchor';

// OPEND-3283: a capturing document scroll listener must only dismiss a menu
// when the scroll actually moves its anchor — a chat transcript auto-scrolling
// under a running turn is not the menu's business.
describe('scrollMovesAnchor', () => {
  it('returns true for a document or window scroll', () => {
    const anchor = document.createElement('button');
    document.body.append(anchor);
    expect(scrollMovesAnchor({ target: document } as unknown as Event, anchor)).toBe(true);
    expect(scrollMovesAnchor({ target: document.documentElement } as unknown as Event, anchor)).toBe(true);
    expect(scrollMovesAnchor({ target: window } as unknown as Event, anchor)).toBe(true);
    anchor.remove();
  });

  it('returns true when the scrolled element contains the anchor', () => {
    const scroller = document.createElement('div');
    const anchor = document.createElement('button');
    scroller.append(anchor);
    document.body.append(scroller);
    expect(scrollMovesAnchor({ target: scroller } as unknown as Event, anchor)).toBe(true);
    scroller.remove();
  });

  it('returns false when an unrelated container scrolls', () => {
    const transcript = document.createElement('div');
    const anchor = document.createElement('button');
    document.body.append(transcript, anchor);
    expect(scrollMovesAnchor({ target: transcript } as unknown as Event, anchor)).toBe(false);
    // The anchor scrolling itself also does not move it.
    expect(scrollMovesAnchor({ target: anchor } as unknown as Event, anchor)).toBe(false);
    transcript.remove();
    anchor.remove();
  });

  it('returns true with no anchor — the conservative dismissal', () => {
    const transcript = document.createElement('div');
    document.body.append(transcript);
    expect(scrollMovesAnchor({ target: transcript } as unknown as Event, null)).toBe(true);
    transcript.remove();
  });
});
