/* OsmaGym — estado, persistencia y motor de decisiones
 *
 * Aquí no se pinta nada. Todo lo que decide qué toca hoy, qué ejercicio entra,
 * cuánto peso y cuántas series vive en este fichero, para poder leerlo de
 * arriba abajo y entender por qué la app propone lo que propone.
 */

/* ============ ESTADO ============ */
var CLAVE='a47v1';
var DEF={
 perfil:{nombre:"",altura:178,peso0:81},
 cfg:{creado:null,padel:['mar','jue'],padelHora:"19:00",fuerza:['lun','vie'],verano:false,tabaco:true,
  descanso:[120,75],kcal:2300,prot:130,sustituye:{},movOff:[],movExtra:[]},
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
 comidas:[],           // diario de comida real [{f,h,t,plan}]
 platos:[],            // mis platos [{n,t}]
 desvios:[],notas:{comida:[]},
 regen:{},           // regeneraciones {fecha:{indiceDeHueco:idEjercicio}} de hoy y días futuros; se limpian al quedar en el pasado o al empezar semana nueva
 plan:{},            // ajustes automáticos de la semana por fecha, ver "REPLANIFICACIÓN DE LA SEMANA" más abajo
 push:null,
 coachLog:[],        // cambios que el Coach ha aplicado (o propuesto), ver COACH más abajo
 coachCfg:{codigo:'',auto:1,revisiones:{}}  // código del Coach, si aplica solo o propone, y última revisión automática por tipo de disparo
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
  if(!S.coachCfg)S.coachCfg=clon(DEF.coachCfg);
  Object.keys(DEF.coachCfg).forEach(function(k){if(S.coachCfg[k]===undefined)S.coachCfg[k]=clon(DEF.coachCfg[k])});
  if(!S.semana)S.semana=1;
  // Los desvíos de la versión anterior pasan al diario de comida como entradas fuera de plan.
  if(!S.migr1){S.migr1=1;var CD={cambio:'Cambié un plato',picoteo:'Piqué entre horas',fuera:'Comí fuera',salte:'Me salté una comida',alcohol:'Más de una cerveza'};
   (S.desvios||[]).forEach(function(d){S.comidas.push({f:d.f,h:'Otro',t:(CD[d.c]||d.c)+(d.t?': '+d.t:''),plan:0})});S.comidas.sort(function(a,b){return a.f<b.f?-1:1})}
  for(var k in S.ejCustom)LIB[k]=S.ejCustom[k];
  // La disposición diaria solo interesa 60 días: lo demás fuera, que el blob no engorde.
  var lim=diasAtras(60);Object.keys(S.hoy).forEach(function(f){if(f<lim)delete S.hoy[f]});
  // Las regeneraciones valen para hoy y para los días futuros de la semana; solo se olvidan al quedar en el pasado.
  if(!S.regen)S.regen={};var hoyR=hoyISO();Object.keys(S.regen).forEach(function(f){if(f<hoyR)delete S.regen[f]});
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
/* Lo que tocaría ese día según la configuración de Ajustes, sin mirar ajustes
   automáticos de la semana (ver REPLANIFICACIÓN más abajo). */
function tipoBase(dia,f){
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
/* Devuelve {tipo:'fuerza',k:'A'|'B'} | {tipo:'padel'} | {tipo:'movil'}.
   Si esa fecha tiene un ajuste automático de la semana (S.plan[f].tipo), manda
   sobre la configuración base: es lo que de verdad toca ese día. */
function queToca(dia,f){
 var ov=(S.plan||{})[f];
 if(ov&&ov.tipo)return {tipo:ov.tipo,k:ov.k};
 return tipoBase(dia,f);
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
 // Sustituciones permanentes elegidas en Entreno («usar siempre»); orig guarda el del plan
 out.orig=out.ej.slice();
 out.ej=out.ej.map(function(id){var x=S.cfg.sustituye&&S.cfg.sustituye[id];return (x&&LIB[x]&&disponible(x)&&out.ej.indexOf(x)<0)?x:id});
 if(!S.cfg.verano)EXTRA_PADEL.forEach(function(id){if(disponible(id))out.ej.push(id)});
 return out;
}
/* candidatos para sustituir un ejercicio de forma permanente: mismo patrón o su lista de alternativas */
function mismoPat(id,enSesion){var L=LIB[id];if(!L)return [];
 return Object.keys(LIB).filter(function(k){return k!==id&&(LIB[k].pat===L.pat||(L.alt||[]).indexOf(k)>=0)&&disponible(k)&&enSesion.indexOf(k)<0})}
/* ============ MÚSCULOS Y REGENERAR ============ */
/* grupos musculares de un ejercicio: los suyos propios, o por defecto los de su patrón
   (para ejercicios propios antiguos guardados antes de tener 'musculos'). */
function musculosDe(id){var L=LIB[id];if(!L)return [];
 if(L.musculos&&L.musculos.length)return L.musculos;
 return MUSC_POR_PAT[L.pat]||[];}
/* unión de grupos musculares (primario y secundarios) de una lista de ejercicios, en orden de aparición */
function musculosUnion(ids){var visto={},out=[];
 (ids||[]).forEach(function(id){musculosDe(id).forEach(function(m){if(!visto[m]){visto[m]=1;out.push(m)}})});
 return out;}
function musculosSesionTxt(ids){return musculosUnion(ids).map(function(m){return MUSC[m]||m}).join(', ')}
/* aplica las regeneraciones de hoy guardadas en S.regen sobre los huecos de la sesión del plan;
   no toca sustituciones permanentes (ya están aplicadas en s.ej) ni el "me duele" (vive en el borrador de la vista). */
function idsConRegen(s,f){var reg=(S.regen&&S.regen[f])||{};
 return s.ej.map(function(id,i){return (reg[i]!==undefined&&LIB[reg[i]]&&disponible(reg[i]))?reg[i]:id});}
/* candidatos para "regenerar": mismo patrón o mismo músculo primario, disponible con las reglas de siempre
   (material, articulaciones en fase mala, nivel desbloqueado), fuera de los huecos ya ocupados hoy en la sesión
   y sin los que hoy toca evitar por dolor (ajuste diario). Orden estable para poder ciclar. */
function candidatosRegen(id,enSesion,f){var L=LIB[id];if(!L)return [];
 var pri=musculosDe(id)[0];
 var swap=(ajustesDe(f||hoyISO()).swap)||{};
 return Object.keys(LIB).filter(function(k){
  if(k===id)return false;
  if((enSesion||[]).indexOf(k)>=0)return false;
  if(!disponible(k))return false;
  if(swap[k])return false;
  var M=LIB[k];
  return M.pat===L.pat||(pri&&musculosDe(k)[0]===pri);
 }).sort();}
/* movilidad: los pasos por defecto menos los desactivados, más los propios */
function rutinaMov(){var l=MOV.filter(function(m,i){return (S.cfg.movOff||[]).indexOf(i)<0});
 return l.concat((S.cfg.movExtra||[]).map(function(m){return {n:m.n,seg:m.seg||45,c:m.c||'',propio:1}}))}
function comidasDe(f){return S.comidas.filter(function(c){return c.f===f})}
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
 // huboPadel() mira los partidos REGISTRADOS en S.padel por fecha, sea o no un día
 // de pádel configurado: esta regla ya cubre partidos fuera de plan sin cambios.
 var padelAyer=d.padel!==undefined?!!d.padel:huboPadel(ayerDe(f));
 if(padelAyer){a.pierna-=1;a.carga=0.9;a.avisos.push('Pádel ayer: una serie menos de pierna y un 10% menos de carga en pierna.')}
 if(d.rod>=4){a.pierna-=1;a.carga=Math.min(a.carga,0.85);a.swap.step_up='ext_term';a.swap.zancada_inv='ext_term';
  a.avisos.push('Rodillas a '+d.rod+'/10: fuera el step-up, entra extensión terminal, y menos carga en pierna.')}
 if(d.rod>=7)a.avisos.push('Rodillas a '+d.rod+'/10 es un día de no cargar pierna. Haz solo tren superior y core, y si hay bloqueo o fallo con dolor, consulta.');
 if(d.sue!==undefined&&d.sue!==null&&d.sue<5){a.series-=1;a.avisos.push('Menos de 5 h dormidas: una serie menos en todo, mismos kilos.')}
 // Ajustes automáticos de la semana (replanSemana): cambio de ejercicio adelantado,
 // series de menos, y el motivo, visible aquí igual que cualquier otro aviso del día.
 var ov=(S.plan||{})[f];
 if(ov){
  if(ov.swap)for(var k in ov.swap)a.swap[k]=ov.swap[k];
  if(ov.series)a.series+=ov.series;
  if(ov.motivo)a.avisos.push(ov.motivo);
 }
 return a;
}
function seriesDe(id,f){var L=LIB[id],a=ajustesDe(f),n=L.s;
 if(esDeload())n=Math.max(2,n-1);
 n+=a.series;if(L.zona==='pierna')n+=a.pierna;
 // El Coach puede fijar un número de series concreto para un ejercicio y fecha
 // (ver COACH: ACCIONES más abajo); si lo hizo, manda sobre el resto de reglas.
 var ov=(S.plan||{})[f||hoyISO()];
 if(ov&&ov.seriesOverride&&ov.seriesOverride[id]!=null)return Math.max(1,ov.seriesOverride[id]);
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
 // Peso fijado a mano por el Coach para esta fecha (ver COACH: ACCIONES).
 var ov=(S.plan||{})[f||hoyISO()];
 if(ov&&ov.pesoOverride&&ov.pesoOverride[id]!=null){r.peso=ov.pesoOverride[id];r.txt+=" Peso ajustado por el Coach."}
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

/* ============ REPLANIFICACIÓN DE LA SEMANA ============
   Motor determinista. Cuando Osma registra algo fuera de plan un día concreto,
   el resto de la semana natural actual (fechas POSTERIORES a esa, sin sesión,
   partido ni movilidad registrados todavía) se ajusta solo. Cada ajuste vive en
   S.plan[fecha] = {tipo, k, swap, series, motivo, auto}, y queToca()/ajustesDe()
   ya lo tienen en cuenta en toda la app sin que las vistas sepan nada de esto.

   Disparadores (llamados desde app.js justo después de guardar) y qué hacen:
    · Fuerza fuera de plan un día que no tocaba (botón "Entrenar fuerza igualmente"
      en Entreno + guardar la sesión) -> si el día siguiente ya tocaba fuerza, ese
      día pasa a movilidad (dos días de fuerza seguidos no compensan) y SU sesión
      se mueve al primer hueco libre posterior de la semana con su misma letra;
      si no hay choque, consume el turno A/B: el siguiente día de fuerza que quede
      en la semana recibe la plantilla contraria a la que se acaba de hacer.
    · Un día de fuerza planificado que se queda sin registrar (ya pasó su fecha,
      se detecta en revisarDiasPerdidos, llamada tras cada guardado y al cargar)
      -> su sesión se mueve al primer hueco libre posterior de la semana.
    · Rodillas ≥4 en las preguntas del día o en el registro de Cuerpo -> las
      próximas sesiones de fuerza de la semana (sin registrar) entran ya con el
      mismo cambio de ejercicio de pierna que ajustesDe() aplicaría ese mismo día
      (step-up/zancada por extensión terminal), para no repetirlo sesión a sesión.
    · Menos de 5 h dormidas -> una serie menos también en lo que queda de semana,
      no solo hoy.
    · Partido de pádel no planificado -> la carga de pierna del día siguiente ya
      baja sola: ajustesDe()/huboPadel() miran el partido REGISTRADO, no si el día
      estaba configurado, así que la regla "pádel ayer" ya cubre partidos fuera de
      plan sin cambios aquí. Solo se revisan días de fuerza perdidos.
    · Movilidad extra un día que no tocaba movilidad -> no fatiga, así que no hay
      nada que reajustar; queda como disparador documentado, sin regla propia.

   Deshacer: restaurarSemana() borra los ajustes automáticos de la semana actual
   que aún no se hayan registrado (lo ya guardado no se toca nunca). Limpieza:
   cerrarSemana() (en app.js) vacía S.plan igual que ya vacía S.regen. */

/* fechas lunes-domingo de la semana natural que contiene f */
function semanaDe(f){
 var d=new Date(f+'T00:00:00'),off=(d.getDay()+6)%7,ini=new Date(d);ini.setDate(d.getDate()-off);
 var out=[];for(var i=0;i<7;i++){var x=new Date(ini);x.setDate(ini.getDate()+i);out.push(iso(x))}
 return out;
}
function mananaDe(f){var d=new Date(f+'T00:00:00');d.setDate(d.getDate()+1);return iso(d)}
/* true si esa fecha ya tiene algo guardado: sesión de fuerza, partido o movilidad */
function registrado(f){return !!sesDe(f)||padelDe(f)>=0||S.movil.indexOf(f)>=0}
function letraContraria(k){return k==='A'?'B':'A'}
/* última letra A/B jugada o ya planificada esta semana, hasta la fecha dada inclusive */
function ultimaLetraSemana(fecha){
 var dias=semanaDe(fecha).filter(function(f){return f<=fecha});
 for(var i=dias.length-1;i>=0;i--){
  var f=dias[i],r=sesDe(f);if(r)return r.s.k;
  var ov=(S.plan||{})[f];if(ov&&ov.k)return ov.k;
 }
 return null;
}
/* letra por defecto para una sesión de fuerza fuera de plan hoy: la contraria a la
   última jugada/planificada, o si no hay ninguna, la que tocaría por semana. */
function proximaLetraExtra(f){var u=ultimaLetraSemana(ayerDe(f));return u?letraContraria(u):(S.semana%2?'A':'B')}
function marcarPlan(f,cambios){
 S.plan=S.plan||{};var actual=S.plan[f]||{},out={};
 for(var k in actual)out[k]=actual[k];
 for(var k in cambios)out[k]=cambios[k];
 S.plan[f]=out;
}
/* mueve una sesión de fuerza (perdida, o desplazada por choque con otra) al primer
   día posterior de la semana, sin registrar todavía, que hoy por hoy no sea ya de
   fuerza. Devuelve la fecha destino, o null si la semana no tiene hueco. */
function moverSesionA(origenFecha,motivo,letra){
 var candidatos=semanaDe(origenFecha).filter(function(f){return f>origenFecha&&!registrado(f)});
 for(var i=0;i<candidatos.length;i++){
  var f=candidatos[i],dia=diaSemana(f),ov=(S.plan||{})[f]||{},tipoActual=ov.tipo||tipoBase(dia,f).tipo;
  if(tipoActual!=='fuerza'){
   marcarPlan(f,{tipo:'fuerza',k:letra||letraContraria(ultimaLetraSemana(f)||'B'),motivo:motivo,auto:1});
   return f;
  }
 }
 return null;
}
/* fuerza fuera de plan en `fecha` (ya guardada, con letra `letraHecha`): reajusta
   lo que queda de semana. Devuelve true si tocó algo. */
function replanTrasFuerzaExtra(fecha,letraHecha){
 var manana=mananaDe(fecha),dentroDeSemana=semanaDe(fecha).indexOf(manana)>=0,tocado=false;
 if(dentroDeSemana&&!registrado(manana)){
  var diaM=diaSemana(manana),ovM=(S.plan||{})[manana]||{},tipoM=ovM.tipo||tipoBase(diaM,manana).tipo;
  if(tipoM==='fuerza'){
   var letraDesplazada=ovM.k||tipoBase(diaM,manana).k;
   marcarPlan(manana,{tipo:'movil',motivo:'Ajustado porque el '+fmtF(fecha)+' hiciste fuerza fuera de plan: dos días de fuerza seguidos no compensan, hoy toca descanso.',auto:1});
   moverSesionA(manana,'Sesión movida aquí porque el '+fmtF(manana)+' pasó a descanso tras la fuerza extra del '+fmtF(fecha)+'.',letraDesplazada);
   tocado=true;
  }
 }
 if(!tocado){
  var siguientesFuerza=semanaDe(fecha).filter(function(f){
   if(f<=fecha||registrado(f))return false;
   var ov=(S.plan||{})[f]||{},tipo=ov.tipo||tipoBase(diaSemana(f),f).tipo;return tipo==='fuerza';
  });
  if(siguientesFuerza.length){
   var f0=siguientesFuerza[0],letra=letraContraria(letraHecha);
   marcarPlan(f0,{tipo:'fuerza',k:letra,motivo:'Ajustado porque el '+fmtF(fecha)+' hiciste fuerza fuera de plan: hoy toca la plantilla '+letra+'.',auto:1});
   tocado=true;
  }
 }
 return tocado;
}
/* aplica a las próximas sesiones de fuerza de la semana (sin registrar) un cambio
   de ejercicio, con motivo. Para dolor de rodilla alto. */
function replanSwap(fecha,motivo,swap){
 var tocado=false;
 semanaDe(fecha).forEach(function(f){
  if(f<=fecha||registrado(f))return;
  var ov=(S.plan||{})[f]||{},tipo=ov.tipo||tipoBase(diaSemana(f),f).tipo;if(tipo!=='fuerza')return;
  var swapNuevo={};for(var k in ov.swap)swapNuevo[k]=ov.swap[k];for(var k in swap)swapNuevo[k]=swap[k];
  marcarPlan(f,{swap:swapNuevo,motivo:(ov.motivo?ov.motivo+' ':'')+motivo,auto:1});
  tocado=true;
 });
 return tocado;
}
/* igual, pero para restar una serie (mal sueño) en vez de cambiar un ejercicio. */
function replanSeriesMenos(fecha,motivo){
 var tocado=false;
 semanaDe(fecha).forEach(function(f){
  if(f<=fecha||registrado(f))return;
  var ov=(S.plan||{})[f]||{},tipo=ov.tipo||tipoBase(diaSemana(f),f).tipo;if(tipo!=='fuerza')return;
  marcarPlan(f,{series:(ov.series||0)-1,motivo:(ov.motivo?ov.motivo+' ':'')+motivo,auto:1});
  tocado=true;
 });
 return tocado;
}
/* revisa si algún día de fuerza planificado de la semana actual, ya pasado, se
   quedó sin sesión, y mueve su turno al siguiente hueco libre. Idempotente: una
   vez revisado un día se marca "gestionado" para no repetir el intento cada vez
   (restaurarSemana lo borra, así que un día perdido puede volver a gestionarse
   tras deshacer). */
function revisarDiasPerdidos(){
 var hoy=hoyISO();S.plan=S.plan||{};
 semanaDe(hoy).filter(function(f){return f<hoy}).forEach(function(f){
  var dia=diaSemana(f);
  if(tipoBase(dia,f).tipo!=='fuerza')return;
  if(registrado(f))return;
  if(S.plan[f]&&S.plan[f].gestionado)return;
  moverSesionA(f,'Sesión movida aquí: el '+fmtF(f)+' tocaba fuerza y se quedó sin registrar.',tipoBase(dia,f).k);
  marcarPlan(f,{gestionado:1});
 });
}
/* Punto de entrada único desde las vistas: se llama justo después de guardar
   cualquier cosa que pueda ser "fuera de plan". Decide qué regla aplica (si
   alguna) y la ejecuta; siempre revisa además los días de fuerza perdidos.
   evento: 'fuerza_extra' | 'rodillas' | 'sueno' | 'cuerpo' | 'padel_extra' | 'movil_extra' | 'sesion'
   datos: según el evento. Devuelve true si tocó algo. */
function revisarReplan(fecha,evento,datos){
 datos=datos||{};S.plan=S.plan||{};
 var tocado=false;
 if(evento==='fuerza_extra')tocado=replanTrasFuerzaExtra(fecha,datos.k);
 else if(evento==='rodillas'&&datos.rod>=4)tocado=replanSwap(fecha,
  'Ajustado por rodillas a '+datos.rod+'/10 el '+fmtF(fecha)+': fuera el step-up, entra extensión terminal.',
  {step_up:'ext_term',zancada_inv:'ext_term'});
 else if(evento==='sueno'&&datos.sue!=null&&datos.sue<5)tocado=replanSeriesMenos(fecha,
  'Ajustado por poco sueño el '+fmtF(fecha)+' ('+datos.sue+' h): una serie menos también en lo que queda de semana.');
 else if(evento==='cuerpo'&&Math.max(datos.rodD||0,datos.rodI||0)>=4)tocado=replanSwap(fecha,
  'Ajustado por dolor de rodilla en el registro de Cuerpo del '+fmtF(fecha)+': fuera el step-up, entra extensión terminal.',
  {step_up:'ext_term',zancada_inv:'ext_term'});
 // 'padel_extra' y 'movil_extra' no tienen regla propia (ver comentario de cabecera).
 if(tocado)save();
 revisarDiasPerdidos();
 return tocado;
}
/* Deshace los ajustes automáticos de la semana actual que no se hayan registrado
   todavía (lo ya guardado —sesión, partido, movilidad— nunca se toca). */
function restaurarSemana(){
 var hoy=hoyISO(),tocado=false;
 semanaDe(hoy).forEach(function(f){
  if(S.plan&&S.plan[f]&&!registrado(f)){delete S.plan[f];tocado=true}
 });
 if(tocado)save();
 return tocado;
}

/* ============ COACH: ACCIONES ============
   El Coach (MiniMax, ver coach-core.js) puede responder con llamadas a
   herramientas; los nombres y argumentos están definidos ahí (TOOLS) y deben
   coincidir exactamente con los switch de aquí abajo. Cada coachX(input,aplicar)
   valida la acción contra las reglas reales del motor (el ejercicio existe y
   está disponible(), no se toca una fecha pasada ni ya registrada, en las
   semanas 1-4 no se sube carga, los rangos de comida son razonables...) y,
   solo si `aplicar` es true, la ejecuta y guarda. Con aplicar=false se hace la
   misma validación pero sin tocar nada: así "El Coach aplica cambios solo" en
   Ajustes puede estar apagado y las acciones válidas quedan como propuestas
   ("Aplicar" a mano) sin haber mutado el estado. Devuelven siempre
   {ok:1,detalle,deshacer} o {ok:0,motivo}. deshacer lleva lo necesario para
   revertir con coachDeshacerAccion(); null si no hay nada que deshacer. */

function coachSustituirEjercicio(input,aplicar){
 var orig=input.original_id,nuevo=input.nuevo_id,alcance=input.alcance;
 if(!LIB[orig])return {ok:0,motivo:'No existe el ejercicio "'+orig+'".'};
 if(!LIB[nuevo])return {ok:0,motivo:'No existe el ejercicio "'+nuevo+'".'};
 if(orig===nuevo)return {ok:0,motivo:'Origen y destino son el mismo ejercicio.'};
 if(!disponible(nuevo))return {ok:0,motivo:LIB[nuevo].n+' no está disponible ahora mismo (material, articulación o nivel).'};
 if(['permanente','solo_hoy','semana'].indexOf(alcance)<0)return {ok:0,motivo:'Alcance no reconocido: '+alcance};
 if(alcance==='permanente'){
  var previoP=S.cfg.sustituye[orig];
  if(aplicar){S.cfg.sustituye[orig]=nuevo;save()}
  return {ok:1,detalle:'Desde ahora, '+LIB[nuevo].n+' en lugar de '+LIB[orig].n+' en todas las sesiones.',
   deshacer:{tipo:'sustituir_permanente',orig:orig,previo:previoP}};
 }
 if(alcance==='solo_hoy'){
  var f=hoyISO(),dia=diaSemana(f),s=sesionDe(dia,f);
  if(!s)return {ok:0,motivo:'Hoy no toca una sesión de fuerza donde cambiar ese ejercicio.'};
  var ids=idsConRegen(s,f),idx=ids.indexOf(orig);
  if(idx<0)return {ok:0,motivo:LIB[orig].n+' no está en la sesión de hoy.'};
  var previoR=((S.regen||{})[f]||{})[idx];
  if(aplicar){S.regen=S.regen||{};S.regen[f]=S.regen[f]||{};S.regen[f][idx]=nuevo;save()}
  return {ok:1,detalle:LIB[nuevo].n+' en lugar de '+LIB[orig].n+' solo hoy.',
   deshacer:{tipo:'sustituir_hoy',fecha:f,idx:idx,previo:previoR}};
 }
 // alcance === 'semana'
 var hoy2=hoyISO(),fechas=[];
 semanaDe(hoy2).forEach(function(f2){
  if(f2<hoy2||registrado(f2))return;
  var s2=sesionDe(diaSemana(f2),f2);if(!s2)return;
  if(s2.ej.indexOf(orig)<0&&s2.orig.indexOf(orig)<0)return;
  fechas.push(f2);
  if(aplicar){var ov=(S.plan||{})[f2]||{},swapNuevo={};for(var k in ov.swap)swapNuevo[k]=ov.swap[k];swapNuevo[orig]=nuevo;marcarPlan(f2,{swap:swapNuevo})}
 });
 if(!fechas.length)return {ok:0,motivo:LIB[orig].n+' no aparece en ninguna sesión de fuerza que quede esta semana.'};
 if(aplicar)save();
 return {ok:1,detalle:LIB[nuevo].n+' en lugar de '+LIB[orig].n+' el resto de la semana ('+fechas.map(fmtF).join(', ')+').',
  deshacer:{tipo:'sustituir_semana',fechas:fechas,orig:orig}};
}
function coachAjustarEjercicio(input,aplicar){
 var id=input.ejercicio_id,f=input.fecha||hoyISO();
 if(!LIB[id])return {ok:0,motivo:'No existe el ejercicio "'+id+'".'};
 if(!/^\d{4}-\d{2}-\d{2}$/.test(f))return {ok:0,motivo:'Fecha no válida: '+f};
 if(f<hoyISO())return {ok:0,motivo:'No se puede tocar una fecha pasada.'};
 if(registrado(f))return {ok:0,motivo:'Esa fecha ya tiene algo registrado; no se toca lo guardado.'};
 if(!disponible(id))return {ok:0,motivo:LIB[id].n+' no está disponible ahora mismo.'};
 var detalle=[],pesoNuevo=null,seriesNuevo=null;
 if(input.peso_kg!=null){
  var actual=sugerir(id,f).peso;
  if(fase()===1&&Number(input.peso_kg)>actual)return {ok:0,motivo:'Semanas 1-4: no se puede subir carga, solo bajarla o mantenerla.'};
  pesoNuevo=Math.max(0,Number(input.peso_kg)||0);detalle.push('peso a '+pesoNuevo+' kg');
 }
 if(input.series!=null){
  var n=parseInt(input.series);if(!(n>=1&&n<=6))return {ok:0,motivo:'Número de series fuera de rango (1 a 6).'};
  seriesNuevo=n;detalle.push(n+' series');
 }
 if(!detalle.length)return {ok:0,motivo:'No se ha pedido ningún cambio de peso o series.'};
 var ov=(S.plan||{})[f]||{},previoPeso=ov.pesoOverride&&ov.pesoOverride[id],previoSeries=ov.seriesOverride&&ov.seriesOverride[id];
 if(aplicar){
  var pO={},sO={};for(var k in ov.pesoOverride)pO[k]=ov.pesoOverride[k];for(var k2 in ov.seriesOverride)sO[k2]=ov.seriesOverride[k2];
  if(pesoNuevo!=null)pO[id]=pesoNuevo;if(seriesNuevo!=null)sO[id]=seriesNuevo;
  marcarPlan(f,{pesoOverride:pO,seriesOverride:sO});save();
 }
 return {ok:1,detalle:LIB[id].n+' el '+fmtF(f)+': '+detalle.join(', ')+'.',
  deshacer:{tipo:'ajustar_ejercicio',fecha:f,id:id,previoPeso:previoPeso,previoSeries:previoSeries}};
}
function coachMarcarArticulacion(input,aplicar){
 var a=input.articulacion;
 if(!ARTIC[a])return {ok:0,motivo:'Articulación no reconocida: '+a};
 var previo=S.artic[a];
 if(aplicar){S.artic[a]=input.en_fase_mala?1:0;save()}
 return {ok:1,detalle:ARTIC[a]+(input.en_fase_mala?' marcada en fase mala.':' desmarcada.'),
  deshacer:{tipo:'marcar_articulacion',articulacion:a,previo:previo}};
}
function coachAjustarSemana(input,aplicar){
 var f=input.fecha,tipo=input.tipo,k=input.plantilla;
 if(!/^\d{4}-\d{2}-\d{2}$/.test(f))return {ok:0,motivo:'Fecha no válida: '+f};
 if(f<hoyISO())return {ok:0,motivo:'No se puede tocar una fecha pasada.'};
 if(registrado(f))return {ok:0,motivo:'Esa fecha ya tiene algo registrado; no se toca lo guardado.'};
 if(['fuerza','padel','movil'].indexOf(tipo)<0)return {ok:0,motivo:'Tipo no reconocido: '+tipo};
 if(tipo==='fuerza'&&['A','B'].indexOf(k)<0)k=proximaLetraExtra(f);
 var previo=(S.plan||{})[f]||null;
 if(aplicar){marcarPlan(f,{tipo:tipo,k:tipo==='fuerza'?k:undefined,motivo:input.motivo||('Ajustado por el Coach: '+fmtF(f)+' pasa a '+tipo+'.')});save()}
 return {ok:1,detalle:fmtF(f)+' pasa a '+(tipo==='fuerza'?'fuerza '+k:tipo)+'.',
  deshacer:{tipo:'ajustar_semana',fecha:f,previo:previo}};
}
function coachRegenerarSemana(input,aplicar){
 var hoy=hoyISO();
 var dias=semanaDe(hoy).filter(function(f){return f>=hoy&&!registrado(f)&&queToca(diaSemana(f),f).tipo==='fuerza'});
 if(!dias.length)return {ok:0,motivo:'No queda ninguna sesión de fuerza por regenerar esta semana.'};
 var resumen=[],deshacerRegen={};
 dias.forEach(function(f){
  var s=sesionDe(diaSemana(f),f);if(!s)return;
  var nuevos=s.ej.slice();
  s.ej.forEach(function(baseId,i){
   var otros=nuevos.filter(function(v,j){return j!==i});
   var cand=candidatosRegen(baseId,otros,f);
   if(cand.length)nuevos[i]=cand[0];
  });
  deshacerRegen[f]=((S.regen||{})[f])?clon(S.regen[f]):null;
  resumen.push(fmtF(f)+': '+musculosSesionTxt(nuevos));
  if(aplicar){S.regen=S.regen||{};S.regen[f]={};nuevos.forEach(function(id,i){if(id!==s.ej[i])S.regen[f][i]=id})}
 });
 if(aplicar)save();
 return {ok:1,detalle:'Semana regenerada. '+resumen.join(' · '),deshacer:{tipo:'regenerar_semana',regenPrevio:deshacerRegen}};
}
function coachAjustarObjetivosComida(input,aplicar){
 var previo={kcal:S.cfg.kcal,prot:S.cfg.prot},cambios=[],kcal=null,prot=null;
 if(input.kcal!=null){kcal=parseInt(input.kcal);if(!(kcal>=1200&&kcal<=4000))return {ok:0,motivo:'Kcal fuera de un rango razonable (1200-4000).'};cambios.push(kcal+' kcal')}
 if(input.proteina_g!=null){prot=parseInt(input.proteina_g);if(!(prot>=60&&prot<=250))return {ok:0,motivo:'Proteína fuera de un rango razonable (60-250 g).'};cambios.push(prot+' g proteína')}
 if(!cambios.length)return {ok:0,motivo:'No se ha pedido ningún cambio de objetivo.'};
 if(aplicar){if(kcal!=null)S.cfg.kcal=kcal;if(prot!=null)S.cfg.prot=prot;save()}
 return {ok:1,detalle:'Objetivo actualizado: '+cambios.join(', ')+'.',deshacer:{tipo:'ajustar_objetivos_comida',previo:previo}};
}
function coachAnadirNota(input){
 var t=(input.texto||'').trim();
 if(!t)return {ok:0,motivo:'Nota vacía.'};
 if(t.length>300)t=t.slice(0,300);
 return {ok:1,detalle:'Nota guardada: "'+t+'".',deshacer:null};
}
function coachProgramarDescarga(input,aplicar){
 if(esDeload())return {ok:0,motivo:'Esta semana ya es de descarga.'};
 var previo=S.descargaExtra;
 if(aplicar){S.descargaExtra=S.semana;save()}
 return {ok:1,detalle:'Semana '+S.semana+' pasa a descarga (85% y una serie menos).',deshacer:{tipo:'programar_descarga',previo:previo}};
}
/* Despachador único: nombre de herramienta tal como lo manda MiniMax (ver
   coach-core.js TOOLS) + su input. aplicar=false valida sin mutar nada. */
function coachAplicarAccion(nombre,input,aplicar){
 input=input||{};aplicar=aplicar!==false;
 switch(nombre){
  case 'sustituir_ejercicio':return coachSustituirEjercicio(input,aplicar);
  case 'ajustar_ejercicio':return coachAjustarEjercicio(input,aplicar);
  case 'marcar_articulacion':return coachMarcarArticulacion(input,aplicar);
  case 'ajustar_semana':return coachAjustarSemana(input,aplicar);
  case 'regenerar_semana':return coachRegenerarSemana(input,aplicar);
  case 'ajustar_objetivos_comida':return coachAjustarObjetivosComida(input,aplicar);
  case 'anadir_nota_plan':return coachAnadirNota(input);
  case 'programar_descarga':return coachProgramarDescarga(input,aplicar);
  default:return {ok:0,motivo:'Herramienta no reconocida: "'+nombre+'".'};
 }
}
/* Revierte una acción ya aplicada, a partir de lo que guardó su `deshacer`. */
function coachDeshacerAccion(d){
 if(!d)return;
 switch(d.tipo){
  case 'sustituir_permanente':
   if(d.previo)S.cfg.sustituye[d.orig]=d.previo;else delete S.cfg.sustituye[d.orig];break;
  case 'sustituir_hoy':
   S.regen=S.regen||{};S.regen[d.fecha]=S.regen[d.fecha]||{};
   if(d.previo!==undefined&&d.previo!=null)S.regen[d.fecha][d.idx]=d.previo;else delete S.regen[d.fecha][d.idx];break;
  case 'sustituir_semana':
   (d.fechas||[]).forEach(function(f){var ov=(S.plan||{})[f];if(ov&&ov.swap)delete ov.swap[d.orig]});break;
  case 'ajustar_ejercicio':
   var ov2=(S.plan||{})[d.fecha];if(ov2){
    if(ov2.pesoOverride){if(d.previoPeso!==undefined&&d.previoPeso!=null)ov2.pesoOverride[d.id]=d.previoPeso;else delete ov2.pesoOverride[d.id]}
    if(ov2.seriesOverride){if(d.previoSeries!==undefined&&d.previoSeries!=null)ov2.seriesOverride[d.id]=d.previoSeries;else delete ov2.seriesOverride[d.id]}
   }break;
  case 'marcar_articulacion':S.artic[d.articulacion]=d.previo?1:0;break;
  case 'ajustar_semana':
   S.plan=S.plan||{};if(d.previo)S.plan[d.fecha]=d.previo;else delete S.plan[d.fecha];break;
  case 'regenerar_semana':
   S.regen=S.regen||{};for(var f in d.regenPrevio){if(d.regenPrevio[f])S.regen[f]=d.regenPrevio[f];else delete S.regen[f]}break;
  case 'ajustar_objetivos_comida':S.cfg.kcal=d.previo.kcal;S.cfg.prot=d.previo.prot;break;
  case 'programar_descarga':S.descargaExtra=d.previo;break;
  default:break;
 }
 save();
}
