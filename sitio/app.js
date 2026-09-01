/* Atlético 47 — vistas y arranque
 *
 * Cada pestaña tiene su función vXxx() que pinta a partir de S (motor.js) y de
 * la biblioteca (biblioteca.js). No hay framework: strings de HTML y onclick.
 */

/* ============ UTILIDADES ============ */
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function $(id){return document.getElementById(id)}
function num(id){var v=parseFloat(($(id)||{}).value);return isNaN(v)?null:v}
function nota(t,cls){return '<div class="note'+(cls?' '+cls:'')+'">'+t+'</div>'}
function stat(v,k){return '<div class="stat"><div class="v">'+v+'</div><div class="k">'+k+'</div></div>'}
function barras(vals,mx,tit){mx=mx||1;
 return '<div class="hline">'+vals.map(function(v,i){return '<div class="hbar" style="height:'+Math.max(6,(v||0)/mx*100)+'%" title="'+(tit?tit[i]:v)+'"></div>'}).join('')+'</div>'}
var _tt=null;
function toast(m,bad){var e=$('toast');e.textContent=m;e.className=bad?'on bad':'on';clearTimeout(_tt);_tt=setTimeout(function(){e.className=''},3200)}
var _cb=null;
function pregunta(txt,cb){_cb=cb;$('mtxt').textContent=txt;$('modal').classList.add('on')}
function mSi(){$('modal').classList.remove('on');var f=_cb;_cb=null;if(f)f()}
function mNo(){$('modal').classList.remove('on');_cb=null}
function pitido(){try{var a=new(window.AudioContext||window.webkitAudioContext)(),o=a.createOscillator(),g=a.createGain();
 o.connect(g);g.connect(a.destination);o.frequency.value=760;g.gain.setValueAtTime(.14,a.currentTime);
 g.gain.exponentialRampToValueAtTime(.001,a.currentTime+.45);o.start();o.stop(a.currentTime+.45)}catch(e){}
 if(navigator.vibrate)navigator.vibrate([180,90,180])}

/* ---- temporizador de descanso ---- */
var T=null,left=0;
function fmt(s){return Math.floor(s/60)+':'+String(s%60).padStart(2,'0')}
function startT(s,lab){left=s;$('timer').classList.add('on');$('tnum').textContent=fmt(left);$('tlab').textContent=lab||'Descanso';clearInterval(T);
 T=setInterval(function(){left--;$('tnum').textContent=fmt(Math.max(0,left));
  if(left<=0){clearInterval(T);$('tlab').textContent='Siguiente serie';pitido();setTimeout(stopT,2600)}},1000)}
function stopT(){clearInterval(T);$('timer').classList.remove('on')}
function addT(s){left+=s;$('tnum').textContent=fmt(left)}

/* ---- rutina guiada (movilidad, calentamiento de pádel) ---- */
var G={lista:null,i:0,left:0,t:null,fin:null};
function guiar(lista,fin){G.lista=lista;G.i=0;G.fin=fin;pasoG()}
function pasoG(){
 if(!G.lista)return;
 if(G.i>=G.lista.length){clearInterval(G.t);$('guia').classList.remove('on');pitido();var f=G.fin;G.lista=null;if(f)f();return}
 var p=G.lista[G.i];G.left=p.seg;
 $('guia').classList.add('on');$('gN').textContent=(G.i+1)+'/'+G.lista.length+' · '+p.n;$('gC').textContent=p.c;$('gT').textContent=fmt(G.left);
 clearInterval(G.t);
 G.t=setInterval(function(){G.left--;$('gT').textContent=fmt(Math.max(0,G.left));
  if(G.left<=0){pitido();G.i++;pasoG()}},1000);
}
function saltarG(){G.i++;pasoG()}
function pararG(){clearInterval(G.t);G.lista=null;$('guia').classList.remove('on')}

/* ============ NAVEGACIÓN ============ */
var TABS=['hoy','tr','hi','pa','cu','co','ai','aj'];
function vw(id){
 TABS.forEach(function(x){$(x).hidden=(x!==id)});
 document.querySelectorAll('.tab').forEach(function(b){b.setAttribute('aria-selected',b.dataset.t===id)});
 ({hoy:vHoy,tr:vTr,hi:vHist,pa:vPadel,cu:vCuerpo,co:vComida,ai:vAI,aj:vAjustes})[id]();
 window.scrollTo({top:0,behavior:'smooth'});
}
function avisosHTML(){
 return alertas().map(function(a){
  return '<div class="note '+a.n+'"><b>'+a.t+'</b>'+a.c+(a.accion==='descargaYa'?'<div class="row" style="margin-top:10px"><button class="btn sm" onclick="descargaYa()">Adelantar la descarga</button></div>':'')+'</div>'}).join('');
}
function descargaYa(){S.descargaExtra=S.semana;save();toast('Semana '+S.semana+' pasa a descarga');vw('hoy')}

/* ============ HOY ============ */
function vHoy(){
 var f=hoyISO(),dia=diaSemana(f),q=queToca(dia,f),d=dispDe(f)||{},o='';
 o+=avisosHTML();
 /* qué toca */
 var tit,sub,boton;
 if(q.tipo==='fuerza'){var s=sesionDe(dia,f);tit=s.n;sub=s.s+' · '+s.ej.length+' ejercicios · 35-40 min';boton='<button class="btn" onclick="vw(\'tr\')">Empezar el entreno</button>'}
 else if(q.tipo==='padel'){tit='Pádel';sub='Calienta 8-10 min antes. Agarre a 6 de 10. Después, apunta cómo quedan rodillas y codo.';boton='<button class="btn" onclick="vw(\'pa\')">Calentamiento y registro</button>'}
 else{tit='Movilidad';sub='8 minutos contra la silla y el coche. Bici suave opcional si te apetece.';boton='<button class="btn" onclick="empezarMovil()">Empezar los 8 minutos</button>'}
 o+='<div class="hd"><h2>'+tit+'</h2><span class="when">Semana '+S.semana+(esDeload()?' · DESCARGA':'')+' · fase '+fase()+'</span></div><p class="sub">'+sub+'</p>';
 o+='<div class="row">'+boton+(q.tipo!=='movil'?'<button class="btn gh sm" onclick="empezarMovil()">Movilidad 8 min</button>':'')+'</div>';
 /* disposición */
 var a=ajustesDe(f);
 o+='<h3 class="sec">¿Cómo vienes hoy?</h3><div class="eq" style="padding:14px 16px">';
 o+='<div class="row"><label>Rodillas 0-10</label><select class="inp" id="hRod">'+[0,1,2,3,4,5,6,7,8,9,10].map(function(n){return '<option value="'+n+'"'+(d.rod==n?' selected':'')+'>'+n+'</option>'}).join('')+'</select>'
 +'<label>Horas dormidas</label><input class="inp" style="width:64px" type="text" inputmode="decimal" id="hSue" value="'+(d.sue!=null?d.sue:'')+'" placeholder="h">'
 +'<label><input type="checkbox" id="hPad" '+((d.padel!==undefined?d.padel:huboPadel(ayerDe(f)))?'checked':'')+' style="width:19px;height:19px;accent-color:var(--acc);vertical-align:-4px;margin-right:6px">Jugué ayer</label></div>';
 o+='<div class="row"><button class="btn sm" onclick="guardarHoy()">Guardar</button><span class="mkcal">'+(S.hoy[f]?'guardado':'sin guardar')+'</span></div></div>';
 if(a.avisos.length)o+='<div class="note w"><b>Ajustes de hoy</b>'+a.avisos.map(esc).join('<br>')+'</div>';
 else if(S.hoy[f])o+='<div class="note"><b>Sin ajustes</b>Rodillas bien, sueño suficiente, sin partido ayer. La sesión va tal cual.</div>';
 /* semana: cada día es un botón; al tocarlo se despliega qué toca ese día */
 if(!diaSel)diaSel=dia;
 o+='<h3 class="sec">La semana</h3><div class="days">'+DIAS.map(function(k){
  var qq=queToca(k,f),lab=qq.tipo==='fuerza'?qq.k:(qq.tipo==='padel'?'pádel':'movil');
  return '<button class="day'+(qq.tipo==='movil'?' rest':'')+(k===dia?' hoyd':'')+'" aria-pressed="'+(k===diaSel)+'" onclick="verDiaSem(\''+k+'\')"><span class="d">'+DIAL[k]+'</span><span class="l">'+lab+'</span></button>'}).join('')+'</div>';
 o+='<div id="diaSem">'+diaSemHTML(diaSel)+'</div>';
 var cs=cargaSemana();
 o+='<div class="grid">'+stat(cs.fuerza,'fuerza esta semana')+stat(cs.partidos,'partidos')+stat(rachaMovil(),'días seguidos de movilidad')+stat(S.hist.length,'sesiones totales')+'</div>';
 /* recordatorios */
 var uc=cuerpoUlt(),hace=uc?Math.round((new Date(f)-new Date(uc.f))/86400000):null;
 if(!uc||hace>=7)o+='<div class="note"><b>Toca el registro semanal</b>'+(uc?'Hace '+hace+' días del último.':'Todavía no hay ninguno.')+' Peso, cintura, dolor por articulación y sueño. Dos minutos. <button class="btn gh sm" style="margin-top:8px" onclick="vw(\'cu\')">Ir a Cuerpo</button></div>';
 if(fase()===1)o+='<div class="note"><b>Fase 1: tendones y técnica</b>Semanas 1 a 4 con cargas bajas a propósito y RIR 4. Vienes de dos codos y una muñeca con artrosis: el músculo se adapta en semanas, el tendón en meses.</div>';
 o+='<div class="note"><b>Siempre</b>Exhala en el esfuerzo, nunca bloquees el aire. Termina cada serie pudiendo hacer 2-3 repeticiones más. Nada por debajo de paralelo, nada de rodillas en el suelo, nada que cargue la muñeca izquierda en extensión.</div>';
 $('hoy').innerHTML=o;
}
var diaSel=null;
function fechaDeDia(k){ // fecha de ese día de la semana en la semana actual (lunes a domingo)
 var d=new Date(),off=(d.getDay()+6)%7;d.setDate(d.getDate()-off+DIAS.indexOf(k));return iso(d)}
