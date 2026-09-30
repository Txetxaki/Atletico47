/* Atlético — piezas comunes a las apps de entreno (44 y 47)
 *
 *  1. Borrador persistente por jornada: lo que apuntas en una sesión se guarda
 *     al momento en S.borr, así que cerrar la app no lo pierde.
 *  2. «Hecho» por ejercicio: botón ✓ en cada tarjeta y estado de cada jornada
 *     (x/y hechos) visible desde Hoy, la tira de días y Progreso.
 *  3. Extras: texto o dictado con lo que has hecho de más. Se interpreta con la
 *     IA de la Pi si está disponible y, si no, con un intérprete local; cada
 *     cosa entendida se convierte en una tarjeta editable dentro de la sesión.
 *
 * Cada app define un objeto EX (al principio de su app.js) que traduce su
 * forma de nombrar las jornadas:
 *   EX.jor()            jornada abierta en Entreno ('lun'… o letra 'A'…)
 *   EX.clave(i,j)       clave del ejercicio i en el borrador de la jornada j
 *   EX.sesion(f)        sesión abierta en Entreno para la fecha f, o null
 *   EX.ids(s,f)         ejercicios efectivos de esa sesión (cambios, regeneraciones)
 *   EX.top(id)          repeticiones tope de un ejercicio
 *   EX.sesJor(j,f)      sesión de la jornada j en la fecha f, vista desde fuera
 *   EX.idsJor(s,f,j)    sus ejercicios vistos desde fuera
 *   EX.legado(r,f,j)    si un registro antiguo (sin r.jor) es de la jornada j
 *   EX.campos(b,sg)     campos propios de la app que se guardan con cada ejercicio
 *   EX.cabeceras()      cabeceras extra para /api/coach (código de acceso)
 *   EX.fecha()          opcional: fecha con la que trabaja Entreno (por defecto fechaSes o hoy)
 *   EX.coachUrl()       opcional: URL del Coach (por defecto /api/coach)
 * Además usa: S, LIB, borrador, fechaSes, save, esc, toast, hoyISO, iso, fmtF,
 * sesDe, seriesDe, sugerir, disponible, vTr, op.
 */

/* ============ 1. BORRADOR PERSISTENTE ============ */
var _tBorr=null;
function _fx(){return EX.fecha?EX.fecha():(fechaSes||hoyISO())}
function borrKey(){return (_fx())+'|'+EX.jor()}
function _hace(n){var d=new Date();d.setDate(d.getDate()-n);return iso(d)}
function borrVacio(b){return !Object.keys(b||{}).some(function(k){
 if(k==='_x')return (b._x||[]).length>0;var x=b[k];
 return x&&(x.hecho!==undefined||x.cambio||x.nota||x.rpe||x.peso!==undefined||(x.reps||[]).some(function(r){return r>0}))})}
/* Guarda el borrador con un pequeño retraso: escribir una serie no debe disparar
   una sincronización con la Pi por cada tecla. */
function guardarBorr(){clearTimeout(_tBorr);_tBorr=setTimeout(function(){
 S.borr=S.borr||{};var k=borrKey();
 if(borrVacio(borrador))delete S.borr[k];else S.borr[k]=borrador;
 var lim=_hace(21);Object.keys(S.borr).forEach(function(x){if(x.slice(0,10)<lim)delete S.borr[x]});
 save()},500)}
/* Al abrir una jornada: el borrador si lo hay; si no, lo que ya se guardó ese día
   (para ver qué se hizo y poder corregirlo); si no, vacío. */
function cargarBorr(){
 S.borr=S.borr||{};var k=borrKey();
 if(S.borr[k]){borrador=S.borr[k];return}
 borrador={};var f=_fx(),r=regDe(f,EX.jor());
 if(r)desdeRegistro(r,f);
}
function regDe(f,j){var r=sesDe(f);if(!r)return null;var s=r.s;
 return (s.jor!==undefined?s.jor===j:EX.legado(s,f,j))?s:null}
