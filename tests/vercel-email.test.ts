import { describe, expect, it } from 'vitest';
// @ts-expect-error server module is exercised directly in Node.
import { readInvitationBody } from '../server/invitation-email.mjs';
import { Readable } from 'node:stream';
describe('SMTP endpoint on Vercel and local Node', () => {
  it('accepts Vercel parsed JSON and the local request stream', async () => {
    const input = { invitationId: '12345678-1234-1234-1234-123456789abc' };
    expect(await readInvitationBody({ body: input })).toEqual(input);
    expect(await readInvitationBody(Readable.from([JSON.stringify(input)]))).toEqual(input);
  });
  it('rejects null, arrays and oversized parsed bodies', async () => {
    await expect(readInvitationBody({ body: null })).rejects.toThrow();
    await expect(readInvitationBody({ body: [] })).rejects.toThrow();
    await expect(readInvitationBody({ body: { text: 'x'.repeat(2100) } })).rejects.toMatchObject({ status: 413 });
  });
});