function verDiaSem(k){diaSel=k;
 document.querySelectorAll('#hoy .day').forEach(function(b){b.setAttribute('aria-pressed',b.textContent.charAt(0)===DIAL[k])});
 $('diaSem').innerHTML=diaSemHTML(k)}
function diaSemHTML(k){
 var f=fechaDeDia(k),q=queToca(k,f),hoy=hoyISO(),cuando=f===hoy?'hoy':(f<hoy?'pasado':'');
 var o='<div class="hist"><h4>'+DIAN[k]+' '+fmtF(f)+(cuando?' <span class="chip">'+cuando+'</span>':'')+'</h4>';
 if(q.tipo==='fuerza'){
  var s=sesionDe(k,f),a=ajustesDe(f);
  o+='<div class="hmeta" style="margin-bottom:8px"><span>'+s.n+' · '+s.s+'</span><span>'+s.ej.length+' ejercicios</span></div>';
  if(a.avisos.length)o+='<p class="err">'+a.avisos.map(esc).join(' ')+'</p>';
  o+='<div class="eq" style="margin:0 0 10px">'+s.ej.map(function(id,i){var L=LIB[id],sg=sugerir(id,f),n=seriesDe(id,f);
   return '<div class="item"><span class="num">'+(i+1<10?'0':'')+(i+1)+'</span><label>'+esc(L.n)+'</label><span class="q">'+n+'×'+(L.r[0]===L.r[1]?L.r[0]:L.r[0]+'-'+L.r[1])+(L.seg?'s':'')+(sg.peso?' · '+sg.peso+' kg':'')+'</span></div>'}).join('')+'</div>';
  var r=sesDe(f);
  o+='<div class="row">'+(r?'<span class="mkcal">guardada'+(r.s.val?' y validada':'')+'</span>':'')+'<button class="btn gh sm" onclick="pick(\''+k+'\');vw(\'tr\')">Abrir en Entreno</button></div>';
 } else if(q.tipo==='padel'){
  var p=padelDe(f);
  o+='<p class="cue" style="padding-top:0">Pádel a las 19:00. Calienta 8-10 min, agarre a 6 de 10, y al acabar apunta rodillas y codo. La sesión de fuerza del día siguiente irá con pierna ligera.</p>';
  o+='<div class="row">'+(p>=0?'<span class="mkcal">partido registrado · codo '+S.padel[p].codo+'/10</span>':'')+'<button class="btn gh sm" onclick="vw(\'pa\')">Ir a Pádel</button></div>';
 } else {
  o+='<p class="cue" style="padding-top:0">Movilidad de 8 minutos: cadera, dorsal y hombro contra la silla y el coche. Bici suave de 30-45 min si te apetece; no cuenta como día de entreno.</p>';
  o+='<div class="eq" style="margin:0 0 10px">'+MOV.map(function(m){return '<div class="item"><label>'+esc(m.n)+'</label><span class="q">'+m.seg+' s</span></div>'}).join('')+'</div>';
  o+='<div class="row">'+(S.movil.indexOf(f)>=0?'<span class="mkcal">hecha</span>':'')+'<button class="btn gh sm" onclick="empezarMovil()">Empezar los 8 minutos</button></div>';
 }
 return o+'</div>';
}
function guardarHoy(){
 var f=hoyISO();S.hoy[f]={rod:parseInt($('hRod').value)||0,sue:num('hSue'),padel:$('hPad').checked?1:0};
 save();toast('Guardado. La sesión de hoy se ajusta sola.');vHoy();
}
function empezarMovil(){
 guiar(MOV,function(){var f=hoyISO();if(S.movil.indexOf(f)<0)S.movil.push(f);save();toast('Movilidad hecha. '+rachaMovil()+' días seguidos.');vHoy()});
}

/* ============ ENTRENO ============ */
var cur=diaSemana(hoyISO()),borrador={},fechaSes=null;
function pick(k){cur=k;borrador={};vTr();window.scrollTo({top:0,behavior:'smooth'})}
function ejerciciosHoy(s){ // aplica swaps de disposición y de "me duele"
 var f=fechaSes||hoyISO(),a=ajustesDe(f);
 return s.ej.map(function(id,i){
  var b=borrador[cur+i];
  if(b&&b.cambio)return b.cambio.por;
  if(a.swap[id]&&disponible(a.swap[id])&&s.ej.indexOf(a.swap[id])<0)return a.swap[id];
  return id;});
}
function vTr(){
 var f=fechaSes||hoyISO();
 $('days').innerHTML=DIAS.map(function(k){var q=queToca(k,f);
  return '<button class="day'+(q.tipo!=='fuerza'?' rest':'')+'" aria-pressed="'+(k===cur)+'" onclick="pick(\''+k+'\')"><span class="d">'+DIAL[k]+'</span><span class="l">'+(q.tipo==='fuerza'?q.k:(q.tipo==='padel'?'pádel':'movil'))+'</span></button>'}).join('');
 var s=sesionDe(cur,f),m=$('main'),q=queToca(cur,f);
 $('when').textContent='Semana '+S.semana+(esDeload()?' · DESCARGA':'');
 if(!s){
  $('tt').textContent=q.tipo==='padel'?'Pádel':'Movilidad';$('ss').textContent='';
  m.innerHTML='<div class="rest-day"><h3 style="font-size:19px;color:var(--dim)">Hoy no toca hierro</h3><p>'+(q.tipo==='padel'?'Calentamiento y registro del partido en la pestaña Pádel.':'8 minutos de movilidad desde Hoy. Bici suave si te apetece.')+'</p></div>';
  $('prog').style.width='0';return;}
 $('tt').textContent=s.n;$('ss').textContent=s.s;
 var a=ajustesDe(f),ids=ejerciciosHoy(s),html='';
 if(s.falta)html+=nota('<b>Faltan '+s.falta+' ejercicios</b>Con el material y las articulaciones marcadas en Ajustes no hay alternativa para algún patrón.','w');
 if(esDeload())html+=nota('<b>Semana de descarga</b>85% del peso y una serie menos. No es opcional.','w');
 if(a.avisos.length)html+=nota('<b>Ajustes de hoy</b>'+a.avisos.map(esc).join('<br>'),'w');
 html+=nota('<b>Calentamiento</b>8 min de bici suave, 2 min de círculos de cadera y hombro, y una serie ligera del primer ejercicio.');
 html+=ids.map(function(id,i){
  var L=LIB[id],sg=sugerir(id,f),b=borrador[cur+i]||{},nS=seriesDe(id,f),sets='';
  for(var j=0;j<nS;j++){var v=(b.reps&&b.reps[j])||'';
   sets+='<div class="serie'+(v?' ok':'')+'"><label>S'+(j+1)+'</label><input type="text" inputmode="numeric" placeholder="'+(L.seg?'seg':'reps')+'" value="'+v+'" oninput="setRep(\''+cur+i+'\','+j+',this.value)"></div>';}
  var cambiado=b.cambio?'<span class="chip" style="color:var(--warn);border-color:var(--warn)">cambiado</span>':(id!==s.ej[i]?'<span class="chip">ajustado</span>':'');
  var alt=alternativa(id,ids);
  return '<article class="ex" id="e'+i+'">'
  +'<button class="exhd" onclick="op('+i+')" aria-expanded="false"><span class="num">'+(i+1<10?'0':'')+(i+1)+'</span><span class="name">'+esc(L.n)+cambiado+'</span>'
  +'<span class="kgb"><b>'+(sg.peso?sg.peso+' kg':'sin peso')+'</b><span>'+nS+'×'+(L.r[0]===L.r[1]?L.r[0]:L.r[0]+'-'+L.r[1])+(L.seg?'s':'')+'</span></span><span class="chev">▶</span></button>'
  +'<div class="body">'
  +'<div class="why"><b>Por qué este peso:</b> '+esc(sg.txt)+'</div>'
  +'<p class="discos">Montaje: '+esc(discos(sg.peso,id))+'</p>'
  +'<p class="cue">'+esc(L.c)+'</p>'
  +'<div class="breath"><span>↗</span><span>'+esc(L.b)+'</span></div>'
  +(L.e?'<p class="err">'+esc(L.e)+'</p>':'')
  +'<div class="vids"><a class="vid" target="_blank" rel="noopener" href="https://www.youtube.com/results?search_query='+encodeURIComponent(L.q)+'"><i>▶</i>Ver técnica</a>'
  +(alt?'<button class="vid duele" onclick="meDuele('+i+')">Me duele → '+esc(LIB[alt].n)+'</button>':'')
  +(b.cambio?'<button class="vid" onclick="deshacerCambio('+i+')">Volver a '+esc(LIB[b.cambio.de].n)+'</button>':'')+'</div>'
  +'<div class="slab">Lo que has hecho hoy</div><div class="sets">'+sets
  +'<button class="rest-btn" onclick="startT('+(i<3?120:75)+')">Descanso '+(i<3?'2:00':'1:15')+'</button></div>'
  +'<div class="row"><label>Peso real</label><input class="inp" style="width:88px" type="text" inputmode="decimal" placeholder="kg" value="'+(b.peso!==undefined?b.peso:sg.peso)+'" oninput="setPeso(\''+cur+i+'\',this.value)">'
  +'<label>RPE</label><select class="inp" onchange="setRpe(\''+cur+i+'\',this.value)"><option value="">–</option>'
  +[5,6,7,8,9].map(function(r){return '<option value="'+r+'"'+(b.rpe==r?' selected':'')+'>'+r+'</option>'}).join('')+'</select></div>'
  +'<input class="nota" placeholder="Nota: molestias, sensaciones, lo que sea" value="'+esc(b.nota||'')+'" oninput="setNota(\''+cur+i+'\',this.value)">'
  +'</div></article>'}).join('');
 var esHoy=(f===hoyISO());
 html+='<div class="row" style="margin-top:20px"><label>Día</label><input class="inp" type="date" value="'+f+'" max="'+hoyISO()+'" onchange="setFecha(this.value)">'
 +(esHoy?'<span class="mkcal">hoy</span>':'<span class="mkcal" style="color:var(--warn)">retroactivo</span>')+'</div>';
 html+='<div class="row"><button class="btn" onclick="guardarSesion()">Guardar sesión</button><button class="btn gh sm" onclick="talCual()">Rellenar tal cual</button><button class="btn gh sm" onclick="limpiar()">Limpiar</button></div>';
 html+=nota('<b>Me duele</b>Cada ejercicio tiene una alternativa a un toque. Si algo duele, cámbialo y sigue: queda apuntado en la sesión. Si el dolor se repite dos sesiones, márcalo en Ajustes como articulación en fase mala y el motor lo saca del plan hasta que lo desmarques.');
 html+=nota('<b>Si lo hiciste tal cual</b>Dale a Guardar sin escribir nada y doy por hecho que seguiste el plan: peso propuesto, tope de repeticiones y RPE 7. Si un ejercicio fue distinto, escribe solo ese.');
 m.innerHTML=html;progBar(s);
}
function op(i){var e=$('e'+i);if(!e)return;var o=e.classList.toggle('open');e.querySelector('.exhd').setAttribute('aria-expanded',o)}
function bd(k){if(!borrador[k])borrador[k]={reps:[]};if(!borrador[k].reps)borrador[k].reps=[];return borrador[k]}
function setRep(k,j,v){var b=bd(k);b.reps[j]=parseInt(v)||0;progBar(sesionDe(cur,fechaSes||hoyISO()));
 var el=event.target.parentNode;el.classList.toggle('ok',!!parseInt(v));
 if(parseInt(v))startT(parseInt(k.slice(3))<3?120:75);}
