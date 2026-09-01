/* Atlético 47 — biblioteca de ejercicios, plantillas, movilidad y comida
 *
 * Todo lo que es DATO vive aquí. El motor (motor.js) decide qué entra en cada
 * sesión; las vistas (app.js) lo pintan. Cambiar un ejercicio es tocar este
 * fichero y nada más.
 *
 * Campos de cada ejercicio:
 *   n      nombre
 *   pat    patrón (hueco que ocupa en la plantilla)
 *   req    material necesario (claves de S.equipo.tiene, 'barra' o 'kb')
 *   tipo   barra | mancuerna | kb | corporal | banda
 *   inc    incremento de carga cuando toca subir (kg)
 *   r      rango de repeticiones [min, max]; con seg:1 son segundos, con m:1 metros
 *   s      series
 *   ini    peso inicial por mano (0 = empieza sin peso aunque sea de mancuerna)
 *   zona   pierna | superior | core   (los días de pierna ligera recortan 'pierna')
 *   evita  articulaciones que, marcadas "en fase mala" en Ajustes, sacan el ejercicio
 *   alt    a qué cambia el botón "me duele" (primer disponible de la lista)
 *   nivel  1 base · 2 desde la semana 6 · 3 desde la semana 13 si no ha habido dolor
 *   q      búsqueda de vídeo
 *   c      cómo se hace   b  respiración   e  error típico / por qué está aquí
 */
