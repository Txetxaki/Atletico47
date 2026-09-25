# OsmaGym

PWA de fuerza, pádel, cuerpo y comida para Osma: cinco operaciones, artrosis
en caderas y muñeca izquierda, y quince años parado. Antes se llamaba Atlético
47 (nombre provisional); OsmaGym es el definitivo, con estética de cabina de
DJ. Derivada de una PWA hermana anterior en arquitectura, no en contenido:
aquí no hay nada que no le sirva a él, y el pádel se queda porque es su
deporte. El plan y el porqué de cada decisión están en el documento de
diseño; este LEEME es la parte técnica.

**Estado:** lista para desplegar. Falta poner la clave de MiniMax (`MINIMAX_API_KEY`) y el código del Coach (`COACH_CODE`).

## Diseño: sound system de rap/dancehall

Fondo negro asfalto con grano sutil, acentos oro/verde/rojo (bandera de
sound system jamaicano), texto crema cálido. La barra de progreso de
Entreno es un vúmetro con segmentos y resplandor dorado, los separadores
de sección (`h3.sec`) llevan una forma de onda muy sutil (bassline) en vez
de una línea recta, la cabecera lleva un tricolor rojo-oro-verde fino en
el borde inferior y una textura de aros concéntricos (cono de altavoz) muy
tenue de fondo. Tipografía: **Bungee** para el logotipo «OsmaGym» y los
titulares de sección (estética de flyer callejero/graffiti, legible),
**Barlow Condensed** para pestañas, botones y cifras destacadas (ya
estaba), **IBM Plex Sans/Mono** para cuerpo y cifras. Los nombres de las
pestañas siguen en español llano. Respeta `prefers-reduced-motion`. El
icono (`tools/icono.html`) es un altavoz/subwoofer con el monograma «OG»
en la tapa central, un tricolor rojo-oro-verde y un micrófono apoyado en
la esquina.

---

## Cómo está montado

```
Tailscale Serve (HTTPS :10047, o el puerto que elijas)
  └─> servidor-web.js (127.0.0.1:8091, solo loopback)
        ├─ sitio/            la PWA
        ├─ /api/estado/*  ──> api-estado.js ──> datos/atletico47.db (SQLite, WAL)
        └─ /api/coach     ──> api-coach.js  ──> API de Claude (clave en coach.json)

servidor-push/push.js (proceso aparte) ──> web-push ──> notificaciones al móvil
```

Otro puerto que la PWA hermana = otro origen = otro `localStorage` y otra
base de datos. Las dos apps conviven en la misma Pi sin tocarse.

La clave de `localStorage` (`a47v1`), el fichero `datos/atletico47.db`, las
rutas `/api/*` y el puerto 8091 se mantienen tal cual desde la versión
anterior: son identificadores de datos, y cambiarlos le haría perder el
historial. Tampoco cambian las unidades systemd (`atletico47-web.service` y
`atletico47-push.service`): renombrarlas rompería `desplegar.sh`. Lo que cambia es lo visible (título, iconos, avisos) y el paquete npm.

| Ruta | Qué es |
|---|---|
| `sitio/index.html` | Estructura y estilos |
| `sitio/biblioteca.js` | Ejercicios, plantillas A/B, movilidad, calentamiento de pádel, comida |
| `sitio/motor.js` | Estado, persistencia, qué toca cada día, disponibilidad, ajustes diarios, progresión, alertas |
| `sitio/app.js` | Las ocho pestañas y el arranque |
| `sitio/storage-remote.js` | Puente `window.storage`: sincroniza `localStorage` con la Pi (clave `a47v1`) |
| `sitio/sw.js` | Service worker: caché sin conexión y recepción de push |
| `sitio/migrar.html` | Mueve el blob de un origen a otro |
| `servidor-web.js` | Estático + enrutado de `/api/*` (puerto 8091, variable `PUERTO`) |
| `api-estado.js` | Estado en SQLite con 60 instantáneas por clave |
| `api-coach.js` | Proxy al Coach en la Pi (MiniMax); la clave nunca sale del servidor |
| `api/coach.js` | El mismo proxy, como función serverless de Vercel (para cuando la PWA se sirve desde GitHub Pages) |
| `coach-core.js` | Núcleo compartido por los dos proxys: llamada a MiniMax, herramientas, validación del código |
| `vercel.json` / `.vercelignore` | Config de Vercel: `sitio/` como estático, `api/` como funciones |
| `servidor-push/push.js` | Planificador de avisos; horarios en `agenda.json` |
| `scripts/` | Despliegue, respaldo, versión del service worker |
| `systemd/` | Unidades para la Pi |
| `tools/icono.html` | Fuente de los iconos (render con Chromium headless) |

