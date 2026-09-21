import {useEffect,useState} from 'react';
import {db,errorMessage} from './supabase';
type Arrival={id:string;recipient_name:string;checked_in_at:string;checked_in_adults:number;checked_in_children:number};
export default function ArrivalSummary(){
  const [rows,setRows]=useState<Arrival[]>([]),[error,setError]=useState('');
  useEffect(()=>{
    let active=true;
    async function refresh(){const {data,error}=await db().from('invitations').select('id,recipient_name,checked_in_at,checked_in_adults,checked_in_children').not('checked_in_at','is',null).order('checked_in_at',{ascending:false});if(!active)return;if(error)setError(errorMessage(error));else{setRows(data??[]);setError('');}}
    void refresh();const timer=setInterval(()=>void refresh(),30000);window.addEventListener('focus',refresh);window.addEventListener('invitations-changed',refresh);
    return()=>{active=false;clearInterval(timer);window.removeEventListener('focus',refresh);window.removeEventListener('invitations-changed',refresh);};
  },[]);
  const adults=rows.reduce((sum,r)=>sum+r.checked_in_adults,0),children=rows.reduce((sum,r)=>sum+r.checked_in_children,0);
  return <div className="card rsvp-table"><h3>Llegadas a la fiesta</h3><p><strong>{rows.length} familias · {adults+children} personas</strong> ({adults} adultos y {children} niños)</p><p className="form-note">Llegadas informadas por los invitados desde las 15:30 del 26 de septiembre. Se actualiza cada 30 segundos.</p>{rows.length>0&&<div className="table-scroll"><table><thead><tr><th>Familia</th><th>Adultos</th><th>Niños</th><th>Llegada</th></tr></thead><tbody>{rows.map(r=><tr key={r.id}><td>{r.recipient_name}</td><td>{r.checked_in_adults}</td><td>{r.checked_in_children}</td><td>{new Intl.DateTimeFormat('es-CL',{timeZone:'America/Santiago',hour:'2-digit',minute:'2-digit'}).format(new Date(r.checked_in_at))}</td></tr>)}</tbody></table></div>}{error&&<p role="alert" className="form-error">{error}</p>}</div>;
}