var LIB={
 /* ---- rodilla dominante ---- */
 sent_banco:{n:"Sentadilla a banco con mancuernas",pat:"rodilla",req:["banco"],tipo:"mancuerna",inc:1,r:[8,10],s:3,ini:5,zona:"pierna",evita:[],alt:["wall_sit","ext_term"],nivel:1,
  q:"box squat mancuernas sentadilla a banco",
  c:"Mancuernas a los lados, banco detrás. Baja controlado hasta rozar el banco con el culo, sin sentarte del todo, y sube empujando el suelo. Rodillas siguiendo la punta del pie.",
  b:"Exhala al subir.",
  e:"El banco fija la profundidad justo en paralelo, que es donde tus rodillas no duelen. Si la rodilla derecha se mete hacia dentro, menos peso."},
 wall_sit:{n:"Sentadilla isométrica en pared",pat:"rodilla",req:[],tipo:"corporal",inc:0,r:[20,40],s:3,seg:1,zona:"pierna",evita:[],alt:["ext_term"],nivel:1,
  q:"wall sit sentadilla isometrica pared",
  c:"Espalda en la pared, muslos algo por encima de paralelo, rodillas sobre los tobillos. Aguanta.",
  b:"Respira con normalidad. No aguantes el aire.",
  e:"Cuádriceps sin recorrido: la alternativa cuando la rodilla está tocada pero quieres trabajar."},
 ext_term:{n:"Extensión terminal de rodilla con banda",pat:"rodilla",req:["banda"],tipo:"banda",inc:0,r:[15,20],s:2,zona:"pierna",evita:[],alt:["wall_sit"],nivel:1,
  q:"terminal knee extension band TKE",
  c:"Banda anclada delante, pasada por detrás de la rodilla. De pie, rodilla algo doblada, estírala del todo contra la banda apretando el cuádriceps 1 segundo arriba.",
  b:"Exhala al estirar.",
  e:"Los últimos 30° de extensión son los que estabilizan una rodilla de cruzado que 'se va'. Cero carga articular."},
 /* ---- unilateral ---- */
 step_up:{n:"Step-up a escalón bajo",pat:"unilateral",req:["escalon"],tipo:"mancuerna",inc:1,r:[10,10],s:2,ini:0,zona:"pierna",evita:["rodD","rodI"],alt:["ext_term"],nivel:1,
  q:"step up escalon bajo tecnica",
  c:"Escalón de 20 cm, no el banco. Sube empujando con la pierna de arriba, sin impulsarte con la de abajo. Baja despacio, 2-3 segundos.",
  b:"Exhala al subir.",
  e:"Unilateral sin desequilibrio ni profundidad. Empieza sin peso; cuando 2×10 por pierna sean fáciles, mancuernas."},
 zancada_inv:{n:"Zancada inversa",pat:"unilateral",req:[],tipo:"mancuerna",inc:1,r:[8,10],s:2,ini:0,zona:"pierna",evita:["rodD","rodI","cadera"],alt:["step_up"],nivel:3,
  q:"zancada inversa tecnica",
  c:"Paso atrás controlado, rodilla trasera cerca del suelo sin tocarlo, tronco vertical. Empuja con el talón de la delantera.",
  b:"Exhala al subir.",
  e:"Solo entra en el bloque 3 y solo si las rodillas no han dado guerra. Más amable que la zancada hacia delante."},
 /* ---- bisagra y glúteo ---- */
 pm_rumano_m:{n:"Peso muerto rumano con mancuernas",pat:"bisagra",req:[],tipo:"mancuerna",inc:1,r:[10,12],s:3,ini:5,zona:"pierna",evita:["cadera"],alt:["puente"],nivel:1,
  q:"peso muerto rumano mancuernas tecnica",
  c:"Rodillas algo flexionadas y fijas. Cadera hacia atrás, mancuernas rozando los muslos. Baja SOLO hasta donde la pelvis siga neutra, no hasta donde lleguen las manos.",
  b:"Exhala al subir.",
  e:"Glúteo e isquios sin flexión profunda de cadera. Las mancuernas cuelgan: muñeca neutra."},
 puente:{n:"Puente de glúteo → hip thrust",pat:"gluteo",req:[],tipo:"mancuerna",inc:2,r:[12,15],s:3,ini:0,zona:"pierna",evita:[],alt:["pm_rumano_m"],nivel:1,
  q:"puente gluteo hip thrust suelo tecnica",
  c:"Tumbado, pies apoyados, sube la cadera hasta alinear rodilla-cadera-hombro y aprieta arriba 1 s. Cuando 3×15 en el suelo sean fáciles, espalda en el banco y una mancuerna sobre la cadera.",
  b:"Exhala al subir.",
  e:"Extensión pura de cadera: lo que mejor tolera una cadera con artrosis y lo que más falta le hace a ocho horas sentado."},
 swing:{n:"Swing con kettlebell",pat:"bisagra",req:["kb"],tipo:"kb",inc:2,r:[10,12],s:3,zona:"pierna",evita:["munI","cadera"],alt:["pm_rumano_m"],nivel:3,
  q:"kettlebell swing tecnica",
  c:"Bisagra potente, la pesa sube por el impulso de la cadera, no por los brazos. Solo hasta la altura del pecho. Carga baja.",
  b:"Exhala con fuerza en el impulso.",
  e:"Balístico sobre una muñeca con artrosis: por eso no entra hasta el bloque 3, y con poco peso."},
 /* ---- cadera lateral ---- */
 abd_banda:{n:"Abducción de cadera con banda",pat:"cadera_lat",req:["banda"],tipo:"banda",inc:0,r:[15,20],s:2,zona:"pierna",evita:[],alt:["almeja"],nivel:1,
  q:"abduccion cadera banda de pie monster walk",
  c:"Banda por encima de las rodillas o en los tobillos. De pie, apoyado en la pared, abre la pierna hacia el lado sin inclinar el tronco. Lento.",
  b:"Respiración continua.",
  e:"Glúteo medio: la base del manejo de una cadera con labrum tocado y de una rodilla que se mete hacia dentro."},
 almeja:{n:"Almeja tumbado de lado",pat:"cadera_lat",req:[],tipo:"banda",inc:0,r:[15,20],s:2,zona:"pierna",evita:[],alt:["abd_banda"],nivel:1,
  q:"clamshell almeja gluteo medio",
  c:"De lado, rodillas dobladas y pies juntos. Abre la rodilla de arriba sin girar la pelvis. Con banda si la tienes.",
  b:"Respiración continua.",
  e:"Misma función que la abducción, sin cargar la rodilla de apoyo."},
 /* ---- empuje horizontal ---- */
 press_manc_n:{n:"Press banca con mancuernas, agarre neutro",pat:"emp_hor",req:["banco"],tipo:"mancuerna",inc:1,r:[10,12],s:3,ini:5,zona:"superior",evita:["hombI"],alt:["flex_nud"],nivel:1,
  q:"press banca mancuernas agarre neutro",
  c:"Palmas enfrentadas, codos a unos 45°. Baja hasta la altura del pecho, no más, y empuja sin bloquear. Solo en casa: nunca al fallo.",
  b:"Exhala al empujar.",
  e:"Mismo estímulo que la barra sin extensión de muñeca. La izquierda va en neutro siempre."},
 flex_nud:{n:"Flexiones de nudillos",pat:"emp_hor",req:[],tipo:"corporal",inc:0,r:[8,12],s:3,zona:"superior",evita:["hombI"],alt:["press_manc_n"],nivel:1,
  q:"flexiones nudillos knuckle push up",
  c:"Como las llevas haciendo 23 años. Cuerpo en línea, codos a 45°, pecho cerca del suelo. Si son pocas, con las manos en el banco.",
  b:"Exhala al subir.",
  e:"La palma no apoya; los nudillos sí. Si algo funciona, no se toca."},
 /* ---- tracción horizontal ---- */
 remo_manc:{n:"Remo a una mano con mancuerna",pat:"trac_hor",req:["banco"],tipo:"mancuerna",inc:1,r:[10,12],s:3,ini:5,zona:"superior",evita:[],alt:["remo_trx"],nivel:1,
  q:"remo mancuerna una mano banco",
  c:"Rodilla y mano del mismo lado en el banco. La mano izquierda apoya en PUÑO, no en palma. Espalda plana, tira del codo hacia la cadera.",
  b:"Exhala al tirar.",
  e:"Espalda alta contra la postura de oficina. Si el tronco rota para ayudar, pesa demasiado."},
 remo_trx:{n:"Remo invertido en TRX",pat:"trac_hor",req:["trx"],tipo:"corporal",inc:0,r:[10,12],s:3,zona:"superior",evita:[],alt:["remo_manc"],nivel:1,
  q:"remo invertido trx",
  c:"Cuerpo recto como una tabla, tira del pecho hacia las manos. Ajusta la dificultad caminando con los pies.",
  b:"Exhala al tirar.",
  e:"Agarre neutro natural. Cuanto más horizontal, más difícil."},
 /* ---- tracción vertical ---- */
 colgarse:{n:"Colgarse de la barra",pat:"trac_ver",req:["torre"],tipo:"corporal",inc:0,r:[15,30],s:3,seg:1,zona:"superior",evita:["hombI"],alt:["remo_trx"],nivel:1,
  q:"dead hang colgarse barra beneficios",
  c:"Agarre neutro si la torre lo permite. Hombros activos, escápulas abajo. Aguanta el tiempo y suelta controlado.",
  b:"Respira con normalidad.",
  e:"Descompresión de hombro, agarre y el primer paso hacia las dominadas. Si el pulgar izquierdo abre la mano, suelta: no aprietes más."},
 dom_neg:{n:"Dominadas negativas",pat:"trac_ver",req:["torre"],tipo:"corporal",inc:0,r:[3,5],s:3,zona:"superior",evita:["hombI"],alt:["colgarse"],nivel:2,
  q:"dominadas negativas tecnica",
  c:"Sube con el escalón o un salto, y baja en 4-5 segundos controlando. Escápulas abajo antes de empezar.",
  b:"Exhala al bajar.",
  e:"Entra cuando llevas 3×30 s colgado. Aquí progresas en control y repeticiones, no en kilos."},
 /* ---- empuje vertical y hombro ---- */
 press_mil_n:{n:"Press militar sentado, agarre neutro",pat:"emp_ver",req:["banco"],tipo:"mancuerna",inc:1,r:[10,12],s:3,ini:5,zona:"superior",evita:["hombI"],alt:["elev_lat"],nivel:1,
  q:"press militar sentado mancuernas neutro",
  c:"Respaldo alto, palmas enfrentadas. Empuja por encima de la cabeza sin arquear la lumbar: aprieta abdomen y glúteo. Nada por detrás de la línea de la oreja.",
  b:"Exhala al empujar. Nunca aguantes el aire.",
  e:"El hombro izquierdo sube sin dolor; hacia atrás no. Por eso no hay nada tras nuca."},
 elev_lat:{n:"Elevaciones laterales",pat:"hombro",req:[],tipo:"mancuerna",inc:1,r:[12,15],s:2,ini:2,zona:"superior",evita:[],alt:["face_pull"],nivel:1,
  q:"elevaciones laterales mancuernas",
  c:"Peso ligero de verdad. Sube hasta la altura del hombro, codo algo flexionado. Sin balanceo.",
  b:"Respiración continua.",
  e:"Si necesitas impulso, pesa demasiado."},
 face_pull:{n:"Face pull con banda",pat:"hombro",req:["banda"],tipo:"banda",inc:0,r:[15,20],s:2,zona:"superior",evita:[],alt:["elev_lat"],nivel:1,
  q:"face pull banda elastica",
  c:"Banda anclada a la altura de la cara. Tira hacia la cara separando las manos, codos altos, aprieta las escápulas.",
  b:"Respiración continua.",
  e:"Salud del manguito operado. Dos minutos, cero excusas."},
 /* ---- transporte ---- */
 granjero:{n:"Paseo del granjero",pat:"carry",req:[],tipo:"mancuerna",inc:2,r:[30,40],s:3,seg:1,ini:10,zona:"superior",evita:[],alt:["plancha_ant"],nivel:1,
  q:"paseo del granjero farmer walk",
  c:"Una mancuerna en cada mano, camina erguido, hombros atrás, pasos cortos. 30-40 segundos ida y vuelta.",
  b:"Respira con normalidad todo el recorrido. Aquí es donde más se tiende a bloquear el aire.",
  e:"Tu mejor ejercicio: carga colgando, muñeca neutra, agarre, core, postura. Cero técnica que aprender."},
 /* ---- antebrazo (prevención codo de pádel) ---- */
 exc_mun:{n:"Extensión excéntrica de muñeca derecha",pat:"antebrazo",req:[],tipo:"mancuerna",inc:0.5,r:[15,15],s:3,ini:2,zona:"superior",evita:["codoD"],alt:[],nivel:1,
  q:"eccentric wrist extension epicondylitis",
  c:"Antebrazo derecho apoyado en el muslo, palma hacia abajo, mancuerna ligera. Baja la muñeca en 4 segundos; sube ayudándote con la otra mano. Solo la derecha.",
  b:"Respiración continua.",
  e:"La medida preventiva con más respaldo para la epicondilitis, y la tuya viene del pádel. La izquierda no tiene el movimiento: no lo hace."},
 /* ---- core ---- */
 plancha_ant:{n:"Plancha de antebrazos",pat:"core",req:[],tipo:"corporal",inc:0,r:[30,45],s:3,seg:1,zona:"core",evita:[],alt:["dead_bug"],nivel:1,
  q:"plancha antebrazos tecnica",
  c:"Antebrazos y puntas de los pies. Cuerpo en línea, glúteo apretado, cadera ni alta ni hundida.",
  b:"Respira con normalidad. No aguantes el aire.",
  e:"Core sin manos ni rodillas en el suelo. Mejor 30 s perfectos que 60 con la cadera caída."},
 plancha_lat:{n:"Plancha lateral en antebrazo",pat:"core",req:[],tipo:"corporal",inc:0,r:[20,30],s:2,seg:1,zona:"core",evita:["hombI"],alt:["dead_bug"],nivel:1,
  q:"plancha lateral antebrazo",
  c:"Antebrazo en el suelo, codo bajo el hombro, cadera arriba y en línea. Rodillas apoyadas si hace falta, sobre algo blando.",
  b:"Respira con normalidad.",
  e:"Oblicuos y glúteo medio a la vez. Del lado izquierdo, solo si el hombro está bien ese día."},
 dead_bug:{n:"Dead bug",pat:"core",req:[],tipo:"corporal",inc:0,r:[10,12],s:2,zona:"core",evita:[],alt:["plancha_ant"],nivel:1,
  q:"dead bug ejercicio core",
  c:"Boca arriba, brazos y rodillas a 90°. Extiende brazo y pierna contrarios sin que la lumbar se despegue.",
  b:"Exhala al extender.",
  e:"Es tanto core como control de la respiración."},
 pallof:{n:"Press Pallof con banda",pat:"core",req:["banda"],tipo:"banda",inc:0,r:[10,12],s:2,zona:"core",evita:[],alt:["dead_bug"],nivel:1,
  q:"press pallof banda",
  c:"Banda anclada al lateral, manos en el pecho, extiende los brazos resistiendo el giro. De pie.",
  b:"Respiración continua.",
  e:"Core antirrotación: lo que protege la lumbar en cada golpe de pádel."}
};