function setPeso(k,v){bd(k).peso=parseFloat(v)||0}
function setRpe(k,v){bd(k).rpe=parseInt(v)||0}
function setNota(k,v){bd(k).nota=v}
function meDuele(i){var s=sesionDe(cur,fechaSes||hoyISO()),ids=ejerciciosHoy(s),id=ids[i],alt=alternativa(id,ids);
 if(!alt)return;var b=bd(cur+i);b.cambio={de:s.ej[i],por:alt};b.reps=[];b.peso=undefined;
 toast('Cambiado a '+LIB[alt].n+'. Queda apuntado.');vTr();
 setTimeout(function(){op(i)},50)}
function deshacerCambio(i){var b=bd(cur+i);delete b.cambio;b.reps=[];b.peso=undefined;vTr()}
function progBar(s){if(!s)return;var t=0,d=0,f=fechaSes||hoyISO();
 ejerciciosHoy(s).forEach(function(id,i){t+=seriesDe(id,f);var b=borrador[cur+i];if(b&&b.reps)b.reps.forEach(function(r){if(r>0)d++})});
 $('prog').style.width=(t?d/t*100:0)+'%';}
function setFecha(v){fechaSes=v||hoyISO();cur=diaSemana(fechaSes);borrador={};vTr();toast(fechaSes===hoyISO()?'Se guardará con fecha de hoy':'Se guardará con fecha '+fmtF(fechaSes))}
function talCual(){var f=fechaSes||hoyISO(),s=sesionDe(cur,f);if(!s)return;
 ejerciciosHoy(s).forEach(function(id,i){var L=LIB[id],sg=sugerir(id,f),b=bd(cur+i),n=seriesDe(id,f);
  for(var j=0;j<n;j++)if(!b.reps[j])b.reps[j]=L.r[1];
  if(b.peso===undefined)b.peso=sg.peso;if(!b.rpe)b.rpe=7});
 vTr();toast('Rellenado con el plan. Cambia lo que fuera distinto.')}
function limpiar(){pregunta('¿Borrar lo que has apuntado hoy?',function(){borrador={};vTr();toast('Borrado')})}
function guardarSesion(){
 var f=fechaSes||hoyISO(),s=sesionDe(cur,f);if(!s)return;
 var ids=ejerciciosHoy(s),ej=[],asumidos=0;
 ids.forEach(function(id,i){
  var L=LIB[id],b=borrador[cur+i]||{},sg=sugerir(id,f),reps=(b.reps||[]).filter(function(r){return r>0}),auto=0;
  if(!reps.length){var n=seriesDe(id,f);reps=[];for(var j=0;j<n;j++)reps.push(L.r[1]);auto=1;asumidos++}
  ej.push({id:id,peso:b.peso!==undefined?b.peso:sg.peso,reps:reps,rpe:b.rpe||7,nota:b.nota||'',auto:auto,cambio:b.cambio||null});
 });
 var reg={f:f,s:s.k,sem:S.semana,ej:ej,val:0,auto:asumidos,listo:dispDe(f)};
 var prev=sesDe(f);if(prev)S.hist[prev.i]=reg;else S.hist.push(reg);
 S.hist.sort(function(a,b){return a.f<b.f?-1:1});
 save();borrador={};fechaSes=null;
 toast(asumidos===ej.length?'Guardada tal cual: '+ej.length+' ejercicios al plan':(asumidos?'Guardada. '+asumidos+' asumidos al plan':'Sesión guardada'));
 cur=diaSemana(hoyISO());vTr();
}