function desdeRegistro(reg,f){
 var s=EX.sesion(f),plan=s?s.ej:[],pos=0;
 (reg.ej||[]).forEach(function(e){
  if(e.extra){(borrador._x=borrador._x||[]).push({id:e.id,n:e.n||((LIB[e.id]||{}).n)||e.id,reps:(e.reps||[]).slice(),peso:e.peso||0,rpe:e.rpe||0,nota:e.nota||'',min:e.min||0,hecho:1});return}
  var i=e.i!==undefined?e.i:pos;pos++;
  if(i>=plan.length)return;
  var b={};Object.keys(e).forEach(function(k){if(['id','i','auto','extra'].indexOf(k)<0)b[k]=e[k]});
  b.reps=(e.reps||[]).slice();if(!b.cambio)delete b.cambio;b.hecho=1;borrador[EX.clave(i)]=b;
 });
}

/* ============ 2. HECHO POR EJERCICIO ============ */
function _llenas(b){return (b&&b.reps||[]).filter(function(r){return r>0}).length}
function hechoB(b,n){if(!b)return false;if(b.hecho===1)return true;if(b.hecho===0)return false;return n>0&&_llenas(b)>=n}
function hechoX(x){return !!(x&&x.hecho)}
function _fsesion(){var f=_fx();return {f:f,s:EX.sesion(f)}}
function marcarEj(elId,on){var e=document.getElementById(elId);if(!e)return;e.classList.toggle('done',!!on);
 var b=e.querySelector('.exok');if(b)b.setAttribute('aria-pressed',on?'true':'false');
 var t=e.querySelector('.exhecho');if(t)t.textContent=on?'Desmarcar':'Hecho';}
function toggleHecho(i){
 var x=_fsesion(),ids=x.s?EX.ids(x.s,x.f):[],b=bd(EX.clave(i)),n=seriesDe(ids[i],x.f),ya=hechoB(b,n);
 b.hecho=ya?0:1;guardarBorr();marcarEj('e'+i,!ya);progBar(x.s);
 if(!ya){toast('Hecho: '+LIB[ids[i]].n);siguientePendiente(i,ids,x)}
}
/* Al marcar uno, se cierra y se abre el siguiente que falte: el móvil en una mano,
   sin buscar. */
function siguientePendiente(i,ids,x){
 var e=document.getElementById('e'+i);if(e&&e.classList.contains('open'))op(i);
 for(var j=i+1;j<ids.length;j++){if(!hechoB(borrador[EX.clave(j)],seriesDe(ids[j],x.f))){var n=document.getElementById('e'+j);
  if(n&&!n.classList.contains('open')){op(j);n.scrollIntoView({behavior:'smooth',block:'start'})}return}}
}
/* Llamado tras escribir una serie: con todas las series puestas, el ejercicio
   cuenta como hecho sin tener que pulsar nada. */
function autoHecho(k){var i=typeof k==='number'?k:parseInt(String(k).replace(/^\D+/,'')),x=_fsesion();if(!x.s)return;
 var ids=EX.ids(x.s,x.f),b=bd(EX.clave(i)),n=seriesDe(ids[i],x.f);
 if(n>0&&_llenas(b)>=n)b.hecho=1;else if(b.hecho===1&&_llenas(b)>0&&_llenas(b)<n)delete b.hecho;
 marcarEj('e'+i,hechoB(b,n));}
function progBar(s){var f=_fx();s=EX.sesion(f);var ids=s?EX.ids(s,f):[],X=borrador._x||[],t=ids.length+X.length,d=0;
 ids.forEach(function(id,i){if(hechoB(borrador[EX.clave(i)],seriesDe(id,f)))d++});
 X.forEach(function(x){if(hechoX(x))d++});
 var p=document.getElementById('prog');if(p)p.style.width=(t?d/t*100:0)+'%';
 var w=document.getElementById('progTxt');if(w)w.textContent=t?d+' de '+t+' hechos':'';}
