import {useEffect,useState} from 'react';
import {db,errorMessage} from './supabase';
import {enterPersonalInvitation} from './GuestForms';
export default function ArrivalButton({token}:{token:string|null}){
  const [saved,setSaved]=useState(false),[editing,setEditing]=useState(false),[busy,setBusy]=useState(true);
  const [adults,setAdults]=useState(1),[children,setChildren]=useState(0),[error,setError]=useState('');
  useEffect(()=>{
    let active=true;
    void(async()=>{try{
      if(token)await enterPersonalInvitation(token);
      const {data,error}=await db().rpc('get_my_arrival').maybeSingle();if(error)throw error;
      const arrival=data as {checked_in_at:string|null;checked_in_adults:number;checked_in_children:number}|null;
      if(active&&arrival?.checked_in_at){setSaved(true);setAdults(arrival.checked_in_adults);setChildren(arrival.checked_in_children);}
    }catch(e){if(active)setError(errorMessage(e));}finally{if(active)setBusy(false);}})();
    return()=>{active=false;};
  },[token]);
  return <section className="section" id="llegada" aria-label="Registrar llegada"><div className="card rsvp-form"><span className="eyebrow">¡LA FIESTA YA COMENZÓ!</span><h3>{saved&&!editing?'¡Tu llegada está registrada!':'¿Ya estás en la fiesta?'}</h3>
    {saved&&!editing?<><p>{adults} adultos y {children} niños. ¡Qué bueno celebrar contigo!</p><button className="button button-outline" onClick={()=>setEditing(true)}>Corregir cantidad</button></>:<form onSubmit={async e=>{e.preventDefault();setBusy(true);setError('');try{
      if(token)await enterPersonalInvitation(token);
      const {data,error}=await db().rpc('arrive_at_party',{actual_adults:adults,actual_children:children});
      if(error)throw error;if(!data)throw new Error('El registro está disponible durante la fiesta, de 15:30 a 19:00.');
      setSaved(true);setEditing(false);
    }catch(e){setError(errorMessage(e));}finally{setBusy(false);}}}>
      <p>Avísanos cuando llegues. Indica cuántos adultos y niños hay contigo.</p><fieldset disabled={busy}><div className="form-grid"><label>Adultos que llegaron<input type="number" min={1} max={20} required value={adults} onChange={e=>setAdults(Number(e.target.value))}/></label><label>Niños que llegaron<input type="number" min={0} max={20} required value={children} onChange={e=>setChildren(Number(e.target.value))}/></label></div><button className="button button-blue">{busy?'Preparando…':saved?'Actualizar cantidad':'¡Ya llegué a la fiesta!'}</button></fieldset>
    </form>}{error&&<p role="alert" className="form-error">{error}</p>}</div></section>;
}
