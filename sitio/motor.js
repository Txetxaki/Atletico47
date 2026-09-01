/* Atlético 47 — estado, persistencia y motor de decisiones
 *
 * Aquí no se pinta nada. Todo lo que decide qué toca hoy, qué ejercicio entra,
 * cuánto peso y cuántas series vive en este fichero, para poder leerlo de
 * arriba abajo y entender por qué la app propone lo que propone.
 */

/* ============ ESTADO ============ */
var CLAVE='a47v1';
var DEF={
 perfil:{nombre:"",altura:178,peso0:81},
 cfg:{creado:null,padel:['mar','jue'],fuerza:['lun','vie'],verano:false,tabaco:true},
 equipo:{barra:10,barraMan:2,kb:2,fijas:5,nFijas:2,
  discos:{"3":4,"2.5":4,"2":4,"1":4},
  tiene:{banco:1,torre:1,trx:1,banda:1,escalon:1,bici:1,paralelas:1,bosu:1,comba:1,saco:1,rodillo:1,rueda:1},custom:[]},
 artic:{rodD:0,rodI:0,cadera:0,munI:0,hombI:0,codoD:0},  // 1 = en fase mala: saca sus ejercicios
 ejCustom:{},
 semana:1,
 descargaExtra:0,      // semana a la que se ha adelantado una descarga por dolor
 hist:[],              // sesiones de fuerza [{f,s,sem,ej:[{id,peso,reps,rpe,nota,auto,cambio}],val,auto,listo}]
 padel:[],             // partidos [{f,min,int,rodD,rodI,codo,hielo,nota}]
 cuerpo:[],            // registro semanal [{f,peso,cint,rodD,rodI,mun,cad,sueN,sueS,cig,sis,dia,nota}]
 hoy:{},               // disposición diaria por fecha {f:{rod,sue,padel}}
 movil:[],             // fechas con la movilidad hecha
 desvios:[],notas:{comida:[]},
 push:null
};
var S=null,_ready=false;
function clon(x){return JSON.parse(JSON.stringify(x))}
function save(){if(!_ready)return;try{
 if(window.storage&&window.storage.set)window.storage.set(CLAVE,JSON.stringify(S)).catch(function(){});
 else localStorage.setItem(CLAVE,JSON.stringify(S));
}catch(e){}}
function load(cb){
 function done(raw){
  try{S=raw?JSON.parse(raw):null}catch(e){S=null}
  if(!S||!S.equipo){S=clon(DEF);S.cfg.creado=hoyISO()}
  Object.keys(DEF).forEach(function(k){if(S[k]===undefined)S[k]=clon(DEF[k])});
  ['discos','tiene','custom'].forEach(function(k){if(!S.equipo[k])S.equipo[k]=clon(DEF.equipo[k])});
  Object.keys(DEF.equipo.tiene).forEach(function(k){if(S.equipo.tiene[k]===undefined)S.equipo.tiene[k]=DEF.equipo.tiene[k]});
  Object.keys(DEF.cfg).forEach(function(k){if(S.cfg[k]===undefined)S.cfg[k]=clon(DEF.cfg[k])});
  Object.keys(DEF.artic).forEach(function(k){if(S.artic[k]===undefined)S.artic[k]=0});
  if(!S.semana)S.semana=1;
  for(var k in S.ejCustom)LIB[k]=S.ejCustom[k];
  // La disposición diaria solo interesa 60 días: lo demás fuera, que el blob no engorde.
  var lim=diasAtras(60);Object.keys(S.hoy).forEach(function(f){if(f<lim)delete S.hoy[f]});
  _ready=true;cb();
 }
 try{
  if(window.storage&&window.storage.get)window.storage.get(CLAVE).then(function(r){done(r&&r.value)}).catch(function(){done(null)});
  else done(localStorage.getItem(CLAVE));
 }catch(e){done(null)}
}