/* ============ PROGRESO ============ */
var calM=new Date().getMonth(),calY=new Date().getFullYear();
function moverMes(d){calM+=d;if(calM<0){calM=11;calY--}if(calM>11){calM=0;calY++}vHist()}
function calendario(){
 var pri=new Date(calY,calM,1),dias=new Date(calY,calM+1,0).getDate(),off=(pri.getDay()+6)%7,hoy=hoyISO();
 var MES=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
 var o='<div class="row" style="justify-content:space-between"><button class="btn gh sm" onclick="moverMes(-1)">‹</button><b class="mesT">'+MES[calM]+' '+calY+'</b><button class="btn gh sm" onclick="moverMes(1)">›</button></div>';
 o+='<div class="calh">'+['L','M','X','J','V','S','D'].map(function(d){return '<span>'+d+'</span>'}).join('')+'</div><div class="cal">';
 for(var i=0;i<off;i++)o+='<div class="cd no"></div>';
 for(var d=1;d<=dias;d++){
  var f=calY+'-'+String(calM+1).padStart(2,'0')+'-'+String(d).padStart(2,'0');
  var r=sesDe(f),p=padelDe(f)>=0,mv=S.movil.indexOf(f)>=0;
  var cl='cd'+(r?' hay':'')+(r&&r.s.val?' val':'')+(p&&!r?' pad':'')+(f===hoy?' hoy':'');
  var mk=r?r.s.s+(r.s.auto?'·':''):(p?'P':(mv?'m':''));
  o+='<div class="'+cl+'"'+(r?' onclick="verDia(\''+f+'\')" style="cursor:pointer"':'')+'>'+d+(mk?'<i>'+mk+'</i>':'')+'</div>';
 }
 o+='</div><div class="hmeta" style="margin-bottom:16px"><span>'+S.hist.length+' sesiones · '+S.padel.length+' partidos</span><span>'+S.hist.filter(function(x){return x.val}).length+' validadas</span></div>';
 return o;
}
function verDia(f){
 var r=sesDe(f);if(!r)return;
 var t=r.s.ej.map(function(e){var L=LIB[e.id];
  return esc(L?L.n:e.id)+': '+(e.peso?e.peso+' kg × ':'')+e.reps.join('-')+' (RPE '+e.rpe+')'+(e.auto?' · tal cual':'')+(e.cambio?' · cambiado por dolor':'')+(e.nota?' — '+esc(e.nota):'')}).join('\n');
 var vol=0;r.s.ej.forEach(function(e){vol+=(e.peso||0)*sum(e.reps)});
 var l=r.s.listo?' · rodillas '+r.s.listo.rod+'/10'+(r.s.listo.sue!=null?', '+r.s.listo.sue+' h':''):'';
 $('detDia').innerHTML='<div class="hist"><h4>'+fmtF(f)+' · Sesión '+r.s.s+(r.s.val?' · validada':'')+'</h4>'
 +'<div class="hmeta" style="margin-bottom:10px"><span>'+r.s.ej.length+' ejercicios'+l+'</span><span>'+Math.round(vol)+' kg movidos</span></div>'
 +'<pre class="pre">'+t+'</pre>'
 +'<div class="row" style="margin-top:14px">'+(r.s.val?'<button class="btn gh sm" onclick="valDia('+r.i+',0)">Quitar validación</button>':'<button class="btn sm" onclick="valDia('+r.i+',1)">Validar</button>')
 +'<button class="btn gh sm rojo" onclick="borrarDia('+r.i+')">Borrar sesión</button></div></div>';
 $('detDia').scrollIntoView({behavior:'smooth',block:'nearest'});
}
function valDia(i,v){S.hist[i].val=v?1:0;save();vHist();setTimeout(function(){verDia(S.hist[i].f)},60)}
function borrarDia(i){pregunta('¿Borrar la sesión del '+fmtF(S.hist[i].f)+'? No se puede deshacer.',function(){S.hist.splice(i,1);save();vHist();toast('Sesión borrada')})}
function vHist(){
 var h=$('hi'),m=porSemana(),ws=Object.keys(m).map(Number).sort(function(a,b){return a-b}),vol=0;
 S.hist.forEach(function(s){s.ej.forEach(function(e){vol+=(e.peso||0)*sum(e.reps)})});
 var out='<div class="grid">'+stat(S.semana,'semana')+stat(fase(),'fase')+stat(S.hist.length,'sesiones')+stat(Math.round(vol/1000)+'k','kg movidos')+'</div>';
 out+='<h3 class="sec">Calendario</h3>'+calendario()+'<div id="detDia"></div>';
 out+=nota('<b>Leyenda</b>A y B son sesiones de fuerza, P partidos de pádel, m movilidad. El punto tras la letra es una sesión guardada tal cual. Toca un día de fuerza para verlo, validarlo o borrarlo.');
 if(ws.length){
  var mx=Math.max.apply(null,ws.map(function(w){return m[w].vol}))||1;
  out+='<h3 class="sec">Volumen por semana</h3><div class="hist">'+barras(ws.map(function(w){return m[w].vol}),mx,ws.map(function(w){return 'Semana '+w+': '+Math.round(m[w].vol)+' kg'}))
  +'<div class="hmeta"><span>semana '+ws[0]+'</span><span>semana '+ws[ws.length-1]+'</span></div>';
  if(ws.length>=2){var a=m[ws[ws.length-2]].vol,b=m[ws[ws.length-1]].vol,pct=a?Math.round((b-a)/a*100):0;
   out+='<div class="hmeta" style="margin-top:9px"><span style="color:'+(pct>=0?'var(--acc)':'var(--warn)')+'">'+(pct>=0?'+':'')+pct+'% respecto a la semana anterior</span></div>';
   if(pct>25)out+='<p class="err" style="padding-top:9px">Subida mayor del 25%. El músculo aguanta, el tendón no. Si notas las articulaciones, frena.</p>'}
  out+='</div>';
 }
 out+='<div class="row" style="margin-top:18px"><button class="btn" onclick="cerrarSemana()">Cerrar semana '+S.semana+' y generar la '+(S.semana+1)+'</button></div>';
 out+=nota('<b>Qué hace ese botón</b>Aplica la doble progresión con tu historial real, rota los ejercicios si toca cambio de bloque (cada 4 semanas) y programa descarga cada quinta. En la semana 6 se abren las dominadas negativas; en la 13, zancadas y swing si no ha habido dolor.');
 if(!S.hist.length){out+=nota('<b>Todavía no hay historial</b>Guarda tu primera sesión desde Entreno y aquí verás la progresión de cada ejercicio.','w');h.innerHTML=out;return}
 out+='<h3 class="sec">Progresión por ejercicio</h3>';
 var ids={};S.hist.forEach(function(s){s.ej.forEach(function(e){ids[e.id]=1})});
 Object.keys(ids).forEach(function(id){
  var L=LIB[id];if(!L)return;var hh=histDe(id).slice(0,8).reverse();
  var vals=hh.map(function(x){return x.e.peso||sum(x.e.reps)}),mx2=Math.max.apply(null,vals)||1;
  var u=hh[hh.length-1].e,sg=sugerir(id);
  out+='<div class="hist"><h4>'+esc(L.n)+'</h4><div class="hmeta"><span>último: '+(u.peso?u.peso+' kg · ':'')+u.reps.join('-')+' · RPE '+u.rpe+'</span><span>'+hh.length+' sesiones</span></div>'
  +barras(vals,mx2,hh.map(function(x){return fmtF(x.f)+': '+(x.e.peso||sum(x.e.reps))}))
  +'<div class="hmeta"><span style="color:var(--acc)">próximo: '+(sg.peso?sg.peso+' kg':'sin peso')+'</span><span>'+(u.nota?'“'+esc(u.nota)+'”':'')+'</span></div></div>';
 });
 h.innerHTML=out;
}
function cerrarSemana(){
 if(!S.hist.length){toast('Guarda al menos una sesión antes de cerrar la semana',1);return}
 pregunta('¿Cerrar la semana '+S.semana+'? Se genera la '+(S.semana+1)+' con los pesos actualizados.',function(){
  S.semana++;save();var msg='Semana '+S.semana+' generada.';
  if(esDeload())msg+=' DESCARGA: 85% y una serie menos.';
  if(S.semana%4===1&&S.semana>1)msg+=' Cambio de bloque: rotan ejercicios.';
  if(S.semana===6)msg+=' Se abren las dominadas negativas.';
  toast(msg);vHist()});
}

/* ============ PÁDEL ============ */
function vPadel(){
 var f=hoyISO(),i=padelDe(f),d=i>=0?S.padel[i]:{},o=avisosHTML();
 o+='<div class="hd"><h2>Pádel</h2><span class="when">'+(S.cfg.verano?'parado en verano':(S.cfg.padel||[]).map(function(k){return DIAN[k]}).join(' y '))+'</span></div>';
 o+='<p class="sub">Es la mitad de tu actividad y el origen de tu última lesión. Se prepara y se registra.</p>';
 o+='<div class="row"><button class="btn" onclick="guiar(CAL_PADEL,function(){toast(\'Calentado. A jugar con el agarre a 6 de 10.\')})">Calentamiento guiado 9 min</button></div>';
 o+=nota('<b>Tres hábitos</b>Antes: 8-10 minutos de calentamiento, siempre. Durante: agarre a 6 de 10, no a 9; de ahí sale el codo. Después: apunta aquí cómo quedan rodillas y codo. El hielo no es malo, pero si se vuelve rutina, algo está subiendo de carga.');
 o+='<h3 class="sec">Registrar partido</h3><div class="eq" style="padding:14px 16px">'
 +'<div class="row"><label>Día</label><input class="inp" type="date" id="pF" value="'+(d.f||f)+'" max="'+f+'"><label>Minutos</label><input class="inp" style="width:64px" type="text" inputmode="numeric" id="pMin" value="'+(d.min||90)+'">'
 +'<label>Intensidad 1-5</label><select class="inp" id="pInt">'+[1,2,3,4,5].map(function(n){return '<option value="'+n+'"'+((d.int||3)==n?' selected':'')+'>'+n+'</option>'}).join('')+'</select></div>'
 +'<div class="row"><label>Después: rodilla D</label>'+sel10('pRD',d.rodD)+'<label>rodilla I</label>'+sel10('pRI',d.rodI)+'<label>codo D</label>'+sel10('pCo',d.codo)+'</div>'
 +'<div class="row"><label><input type="checkbox" id="pHielo" '+(d.hielo?'checked':'')+' class="chk">Hielo después</label></div>'
 +'<input class="nota" id="pNota" placeholder="Nota: cómo fue, qué molestó" value="'+esc(d.nota||'')+'">'
 +'<div class="row" style="margin-top:10px"><button class="btn sm" onclick="guardarPadel()">Guardar partido</button></div></div>';
 var cs=cargaSemana();
 o+='<div class="grid">'+stat(cs.partidos,'partidos esta semana')+stat(cs.minutos,'minutos')+stat(cs.fuerza,'sesiones de fuerza')+stat(S.padel.length,'partidos totales')+'</div>';
 if(S.padel.length){
  var ult=S.padel.slice(-8);
  o+='<h3 class="sec">Rodillas y codo tras los últimos partidos</h3><div class="hist">'
  +barras(ult.map(function(p){return Math.max(p.rodD||0,p.rodI||0,p.codo||0)}),10,ult.map(function(p){return fmtF(p.f)+': rodillas '+(p.rodD||0)+'/'+(p.rodI||0)+', codo '+(p.codo||0)}))
  +'<div class="hmeta"><span>peor articulación, 0-10</span><span>'+ult.length+' partidos</span></div></div>';
  o+='<div class="eq">'+S.padel.slice().reverse().slice(0,10).map(function(p){var j=padelDe(p.f);
   return '<div class="item"><label>'+fmtF(p.f)+' · '+p.min+' min · int '+p.int+'</label><span class="q">RD '+(p.rodD||0)+' RI '+(p.rodI||0)+' codo '+(p.codo||0)+(p.hielo?' · hielo':'')+'</span><button class="btn gh sm" onclick="borrarPadel('+j+')">×</button></div>'}).join('')+'</div>';
 } else o+=nota('<b>Sin partidos registrados</b>Cuando vuelva el pádel tras el verano, las dos primeras semanas dolerán más de lo normal. Es esperable y no es motivo para tocar la fuerza.');
 o+=nota('<b>Cuando el codo vuelva a avisar</b>Agarre más suelto, excéntricos de muñeca en cada sesión de fuerza (ya están en el plan) y revisar el peso y el grip de la pala. Una semana sin jugar cuesta menos que dos meses de codo.');
 $('pa').innerHTML=o;
}
function sel10(id,v){return '<select class="inp" id="'+id+'">'+[0,1,2,3,4,5,6,7,8,9,10].map(function(n){return '<option value="'+n+'"'+((v||0)==n?' selected':'')+'>'+n+'</option>'}).join('')+'</select>'}
function guardarPadel(){
 var r={f:$('pF').value||hoyISO(),min:parseInt($('pMin').value)||0,int:parseInt($('pInt').value)||3,rodD:parseInt($('pRD').value)||0,rodI:parseInt($('pRI').value)||0,codo:parseInt($('pCo').value)||0,hielo:$('pHielo').checked?1:0,nota:$('pNota').value.trim()};
 var i=padelDe(r.f);if(i>=0)S.padel[i]=r;else S.padel.push(r);
 S.padel.sort(function(a,b){return a.f<b.f?-1:1});save();toast('Partido guardado');vPadel();
}
function borrarPadel(i){pregunta('¿Borrar el partido del '+fmtF(S.padel[i].f)+'?',function(){S.padel.splice(i,1);save();vPadel()})}