## Las pestañas

| Pestaña | Qué hace | Por qué existe |
|---|---|---|
| **Hoy** | Qué toca, tres preguntas (rodillas 0-10, horas dormidas, ¿jugaste ayer?), movilidad guiada de 8 min, la semana | Abrir la app tiene que responder «¿qué hago?» en un segundo, y la sesión se ajusta sola a cómo viene |
| **Entreno** | Sesión A o B con peso propuesto, montaje, series, RPE, y botón **«Me duele»** que cambia el ejercicio por su alternativa al momento | Con sus rodillas, el plan del papel y el de las 7 de la mañana no siempre coinciden |
| **Progreso** | Calendario (fuerza, pádel, movilidad), volumen semanal, progresión por ejercicio, cerrar semana | Lo de siempre |
| **Pádel** | Calentamiento guiado de 9 min, registro de partido (minutos, intensidad, rodillas y codo después, hielo), carga semanal | Es la mitad de su actividad y el origen de su última lesión |
| **Cuerpo** | Semanal: peso, cintura, dolor por articulación, sueño de noche y siesta, tabaco opcional, tensión trimestral | Sustituye a Tensión: él no es hipertenso. Lo que decide la progresión es el dolor por articulación |
| **Comida** | **Diario de lo que ha comido de verdad** (momento, qué, en plan o no), «mis platos» para apuntar rápido, menú de referencia por tipo de día, cenas de emergencia, lista de la compra | Lo que decide la barriga es lo que come, no lo que debería; el Coach lee el diario |
| **Coach** | Chat con perfil, lesiones, reglas duras e historial completo. Puede ajustar el plan él solo (ver más abajo) | La clave vive en el servidor, no en el HTML |
| **Ajustes** | Días de pádel y fuerza, hora del partido, descansos, **articulaciones en fase mala**, **sustituciones permanentes**, material (incluido el propio), **ejercicios propios** con material y alternativa, **movilidad editable**, objetivos de comida, push, copia de seguridad | Que el plan cambie sin tocar código |

## Qué decide el motor

- **Qué toca:** días de fuerza y pádel desde Ajustes. Primer día de fuerza = A, segundo = B. Con un solo día, alterna por semanas. Verano quita el pádel.
- **Sustituciones permanentes:** desde Entreno, «usar siempre X en lugar de Y» (mismo patrón o alternativa). El motor lo aplica en cada sesión; se quitan en Ajustes.
- **Disponibilidad:** un ejercicio entra si hay material (de la lista o propio), si ninguna articulación marcada «en fase mala» está en su lista `evita`, y si está desbloqueado (nivel 2 desde la semana 6, nivel 3 desde la 13 y solo sin dolor >3 en 8 semanas).
- **Ajustes del día:** pádel ayer → una serie menos de pierna y carga al 90 %. Rodillas ≥4 → fuera step-up, entra extensión terminal, carga al 85 %. Menos de 5 h dormidas → una serie menos en todo. Rodillas ≥7 → aviso de no cargar pierna.
- **Progresión:** doble progresión (reps hasta el tope, luego kilos), bloqueada en las semanas 1-4 (tendones). Descarga cada 5ª semana o adelantada si el dolor sube tres registros seguidos.
- **Alertas:** tensión ≥180/110 (no entrena), ≥140/90 (repetir y consultar), codo ≥4 dos partidos seguidos, rodilla ≥6 tras partido, dolor en tendencia ascendente.

## Replanificación automática de la semana

Si Osma registra algo fuera de plan, el resto de la semana actual (fechas
posteriores, sin registrar todavía) se reajusta solo — regla completa y
comentada en `sitio/motor.js`, sección «REPLANIFICACIÓN DE LA SEMANA»:

- Fuerza fuera de plan (botón **«Entrenar fuerza igualmente»** en Entreno, en
  un día que no tocaba): si el día siguiente ya tocaba fuerza, pasa a
  descanso y su sesión se mueve al primer hueco libre de la semana; si no,
  el siguiente día de fuerza que quede recibe la plantilla contraria (A/B).
- Un día de fuerza planificado que se queda sin registrar mueve su sesión al
  primer hueco libre posterior, en cuanto pasa su fecha.
- Partido de pádel no planificado: la regla «pádel ayer» (una serie menos de
  pierna, 90 % de carga) ya mira el partido registrado, sea o no un día
  configurado, así que no hace falta nada más.
- Rodillas ≥4 en las preguntas del día o en Cuerpo: las próximas sesiones de
  fuerza de la semana entran ya con el cambio de ejercicio (step-up →
  extensión terminal). Menos de 5 h dormidas: una serie menos también en lo
  que queda de semana.

Cada ajuste queda en `S.plan[fecha]` con un motivo en español, visible en la
tira de la semana (borde e icono ↻), en Hoy y en Entreno. **«Restaurar
semana»** deshace lo que no se haya registrado todavía; nunca toca el
pasado. Se limpia también al cerrar semana.

## Datos

Doble capa, igual que la PWA hermana: `localStorage` (clave `a47v1`, síncrono,
siempre primero) y SQLite en la Pi como sincronización. Gana el último por
marca de tiempo; cada escritura deja instantánea en `historial`.

## Poner en marcha en la Pi

```bash
# 1. Código
git clone <repo> ~/atletico47          # el directorio se llama asi por continuidad, ver nota abajo
cd ~/atletico47
npm install --omit=dev                 # sin dependencias: el Coach usa fetch a pelo, sin SDK

# 2. Coach (opcional): la clave NUNCA va a git
cp coach.ejemplo.json coach.json && nano coach.json

# 3. Servicios
sudo cp systemd/atletico47-*.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now atletico47-web.service
curl http://127.0.0.1:8091/api/salud

# 4. Tailscale Serve, en otro puerto que la PWA hermana
sudo tailscale serve --bg --https=10047 http://127.0.0.1:8091

# 5. Push (opcional)
cd servidor-push && npm install && node push.js --claves
# pega la clave pública en Ajustes → Suscribir → Copiar suscripción → suscripciones.json (array)
sudo systemctl enable --now atletico47-push.service
```

Si el Coach no está configurado, la pestaña lo dice y todo lo demás funciona.

**Nota sobre el directorio `~/atletico47`:** es el checkout de git ya
desplegado en la Pi, y `scripts/desplegar.sh` da por hecho esa ruta. Se
mantiene con ese nombre a propósito, para no tener que mover nada en
producción; el nombre de la app en todas partes visibles (título, iconos,
notificaciones) ya es OsmaGym. Si algún día se renombra
también el directorio, hay que actualizar `BASE=` en `scripts/desplegar.sh`
y `scripts/respaldo-db.sh`, y las rutas `WorkingDirectory=`/`ExecStart=` de
los dos `.service`.

## Trabajar en la app

No hay build. Edita `sitio/` y recarga. Para probar con la API:

```bash
node servidor-web.js       # http://127.0.0.1:8091
```

**Antes de commitear cualquier cambio dentro de `sitio/`:**

```bash
./scripts/version-sw.sh    # sube og-vN -> og-v(N+1)
```

Iconos: `tools/icono.html` se renderiza siempre a 512 px con Chromium headless
(`?masc=1` para el maskable) y de ahí se reduce a 192 y 180 px con `magick -resize`:
la página tiene tamaño fijo y a otra resolución sale recortada.

## Desplegar y respaldar

```bash
ssh txetxaki@raspberry.taile8249e.ts.net '~/atletico47/scripts/desplegar.sh'
~/atletico47/scripts/respaldo-db.sh      # cron diario recomendado, ver el script
```

## GitHub Pages

`.github/workflows/pages.yml` publica `sitio/` en Pages en cada push a `main`
o `osmagym`. Es solo la PWA estática: sin servidor propio, sin `/api/estado`,
sin push. `storage-remote.js` intenta hablar con `/api` y, si no existe (como
en Pages), cae en silencio a `localStorage` sin avisos molestos; la app
funciona igual, solo que sin sincronizar entre dispositivos. El Coach SÍ
funciona desde Pages: `coachURL()` en `sitio/app.js` detecta que el origen es
`*.github.io` y usa `https://osmagym.vercel.app/api/coach` en vez de la ruta
relativa — ver la sección siguiente.