/* Plantillas: cada sesión son huecos por patrón.
   fijo = siempre que esté disponible y desbloqueado; alt = si el fijo no puede;
   rota = va cambiando por bloques de 4 semanas entre los disponibles. */
var TPL={
 A:{n:"Fuerza A",s:"Rodilla · empuje horizontal · tracción horizontal · cadera lateral",slots:[
  {pat:"rodilla",fijo:"sent_banco",alt:["wall_sit","ext_term"]},
  {pat:"emp_hor",fijo:"press_manc_n",alt:["flex_nud"]},
  {pat:"trac_hor",fijo:"remo_manc",alt:["remo_trx"]},
  {pat:"unilateral",rota:["step_up","zancada_inv"]},
  {pat:"cadera_lat",fijo:"abd_banda",alt:["almeja"]},
  {pat:"hombro",fijo:"face_pull",alt:["elev_lat"]},
  {pat:"core",rota:["plancha_ant","dead_bug","plancha_lat"]}]},
 B:{n:"Fuerza B",s:"Bisagra · tracción vertical · empuje vertical · transporte",slots:[
  {pat:"bisagra",rota:["pm_rumano_m","swing"]},
  {pat:"trac_ver",fijo:"dom_neg",alt:["colgarse","remo_trx"]},
  {pat:"emp_ver",fijo:"press_mil_n",alt:["elev_lat"]},
  {pat:"gluteo",fijo:"puente",alt:["pm_rumano_m"]},
  {pat:"carry",fijo:"granjero",alt:["plancha_ant"]},
  {pat:"rodilla",fijo:"ext_term",alt:["wall_sit"]},
  {pat:"core",fijo:"pallof",alt:["dead_bug"]}]}
};
/* Bloque de antebrazo: se añade al final de las dos sesiones mientras haya pádel. */
var EXTRA_PADEL=["exc_mun"];