/* ============ CUERPO ============ */
function vCuerpo(){
 var f=hoyISO(),u=cuerpoUlt()||{},i=cuerpoDe(f),d=i>=0?S.cuerpo[i]:{},o=avisosHTML();
 o+='<div class="hd"><h2>Cuerpo</h2><span class="when">una vez a la semana</span></div>';
 o+='<p class="sub">Cintura mejor que báscula, dolor por articulación, sueño de noche y de siesta. Lo que decide la progresión es la tendencia, no el dato de hoy.</p>';
 var v=function(k){return d[k]!=null?d[k]:''},p=function(k){return u[k]!=null?u[k]:''};
 o+='<h3 class="sec">Registro</h3><div class="eq" style="padding:14px 16px">'
 +'<div class="row"><label>Peso kg</label><input class="inp" style="width:70px" type="text" inputmode="decimal" id="cPeso" value="'+v('peso')+'" placeholder="'+p('peso')+'">'
 +'<label>Cintura cm</label><input class="inp" style="width:70px" type="text" inputmode="decimal" id="cCint" value="'+v('cint')+'" placeholder="'+p('cint')+'"></div>'
 +'<div class="slab">Dolor esta semana, 0-10 (el peor día)</div>'
 +'<div class="row"><label>Rodilla D</label>'+sel10('cRD',d.rodD)+'<label>Rodilla I</label>'+sel10('cRI',d.rodI)+'</div>'
 +'<div class="row"><label>Muñeca I</label>'+sel10('cMun',d.mun)+'<label>Caderas</label>'+sel10('cCad',d.cad)+'</div>'
 +'<div class="slab">Sueño medio</div>'
 +'<div class="row"><label>Noche h</label><input class="inp" style="width:60px" type="text" inputmode="decimal" id="cSueN" value="'+v('sueN')+'" placeholder="'+p('sueN')+'">'
 +'<label>Siesta h</label><input class="inp" style="width:60px" type="text" inputmode="decimal" id="cSueS" value="'+v('sueS')+'" placeholder="'+p('sueS')+'"></div>'
 +(S.cfg.tabaco?'<div class="row"><label>Cigarrillos/día</label><input class="inp" style="width:60px" type="text" inputmode="numeric" id="cCig" value="'+v('cig')+'" placeholder="'+p('cig')+'"></div>':'')
 +'<div class="slab">Tensión, si te la has tomado (farmacia, en reposo)</div>'
 +'<div class="row"><input class="inp" style="width:62px" type="text" inputmode="numeric" id="cSis" placeholder="sis" value="'+v('sis')+'"><span style="color:var(--dim)">/</span><input class="inp" style="width:62px" type="text" inputmode="numeric" id="cDia" placeholder="dia" value="'+v('dia')+'"></div>'
 +'<input class="nota" id="cNota" placeholder="Nota" value="'+esc(d.nota||'')+'">'
 +'<div class="row" style="margin-top:10px"><button class="btn sm" onclick="guardarCuerpo()">Guardar</button><span class="mkcal">'+fmtF(f)+'</span></div></div>';
 if(S.cuerpo.length){
  var c=S.cuerpo,pr=c[0],ul=c[c.length-1];
  o+='<div class="grid">'+stat(ul.cint?ul.cint+(pr.cint&&pr.cint!==ul.cint?' <small>'+(ul.cint-pr.cint>0?'+':'')+(ul.cint-pr.cint).toFixed(1)+'</small>':''):'–','cintura cm')
  +stat(ul.peso?ul.peso+(pr.peso&&pr.peso!==ul.peso?' <small>'+(ul.peso-pr.peso>0?'+':'')+(ul.peso-pr.peso).toFixed(1)+'</small>':''):'–','peso kg')
  +stat(ul.sueN!=null?((ul.sueN||0)+(ul.sueS||0)).toFixed(1):'–','h sueño total')
  +stat(Math.max(ul.rodD||0,ul.rodI||0,ul.cad||0,ul.mun||0),'peor dolor')+'</div>';
  var ult=c.slice(-12);
  var serie=function(k,mx,tit){return '<h3 class="sec">'+tit+'</h3><div class="hist">'+barras(ult.map(function(x){return x[k]||0}),mx,ult.map(function(x){return fmtF(x.f)+': '+(x[k]!=null?x[k]:'–')}))+'<div class="hmeta"><span>'+fmtF(ult[0].f)+'</span><span>'+fmtF(ult[ult.length-1].f)+'</span></div></div>'};
  if(ult.some(function(x){return x.cint}))o+=serie('cint',Math.max.apply(null,ult.map(function(x){return x.cint||0})),'Cintura');
  o+='<h3 class="sec">Dolor por articulación</h3><div class="eq">'+ult.slice().reverse().map(function(x){
   return '<div class="item"><label>'+fmtF(x.f)+'</label><span class="q">RD '+(x.rodD||0)+' · RI '+(x.rodI||0)+' · muñ '+(x.mun||0)+' · cad '+(x.cad||0)+(x.sis?' · '+x.sis+'/'+x.dia:'')+'</span><button class="btn gh sm" onclick="borrarCuerpo(\''+x.f+'\')">×</button></div>'}).join('')+'</div>';
 } else o+=nota('<b>Todavía no hay registros</b>Apunta el primero hoy: es la línea de salida. Mide la cintura a la altura del ombligo, de pie, sin meter tripa.');
 o+=nota('<b>Sobre la tensión</b>A los 47, con tabaco y 15 años parado, hay que conocerla una vez. Tómatela en una farmacia, sentado y en reposo, y apúntala aquí. Después, una vez al trimestre. No hace falta cada día: no eres hipertenso, que se sepa.');
 if(S.cfg.tabaco)o+=nota('<b>Sobre el tabaco</b>Se apunta si quieres, y solo para que el Coach lo tenga en cuenta. Nadie te va a sermonear desde aquí. Lo que sí es verdad: es la palanca más grande que tienes para el corazón, la recuperación y la vida sexual, más que cualquier ejercicio de este plan.');
 $('cu').innerHTML=o;
}
function guardarCuerpo(){
 var r={f:hoyISO(),peso:num('cPeso'),cint:num('cCint'),rodD:parseInt($('cRD').value)||0,rodI:parseInt($('cRI').value)||0,mun:parseInt($('cMun').value)||0,cad:parseInt($('cCad').value)||0,sueN:num('cSueN'),sueS:num('cSueS'),cig:$('cCig')?num('cCig'):null,sis:num('cSis'),dia:num('cDia'),nota:$('cNota').value.trim()};
 if(r.peso==null&&r.cint==null&&r.sueN==null){toast('Apunta al menos peso, cintura o sueño',1);return}
 var i=cuerpoDe(r.f);if(i>=0)S.cuerpo[i]=r;else S.cuerpo.push(r);
 S.cuerpo.sort(function(a,b){return a.f<b.f?-1:1});save();toast('Registrado');vCuerpo();
}
function borrarCuerpo(f){var i=cuerpoDe(f);if(i<0)return;pregunta('¿Borrar el registro del '+fmtF(f)+'?',function(){S.cuerpo.splice(i,1);save();vCuerpo()})}

