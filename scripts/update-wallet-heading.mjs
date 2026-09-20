import{readFileSync,writeFileSync,mkdirSync}from'node:fs';import{parseEnv}from'node:util';
import{createClient}from'@supabase/supabase-js';
import{unzipSync,strFromU8}from'fflate';
const env=parseEnv(readFileSync('.env','utf8'));
const db=createClient(env.VITE_SUPABASE_URL,env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const rows=await db.from('wallet_passes').select('invitation_id,serial_number,invitations!inner(active)').eq('status','ready').eq('invitations.active',true);
if(rows.error)throw new Error('Could not read active passes');
mkdirSync('.local/wallet-heading',{recursive:true});
const headers={Authorization:`Bearer ${env.WALLETWALLET_API_KEY}`,'Content-Type':'application/json'};
console.log('Active passes:',rows.data.length);
for(const row of rows.data){
  const response=await fetch(`https://api.walletwallet.dev/api/passes/${encodeURIComponent(row.serial_number)}`,{headers,signal:AbortSignal.timeout(15000)});
  console.log('Pass detail status:',response.status);
  if(response.ok){const data=await response.json();writeFileSync(`.local/wallet-heading/${row.serial_number}.json`,JSON.stringify(data));console.log('Detail keys:',Object.keys(data));}
  const download=await fetch(`https://api.walletwallet.dev/p/${encodeURIComponent(row.serial_number)}/apple.pkpass?v=${Date.now()}`,{signal:AbortSignal.timeout(15000)});
  if(!download.ok)throw new Error('Could not back up original pass');
  const bytes=new Uint8Array(await download.arrayBuffer());writeFileSync(`.local/wallet-heading/${row.serial_number}.pkpass`,bytes);
  const files=unzipSync(bytes),pass=JSON.parse(strFromU8(files['pass.json']));
  const style=pass.storeCard??pass.generic??pass.eventTicket;
  if(!style||!files['strip.png'])throw new Error('Unexpected design; review before updating');
  const image=name=>{const bytes=files[`${name}@3x.png`]??files[`${name}@2x.png`]??files[`${name}.png`];return 'data:image/png;base64,'+Buffer.from(bytes).toString('base64');};
  const fields=key=>(style[key]??[]).map(({label,value,changeMessage})=>({label,value,...(changeMessage?{changeMessage}:{})}));
  const barcode=pass.barcodes?.[0]??pass.barcode;
  const payload={logoText:'\u2060',organizationName:pass.organizationName,description:pass.description,color:'#071C54',
    wideLogoURL:image('logo'),stripURL:image('strip'),iconURL:image('icon'),sharingProhibited:true,
    primaryFields:fields('primaryFields'),secondaryFields:fields('secondaryFields'),headerFields:fields('headerFields'),backFields:fields('backFields'),
    barcodeValue:barcode.message,barcodeFormat:'QR',barcodeAltText:barcode.altText??'',
    expirationDays:Math.max(1,Math.ceil((Date.parse(pass.expirationDate)-Date.now())/86400000)),
  };
  if(!Number.isFinite(payload.expirationDays))throw new Error('Missing expiry');
  if(process.argv.includes('--apply')){
    const current=await db.from('invitations').select('id').eq('id',row.invitation_id).eq('active',true).maybeSingle();
    if(current.error||!current.data)throw new Error('Invitation changed during review');
    const updated=await fetch(`https://api.walletwallet.dev/api/passes/${encodeURIComponent(row.serial_number)}`,{method:'PUT',headers,body:JSON.stringify(payload),signal:AbortSignal.timeout(25000)});
    if(!updated.ok)throw new Error(`Update HTTP ${updated.status}: ${(await updated.text()).slice(0,250)}`);
    console.log('Heading removed; original fields and QR preserved.');
    const verify=await fetch(`https://api.walletwallet.dev/p/${encodeURIComponent(row.serial_number)}/apple.pkpass?v=${Date.now()}`);
    const result=JSON.parse(strFromU8(unzipSync(new Uint8Array(await verify.arrayBuffer()))['pass.json']));
    if((result.logoText??'').replaceAll('\u2060',''))throw new Error('Duplicate heading still present');
    if(JSON.stringify(result.storeCard?.secondaryFields??result.generic?.secondaryFields)!==JSON.stringify(style.secondaryFields))throw new Error('Guest fields changed');
    console.log('Downloaded pass verified: duplicate heading absent and guest fields unchanged.');
  }
}
