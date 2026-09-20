import { invitationEmailMiddleware } from '../../server/invitation-email.mjs';

const handle = invitationEmailMiddleware(process.env);
export default async function invitationEmail(request, response) {
  request.url = '/api/invitations/email';
  return handle(request, response);
}