/* ============ COMIDA ============ */
var CATDESV={cambio:'Cambié un plato',picoteo:'Piqué entre horas',fuera:'Comí fuera',salte:'Me salté una comida',alcohol:'Más de una cerveza'};
function vComida(){
 var f=hoyISO(),q=queToca(diaSemana(f),f),tipo=q.tipo==='fuerza'?'fuerza':(q.tipo==='padel'?'padel':'normal');
 var o='<div class="hd"><h2>Comida</h2><span class="when">~2.300 kcal · ~130 g proteína</span></div>';
 o+='<p class="sub">Sin contar calorías. Método del plato, proteína en cada comida y tres cenas para los días de obra. Perder barriga se mide en la cintura, no en la báscula.</p>';
 o+='<div class="grid">'+stat('½','plato de verdura')+stat('¼','proteína, una palma')+stat('¼','hidrato, un puño')+stat('1','cucharada de aceite')+'</div>';
 o+='<div class="eq"><div class="item"><label>'+PLATO.mitad+'</label></div><div class="item"><label>'+PLATO.cuarto1+'</label></div><div class="item"><label>'+PLATO.cuarto2+'</label></div><div class="item"><label>'+PLATO.grasa+'</label></div></div>';
 o+='<h3 class="sec">Hoy: día de '+{fuerza:'fuerza',padel:'pádel',normal:'descanso'}[tipo]+'</h3><div class="row">'+['fuerza','padel','normal','carretera'].map(function(k){return '<button class="btn gh sm" onclick="verMenu(\''+k+'\')">'+{fuerza:'Fuerza',padel:'Pádel',normal:'Normal',carretera:'Carretera'}[k]+'</button>'}).join('')+'</div>';
 o+='<div id="menuDia">'+menuHTML(tipo)+'</div>';
 o+='<h3 class="sec">Cenas de emergencia</h3><div class="eq">'+CENAS_EMERGENCIA.map(function(c){return '<div class="item"><label><b>'+c.n+'</b><br><span style="color:var(--dim)">'+c.t+'</span></label></div>'}).join('')+'</div>';
 o+=vDesvios();
 o+='<h3 class="sec">Notas de comida</h3><div class="row"><input class="nota" id="ncom" placeholder="Ej: el yogur griego me sienta mal, cambiar"><button class="btn sm" onclick="addNota()">Añadir</button></div>';
 if(S.notas.comida.length)o+='<div class="eq">'+S.notas.comida.map(function(n,i){return '<div class="eqi"><label>'+esc(n.t)+' <span class="u">'+fmtF(n.f)+'</span></label><button class="btn gh sm" onclick="delNota('+i+')">×</button></div>'}).join('')+'</div>';
 o+='<h3 class="sec">Lista de la compra</h3>';
 COMPRA.forEach(function(g,gi){o+='<h4 class="sub" style="margin:12px 0 6px;color:var(--paper)">'+g[0]+'</h4><div class="eq">'+g[1].map(function(it,ii){var id='sh'+gi+'_'+ii;
  return '<div class="item"><input type="checkbox" id="'+id+'" '+(S['ck'+id]?'checked':'')+' onchange="ck(\''+id+'\',this.checked)"><label for="'+id+'">'+it[0]+'</label><span class="q">'+it[1]+'</span></div>'}).join('')+'</div>'});
 o+='<div class="row"><button class="btn gh sm" onclick="resetShop()">Desmarcar todo</button></div>';
 o+=nota('<b>Por qué así</b>Pediste «lo que me venga mejor para la salud» y perder barriga. Sin hipertensión conocida no hay razón para restringir la sal ni seguir un patrón DASH. Lo que falla con tu horario es la cena del día de obra: por eso las tres de emergencia. Y la cerveza: la de después del pádel, una.');
 $('co').innerHTML=o;
}
function menuHTML(k){return '<div class="eq">'+MENU_DIA[k].map(function(x){return '<div class="item"><label><span class="mtime">'+x.h+'</span><br>'+x.t+'</label></div>'}).join('')+'</div>'}
function verMenu(k){$('menuDia').innerHTML=menuHTML(k)}
function addNota(){var el=$('ncom');if(!el.value.trim())return;S.notas.comida.push({t:el.value.trim(),f:hoyISO()});save();vComida()}
function delNota(i){S.notas.comida.splice(i,1);save();vComida()}
function vDesvios(){
 var hoy=hoyISO(),w=semanaNat(hoy),sem=[],dias={},cuenta={};
 S.desvios.forEach(function(d,i){if(semanaNat(d.f)!==w)return;sem.push({d:d,i:i});dias[d.f]=1;cuenta[d.c]=(cuenta[d.c]||0)+1});
 var trans=(new Date(hoy+'T00:00:00').getDay()+6)%7+1,top=Object.keys(cuenta).sort(function(a,b){return cuenta[b]-cuenta[a]})[0];
 var o='<h3 class="sec">Lo que realmente comí</h3><div class="grid">'+stat(Math.max(0,trans-Object.keys(dias).length)+'/'+trans,'días limpios')+stat(sem.length,'desvíos semana')+stat(top?CATDESV[top]:'—','más repetido')+'</div>';
 o+='<div class="row"><input class="nota" id="ndesv" placeholder="Qué pasó (opcional): menú del día con postre" style="flex:1;min-width:180px"></div>';
 o+='<div class="row">'+Object.keys(CATDESV).map(function(k){return '<button class="btn gh sm" onclick="addDesvio(\''+k+'\')">'+CATDESV[k]+'</button>'}).join('')+'</div>';
 if(sem.length)o+='<div class="eq">'+sem.slice().reverse().map(function(x){return '<div class="eqi"><label><span class="chip">'+CATDESV[x.d.c]+'</span> '+fmtF(x.d.f)+' '+esc(x.d.t)+'</label><button class="btn gh sm" onclick="delDesvio('+x.i+')">×</button></div>'}).join('')+'</div>';
 else o+=nota('<b>Semana limpia de momento</b>Aquí solo aparece lo que se sale del plan. Si no hay nada, vas bien.');
 return o;
}
function addDesvio(c){var el=$('ndesv');S.desvios.push({f:hoyISO(),c:c,t:el?el.value.trim():''});save();vComida();toast('Apuntado')}
function delDesvio(i){S.desvios.splice(i,1);save();vComida()}
function ck(id,v){S['ck'+id]=v;save()}
function resetShop(){Object.keys(S).forEach(function(k){if(k.indexOf('cksh')===0)delete S[k]});save();vComida()}

/* ============ COACH ============ */
var chat=[];
function contexto(){
 var e=S.equipo,t=[],nom=S.perfil.nombre?S.perfil.nombre+', ':'';
 t.push('PERFIL: '+nom+'hombre de 47 años, 1,78 m, '+(cuerpoUlt()&&cuerpoUlt().peso?cuerpoUlt().peso:S.perfil.peso0)+' kg. Sin medicación. Fumador (10-15/día). Duerme 4-5 h de noche más siesta de 1-2 h. Sedentario 15 años salvo pádel los últimos 10 meses (nivel medio-alto). Trabajo de oficina 70-80% sentado, con carretera y visitas a obra. Objetivo: salud, tono, perder barriga, agilidad para el pádel, llegar bien a los 50 y 60, y recuperar vida sexual. Le gusta todo lo que es juego; el gimnasio puro le echa atrás.');
 t.push('LESIONES Y SECUELAS: rodilla derecha con plastia de cruzado anterior (15 años) y menisco interno; a veces falla. Rodilla izquierda con menisco interno suturado (10 años); a veces se engancha. Arrodillarse duele; sentadilla hasta paralelo sin dolor, más abajo no. Caderas: labrum y cabezas femorales con artrosis "como una persona de 60 años" según especialista; cruzar las piernas cuesta. Muñeca izquierda: escafoides y semilunar operados hace 23 años, artrosis severa, SIN flexión ni extensión, no apoya la palma (flexiones de nudillos), pulgar limitado; carga colgando >10-15 kg bien. Hombro izquierdo: supraespinoso operado; sube por encima de la cabeza sin dolor, hacia atrás llega a la nuca. Codo izquierdo operado, rango completo. Codo derecho: epicondilitis y epitrocleitis resueltas (vienen del pádel). Esguinces históricos, tobillos estables hoy.');
 t.push('REGLAS INNEGOCIABLES: nunca al fallo, nunca 1RM ni cargas máximas, siempre RIR 2-3, nunca aguantar el aire (Valsalva). Nada que cargue la muñeca izquierda en extensión (barra en banca, sentadilla frontal, rueda abdominal, flexión con palma). Nada por debajo de paralelo, nada de rodillas en el suelo, nada balístico ni de impacto hasta el bloque 3. Rodilla que se bloquea o falla con dolor: no se entrena esa pierna y consulta traumatólogo. Pinchazo en la ingle: menos profundidad. Mareo, dolor de pecho o falta de aire: parar y médico. Si la tensión en reposo es 180/110 o más: no entrena y llama al médico. No eres médico ni fisio: deriva cuando toque, y recuerda que le conviene una visita de fisio para rodillas y cadera.');
 t.push('MATERIAL: barra de '+e.barra+' kg, barras de mancuerna de '+e.barraMan+' kg, kettlebell de '+e.kb+' kg, '+e.nFijas+' mancuernas fijas de '+e.fijas+' kg y mancuernas de 2 kg. Discos: '+Object.keys(e.discos).map(function(k){return e.discos[k]+'×'+k+' kg'}).join(', ')+'. Aparatos: '+Object.keys(e.tiene).filter(function(k){return e.tiene[k]}).map(function(k){return NOM[k]||k}).join(', ')+'.');
 var mal=Object.keys(S.artic).filter(function(k){return S.artic[k]}).map(function(k){return ARTIC[k]});
 t.push('PROGRAMA: semana '+S.semana+', fase '+fase()+(esDeload()?' (DESCARGA)':'')+'. Fuerza '+S.cfg.fuerza.map(function(k){return DIAN[k]}).join(' y ')+' (A y B, cuerpo entero, 35-40 min). Pádel '+(S.cfg.verano?'parado por verano':S.cfg.padel.map(function(k){return DIAN[k]}).join(' y ')+' a las 19:00')+'. Movilidad diaria de 8 min. '+(mal.length?'Articulaciones marcadas en fase mala: '+mal.join(', ')+'.':''));
 if(S.hist.length){
  t.push('HISTORIAL DE FUERZA ('+S.hist.length+' sesiones, últimas 20):');
  S.hist.slice(-20).forEach(function(x){t.push(x.f+' ['+x.s+', sem '+x.sem+(x.val?', validada':'')+(x.listo?', rodillas '+x.listo.rod+'/10':'')+']: '+x.ej.map(function(q){var L=LIB[q.id];return (L?L.n:q.id)+' '+(q.peso||0)+'kg '+q.reps.join('-')+' RPE'+q.rpe+(q.auto?' [asumido]':'')+(q.cambio?' [cambiado por dolor desde '+(LIB[q.cambio.de]||{}).n+']':'')+(q.nota?' ("'+q.nota+'")':'')}).join(' | '))});
 } else t.push('HISTORIAL DE FUERZA: todavía no hay sesiones guardadas.');
 if(S.padel.length)t.push('PÁDEL (últimos 10): '+S.padel.slice(-10).map(function(p){return p.f+' '+p.min+'min int'+p.int+' rodillas '+p.rodD+'/'+p.rodI+' codo '+p.codo+(p.hielo?' hielo':'')+(p.nota?' ("'+p.nota+'")':'')}).join(' | '));
 if(S.cuerpo.length)t.push('CUERPO (registro semanal, últimos 10): '+S.cuerpo.slice(-10).map(function(c){return c.f+': peso '+(c.peso||'?')+', cintura '+(c.cint||'?')+', dolor RD'+c.rodD+' RI'+c.rodI+' muñ'+c.mun+' cad'+c.cad+', sueño '+(c.sueN||'?')+'+'+(c.sueS||0)+'h'+(c.cig!=null?', '+c.cig+' cig':'')+(c.sis?', TA '+c.sis+'/'+c.dia:'')}).join(' | '));
 if(S.desvios.length)t.push('DESVÍOS DE COMIDA RECIENTES: '+S.desvios.slice(-10).map(function(d){return d.f+' '+CATDESV[d.c]+(d.t?' ('+d.t+')':'')}).join(' | '));
 if(S.notas.comida.length)t.push('NOTAS DE COMIDA: '+S.notas.comida.map(function(n){return n.f+': '+n.t}).join(' | '));
 t.push('COMIDA OBJETIVO: ~2.300 kcal, ~130 g proteína, método del plato, sin contar. Sin restricción de sal ni DASH (no hay hipertensión conocida).');
 t.push('NOTA SOBRE LOS DATOS: los ejercicios [asumidos] no los apuntó; se dieron por hechos según el plan. Menos confianza que los medidos. Los [cambiados por dolor] indican dónde ha habido molestia real.');
 t.push('ESTILO: responde en español, sinceridad extrema, sin halagos, pros y contras cuando ayuden a decidir. Usa SUS datos reales. Si te falta un dato, pregúntalo en vez de suponerlo. Máximo 250 palabras salvo que pida más. Sobre el tabaco: no sermonees; si pregunta o si es relevante para lo que pregunta, dilo una vez con datos.');
 return t.join('\n\n');
}
function vAI(){
 var o='<div class="hd"><h2>Coach</h2></div><p class="sub">Lleva tu perfil, tus lesiones, tu historial de fuerza, de pádel y de cuerpo. Pregunta lo que quieras.</p>';
 o+='<div class="sug">'+['¿Voy progresando bien?','La rodilla derecha me falló ayer, ¿qué hago?','¿Puedo entrenar si he dormido 4 horas?','Adapta la cena de hoy, estoy de obra','¿Cuándo paso a dominadas?','¿Qué hago con el codo después del pádel?'].map(function(q){return '<button onclick="preguntarIA(\''+q.replace(/'/g,"\\'")+'\')">'+q+'</button>'}).join('')+'</div>';
 o+='<div id="chatBox">'+(chat.length?chat.map(function(m){return '<div class="msg '+(m.r==='u'?'u':'a')+'">'+esc(m.t).replace(/\n/g,'<br>')+'</div>'}).join(''):'<div class="msg a">Cuéntame. Puedo mirar tu progresión ejercicio por ejercicio, decirte si lo que notas en una rodilla tiene sentido con lo que llevas, o ajustarte la comida de un día concreto.</div>')+'</div>';
 o+='<div class="row" style="margin-top:14px"><input class="nota" id="aiQ" placeholder="Escribe tu pregunta" style="flex:1;min-width:180px" onkeydown="if(event.key===\'Enter\')preguntarIA()"><button class="btn sm" id="aiB" onclick="preguntarIA()">Enviar</button></div>';
 if(chat.length)o+='<div class="row"><button class="btn gh sm" onclick="chat=[];vAI()">Empezar de cero</button></div>';
 o+=nota('<b>No sustituye a tu médico ni a un fisio</b>Puede equivocarse. Para una rodilla que se bloquea, cambios de medicación o dudas clínicas, el médico. La visita de fisio para rodillas y cadera sigue pendiente.','w');
 $('ai').innerHTML=o;var b=$('chatBox');if(b&&chat.length)b.scrollTop=b.scrollHeight;
}
function preguntarIA(pre){
 var el=$('aiQ'),q=pre||(el?el.value.trim():'');if(!q)return;
 chat.push({r:'u',t:q});vAI();
 $('chatBox').innerHTML+='<div class="msg a" id="pend"><span class="spin"></span>Mirando tus datos…</div>';
 var msgs=[{role:'user',content:contexto()+'\n\n=== PREGUNTA ===\n'+chat[0].t}];
 for(var i=1;i<chat.length;i++)msgs.push({role:chat[i].r==='u'?'user':'assistant',content:chat[i].t});
 fetch('/api/coach',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages:msgs})})
 .then(function(r){return r.json().then(function(d){return {ok:r.ok,status:r.status,d:d}})})
 .then(function(x){
  var txt=x.ok?(x.d.texto||''):'';
  if(!x.ok)txt=x.status===503?'El Coach no está configurado en el servidor. Hay que poner la clave de la API en coach.json (ver LEEME).':'No he podido responder ('+(x.d.error||x.status)+'). Prueba otra vez.';
  if(!txt)txt='No he podido responder. Prueba otra vez.';
  chat.push({r:'a',t:txt});vAI();
 })
 .catch(function(){chat.push({r:'a',t:'Ha fallado la conexión. Comprueba que estás en la tailnet y vuelve a intentarlo.'});vAI()});
}