var PATN={rodilla:"Rodilla dominante",unilateral:"Unilateral de pierna",bisagra:"Bisagra de cadera",gluteo:"Glúteo / extensión de cadera",cadera_lat:"Cadera lateral",emp_hor:"Empuje horizontal",emp_ver:"Empuje vertical",trac_hor:"Tracción horizontal",trac_ver:"Tracción vertical",hombro:"Hombro",carry:"Transporte",antebrazo:"Antebrazo",core:"Core"};
var NOM={banco:"Banco reclinable",torre:"Torre de dominadas",trx:"TRX",banda:"Bandas elásticas",escalon:"Escalón bajo (20 cm)",bici:"Bici estática",paralelas:"Barras paralelas",bosu:"Bosu",comba:"Comba",saco:"Saco de boxeo",rodillo:"Rodillo (foam roller)",rueda:"Rueda abdominal"};
var ARTIC={rodD:"Rodilla derecha",rodI:"Rodilla izquierda",cadera:"Caderas",munI:"Muñeca izquierda",hombI:"Hombro izquierdo",codoD:"Codo derecho"};
var DIAS=['lun','mar','mie','jue','vie','sab','dom'];
var DIAN={lun:"Lunes",mar:"Martes",mie:"Miércoles",jue:"Jueves",vie:"Viernes",sab:"Sábado",dom:"Domingo"};
var DIAL={lun:'L',mar:'M',mie:'X',jue:'J',vie:'V',sab:'S',dom:'D'};

