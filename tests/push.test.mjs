import { describe, it, expect } from 'vitest';
import { reminderFor, allowedEndpoint } from '../server/reminders.mjs';
import { authorizedCron, pushHandler } from '../server/push.mjs';
describe('Birthday reminders', () => {
  it('uses Chile dates and separates the birthday from the party', () => {
    expect(reminderFor(new Date('2026-09-20T02:59:59Z'))).toBeNull();
    expect(reminderFor(new Date('2026-09-20T03:00:00Z')).title).toContain('5 días');
    expect(reminderFor(new Date('2026-09-24T13:00:00Z')).title).toContain('Mañana');
    expect(reminderFor(new Date('2026-09-25T13:00:00Z')).title).toContain('cumple 7');
    expect(reminderFor(new Date('2026-09-26T13:00:00Z')).body).toContain('15:30');
    expect(reminderFor(new Date('2026-09-26T13:00:00Z')).body).toContain('Ya llegué');
    expect(reminderFor(new Date('2026-09-27T13:00:00Z'))).toBeNull();
    expect(reminderFor(new Date('2026-09-17T13:00:00Z'))).toBeNull();
  });
  it('does not permit arbitrary outbound URLs', () => {
    for(const endpoint of ['https://fcm.googleapis.com/fcm/send/example','https://updates.push.services.mozilla.com/wpush/v2/example','https://web.push.apple.com/example']) expect(allowedEndpoint(endpoint)).toBe(true);
    for(const endpoint of ['http://fcm.googleapis.com/x','https://fcm.googleapis.com.evil.test/x','https://evil.test/x','https://127.0.0.1/x','https://user@fcm.googleapis.com/x','https://fcm.googleapis.com:8080/x']) expect(allowedEndpoint(endpoint)).toBe(false);
  });
  it('requires an exact cron secret and rejects public cron requests', async () => {
    expect(authorizedCron('Bearer secret','secret')).toBe(true);
    expect(authorizedCron('Bearer nope','secret')).toBe(false);
    expect(authorizedCron(undefined,undefined)).toBe(false);
    let status;
    const res={setHeader(){},status(value){status=value;return this;},json(value){return value;}};
    await pushHandler({method:'GET',headers:{}},res);
    expect(status).toBe(401);
  });
});