/* ============ AJUSTES ============ */
function vAjustes(){
 var e=S.equipo,o='<div class="hd"><h2>Ajustes</h2></div><p class="sub">Días, material, articulaciones y la app. El plan cambia con el verano, con un mal mes de rodilla o con una mancuerna nueva: aquí, sin tocar código.</p>';
 o+='<h3 class="sec">Perfil</h3><div class="eq" style="padding:6px 16px"><div class="row" style="margin:8px 0"><label>Nombre</label><input class="nota" style="width:auto;flex:1" value="'+esc(S.perfil.nombre)+'" oninput="S.perfil.nombre=this.value;save()"><label>Peso inicial</label><input class="inp" style="width:70px" value="'+S.perfil.peso0+'" oninput="S.perfil.peso0=parseFloat(this.value)||0;save()"></div></div>';
 o+='<h3 class="sec">Días de pádel</h3><div class="eq">'+DIAS.map(function(k){return '<div class="eqi"><input type="checkbox" id="pd'+k+'" '+(S.cfg.padel.indexOf(k)>=0?'checked':'')+' onchange="setDia(\'padel\',\''+k+'\',this.checked)"><label for="pd'+k+'">'+DIAN[k]+'</label></div>'}).join('')
 +'<div class="eqi"><input type="checkbox" id="verano" '+(S.cfg.verano?'checked':'')+' onchange="S.cfg.verano=this.checked;save();vAjustes()"><label for="verano">Pádel parado (verano)</label></div></div>';
 o+='<h3 class="sec">Días de fuerza (dos)</h3><div class="eq">'+DIAS.map(function(k){return '<div class="eqi"><input type="checkbox" id="fz'+k+'" '+(S.cfg.fuerza.indexOf(k)>=0?'checked':'')+' onchange="setDia(\'fuerza\',\''+k+'\',this.checked)"><label for="fz'+k+'">'+DIAN[k]+(S.cfg.fuerza.indexOf(k)===0?' <span class="u">A</span>':(S.cfg.fuerza.indexOf(k)===1?' <span class="u">B</span>':''))+'</label></div>'}).join('')+'</div>';
 o+=nota('<b>Por qué así</b>Con tres días máximo, dos de fuerza de cuerpo entero y el pádel como tercero. Si juegas un día: lunes y viernes. Si juegas dos: miércoles y sábado, y la sesión del miércoles va con pierna ligera porque el motor sabe que ayer hubo partido. En verano, sin pádel, un tercer día de bici suave.');
 o+='<h3 class="sec">Articulaciones en fase mala</h3><div class="eq">'+Object.keys(ARTIC).map(function(k){return '<div class="eqi"><input type="checkbox" id="ar'+k+'" '+(S.artic[k]?'checked':'')+' onchange="S.artic[\''+k+'\']=this.checked?1:0;save();vAjustes()"><label for="ar'+k+'">'+ARTIC[k]+'</label></div>'}).join('')+'</div>';
 o+=nota('<b>Qué hace</b>Marcar una articulación saca del plan los ejercicios que la cargan hasta que la desmarques, y el motor busca alternativa. Es para rachas malas, no para un día: para un día usa «me duele» en la sesión.');
 o+='<h3 class="sec">Barras y pesos</h3><div class="eq">'+eqNum('barra','Barra larga','kg')+eqNum('barraMan','Barra de mancuerna (cada una)','kg')+eqNum('kb','Kettlebell','kg')+eqNum('fijas','Mancuernas fijas (cada una)','kg')+eqNum('nFijas','Cuántas fijas','uds')+'</div>';
 o+='<h3 class="sec">Discos</h3><div class="eq">'+Object.keys(e.discos).sort(function(a,b){return b-a}).map(function(k){return '<div class="eqi"><label>Discos de '+k+' kg</label><input class="inp" type="text" inputmode="numeric" value="'+e.discos[k]+'" oninput="S.equipo.discos[\''+k+'\']=parseInt(this.value)||0;save()"><span class="u">uds</span></div>'}).join('')+'</div>';
 o+='<h3 class="sec">Aparatos</h3><div class="eq">'+Object.keys(NOM).map(function(k){return '<div class="eqi"><input type="checkbox" id="q'+k+'" '+(e.tiene[k]?'checked':'')+' onchange="S.equipo.tiene[\''+k+'\']=this.checked?1:0;save()"><label for="q'+k+'">'+NOM[k]+'</label></div>'}).join('')+'</div>';
 o+=nota('<b>Lo que no verás aquí</b>Soportes de barra y tela aérea no aparecen porque en tu plan no hay barra en banca ni nada colgado por las muñecas. El escalón bajo (20 cm) sí importa: sin él, el step-up sale y entra la extensión terminal.');
 /* ejercicios propios */
 o+='<h3 class="sec">Ejercicios propios</h3>';
 var ncus=Object.keys(S.ejCustom);
 if(ncus.length)o+='<div class="eq">'+ncus.map(function(k){return '<div class="eqi"><label>'+esc(S.ejCustom[k].n)+' <span class="u">'+PATN[S.ejCustom[k].pat]+'</span></label><button class="btn gh sm" onclick="delEjer(\''+k+'\')">Quitar</button></div>'}).join('')+'</div>';
 o+='<div class="eq" style="padding:14px 16px"><div class="row"><input class="nota" id="exN" placeholder="Nombre del ejercicio"></div>'
 +'<div class="row"><label>Patrón</label><select class="inp" id="exP">'+Object.keys(PATN).map(function(k){return '<option value="'+k+'">'+PATN[k]+'</option>'}).join('')+'</select>'
 +'<label>Tipo</label><select class="inp" id="exT"><option value="corporal">Peso corporal</option><option value="mancuerna">Mancuerna</option><option value="banda">Banda</option><option value="kb">Kettlebell</option></select></div>'
 +'<div class="row"><label>Series</label><input class="inp" id="exS" style="width:56px" value="3"><label>Reps</label><input class="inp" id="exR1" style="width:50px" value="8"><span style="color:var(--dim)">a</span><input class="inp" id="exR2" style="width:50px" value="12"></div>'
 +'<div class="row"><input class="nota" id="exC" placeholder="Cómo se ejecuta (opcional)"></div><div class="row"><button class="btn sm" onclick="addEjer()">Crear ejercicio</button></div></div>';
 /* app */
 o+='<h3 class="sec">App y notificaciones</h3><div class="eq" style="padding:14px 16px">'
 +'<div class="row"><button class="btn sm" id="btnInst" hidden onclick="instalar()">Instalar en el móvil</button><button class="btn gh sm" onclick="pedirNotif()">Activar notificaciones</button><button class="btn gh sm" onclick="probarNotif()">Probar</button></div>'
 +'<div class="row"><span class="mkcal">Estado: '+estadoNotif()+'</span></div>'
 +'<div class="row"><input class="nota" id="vapid" placeholder="Clave pública VAPID del servidor" value="'+esc((S.push&&S.push.vapid)||'')+'" style="flex:1;min-width:170px"><button class="btn gh sm" onclick="suscribirPush()">Suscribir</button></div>'
 +((S.push&&S.push.sub)?'<div class="row"><button class="btn gh sm" onclick="copiarSub()">Copiar suscripción</button><span class="mkcal">lista</span></div>':'')+'</div>';
 o+='<h3 class="sec">Datos</h3><div class="eq" style="padding:14px 16px"><div class="row"><button class="btn gh sm" onclick="exportar()">Copiar copia de seguridad</button><button class="btn gh sm" onclick="$(\'impIn\').hidden=false">Importar</button><button class="btn gh sm rojo" onclick="borrarTodo()">Borrar todo</button></div>'
 +'<div id="impIn" hidden><input class="nota" id="impTxt" placeholder="Pega aquí la copia de seguridad"><div class="row" style="margin-top:8px"><button class="btn sm" onclick="importar()">Cargar</button></div></div>'
 +'<div class="row"><span class="mkcal">'+(window.storage&&window.storage.estado?('sync: '+(window.storage.estado().conectado===false?'sin servidor, guardando en local':'servidor ok')):'solo local')+'</span></div></div>';
 $('aj').innerHTML=o;
}
function eqNum(k,n,u){return '<div class="eqi"><label>'+n+'</label><input class="inp" type="text" inputmode="decimal" value="'+S.equipo[k]+'" oninput="S.equipo[\''+k+'\']=parseFloat(this.value)||0;save()"><span class="u">'+u+'</span></div>'}
function setDia(tipo,k,v){var l=S.cfg[tipo];
 if(v){if(l.indexOf(k)<0)l.push(k);if(tipo==='fuerza'&&l.length>2){l.shift();toast('Solo dos días de fuerza. He quitado '+DIAN[l[0]==k?l[1]:l[0]]+'.',1)}}
 else{var i=l.indexOf(k);if(i>=0)l.splice(i,1)}
 S.cfg[tipo]=DIAS.filter(function(d){return l.indexOf(d)>=0});save();vAjustes();
}
function slug(t){return 'c_'+t.toLowerCase().normalize('NFD').replace(/[^a-z0-9]/g,'').slice(0,14)+Math.random().toString(36).slice(2,5)}
function addEjer(){
 var n=($('exN').value||'').trim();if(!n){toast('Ponle nombre',1);return}
 var r1=parseInt($('exR1').value)||8,r2=parseInt($('exR2').value)||12;if(r2<r1){var t=r1;r1=r2;r2=t}
 var tipo=$('exT').value,id=slug(n);
 S.ejCustom[id]={n:n,pat:$('exP').value,req:[],tipo:tipo,inc:1,r:[r1,r2],s:parseInt($('exS').value)||3,ini:tipo==='mancuerna'?2:0,zona:['rodilla','unilateral','bisagra','gluteo','cadera_lat'].indexOf($('exP').value)>=0?'pierna':'superior',evita:[],alt:[],nivel:1,
  c:($('exC').value||'').trim()||'Ejercicio añadido por ti.',b:'Exhala en el esfuerzo. Nunca bloquees el aire.',e:'',q:n,propio:1};
 LIB[id]=S.ejCustom[id];save();vAjustes();toast('"'+n+'" creado. Entra en la rotación de '+PATN[S.ejCustom[id].pat]);
}
function delEjer(k){pregunta('¿Quitar "'+S.ejCustom[k].n+'"?',function(){delete S.ejCustom[k];delete LIB[k];save();vAjustes()})}
function exportar(){var t=JSON.stringify(S);
 (navigator.clipboard?navigator.clipboard.writeText(t):Promise.reject()).then(function(){toast('Copiado. Pégalo en un sitio seguro.')})
 .catch(function(){$('impIn').hidden=false;$('impTxt').value=t;toast('Cópialo del cuadro de abajo',1)})}
