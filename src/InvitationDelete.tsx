import {useEffect,useState} from 'react';
import {Trash2} from 'lucide-react';
import {db,errorMessage} from './supabase';

export type DeleteOutcome={name:string;cleanupPending:boolean};
async function request(invitationId?:string){
  const {data:{session}}=await db().auth.getSession();
  if(!session)throw new Error('Vuelve a entrar al panel.');
  const response=await fetch('/api/invitations/delete',{method:invitationId?'POST':'GET',headers:{Authorization:`Bearer ${session.access_token}`,'Content-Type':'application/json'},...(invitationId?{body:JSON.stringify({invitationId})}:{})});
  const data=await response.json();
  if(!response.ok)throw new Error(data.error||'No se pudo completar la eliminación.');
  return data as {pending?:{invitation_id:string;recipient_name:string}[];deleted?:boolean;cleanupPending?:boolean};
}
export function DeleteInvitation({id,name,confirmed,onDeleted,onError}:{id:string;name:string;confirmed:boolean;onDeleted:(outcome:DeleteOutcome)=>Promise<void>;onError:(message:string)=>void}){
  const [asking,setAsking]=useState(false);const [busy,setBusy]=useState(false);
  useEffect(()=>{
    if(!asking)return;
    const escape=(e:KeyboardEvent)=>{if(e.key==='Escape')setAsking(false);};
    window.addEventListener('keydown',escape);return()=>window.removeEventListener('keydown',escape);
  },[asking]);
  async function remove(){
    setBusy(true);
    try{const data=await request(id);setAsking(false);await onDeleted({name,cleanupPending:Boolean(data.cleanupPending)});}
    catch(e){onError(errorMessage(e));}
    finally{setBusy(false);window.dispatchEvent(new Event('invitation-cleanup'));}
  }
  return <><button className="button button-quiet button-remove" disabled={busy} aria-label={`Eliminar invitación de ${name}`} onClick={()=>setAsking(true)}><Trash2 size={15}/>Eliminar</button>
    {asking&&<div className="confirm-delete confirm-invitation" role="alertdialog" aria-modal="true" aria-labelledby="delete-invitation-title"><strong id="delete-invitation-title">¿Eliminar la invitación de {name}?</strong><p>{confirmed?'Se borrará su confirmación con las cantidades indicadas, ':'Se borrarán '}sus fotos, comentarios y reacciones. Su enlace y código dejarán de funcionar y se invalidará su pase Wallet.</p><small>Esta acción no se puede deshacer.</small><div className="button-row"><button className="button button-danger" disabled={busy} onClick={()=>void remove()}><Trash2 size={16}/>{busy?'Eliminando…':'Sí, eliminar'}</button><button className="button button-white" disabled={busy} onClick={()=>setAsking(false)}>Conservar</button></div></div>}</>;
}
export function InvitationCleanup(){
  const [pending,setPending]=useState<{invitation_id:string;recipient_name:string}[]>([]);
  const [error,setError]=useState('');const [busy,setBusy]=useState(false);
  async function refresh(){try{const data=await request();setPending(data.pending??[]);}catch(e){setError(errorMessage(e));}}
  useEffect(()=>{void refresh();const update=()=>void refresh();window.addEventListener('invitation-cleanup',update);return()=>window.removeEventListener('invitation-cleanup',update);},[]);
  return <>{error&&<p className="form-error" role="alert">{error}</p>}{pending.map(job=><div className="form-note" key={job.invitation_id}><p>La invitación de <strong>{job.recipient_name}</strong> ya no da acceso. Falta completar la eliminación de archivos o invalidar su pase Wallet.</p><button className="button button-outline" disabled={busy} onClick={async()=>{setBusy(true);setError('');try{await request(job.invitation_id);await refresh();}catch(e){setError(errorMessage(e));}finally{setBusy(false);}}}>Completar eliminación</button></div>)}</>;
}