/* ---- MOVILIDAD: 8 minutos, sin rodillas en el suelo, sin apoyar la muñeca ---- */
var MOV=[
 {n:"Marcha en el sitio o bici suave",seg:60,c:"Sube la temperatura. Brazos sueltos, rodillas altas sin forzar."},
 {n:"90/90 en silla, pierna derecha",seg:45,c:"Sentado, tobillo derecho sobre la rodilla izquierda. Espalda recta, inclínate hacia delante hasta notar el glúteo. Sin rebotes."},
 {n:"90/90 en silla, pierna izquierda",seg:45,c:"Igual con la otra pierna. Si la cadera pincha en la ingle, menos inclinación."},
 {n:"Flexor de cadera de pie, derecha",seg:40,c:"Zancada larga con la mano en la pared, pierna derecha atrás. Aprieta el glúteo de atrás y adelanta la cadera. La rodilla no toca el suelo."},
 {n:"Flexor de cadera de pie, izquierda",seg:40,c:"Igual con la izquierda atrás. Esto es el antídoto contra la silla y el coche."},
 {n:"Rotación dorsal contra la pared",seg:60,c:"De lado a la pared, brazos al frente. Abre el brazo exterior girando el tronco hasta tocar la pared. Alterna lados cada 5."},
 {n:"Péndulo y círculos de hombro",seg:60,c:"Tronco inclinado, brazo colgando, círculos pequeños que crecen. Después, 10 círculos grandes hacia atrás con cada brazo."},
 {n:"Gato-vaca de pie, puños en la pared",seg:60,c:"Manos en PUÑO apoyadas en la pared. Redondea la espalda exhalando, arquéala inhalando. Lento, con la respiración."},
 {n:"Balanceos de pierna",seg:60,c:"Mano en la pared. 15 balanceos adelante-atrás y 15 laterales con cada pierna. Controlado, sin llegar al final del rango."}
];

