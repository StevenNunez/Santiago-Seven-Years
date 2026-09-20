import {invitationDeleteMiddleware} from '../../server/invitation-delete.mjs';
export default function handler(req,res){req.url='/api/invitations/delete';return invitationDeleteMiddleware(process.env)(req,res);}