## El Coach (MiniMax)

Un solo proveedor para los tres sitios donde puede vivir la app (Pi, Vercel,
local): **MiniMax Token Plan**, con una API compatible con la de Anthropic.
Toda la lógica de llamada y las herramientas están en `coach-core.js`, y la
usan tanto `api-coach.js` (Pi) como `api/coach.js` (función de Vercel) — sin
SDK, `fetch` a pelo.

**Variables de entorno** (en Vercel: Project Settings → Environment
Variables; en la Pi: pueden ir en `coach.json` o en el entorno del proceso):

| Variable | Qué es | Obligatoria |
|---|---|---|
| `MINIMAX_API_KEY` | Clave de la cuenta de MiniMax Token Plan | Sí |
| `COACH_CODE` | Código que debe mandar el cliente (cabecera `x-coach-code`); sin él, 401. En Vercel es recomendable siempre, porque el endpoint es público | En Vercel sí; en la Pi opcional (ya está tras Tailscale) |
| `MINIMAX_MODEL` | Modelo, por defecto `MiniMax-M3` | No |
| `MINIMAX_MAX_TOKENS` | Tope de tokens de salida, por defecto 1500 | No |

En la Pi, `coach.json` (fuera de git) puede llevar `clave`, `modelo`,
`max_tokens` y `codigo` en vez de variables de entorno; las variables de
entorno, si están, mandan. En Ajustes → Coach, «Código del Coach» es lo que
el cliente guarda en local y manda como `x-coach-code`.

**Vercel:** `vercel.json` sirve `sitio/` como salida estática
(`outputDirectory`) sin build (`buildCommand: null`) y Vercel detecta
`api/coach.js` como función Node automáticamente. `.vercelignore` deja fuera
todo lo que es cosa de la Pi (`datos/`, `servidor-push/`, `systemd/`,
`scripts/`, `tools/`, `coach.json`). Desde el repo: `vercel link` y luego
`vercel env add MINIMAX_API_KEY` / `vercel env add COACH_CODE` (y opcionales),
`vercel --prod` para desplegar.

**Acciones (el Coach se auto-incorpora al plan):** además de texto, el
modelo puede llamar a herramientas — `sustituir_ejercicio`,
`ajustar_ejercicio`, `marcar_articulacion`, `ajustar_semana`,
`regenerar_semana`, `ajustar_objetivos_comida`, `anadir_nota_plan`,
`programar_descarga` (definidas en `coach-core.js`, `TOOLS`). El SERVIDOR
nunca las aplica: solo las devuelve. El CLIENTE (`sitio/motor.js`, sección
«COACH: ACCIONES») valida cada una contra las reglas reales del plan
(el ejercicio existe y está `disponible()`, nunca una fecha pasada o ya
registrada, en las semanas 1-4 no se sube carga...) y, si «El Coach aplica
cambios solo» está activado (Ajustes por defecto), la aplica y la registra en
`S.coachLog`; si está desactivado, queda como propuesta con botón «Aplicar».
Todo lo aplicado se ve en la pestaña Coach, bajo «Cambios del Coach», con
«Deshacer» por cada cambio.

**Revisión diaria automática:** tras guardar una sesión, las preguntas del
día, un partido, un registro de Cuerpo, comida o una nota, `revisarCoachDiario()`
llama al Coach en segundo plano (como mucho una vez al día por tipo de
disparo, sin contar el chat ni «Analizar mi día», que siempre están
disponibles) y aplica sus acciones igual que en el chat. El resumen aparece
en Hoy: «Tu coach ha revisado el día: …».

## Lo que falta

- [ ] `MINIMAX_API_KEY` y `COACH_CODE` en Vercel, y `coach.json` en la Pi
- [ ] Puerto de Tailscale Serve
- [ ] Claves VAPID y `suscripciones.json`
- [ ] Sacar los respaldos de la Pi a otra máquina
- [ ] Una visita de fisio para rodillas y cadera antes de cargar en serio: el plan arranca igual con cargas bajas, pero el rango lo debería confirmar alguien que le vea moverse