/* Estado de una jornada visto desde fuera: Hoy, la tira de días, el calendario. */
function estadoDia(k,f){
 var s=EX.sesJor(k,f),ids=s?EX.idsJor(s,f,k):[],b=(S.borr||{})[f+'|'+k],reg=regDe(f,k),o={tot:ids.length,hechos:0,m:[],xn:[],guardada:!!reg};
 if(b){
  ids.forEach(function(id,i){var ok=hechoB(b[EX.clave(i,k)],seriesDe(id,f));o.m[i]=ok;if(ok)o.hechos++});
  (b._x||[]).forEach(function(x){o.xn.push(x.n);o.tot++;if(hechoX(x))o.hechos++});
 } else if(reg){
  var pos=0,hechos={};
  (reg.ej||[]).forEach(function(e){if(e.extra){o.xn.push(e.n||((LIB[e.id]||{}).n)||e.id);o.tot++;o.hechos++;return}
   hechos[e.i!==undefined?e.i:pos]=1;pos++});
  ids.forEach(function(id,i){o.m[i]=!!hechos[i];if(hechos[i])o.hechos++});
 }
 return o;
}
function marcaDia(k,f){var e=estadoDia(k,f);
 if(e.guardada&&e.hechos>=e.tot&&e.tot)return '✓';
 if(e.hechos)return e.hechos+'/'+e.tot;
 return '';}
/* Lo que se guarda: planificados, extras y lo que quedó sin hacer.
   Regla: si no tocas nada, se asume el plan entero (como siempre). En cuanto
   marcas o apuntas algún ejercicio del plan, los que no marques quedan como
   «sin hacer». */
function construirEj(s,f){
 var ids=s?EX.ids(s,f):[],ej=[],omit=[],asumidos=0;
 var tocado=ids.some(function(id,i){var b=borrador[EX.clave(i)];return b&&(b.hecho!==undefined||_llenas(b)>0)});
 ids.forEach(function(id,i){
  var b=borrador[EX.clave(i)]||{},sg=sugerir(id,f),n=seriesDe(id,f),reps=(b.reps||[]).filter(function(r){return r>0}),auto=0;
  if(!reps.length){
   if(tocado&&!hechoB(b,n)){omit.push(id);return}
   for(var j=0;j<n;j++)reps.push(EX.top(id));
   if(!hechoB(b,n)){auto=1;asumidos++}
  }
  var e={id:id,i:i,peso:b.peso!==undefined?b.peso:sg.peso,reps:reps,rpe:b.rpe||7,nota:b.nota||'',auto:auto,cambio:b.cambio||null},extra=EX.campos(b,sg)||{};
  Object.keys(extra).forEach(function(k){e[k]=extra[k]});ej.push(e);
 });
 (borrador._x||[]).forEach(function(x){
  var reps=(x.reps||[]).filter(function(r){return r>0});
  if(!hechoX(x)&&!reps.length&&!x.min)return;
  var L=LIB[x.id];if(!reps.length&&L&&!x.min){var n=L.s||3;for(var j=0;j<n;j++)reps.push(EX.top(x.id))}
  ej.push({id:x.id,n:x.n,peso:x.peso||0,reps:reps,rpe:x.rpe||7,nota:x.nota||'',min:x.min||0,extra:1,auto:0});
 });
 return {ej:ej,omit:omit,asumidos:asumidos};
}
function resumenGuardado(c,f){
 var dia=(f===hoyISO())?'hoy':'el '+fmtF(f),pl=c.ej.filter(function(e){return !e.extra}).length,ex=c.ej.length-pl;
 if(c.asumidos&&c.asumidos===pl&&!ex)return 'Guardada tal cual '+dia+': '+pl+' ejercicios al plan';
 var p=[];if(pl)p.push(pl+' hechos');if(c.omit.length)p.push(c.omit.length+' sin hacer');if(ex)p.push(ex+' extra');if(c.asumidos)p.push(c.asumidos+' asumidos');
 return 'Guardada '+dia+': '+p.join(', ');
}
function nombreEj(e){var L=LIB[e.id];return (L?L.n:(e.n||e.id))}
function lineaEj(e){return nombreEj(e)+(e.extra?' [extra]':'')+': '+(e.min?e.min+' min':(e.peso?e.peso+' kg × ':'')+(e.reps||[]).join('-')+' (RPE '+e.rpe+')')}