/* ============ FECHAS ============ */
function iso(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
function hoyISO(){return iso(new Date())}
function diasAtras(n){var d=new Date();d.setDate(d.getDate()-n);return iso(d)}
function diaSemana(f){return DIAS[(new Date(f+'T00:00:00').getDay()+6)%7]}   // 'lun'..'dom'
function ayerDe(f){var d=new Date(f+'T00:00:00');d.setDate(d.getDate()-1);return iso(d)}
function semanaNat(f){var d=new Date(f+'T00:00:00'),o=new Date(d.getFullYear(),0,1);
 return Math.ceil(((d-o)/86400000+o.getDay()+1)/7)}
function fmtF(f){return f.split('-').reverse().slice(0,2).join('/')}

/* ============ QUÉ TOCA CADA DÍA ============ */
/* Devuelve {tipo:'fuerza',k:'A'|'B'} | {tipo:'padel'} | {tipo:'movil'} */
function queToca(dia,f){
 var fz=S.cfg.fuerza||[];
 var i=fz.indexOf(dia);
 if(i>=0){
  // Un solo día de fuerza configurado: alterna A y B por semanas.
  var k=fz.length===1?(S.semana%2?'A':'B'):(i===0?'A':'B');
  return {tipo:'fuerza',k:k};
 }
 if(!S.cfg.verano&&(S.cfg.padel||[]).indexOf(dia)>=0)return {tipo:'padel'};
 return {tipo:'movil'};
}
function huboPadel(f){ // partido registrado o día de pádel configurado
 for(var i=0;i<S.padel.length;i++)if(S.padel[i].f===f)return true;
 return !S.cfg.verano&&(S.cfg.padel||[]).indexOf(diaSemana(f))>=0;
}

/* ============ DISPONIBILIDAD ============ */
function disponible(id){var e=LIB[id];if(!e)return false;
 var art=S.artic||{};
 if((e.evita||[]).some(function(a){return art[a]}))return false;
 if(!desbloqueado(id))return false;
 return (e.req||[]).every(function(r){
  if(r==='barra')return S.equipo.barra>0;
  if(r==='kb')return S.equipo.kb>0;
  if(S.equipo.tiene[r]!==undefined)return !!S.equipo.tiene[r];
  return S.equipo.custom.some(function(c){return c.id===r});});
}
/* nivel 2: desde la semana 6. nivel 3: desde la 13 y solo sin dolor articular >3 en las últimas 8 semanas. */
function desbloqueado(id){var e=LIB[id],n=e.nivel||1;
 if(n<=1)return true;
 if(n===2)return S.semana>=6;
 if(S.semana<13)return false;
 var lim=diasAtras(56);
 return !S.cuerpo.some(function(c){return c.f>=lim&&Math.max(c.rodD||0,c.rodI||0,c.cad||0)>3})
  &&!S.padel.some(function(p){return p.f>=lim&&Math.max(p.rodD||0,p.rodI||0)>3});
}
function bloque(){return Math.floor((S.semana-1)/4)}
function esDeload(){return S.semana%5===0||S.descargaExtra===S.semana}
function fase(){ // 1 tendones · 2 cargar · 3 abrir la puerta
 return S.semana<=4?1:(S.semana<13?2:3)}
function propiosDe(pat){var o=[];for(var k in S.ejCustom)if(S.ejCustom[k].pat===pat)o.push(k);return o}
function ejerDeSlot(sl){
 if(sl.fijo&&disponible(sl.fijo))return sl.fijo;
 var extra=propiosDe(sl.pat);
 if(sl.fijo){var alt=(sl.alt||[]).concat(extra).filter(disponible);return alt.length?alt[0]:null}
 var pool=(sl.rota||[]).concat(extra).filter(disponible);
 if(!pool.length)return null;
 return pool[bloque()%pool.length];
}
function sesionDe(dia,f){
 var q=queToca(dia,f);if(q.tipo!=='fuerza')return null;
 var t=TPL[q.k],out={n:t.n,s:t.s,k:q.k,ej:[]};
 t.slots.forEach(function(sl){var id=ejerDeSlot(sl);if(id&&LIB[id])out.ej.push(id);else out.falta=(out.falta||0)+1});
 if(!S.cfg.verano)EXTRA_PADEL.forEach(function(id){if(disponible(id))out.ej.push(id)});
 return out;
}
/* alternativa para el botón "me duele": primera de la lista alt que esté disponible y no esté ya en la sesión */
function alternativa(id,enSesion){
 var L=LIB[id];if(!L)return null;
 var c=(L.alt||[]).filter(function(a){return disponible(a)&&enSesion.indexOf(a)<0});
 return c.length?c[0]:null;
}

/* ============ DISPOSICIÓN DIARIA Y AJUSTES ============ */
function dispDe(f){return S.hoy[f]||null}
/* Devuelve cómo se recorta la sesión de hoy y por qué. */
function ajustesDe(f){
 var d=dispDe(f)||{},a={series:0,pierna:0,carga:1,swap:{},avisos:[]};
 var padelAyer=d.padel!==undefined?!!d.padel:huboPadel(ayerDe(f));
 if(padelAyer){a.pierna-=1;a.carga=0.9;a.avisos.push('Pádel ayer: una serie menos de pierna y un 10% menos de carga en pierna.')}
 if(d.rod>=4){a.pierna-=1;a.carga=Math.min(a.carga,0.85);a.swap.step_up='ext_term';a.swap.zancada_inv='ext_term';
  a.avisos.push('Rodillas a '+d.rod+'/10: fuera el step-up, entra extensión terminal, y menos carga en pierna.')}
 if(d.rod>=7)a.avisos.push('Rodillas a '+d.rod+'/10 es un día de no cargar pierna. Haz solo tren superior y core, y si hay bloqueo o fallo con dolor, consulta.');
 if(d.sue!==undefined&&d.sue!==null&&d.sue<5){a.series-=1;a.avisos.push('Menos de 5 h dormidas: una serie menos en todo, mismos kilos.')}
 return a;
}
function seriesDe(id,f){var L=LIB[id],a=ajustesDe(f),n=L.s;
 if(esDeload())n=Math.max(2,n-1);
 n+=a.series;if(L.zona==='pierna')n+=a.pierna;
 return Math.max(1,n);
}

/* ============ PROGRESIÓN ============ */
function sum(a){return a.reduce(function(x,y){return x+(y||0)},0)}
function histDe(id){var out=[];
 S.hist.slice().reverse().forEach(function(s){s.ej.forEach(function(e){if(e.id===id)out.push({f:s.f,e:e})})});
 return out;}
function sugerir(id,f){
 var L=LIB[id],h=histDe(id),a=ajustesDe(f||hoyISO());
 var esPierna=L.zona==='pierna',factor=esPierna?a.carga:1;
 var r;
 if(!h.length)r={peso:pesoInicial(id),txt:"Primera vez. Empieza cómodo, RPE 6: al acabar deberías poder hacer 4 repeticiones más. Hoy es para aprender el gesto, no para cargar.",nuevo:1};
 else{
  var u=h[0].e,reps=(u.reps||[]).filter(function(x){return x>0});
  var top=L.r[1],todas=reps.length>=L.s&&reps.every(function(x){return x>=top});
  var rpe=u.rpe||7;
  if(!reps.length)r={peso:u.peso,txt:"Sin repeticiones registradas la última vez. Repite el mismo peso.",nuevo:0};
  else if(esDeload())r={peso:redondea(u.peso*0.85,id),txt:"SEMANA DE DESCARGA. 85% del peso y una serie menos. Con seis horas de sueño fragmentado, esto no es opcional.",nuevo:0,deload:1};
  else if(L.tipo==='corporal'||L.tipo==='banda')r={peso:0,txt:todas?"Tope de repeticiones alcanzado. Sube el rango, añade una serie o pasa a la versión más difícil.":"Progresa sumando repeticiones o segundos, no kilos.",nuevo:0};
  else if(fase()===1&&todas)r={peso:u.peso,txt:"Llegaste al tope, pero estamos en las 4 semanas de tendones: mismo peso, técnica perfecta, RIR 4. Los kilos llegan en la semana 6.",nuevo:0};
  else if(todas&&rpe<=8)r={peso:redondea(u.peso+L.inc,id),txt:"Completaste "+reps.join('-')+" a RPE "+rpe+". Toca subir "+L.inc+" kg.",nuevo:1};
  else if(todas&&rpe>8)r={peso:u.peso,txt:"Tope de repeticiones pero a RPE "+rpe+", demasiado alto. Consolida el mismo peso una semana más.",nuevo:0};
  else if(h.length>=2&&h[1].e.peso===u.peso&&sum(reps)<=sum((h[1].e.reps||[]).filter(function(x){return x>0})))
   r={peso:redondea(u.peso*0.9,id),txt:"Dos sesiones sin mejorar. Baja un 10% y vuelve a construir: es más rápido que insistir.",nuevo:0,stall:1};
  else r={peso:u.peso,txt:"Mantén el peso y busca llegar a "+top+(L.seg?" segundos":" repeticiones")+" en todas las series.",nuevo:0};
 }
 if(factor<1&&r.peso>0){r.peso=redondea(r.peso*factor,id);r.txt+=" Hoy va al "+Math.round(factor*100)+"% por la disposición del día."}
 return r;
}
function pesoInicial(id){var L=LIB[id];
 if(L.tipo==='corporal'||L.tipo==='banda')return 0;
 if(L.ini===0)return 0;
 var obj=L.ini?L.ini:(L.tipo==='barra'?S.equipo.barra+4:(L.tipo==='kb'?S.equipo.kb+4:S.equipo.fijas));
 return redondea(obj,id);}
function redondea(p,id){var L=LIB[id];
 if(L.tipo==='corporal'||L.tipo==='banda')return 0;
 if(p<=0)return 0;
 var pos=posibles(id),mej=pos[0],dif=1e9;
 pos.forEach(function(v){var d=Math.abs(v-p);if(d<dif-0.001){dif=d;mej=v}});
 return mej;}
function posibles(id){var L=LIB[id],e=S.equipo;
 var lados=(L.tipo==='kb')?1:2;
 var barra=L.tipo==='barra'?e.barra:(L.tipo==='kb'?e.kb:e.barraMan);
 var porLado={};for(var k in e.discos)porLado[k]=Math.floor(e.discos[k]/(lados===2?2:1));
 var sums={0:1};
 Object.keys(porLado).forEach(function(k){
  var v=Number(k),n=porLado[k],nuevo={};
  Object.keys(sums).forEach(function(base){for(var i=0;i<=n;i++)nuevo[(Number(base)+v*i).toFixed(2)]=1});
  sums=nuevo;});
 var out=Object.keys(sums).map(function(x){return barra+Number(x)*lados});
 if(L.tipo==='mancuerna'&&e.nFijas>0)out.push(e.fijas);
 if(L.ini===0||L.ini===2)out.push(2); // sus mancuernas de 2 kg
 return out.filter(function(v,i,a){return a.indexOf(v)===i}).sort(function(a,b){return a-b});}
function discos(objetivo,id){
 var L=LIB[id];
 if(L.tipo==='corporal'||L.tipo==='banda')return "sin peso";
 if(!objetivo)return "sin peso, solo el gesto";
 if(L.tipo==='mancuerna'&&Math.abs(objetivo-2)<0.1)return "tus mancuernas de 2 kg";
 var barra=L.tipo==='barra'?S.equipo.barra:(L.tipo==='kb'?S.equipo.kb:S.equipo.barraMan);
 if(L.tipo==='mancuerna'&&Math.abs(objetivo-S.equipo.fijas)<0.6)return "mancuernas fijas de "+S.equipo.fijas+" kg";
 var lados=(L.tipo==='kb')?1:2;
 var porLado=(objetivo-barra)/lados;
 if(porLado<=0.4)return (L.tipo==='barra'?"barra sola":"barra corta sola")+" ("+barra+" kg)";
 var stock={},k;for(k in S.equipo.discos)stock[k]=Math.floor(S.equipo.discos[k]/(lados===2?2:1));
 var vals=Object.keys(stock).map(Number).sort(function(a,b){return b-a});
 var usa=[],resto=porLado;
 vals.forEach(function(v){while(resto>=v-0.01&&stock[String(v)]>0){usa.push(v);resto-=v;stock[String(v)]--}});
 if(!usa.length)return "no llegas con tus discos";
 var cuenta={};usa.forEach(function(v){cuenta[v]=(cuenta[v]||0)+1});
 var txt=Object.keys(cuenta).sort(function(a,b){return b-a}).map(function(v){return cuenta[v]+"×"+v+" kg"}).join(" + ");
 var real=barra+usa.reduce(function(a,b){return a+b},0)*lados;
 return txt+(lados===2?" por lado":"")+" → "+real.toFixed(1).replace('.0','')+" kg";
}

/* ============ ANALÍTICA ============ */
function porSemana(){var m={};
 S.hist.forEach(function(s){var w=s.sem||1;if(!m[w])m[w]={vol:0,ses:0,rpe:[],val:0};
  m[w].ses++;if(s.val)m[w].val++;
  s.ej.forEach(function(e){m[w].vol+=(e.peso||0)*sum(e.reps||[]);if(e.rpe)m[w].rpe.push(e.rpe)})});
 return m;}
function sesDe(f){for(var i=0;i<S.hist.length;i++)if(S.hist[i].f===f)return {i:i,s:S.hist[i]};return null}
function cuerpoUlt(){return S.cuerpo.length?S.cuerpo[S.cuerpo.length-1]:null}
function cuerpoDe(f){for(var i=0;i<S.cuerpo.length;i++)if(S.cuerpo[i].f===f)return i;return -1}
function padelDe(f){for(var i=0;i<S.padel.length;i++)if(S.padel[i].f===f)return i;return -1}
function rachaMovil(){ // días seguidos con movilidad hecha, contando hoy o ayer
 var set={};S.movil.forEach(function(f){set[f]=1});
 var d=new Date(),n=0;
 if(!set[iso(d)])d.setDate(d.getDate()-1);
 while(set[iso(d)]){n++;d.setDate(d.getDate()-1)}
 return n;}
function cargaSemana(){ // carga combinada de la semana natural actual
 var w=semanaNat(hoyISO()),fz=0,pm=0,pn=0;
 S.hist.forEach(function(s){if(semanaNat(s.f)===w)fz++});
 S.padel.forEach(function(p){if(semanaNat(p.f)===w){pn++;pm+=p.min||0}});
 return {fuerza:fz,partidos:pn,minutos:pm};
}

/* ============ ALERTAS ============
   Reglas duras y tendencias. Devuelve [{n:'r'|'w'|'',t:titulo,c:texto}]. */
function alertas(){
 var out=[],u=cuerpoUlt();
 if(u&&(u.sis>=180||u.dia>=110))out.push({n:'r',t:'No entrenes hoy',c:'Has apuntado '+u.sis+'/'+u.dia+'. Con 180/110 o más en reposo no se entrena: llama a tu médico. Si además hay dolor de pecho, falta de aire, visión borrosa o dolor de cabeza intenso, urgencias.'});
 else if(u&&(u.sis>=140||u.dia>=90))out.push({n:'w',t:'Tensión alta',c:'Última lectura '+u.sis+'/'+u.dia+'. Una lectura no es diagnóstico: repítela otro día, en reposo, y si sigue por encima de 140/90 coméntalo con tu médico. El entreno sigue igual.'});
 // Dolor articular subiendo dos semanas seguidas y la última ≥4: descarga adelantada.
 if(S.cuerpo.length>=3){
  var c=S.cuerpo.slice(-3),peor=function(x){return Math.max(x.rodD||0,x.rodI||0,x.cad||0,x.mun||0)};
  if(peor(c[2])>=4&&peor(c[2])>peor(c[1])&&peor(c[1])>peor(c[0])){
   if(S.descargaExtra!==S.semana&&!esDeload())out.push({n:'w',t:'Dolor en tendencia ascendente',c:'Tres registros seguidos con más dolor articular. Te propongo adelantar la descarga a esta semana: 85% y una serie menos.',accion:'descargaYa'});
  }
 }
 // Codo después del pádel: dos partidos seguidos con codo ≥4.
 if(S.padel.length>=2){var p=S.padel.slice(-2);
  if(p[0].codo>=4&&p[1].codo>=4)out.push({n:'w',t:'El codo avisa',c:'Dos partidos seguidos con el codo a 4 o más. Agarre a 6 de 10, excéntricos de muñeca en cada sesión, y revisa grip y peso de la pala. Si sube a 6, una semana sin pádel vale más que un mes de codo.'});
  if(p[1].rodD>=6||p[1].rodI>=6)out.push({n:'w',t:'Rodilla cargada tras el pádel',c:'Rodilla a '+Math.max(p[1].rodD||0,p[1].rodI||0)+'/10 después del último partido. Pierna ligera esta semana, y si se hincha o se bloquea, consulta.'});
 }
 var d=dispDe(hoyISO());
 if(d&&d.rod>=7)out.push({n:'r',t:'Rodillas a '+d.rod+'/10',c:'Hoy no se carga pierna. Tren superior y core, o descanso. Si hay bloqueo o fallo con dolor, esa rodilla la ve un traumatólogo antes que esta app.'});
 return out;
}
