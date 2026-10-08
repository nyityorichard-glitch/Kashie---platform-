const http=require('http');const fs=require('fs');const path=require('path');const crypto=require('crypto');
const PORT=Number(process.env.PORT||3000);const ROOT=__dirname;const PUBLIC=path.join(ROOT,'public');const DATA=path.join(ROOT,'data','db.json');
const sessions=new Map();
function uid(prefix){return `${prefix}-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`}
function now(){return new Date().toISOString()}
function hashPassword(p){const salt=crypto.randomBytes(16).toString('hex');return `${salt}:${crypto.scryptSync(p,salt,64).toString('hex')}`}
function verifyPassword(p,stored){try{const [salt,hash]=stored.split(':');const test=crypto.scryptSync(p,salt,64).toString('hex');return crypto.timingSafeEqual(Buffer.from(hash,'hex'),Buffer.from(test,'hex'))}catch{return false}}
function baseDb(){return {meta:{brand:'KASHIE',tagline:'THE TIME IS NOW',version:'1.0.0'},artists:[],buyers:[],artworks:[],orders:[],payments:[],commissions:[],exhibitions:[{id:'KSH-EXH-001',title:'KASHIE Emerging Artists Exhibition & Competition',institution:'Pilot Exhibition',location:'Nigeria',date:'2027-01-30',status:'UPCOMING',description:'A public exhibition where artists can exhibit, sell and compete at the same time.',sponsors:[]}],competitions:[{id:'KSH-COMP-001',exhibitionId:'KSH-EXH-001',title:'KASHIE Emerging Artist of the Year',status:'OPEN',criteria:['Concept','Creativity','Originality','Technical execution','Craftsmanship','Artistic expression']}],opportunities:[],certificates:[],inquiries:[],disputes:[],notifications:[],partners:[],sponsors:[],audit:[]}}
function load(){if(!fs.existsSync(DATA)){const db=baseDb();fs.writeFileSync(DATA,JSON.stringify(db,null,2));return db}try{return JSON.parse(fs.readFileSync(DATA,'utf8'))}catch{return baseDb()}}
let db=load();function save(){fs.writeFileSync(DATA,JSON.stringify(db,null,2))}
function audit(actor,action,entity,id,details={}){db.audit.push({id:uid('AUD'),at:now(),actor,action,entity,entityId:id,details});if(db.audit.length>5000)db.audit.shift()}
function send(res,status,data,headers={}){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...headers});res.end(JSON.stringify(data))}
function cookie(res,name,value,maxAge){res.setHeader('Set-Cookie',`${name}=${value}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge||86400};${process.env.NODE_ENV==='production'?' Secure;':''}`)}
function parseCookies(req){return Object.fromEntries((req.headers.cookie||'').split(';').filter(Boolean).map(x=>{const i=x.indexOf('=');return [x.slice(0,i).trim(),decodeURIComponent(x.slice(i+1))]}))}
function auth(req){const sid=parseCookies(req).ksh_session;return sid?sessions.get(sid):null}
function requireAuth(req,res,roles){const u=auth(req);if(!u){send(res,401,{error:'Authentication required'});return null}if(roles&&!roles.includes(u.role)){send(res,403,{error:'Insufficient permissions'});return null}return u}
function body(req){return new Promise((resolve,reject)=>{let b='';req.on('data',c=>{b+=c;if(b.length>2e6)req.destroy()});req.on('end',()=>{try{resolve(b?JSON.parse(b):{})}catch(e){reject(e)}});req.on('error',reject)})}
function publicDb(){return {meta:db.meta,artists:db.artists.filter(a=>a.status!=='SUSPENDED').map(({passwordHash,...a})=>a),artworks:db.artworks.filter(a=>['AVAILABLE','ON EXHIBITION','SOLD','NOT FOR SALE'].includes(a.status)).map(({...a})=>a),exhibitions:db.exhibitions,competitions:db.competitions,opportunities:db.opportunities,partners:db.partners,sponsors:db.sponsors}}
function safeUser(u){if(!u)return null;const {passwordHash,...x}=u;return x}
async function api(req,res){const url=new URL(req.url,`http://${req.headers.host}`);const p=url.pathname;const method=req.method;
 try{
  if(method==='GET'&&p==='/api/public/bootstrap')return send(res,200,publicDb());
  if(method==='GET'&&p==='/api/me')return send(res,200,{user:safeUser(auth(req))});
  if(method==='POST'&&p==='/api/auth/register'){
   const x=await body(req);if(!x.email||!x.password||!x.name)return send(res,400,{error:'Name, email and password are required'});
   const role=x.role==='buyer'?'buyer':'artist';const list=role==='artist'?db.artists:db.buyers;if(list.some(u=>u.email.toLowerCase()===x.email.toLowerCase()))return send(res,409,{error:'Email already registered'});
   const u={id:uid(role==='artist'?'KSH-ART':'KSH-BUY'),email:x.email.toLowerCase(),name:x.name,role,status:role==='artist'?'PENDING VERIFICATION':'ACTIVE',passwordHash:hashPassword(x.password),createdAt:now()};
   if(role==='artist')Object.assign(u,{school:x.school||'',dept:x.dept||'',level:x.level||'',location:x.location||'',specialization:x.specialization||'',bio:x.bio||'',statement:x.statement||'',verified:false,commissionAvailable:true,exhibitions:[],awards:[],skills:[],portfolio:[]});else Object.assign(u,{accountType:x.accountType||'INDIVIDUAL',location:x.location||'',interests:[],purchases:[]});
   list.push(u);audit(u.id,'REGISTER',role,u.id);save();const sid=crypto.randomBytes(32).toString('hex');sessions.set(sid,{...u});cookie(res,'ksh_session',sid,86400*7);return send(res,201,{user:safeUser(u)});
  }
  if(method==='POST'&&p==='/api/auth/login'){
   const x=await body(req);let u=null;
   if(x.role==='admin'){const email=(process.env.ADMIN_EMAIL||'admin@kashie.ng').toLowerCase();if(x.email?.toLowerCase()===email&&process.env.ADMIN_PASSWORD&&x.password===process.env.ADMIN_PASSWORD)u={id:'KSH-ADMIN-001',email,role:'admin',name:'KASHIE Administration',status:'ACTIVE'};else return send(res,401,{error:'Invalid administrator credentials'});
   } else {const list=x.role==='buyer'?db.buyers:db.artists;u=list.find(a=>a.email===String(x.email||'').toLowerCase());if(!u||!verifyPassword(x.password||'',u.passwordHash))return send(res,401,{error:'Invalid email or password'});if(u.status==='SUSPENDED')return send(res,403,{error:'Account suspended'});}
   const sid=crypto.randomBytes(32).toString('hex');sessions.set(sid,{...u});cookie(res,'ksh_session',sid,86400*7);audit(u.id,'LOGIN',u.role,u.id);save();return send(res,200,{user:safeUser(u)});
  }
  if(method==='POST'&&p==='/api/auth/logout'){const sid=parseCookies(req).ksh_session;sessions.delete(sid);cookie(res,'ksh_session','',0);return send(res,200,{ok:true})}
  if(method==='GET'&&p==='/api/artists')return send(res,200,{artists:publicDb().artists});
  if(method==='GET'&&p.startsWith('/api/artists/')){const id=p.split('/').pop();const a=db.artists.find(x=>x.id===id);if(!a)return send(res,404,{error:'Artist not found'});const works=db.artworks.filter(w=>w.artistId===id);return send(res,200,{artist:safeUser(a),artworks:works});}
  if(method==='GET'&&p.startsWith('/api/artworks/')){const id=p.split('/').pop();const a=db.artworks.find(x=>x.id===id);if(!a)return send(res,404,{error:'Artwork not found'});return send(res,200,{artwork:a,artist:safeUser(db.artists.find(x=>x.id===a.artistId))});}
  if(method==='POST'&&p==='/api/artworks'){
   const u=requireAuth(req,res,['artist']);if(!u)return;const x=await body(req);if(!x.title||!x.medium||!x.category)return send(res,400,{error:'Title, medium and category are required'});
   const a={id:uid('KSH-ARTWORK'),artistId:u.id,artist:u.name,title:x.title,category:x.category,medium:x.medium,dimensions:x.dimensions||'',weight:x.weight||'',year:x.year||new Date().getFullYear(),location:x.location||'',ownership:x.ownership||'ARTIST DECLARED',price:Number(x.price||0),status:'PENDING REVIEW',description:x.description||'',images:x.images||[],verified:false,qrPath:`/artwork/${encodeURIComponent(uid('KSH-QR'))}`,createdAt:now()};db.artworks.push(a);audit(u.id,'CREATE','artwork',a.id);save();return send(res,201,{artwork:a});
  }
  if(method==='POST'&&p==='/api/commissions'){
   const u=auth(req);const x=await body(req);if(!x.project||!x.type)return send(res,400,{error:'Project description and type are required'});const c={id:uid('KSH-COM'),clientId:u?.id||null,clientName:x.clientName||u?.name||'Public Client',email:x.email||u?.email||'',type:x.type,project:x.project,quantity:x.quantity||1,dimensions:x.dimensions||'',medium:x.medium||'',budget:Number(x.budget||0),deadline:x.deadline||'',location:x.location||'',installation:x.installation||'',description:x.description||'',status:'BRIEF RECEIVED',artistId:null,milestones:[],createdAt:now()};db.commissions.push(c);audit(u?.id||'PUBLIC','CREATE','commission',c.id);save();return send(res,201,{commission:c});
  }
  if(method==='POST'&&p==='/api/inquiries'){const x=await body(req);const i={id:uid('KSH-INQ'),artworkId:x.artworkId||'',name:x.name||'',email:x.email||'',message:x.message||'',status:'NEW',createdAt:now()};db.inquiries.push(i);save();return send(res,201,{inquiry:i});}
  if(method==='POST'&&p==='/api/orders'){
   const u=requireAuth(req,res,['buyer','admin']);if(!u)return;const x=await body(req);const a=db.artworks.find(w=>w.id===x.artworkId);if(!a)return send(res,404,{error:'Artwork not found'});if(a.status!=='AVAILABLE')return send(res,409,{error:'Artwork is not currently available'});const o={id:uid('KSH-ORD'),artworkId:a.id,artistId:a.artistId,buyerId:u.id,price:a.price,fee:Number(x.fee||0),total:a.price,status:'PAYMENT_PENDING',deliveryStatus:'PENDING',createdAt:now()};db.orders.push(o);a.status='RESERVED';save();return send(res,201,{order:o});
  }
  if(method==='POST'&&p==='/api/competition/entries'){
   const u=requireAuth(req,res,['artist']);if(!u)return;const x=await body(req);const a=db.artworks.find(w=>w.id===x.artworkId&&w.artistId===u.id);if(!a)return send(res,404,{error:'Your artwork was not found'});const c=db.competitions.find(c=>c.id===x.competitionId);if(!c)return send(res,404,{error:'Competition not found'});c.entries=c.entries||[];if(c.entries.some(e=>e.artistId===u.id&&e.artworkId===a.id))return send(res,409,{error:'Already entered'});const e={id:uid('KSH-ENTRY'),artistId:u.id,artworkId:a.id,status:'SUBMITTED',scores:{},createdAt:now()};c.entries.push(e);save();return send(res,201,{entry:e});}
  if(method==='POST'&&p==='/api/exhibitions/apply'){const u=requireAuth(req,res,['artist']);if(!u)return;const x=await body(req);const e=db.exhibitions.find(e=>e.id===x.exhibitionId);if(!e)return send(res,404,{error:'Exhibition not found'});e.applications=e.applications||[];const app={id:uid('KSH-EXAPP'),artistId:u.id,artworkIds:x.artworkIds||[],status:'SUBMITTED',createdAt:now()};e.applications.push(app);save();return send(res,201,{application:app});}
  if(method==='GET'&&p==='/api/admin/overview'){const u=requireAuth(req,res,['admin']);if(!u)return;return send(res,200,{artists:db.artists.length,pendingArtists:db.artists.filter(a=>a.status==='PENDING VERIFICATION').length,artworks:db.artworks.length,pendingArtworks:db.artworks.filter(a=>a.status==='PENDING REVIEW').length,commissions:db.commissions.length,orders:db.orders.length,exhibitions:db.exhibitions.length,disputes:db.disputes.length,audit:db.audit.slice(-20).reverse()});}
  if(method==='GET'&&p==='/api/admin/data'){const u=requireAuth(req,res,['admin']);if(!u)return;return send(res,200,db);}
  if(method==='POST'&&p.startsWith('/api/admin/')){
   const u=requireAuth(req,res,['admin']);if(!u)return;const parts=p.split('/');const action=parts[3];const id=parts[4];const x=await body(req);
   if(action==='artist'){const a=db.artists.find(a=>a.id===id);if(!a)return send(res,404,{error:'Artist not found'});if(x.status)a.status=x.status;if(typeof x.verified==='boolean')a.verified=x.verified;a.verificationNotes=x.notes||a.verificationNotes||'';audit(u.id,'UPDATE','artist',id,x);save();return send(res,200,{artist:safeUser(a)});}
   if(action==='artwork'){const a=db.artworks.find(a=>a.id===id);if(!a)return send(res,404,{error:'Artwork not found'});if(x.status)a.status=x.status;if(typeof x.verified==='boolean')a.verified=x.verified;a.reviewNotes=x.notes||a.reviewNotes||'';audit(u.id,'UPDATE','artwork',id,x);save();return send(res,200,{artwork:a});}
   if(action==='commission'){const c=db.commissions.find(c=>c.id===id);if(!c)return send(res,404,{error:'Commission not found'});Object.assign(c,x);audit(u.id,'UPDATE','commission',id,x);save();return send(res,200,{commission:c});}
   if(action==='order'){const o=db.orders.find(o=>o.id===id);if(!o)return send(res,404,{error:'Order not found'});Object.assign(o,x);if(x.status==='PAID'){const a=db.artworks.find(a=>a.id===o.artworkId);if(a)a.status='SOLD'}audit(u.id,'UPDATE','order',id,x);save();return send(res,200,{order:o});}
   if(action==='certificate'){const cert={id:uid('KSH-CERT'),type:x.type||'ARTWORK',recordId:x.recordId||'',number:uid('CERT'),status:'VALID',issuedAt:now(),issuedBy:u.id};db.certificates.push(cert);save();return send(res,201,{certificate:cert});}
   if(action==='dispute'){const d={id:uid('KSH-DISPUTE'),...x,status:'OPEN',createdAt:now()};db.disputes.push(d);save();return send(res,201,{dispute:d});}
  }
  return send(res,404,{error:'Not found'});
 }catch(e){console.error(e);return send(res,500,{error:'Server error'})}
}
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.svg':'image/svg+xml','.ico':'image/x-icon'};
function staticFile(req,res){let u=decodeURIComponent(new URL(req.url,`http://${req.headers.host}`).pathname);if(u==='/'||u==='/index.html')u='/index.html';const f=path.normalize(path.join(PUBLIC,u));if(!f.startsWith(PUBLIC)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){const index=path.join(PUBLIC,'index.html');res.writeHead(200,{'Content-Type':mime['.html']});return res.end(fs.readFileSync(index))}const ext=path.extname(f);res.writeHead(200,{'Content-Type':mime[ext]||'application/octet-stream','Cache-Control':ext===' .html'?'no-cache':'public, max-age=3600'});res.end(fs.readFileSync(f))}
const server=http.createServer((req,res)=>req.url.startsWith('/api/')?api(req,res):staticFile(req,res));server.listen(PORT,()=>console.log(`KASHIE running on http://localhost:${PORT}`));