function importar(){var t=$('impTxt').value.trim();if(!t)return;
 try{var o=JSON.parse(t);if(!o.equipo)throw 0}catch(e){toast('Eso no es una copia válida',1);return}
 pregunta('¿Sustituir TODOS los datos por la copia pegada?',function(){localStorage.setItem(CLAVE,t);location.reload()})}
function borrarTodo(){pregunta('¿Borrar todos los datos de esta app en este dispositivo? El servidor conserva el historial.',function(){localStorage.removeItem(CLAVE);location.reload()})}

/* ---- instalable y push ---- */
var swReg=null,instalable=null;
if('serviceWorker' in navigator)navigator.serviceWorker.register('sw.js').then(function(r){swReg=r}).catch(function(){});
window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();instalable=e;var b=$('btnInst');if(b)b.hidden=false});
function instalar(){if(!instalable){toast('Usa el menú del navegador: Añadir a pantalla de inicio',1);return}
 instalable.prompt();instalable.userChoice.then(function(){instalable=null;var b=$('btnInst');if(b)b.hidden=true})}
function estadoNotif(){
 if(!('Notification' in window))return 'no soportadas en este navegador';
 if(!('serviceWorker' in navigator))return 'requieren instalar la app';
 return Notification.permission==='granted'?'activadas':(Notification.permission==='denied'?'bloqueadas en el navegador':'sin activar')}
function pedirNotif(){if(!('Notification' in window)){toast('Este navegador no las soporta',1);return}
 Notification.requestPermission().then(function(p){vAjustes();if(p==='granted'){toast('Notificaciones activadas');probarNotif()}else toast('Permiso denegado',1)})}
function probarNotif(){if(Notification.permission!=='granted'){toast('Actívalas primero',1);return}
 if(swReg&&swReg.showNotification)swReg.showNotification('Atlético 47',{body:'Funcionan.',icon:'icon-192.png',vibrate:[180,90,180]});else new Notification('Atlético 47',{body:'Funcionan.'})}
function suscribirPush(){
 var k=(($('vapid')||{}).value||'').trim();
 if(!k){toast('Pega primero la clave pública VAPID',1);return}
 if(!swReg){toast('El service worker aún no está listo. Recarga',1);return}
 if(Notification.permission!=='granted'){toast('Activa antes las notificaciones',1);return}
 function b64(s){var pad='='.repeat((4-s.length%4)%4),b=atob((s+pad).replace(/-/g,'+').replace(/_/g,'/')),a=new Uint8Array(b.length);for(var i=0;i<b.length;i++)a[i]=b.charCodeAt(i);return a}
 swReg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:b64(k)}).then(function(sub){S.push={sub:JSON.stringify(sub),vapid:k};save();vAjustes();toast('Suscrito. Copia el JSON y pásalo al servidor')})
 .catch(function(e){toast('No se pudo suscribir: '+e.message,1)})}
function copiarSub(){if(!S.push||!S.push.sub)return;navigator.clipboard.writeText(S.push.sub).then(function(){toast('Copiado')}).catch(function(){toast('No se pudo copiar',1)})}

/* ============ ARRANQUE ============ */
load(function(){
 $('app').remove();
 $('today').textContent=new Date().toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'long'}).toUpperCase();
 $('foot').textContent='Semana '+S.semana+' · '+S.hist.length+' sesiones · '+S.padel.length+' partidos · descarga cada 5 semanas';
 var t=new URLSearchParams(location.search).get('t');
 vw(t&&TABS.indexOf(t)>=0?t:'hoy');
});