/* ============ 3. EXTRAS: TEXTO O DICTADO ============ */
function extrasHTML(libre){
 var X=borrador._x||[],o='';
 o+=X.map(extraCard).join('');
 o+='<h3 class="sec">Algo más</h3><div class="eq" style="padding:14px 16px">'
 +'<p class="sub" style="margin-bottom:10px">¿Día con energía? Escribe o dicta lo que has hecho de más y lo reparto en ejercicios. Separa con comas: <i>3x12 curl con 8 kilos, 2 series de 5 dominadas, 15 minutos de comba</i>.</p>'
 +'<div class="row"><input class="nota" id="xTxt" placeholder="Qué has hecho de más" style="flex:1;min-width:180px" onkeydown="if(event.key===\'Enter\')interpretarExtra()"></div>'
 +'<div class="row"><button class="btn sm" id="xBtn" onclick="interpretarExtra()">Añadir</button><button class="btn gh sm" id="xMic" onclick="dictar()">Dictar</button>'
 +'<select class="inp" style="flex:1;min-width:150px" onchange="addDeLib(this.value);this.value=\'\'"><option value="">o elige de la lista…</option>'
 +Object.keys(LIB).filter(disponible).sort(function(a,b){return LIB[a].n.localeCompare(LIB[b].n)}).map(function(k){return '<option value="'+k+'">'+esc(LIB[k].n)+'</option>'}).join('')+'</select></div></div>';
 if(libre)o+='<div class="row"><button class="btn" onclick="guardarSesion()"'+(X.length?'':' disabled')+'>Guardar lo extra</button><span class="mkcal" id="progTxt"></span></div>';
 return o;
}
function extraCard(x,j){
 var L=LIB[x.id],nS=x.min?0:Math.max((x.reps||[]).length,1),sets='',h=hechoX(x);
 for(var k=0;k<nS;k++){var v=(x.reps&&x.reps[k])||'';sets+='<div class="serie'+(v?' ok':'')+'"><label>S'+(k+1)+'</label><input type="text" inputmode="numeric" placeholder="'+(L&&L.seg?'seg':'reps')+'" value="'+v+'" oninput="setRepX('+j+','+k+',this.value)"></div>'}
 var r=(x.reps||[]).filter(function(v){return v>0}),resumen=x.min?x.min+' min':(r.length?r.length+'×'+(r.every(function(v){return v===r[0]})?r[0]:r.join('-')):'');
 return '<article class="ex'+(h?' done':'')+'" id="x'+j+'"><div class="exrow"><button class="exok" onclick="toggleHechoX('+j+')" aria-label="Marcar hecho" aria-pressed="'+h+'">✓</button>'
 +'<button class="exhd" onclick="opX('+j+')" aria-expanded="false"><span class="num">+</span><span class="name">'+esc(x.n)+'<span class="chip">extra</span></span>'
 +'<span class="kgb"><b>'+(x.peso?x.peso+' kg':(x.min?'tiempo':'—'))+'</b><span>'+resumen+'</span></span><span class="chev">▶</span></button></div>'
 +'<div class="body">'+(L?'<p class="cue">'+esc(L.c)+'</p>':'')
 +(x.min?'':'<div class="slab">Series</div><div class="sets">'+sets+'<button class="rest-btn" onclick="addSerieX('+j+')">+ serie</button></div>')
 +'<div class="row"><label>Peso</label><input class="inp" style="width:78px" type="text" inputmode="decimal" placeholder="kg" value="'+(x.peso||'')+'" oninput="setX('+j+',\'peso\',parseFloat(this.value)||0)">'
 +'<label>Minutos</label><input class="inp" style="width:64px" type="text" inputmode="numeric" value="'+(x.min||'')+'" onchange="setX('+j+',\'min\',parseInt(this.value)||0);vTr()"></div>'
 +'<input class="nota" placeholder="Nota" value="'+esc(x.nota||'')+'" oninput="setX('+j+',\'nota\',this.value)">'
 +'<div class="row" style="margin-top:10px"><button class="btn sm exhecho" onclick="toggleHechoX('+j+')">'+(h?'Desmarcar':'Hecho')+'</button><button class="btn gh sm rojo" onclick="delX('+j+')">Quitar</button></div>'
 +'</div></article>';
}
/* Acordeón: al abrir una tarjeta se cierra la que estuviera abierta. Se
   compensa el scroll para que la tarjeta tocada no salte si la que se cierra
   está por encima. */
