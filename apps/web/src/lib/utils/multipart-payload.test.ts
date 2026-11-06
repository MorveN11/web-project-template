import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { parseMultipartPayload } from './multipart-payload';

const schema = z.object({
  description: z.string().optional(),
  keepImageUrls: z.array(z.string().url()).optional(),
});

function fd(entries: [string, string][]): FormData {
  const data = new FormData();
  for (const [k, v] of entries) data.append(k, v);
  return data;
}

describe('parseMultipartPayload', () => {
  it('decodes an empty JSON array (empty gallery)', () => {
    expect(parseMultipartPayload(fd([['keepImageUrls', '[]']]), schema).keepImageUrls).toEqual([]);
  });

  it('decodes a populated JSON array', () => {
    expect(parseMultipartPayload(fd([['keepImageUrls', '["https://x.test/y.jpg"]']]), schema).keepImageUrls).toEqual([
      'https://x.test/y.jpg',
    ]);
  });

  it('leaves bracketed plain text alone', () => {
    expect(parseMultipartPayload(fd([['description', '[Featured]']]), schema).description).toBe('[Featured]');
  });
});