/* ---- CALENTAMIENTO PÁDEL: 8-10 minutos antes de cada partido ---- */
var CAL_PADEL=[
 {n:"Trote suave o marcha rápida",seg:120,c:"Alrededor de la pista. Nada de correr fuerte todavía."},
 {n:"Círculos de cadera y hombro",seg:60,c:"10 en cada sentido. Rodillas sueltas."},
 {n:"20 sentadillas a paralelo sin peso",seg:60,c:"Hasta paralelo, no más. Rodillas siguiendo los pies."},
 {n:"Rotaciones de antebrazo con la pala",seg:60,c:"Pala en la mano derecha, gira la muñeca y el antebrazo despacio, 15 en cada sentido. Aprieta el mango a 6 de 10, no a 9."},
 {n:"Desplazamientos laterales y cambios de dirección",seg:60,c:"Suaves, aumentando poco a poco. Aquí es donde las rodillas avisan si no están."},
 {n:"Peloteo progresivo",seg:180,c:"Globos y voleas suaves antes de pegar. Los primeros 3 minutos son calentamiento, no partido."}
];

/* ---- COMIDA ----
   Objetivo orientativo: ~2.300 kcal, ~130 g de proteína (1,6 g/kg). Sin contar.
   Sin DASH ni límite de sal: no hay hipertensión conocida. */