function cerrarOtros(el){
 var antes=el.getBoundingClientRect().top;
 document.querySelectorAll('.ex.open').forEach(function(x){if(x===el)return;x.classList.remove('open');var h=x.querySelector('.exhd');if(h)h.setAttribute('aria-expanded','false')});
 var d=el.getBoundingClientRect().top-antes;if(d)window.scrollBy(0,d);
}
function _X(){return borrador._x=borrador._x||[]}
function opX(j){var e=document.getElementById('x'+j);if(!e)return;if(!e.classList.contains('open'))cerrarOtros(e);var o=e.classList.toggle('open');e.querySelector('.exhd').setAttribute('aria-expanded',o)}
function setRepX(j,k,v){var x=_X()[j];x.reps=x.reps||[];x.reps[k]=parseInt(v)||0;if(parseInt(v))x.hecho=1;guardarBorr();marcarEj('x'+j,hechoX(x));progBar(_fsesion().s)}
function addSerieX(j){var x=_X()[j];x.reps=x.reps||[];x.reps.push(x.reps.length?x.reps[x.reps.length-1]:0);guardarBorr();vTr();setTimeout(function(){opX(j)},30)}
function setX(j,campo,v){_X()[j][campo]=v;guardarBorr()}
function toggleHechoX(j){var x=_X()[j];x.hecho=hechoX(x)?0:1;guardarBorr();marcarEj('x'+j,x.hecho);progBar(_fsesion().s)}
function delX(j){_X().splice(j,1);guardarBorr();vTr()}
function addDeLib(id){if(!id||!LIB[id])return;var L=LIB[id],sg=sugerir(id,_fx());
 _X().push({id:id,n:L.n,reps:[],peso:sg.peso||0,rpe:0,nota:'',min:0,hecho:0});guardarBorr();vTr();
 var j=_X().length-1;setTimeout(function(){opX(j);var e=document.getElementById('x'+j);if(e)e.scrollIntoView({behavior:'smooth',block:'center'})},40);
 toast(L.n+' añadido. Apunta las series y márcalo hecho.')}

/* ---- dictado: la voz se transcribe en el propio móvil, no se guarda audio ---- */
var _rec=null;
function dictar(){
 var SR=window.SpeechRecognition||window.webkitSpeechRecognition,b=document.getElementById('xMic'),t=document.getElementById('xTxt');
 if(!SR){toast('Aquí no puedo dictar. Usa el micrófono del teclado del móvil.',1);if(t)t.focus();return}
 if(_rec){_rec.stop();return}
 var base=t.value;_rec=new SR();_rec.lang='es-ES';_rec.interimResults=true;_rec.continuous=true;
 _rec.onresult=function(e){var s='';for(var i=0;i<e.results.length;i++)s+=e.results[i][0].transcript;t.value=(base?base+', ':'')+s.trim()};
 _rec.onerror=function(e){if(e.error!=='aborted'&&e.error!=='no-speech')toast('No se pudo dictar ('+e.error+'). Prueba el micrófono del teclado.',1)};
 _rec.onend=function(){_rec=null;var bb=document.getElementById('xMic');if(bb){bb.textContent='Dictar';bb.classList.remove('rec')}};
 try{_rec.start();b.textContent='Parar';b.classList.add('rec')}catch(e){_rec=null;toast('No se pudo empezar a dictar',1)}
}

