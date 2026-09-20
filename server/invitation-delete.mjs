import {createClient} from '@supabase/supabase-js';
import {emailConfig,readInvitationBody} from './invitation-email.mjs';

export function invitationDeleteMiddleware(config=emailConfig(), dependencies={}) {
  const request=dependencies.fetch??fetch;
  return async(req,res,next=()=>{})=>{
    if(req.url?.split('?')[0]!=='/api/invitations/delete')return next();
    const reply=(status,body)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(body));};
    if(!['GET','POST'].includes(req.method)){res.setHeader('Allow','GET, POST');return reply(405,{error:'Método no permitido.'});}
    const bearer=req.headers.authorization;
    if(!bearer?.startsWith('Bearer '))return reply(401,{error:'Inicia sesión en organización.'});
    try {
      const options={auth:{persistSession:false,autoRefreshToken:false}};
      const client=createClient(config.VITE_SUPABASE_URL,config.VITE_SUPABASE_PUBLISHABLE_KEY,{...options,global:{headers:{Authorization:bearer}}});
      const user=await client.auth.getUser(bearer.slice(7));
      if(user.error||!user.data.user)return reply(401,{error:'Tu sesión venció. Vuelve a entrar.'});
      const admin=await client.rpc('is_admin');
      if(admin.error||admin.data!==true)return reply(403,{error:'Solo la organización puede eliminar invitaciones.'});
      const service=createClient(config.VITE_SUPABASE_URL,config.SUPABASE_SERVICE_ROLE_KEY,options);
      if(req.method==='GET'){
        const jobs=await service.from('invitation_cleanup').select('invitation_id,recipient_name');
        if(jobs.error)throw jobs.error;
        return reply(200,{pending:jobs.data});
      }
      const input=await readInvitationBody(req);
      if(!/^[a-f0-9-]{36}$/.test(input.invitationId??''))return reply(400,{error:'Selecciona una invitación válida.'});
      const removed=await client.rpc('delete_birthday_invitation',{target:input.invitationId});
      if(removed.error)return reply(409,{error:'No se pudo eliminar la invitación. Actualiza el panel y vuelve a intentar.'});
      const job=await service.from('invitation_cleanup').select('*').eq('invitation_id',input.invitationId).maybeSingle();
      if(job.error)throw job.error;
      if(!job.data)return reply(200,{deleted:true,cleanupPending:false});
      try {
        const paths=job.data.storage_paths;
        for(let n=0;n<paths.length;n+=100){
          const storage=await service.storage.from('memories').remove(paths.slice(n,n+100));
          if(storage.error)throw storage.error;
        }
        if(job.data.wallet_serial){
          if(!config.WALLETWALLET_API_KEY)throw new Error('Wallet configuration missing');
          const wallet=await request(`https://api.walletwallet.dev/api/passes/${encodeURIComponent(job.data.wallet_serial)}`,{method:'DELETE',headers:{Authorization:`Bearer ${config.WALLETWALLET_API_KEY}`},signal:AbortSignal.timeout(15000)});
          if(!wallet.ok&&wallet.status!==404)throw new Error('Wallet revoke pending');
        }
        const finished=await service.from('invitation_cleanup').delete().eq('invitation_id',input.invitationId);
        if(finished.error)throw finished.error;
        return reply(200,{deleted:true,cleanupPending:false});
      }catch{return reply(200,{deleted:true,cleanupPending:true});}
    }catch{return reply(503,{error:'No pudimos completar la operación. Actualiza el panel para revisar su estado.'});}
  };
}
