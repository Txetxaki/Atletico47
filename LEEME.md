# OsmaGym

PWA de fuerza, pádel, cuerpo y comida para Osma: cinco operaciones, artrosis
en caderas y muñeca izquierda, y quince años parado. Antes se llamaba Atlético
47 (nombre provisional); OsmaGym es el definitivo, con estética de cabina de
DJ. Derivada de una PWA hermana anterior en arquitectura, no en contenido:
aquí no hay nada que no le sirva a él, y el pádel se queda porque es su
deporte. El plan y el porqué de cada decisión están en el documento de
diseño; este LEEME es la parte técnica.

**Estado:** lista para desplegar. Falta poner la clave del Coach.

## Diseño: cabina de DJ

Fondo casi negro, acentos neón magenta/cian, motivos de mesa de mezclas
usados con moderación: la barra de progreso de Entreno es un vúmetro con
segmentos y resplandor, los separadores de sección (`h3.sec`) llevan una
forma de onda muy sutil en vez de una línea recta, y la cabecera tiene una
textura de surcos de vinilo de fondo. Tipografía: **Monoton** solo para el
logotipo «OsmaGym» del encabezado (estética de flyer de club), **Barlow
Condensed** para el resto de titulares (ya estaba), **IBM Plex Sans/Mono**
para cuerpo y cifras. Los nombres de las pestañas siguen en español llano.
Respeta `prefers-reduced-motion`. El icono (`tools/icono.html`) es un vinilo
con el mono­grama «IG» en el label y un brazo de plato en cian.

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
| `api-coach.js` | Proxy al Coach: la clave nunca sale del servidor |
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
| **Coach** | Chat con perfil, lesiones, reglas duras e historial completo | La clave vive en el servidor, no en el HTML |
| **Ajustes** | Días de pádel y fuerza, hora del partido, descansos, **articulaciones en fase mala**, **sustituciones permanentes**, material (incluido el propio), **ejercicios propios** con material y alternativa, **movilidad editable**, objetivos de comida, push, copia de seguridad | Que el plan cambie sin tocar código |

## Qué decide el motor

- **Qué toca:** días de fuerza y pádel desde Ajustes. Primer día de fuerza = A, segundo = B. Con un solo día, alterna por semanas. Verano quita el pádel.
- **Sustituciones permanentes:** desde Entreno, «usar siempre X en lugar de Y» (mismo patrón o alternativa). El motor lo aplica en cada sesión; se quitan en Ajustes.
- **Disponibilidad:** un ejercicio entra si hay material (de la lista o propio), si ninguna articulación marcada «en fase mala» está en su lista `evita`, y si está desbloqueado (nivel 2 desde la semana 6, nivel 3 desde la 13 y solo sin dolor >3 en 8 semanas).
- **Ajustes del día:** pádel ayer → una serie menos de pierna y carga al 90 %. Rodillas ≥4 → fuera step-up, entra extensión terminal, carga al 85 %. Menos de 5 h dormidas → una serie menos en todo. Rodillas ≥7 → aviso de no cargar pierna.
- **Progresión:** doble progresión (reps hasta el tope, luego kilos), bloqueada en las semanas 1-4 (tendones). Descarga cada 5ª semana o adelantada si el dolor sube tres registros seguidos.
- **Alertas:** tensión ≥180/110 (no entrena), ≥140/90 (repetir y consultar), codo ≥4 dos partidos seguidos, rodilla ≥6 tras partido, dolor en tendencia ascendente.

## Datos

Doble capa, igual que la PWA hermana: `localStorage` (clave `a47v1`, síncrono,
siempre primero) y SQLite en la Pi como sincronización. Gana el último por
marca de tiempo; cada escritura deja instantánea en `historial`.

## Poner en marcha en la Pi

```bash
# 1. Código
git clone <repo> ~/atletico47          # el directorio se llama asi por continuidad, ver nota abajo
cd ~/atletico47
npm install --omit=dev                 # solo @anthropic-ai/sdk, para el Coach

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
o `osmagym`. Es solo la PWA estática: sin servidor, sin API, sin Coach, sin
push. `storage-remote.js` intenta hablar con `/api` y, si no existe (como en
Pages), cae en silencio a `localStorage` sin avisos molestos; la app funciona
igual, solo que sin sincronizar entre dispositivos.

## Lo que falta

- [ ] `coach.json` con la clave
- [ ] Puerto de Tailscale Serve
- [ ] Claves VAPID y `suscripciones.json`
- [ ] Sacar los respaldos de la Pi a otra máquina
- [ ] Una visita de fisio para rodillas y cadera antes de cargar en serio: el plan arranca igual con cargas bajas, pero el rango lo debería confirmar alguien que le vea moverse