/* ---- intérprete ---- */
function norm(t){return String(t||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'')}
var NUMP={un:1,una:1,uno:1,dos:2,tres:3,cuatro:4,cinco:5,seis:6,siete:7,ocho:8,nueve:9,diez:10,once:11,doce:12,trece:13,catorce:14,quince:15,dieciseis:16,veinte:20,veinticinco:25,treinta:30,cuarenta:40,cincuenta:50,sesenta:60,cien:100,media:0.5,medio:0.5};
var VACIAS={con:1,de:1,del:1,la:1,el:1,los:1,las:1,en:1,al:1,a:1,y:1,e:1,por:1,para:1,sobre:1,mano:1,manos:1,cada:1,lado:1,pierna:1,brazo:1,series:1,serie:1,repeticiones:1,repeticion:1,reps:1,rep:1,veces:1,vez:1,kilos:1,kilo:1,kg:1,minutos:1,minuto:1,min:1,segundos:1,segundo:1,seg:1,hice:1,hecho:1,he:1,hoy:1,ademas:1,tambien:1,luego:1,despues:1,mas:1,otro:1,otra:1,otros:1,otras:1,rato:1,un:1,una:1,uno:1,unos:1,unas:1,km:1,kilometros:1,x:1,tecnica:1};
var ALIAS={'hip thrust':'puente','peso muerto':'pm_rumano','pull up':'dominadas','dips':'fondos','flexiones':'flex_nud','lagartijas':'flex_nud','plancha lateral':'plancha_lat','face pull':'face_pull','dead bug':'dead_bug','granjero':'granjero'};
function _raiz(w){return w.length>4?w.replace(/(es|s)$/,''):w}
function _palabras(t){return norm(t).split(/[^a-z0-9ñ]+/).filter(function(w){return w&&!VACIAS[w]&&!/^\d/.test(w)&&w.length>1})}
function buscarEj(txt){
 var t=norm(txt),mejor=null,pts=0,rat=0,al=Object.keys(ALIAS);
 for(var a=0;a<al.length;a++){if(t.indexOf(al[a])<0)continue;var id=ALIAS[al[a]];
  var cand=LIB[id]?id:Object.keys(LIB).filter(function(k){return k.indexOf(id)===0})[0];if(cand)return cand}
 var pal=_palabras(txt).map(_raiz);if(!pal.length)return null;
 Object.keys(LIB).forEach(function(k){
  var w=_palabras(LIB[k].n).map(_raiz),m=pal.filter(function(p){return w.indexOf(p)>=0}).length;if(!m)return;
  var r=m/w.length+(disponible(k)?0.01:0);
  if(m>pts||(m===pts&&r>rat)){pts=m;rat=r;mejor=k}
 });
 return mejor;
}
function _num(s){return parseFloat(String(s).replace(',','.'))}
function interpretarLocal(texto){
 var t=norm(texto).replace(/\b([a-z]+)\b/g,function(w){return NUMP[w]!==undefined&&!/^(un|una|uno)$/.test(w)?String(NUMP[w]):w});
 var trozos=t.split(/[,;\n]|\.\s|\s(?:luego|despues|ademas|tambien)\s|\sy\s(?=\d)/).map(function(x){return x.trim()}).filter(Boolean);
 var out=[];
 trozos.forEach(function(c){
  var s=null,r=null,kg=null,min=null,seg=null,m;
  if((m=c.match(/(\d+)\s*(?:x|×|\*|por)\s*(\d+)/))){s=+m[1];r=+m[2];c=c.replace(m[0],' ')}
  if((m=c.match(/(\d+(?:[.,]\d+)?)\s*(?:kg|kilos?|k)\b/))){kg=_num(m[1]);c=c.replace(m[0],' ')}
  if((m=c.match(/(\d+(?:[.,]\d+)?)\s*(?:min|minutos?)\b/))){min=Math.round(_num(m[1]));c=c.replace(m[0],' ')}
  if((m=c.match(/(\d+)\s*(?:s|seg|segundos?)\b/))){seg=+m[1];c=c.replace(m[0],' ')}
  if(s===null&&(m=c.match(/(\d+)\s*series?/))){s=+m[1];c=c.replace(m[0],' ')}
  if(r===null&&(m=c.match(/(\d+)\s*(?:repeticiones|reps?|veces)/))){r=+m[1];c=c.replace(m[0],' ')}
  if(r===null&&(m=c.match(/\b(\d+)\b/))){r=+m[1];c=c.replace(m[0],' ')}
  var km=(texto.match(/(\d+(?:[.,]\d+)?)\s*(?:km|kilometros?)/i)||[])[0];
  var id=buscarEj(c),nombre=_palabras(c).join(' ');
  if(!id&&!nombre)return;
  var L=LIB[id],reps=[];
  if(L&&L.seg&&seg)r=seg;
  if(r!==null&&!min){for(var i=0;i<(s||1);i++)reps.push(r)}
  else if(s&&L&&!min){for(var k=0;k<s;k++)reps.push(EX.top(id))}
  if(!min&&seg&&!(L&&L.seg))min=Math.max(1,Math.round(seg/60));
  out.push({id:id||('x:'+nombre.replace(/[^a-z0-9]+/g,'_').slice(0,24)),n:L?L.n:nombre.charAt(0).toUpperCase()+nombre.slice(1),reps:reps,peso:kg||0,rpe:0,nota:km&&!L?km:'',min:min||0,hecho:1});
 });
 return out;
}
function interpretarIA(texto){
 var lista=Object.keys(LIB).filter(disponible).map(function(k){return k+': '+LIB[k].n}).join('\n');
 var p='Convierte en ejercicios lo que describe este texto de un entrenamiento que ya se ha hecho. Responde SOLO con un array JSON, sin texto alrededor. '
 +'Cada elemento: {"id": id de la LISTA o null, "n": nombre corto en español, "series": número o null, "reps": número o null (segundos si es isométrico), "kg": número o null, "min": minutos o null, "nota": texto corto o ""}. '
 +'Usa un id solo si es claramente ese ejercicio. Si algo es cardio o por tiempo, usa "min".\n\nLISTA:\n'+lista+'\n\nTEXTO:\n'+texto;
 var ctrl=window.AbortController?new AbortController():null,reloj=setTimeout(function(){if(ctrl)ctrl.abort()},20000);
 var h={'Content-Type':'application/json'},ex=(EX.cabeceras&&EX.cabeceras())||{};Object.keys(ex).forEach(function(k){if(ex[k])h[k]=ex[k]});
 return fetch(EX.coachUrl?EX.coachUrl():'/api/coach',{method:'POST',signal:ctrl?ctrl.signal:undefined,headers:h,body:JSON.stringify({messages:[{role:'user',content:p}]})})
 .then(function(r){clearTimeout(reloj);return r.ok?r.json():Promise.reject(new Error('HTTP '+r.status))})
 .then(function(d){var m=String(d.texto||'').match(/\[[\s\S]*\]/);if(!m)throw new Error('sin JSON');
  return JSON.parse(m[0]).filter(function(e){return e&&(e.n||e.id)}).map(function(e){
   var L=e.id&&LIB[e.id]?LIB[e.id]:null,reps=[],s=parseInt(e.series)||0,r=parseInt(e.reps)||0,min=parseInt(e.min)||0;
   if(!min&&r){for(var i=0;i<(s||1);i++)reps.push(r)}else if(!min&&s&&L){for(var k=0;k<s;k++)reps.push(EX.top(e.id))}
   var n=L?L.n:String(e.n||'Extra').slice(0,50);
   return {id:L?e.id:'x:'+norm(n).replace(/[^a-z0-9]+/g,'_').slice(0,24),n:n,reps:reps,peso:parseFloat(e.kg)||0,rpe:0,nota:String(e.nota||'').slice(0,120),min:min,hecho:1}})});
}
function interpretarExtra(){
 var el=document.getElementById('xTxt'),texto=(el&&el.value||'').trim();
 if(!texto){toast('Escribe o dicta lo que has hecho',1);return}
 if(_rec)_rec.stop();
 var b=document.getElementById('xBtn');if(b){b.disabled=true;b.textContent='Interpretando…'}
 function poner(lista,como){
  if(b){b.disabled=false;b.textContent='Añadir'}
  if(!lista.length){toast('No he entendido ningún ejercicio. Prueba con «3x12 curl con 8 kilos».',1);return}
  lista.forEach(function(x){_X().push(x)});guardarBorr();vTr();
  toast('Añadido ('+como+'): '+lista.map(function(x){return x.n}).join(', ')+'. Revísalo abajo.');
 }
 interpretarIA(texto).then(function(l){poner(l.length?l:interpretarLocal(texto),l.length?'IA':'local')})
 .catch(function(){poner(interpretarLocal(texto),'local')});
}