var PLATO={
 mitad:"Mitad del plato: verdura u hortaliza, la que sea, cruda o cocinada.",
 cuarto1:"Un cuarto: proteína del tamaño de la palma y el grosor de la mano. Pollo, pescado, huevos, legumbre, carne magra.",
 cuarto2:"Un cuarto: patata, arroz, pasta, pan o legumbre. Un puño. Los días de fuerza y pádel, un puño y medio.",
 grasa:"Una cucharada de aceite de oliva o un puñado de frutos secos. No más."
};
var MENU_DIA={
 fuerza:[{h:"Desayuno",t:"2-3 huevos revueltos o tortilla con verdura, 1 rebanada de pan con tomate y aceite, café."},
  {h:"Media mañana",t:"Yogur natural o griego y una pieza de fruta. Si vas en coche, un puñado de frutos secos y la fruta."},
  {h:"Comida",t:"Plato completo: proteína (150-200 g), verdura, y un puño y medio de arroz, patata o legumbre."},
  {h:"Merienda",t:"Fruta y un puñado de almendras o nueces, o un yogur con avena."},
  {h:"Cena",t:"Pescado o pollo (150-200 g) con verdura. Patata o boniato pequeño. Sin postre dulce; si acaso fruta o yogur."}],
 padel:[{h:"Desayuno",t:"Lo de siempre: huevos, pan con tomate, fruta, café."},
  {h:"Comida",t:"Plato completo con un puño y medio de hidrato: hoy hay partido a las 19."},
  {h:"17:30, antes del pádel",t:"Un plátano y un yogur, o una tostada con pavo. Llegar vacío al partido se nota en la segunda hora."},
  {h:"Cena después del partido",t:"Ligera y con proteína: tortilla con verdura, o pescado con ensalada. Agua, no cerveza como norma; la de después del partido, si cae, que sea una."}],
 normal:[{h:"Desayuno",t:"Huevos o yogur con avena y fruta. Café."},
  {h:"Comida",t:"Plato completo con un puño de hidrato."},
  {h:"Merienda",t:"Fruta, o frutos secos, o yogur. Una cosa, no las tres."},
  {h:"Cena",t:"Proteína y verdura. Hidrato pequeño o ninguno: hoy no has entrenado."}],
 carretera:[{h:"Antes de salir",t:"Desayuno de verdad en casa: huevos y pan. Sin desayuno, la gasolinera gana."},
  {h:"En el coche",t:"Lleva fruta, frutos secos y agua. Lo que no llevas, lo compras mal."},
  {h:"Comida fuera",t:"Menú del día: primero de verdura o legumbre, segundo de carne o pescado a la plancha, agua. Sin pan de más, sin postre dulce. Café."},
  {h:"Cena de emergencia",t:"Una de las tres de abajo. Diez minutos y a la cama."}]
};
var CENAS_EMERGENCIA=[
 {n:"Tortilla de 3 huevos con lo que haya",t:"Espinacas, calabacín, cebolla o lo que quede. Tomate en ensalada al lado. 8 minutos."},
 {n:"Lata de atún o caballa con legumbre de bote",t:"Garbanzos o alubias escurridos, atún, pimiento, aceite y vinagre. 3 minutos. Proteína y fibra sin cocinar."},
 {n:"Pechuga a la plancha con verdura congelada",t:"Salteado de verduras congelado en sartén, pechuga fileteada fina al lado. 10 minutos. Sal y pimentón."}
];
var COMPRA=[["Proteína",[["Huevos","2 docenas"],["Pollo (pechuga o contramuslo)","1 kg"],["Pescado (merluza, bacalao, salmón)","600 g"],["Atún o caballa en lata","4 latas"],["Yogur natural o griego","8 uds"],["Queso fresco o batido","300 g"]]],
["Hidrato",[["Patata y boniato","1,5 kg"],["Arroz","500 g"],["Pan de verdad","2 barras"],["Avena","500 g"],["Legumbre cocida en bote","3 botes"],["Pasta integral","500 g"]]],
["Verdura y fruta",[["Verdura de temporada","2 kg"],["Verdura congelada para saltear","2 bolsas"],["Ensalada lista","2 bolsas"],["Tomate","1 kg"],["Cebolla y ajo",""],["Fruta variada","2 kg"],["Plátano","6 uds"]]],
["Grasa y despensa",[["Aceite de oliva virgen","1 L"],["Frutos secos sin sal","400 g"],["Pimentón, orégano, pimienta",""],["Café",""]]]];
