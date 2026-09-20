export function escapeHtml(value: unknown): string;
export function createInvitationEmail(
  invitation: { recipient_name: string; token: string },
  event: { starts_at: string | null; ends_at: string | null },
  details: { address?: string },
  origin: string,
): { subject: string; text: string; html: string };
