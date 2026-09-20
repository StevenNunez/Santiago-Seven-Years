import {useEffect,useState} from 'react';
import {Trash2} from 'lucide-react';
import {db,errorMessage} from './supabase';

async function request(invitationId?:string){
  const {data:{session}}=await db().auth.getSession();
  if(!session)throw new Error('Vuelve a entrar al panel.');
  const response=await fetch('/api/invitations/delete',{method:invitationId?'POST':'GET',headers:{Authorization:`Bearer ${session.access_token}`,'Content-Type':'application/json'},...(invitationId?{body:JSON.stringify({invitationId})}:{})});
  const data=await response.json();
  if(!response.ok)throw new Error(data.error||'No se pudo completar la eliminación.');
  return data;
}
export function DeleteInvitation({id,name,onDeleted}:{id:string;name:string;onDeleted:()=>Promise<void>}){
  const [busy,setBusy]=useState(false);const [error,setError]=useState('');
  async function remove(){
    if(!window.confirm(`¿Eliminar definitivamente la invitación de ${name}?\n\nSe borrarán su confirmación, fotos, comentarios y me gusta. Las fotos eliminadas perderán también los comentarios y reacciones de otras personas. Su enlace y código dejarán de funcionar y se solicitará invalidar su pase Wallet.\n\nEsta acción no se puede deshacer.`))return;
    setBusy(true);setError('');
    try{await request(id);window.dispatchEvent(new Event('invitation-cleanup'));await onDeleted();}
    catch(e){setError(errorMessage(e));window.dispatchEvent(new Event('invitation-cleanup'));}
    finally{setBusy(false);}
  }
  return <><button className="button button-danger" disabled={busy} aria-label={`Eliminar invitación de ${name}`} onClick={()=>void remove()}><Trash2 size={16}/>{busy?'Eliminando…':'Eliminar'}</button>{error&&<p role="alert" className="form-error">{error}</p>}</>;
}
export function InvitationCleanup(){
  const [pending,setPending]=useState<{invitation_id:string;recipient_name:string}[]>([]);
  const [error,setError]=useState('');const [busy,setBusy]=useState(false);
  async function refresh(){try{const data=await request();setPending(data.pending??[]);}catch(e){setError(errorMessage(e));}}
  useEffect(()=>{void refresh();const update=()=>void refresh();window.addEventListener('invitation-cleanup',update);return()=>window.removeEventListener('invitation-cleanup',update);},[]);
  return <>{error&&<p className="form-error" role="alert">{error}</p>}{pending.map(job=><div className="form-note" key={job.invitation_id}><p>La invitación de <strong>{job.recipient_name}</strong> ya no da acceso. Falta completar la eliminación de archivos o invalidar su pase Wallet.</p><button className="button button-outline" disabled={busy} onClick={async()=>{setBusy(true);setError('');try{await request(job.invitation_id);await refresh();}catch(e){setError(errorMessage(e));}finally{setBusy(false);}}}>Completar eliminación</button></div>)}</>;
}
