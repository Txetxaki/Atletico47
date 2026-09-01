# Atlético 47

PWA de fuerza, pádel, cuerpo y comida para un hombre de 47 años con cinco
operaciones, artrosis en caderas y muñeca izquierda, y quince años parado.
Derivada de Atlético 44 en arquitectura, no en contenido: aquí no hay nada que
no le sirva a él. El plan y el porqué de cada decisión están en el documento
de diseño; este LEEME es la parte técnica.

**Estado:** lista para desplegar. Falta decidir el nombre definitivo (este es
provisional) y poner la clave del Coach.

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

Otro puerto que Atlético 44 = otro origen = otro `localStorage` y otra base de
datos. Las dos apps conviven en la misma Pi sin tocarse.

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
| **Comida** | Método del plato, menú por tipo de día, tres cenas de emergencia, desvíos, lista de la compra | ~2.300 kcal y ~130 g de proteína sin contar; sin DASH ni límite de sal |
| **Coach** | Chat con perfil, lesiones, reglas duras e historial completo | La clave vive en el servidor, no en el HTML |
| **Ajustes** | Días de pádel y fuerza, verano, material, **articulaciones en fase mala**, ejercicios propios, push, copia de seguridad | Que el plan cambie sin tocar código |

## Qué decide el motor

- **Qué toca:** días de fuerza y pádel desde Ajustes. Primer día de fuerza = A, segundo = B. Con un solo día, alterna por semanas. Verano quita el pádel.
- **Disponibilidad:** un ejercicio entra si hay material, si ninguna articulación marcada «en fase mala» está en su lista `evita`, y si está desbloqueado (nivel 2 desde la semana 6, nivel 3 desde la 13 y solo sin dolor >3 en 8 semanas).
- **Ajustes del día:** pádel ayer → una serie menos de pierna y carga al 90 %. Rodillas ≥4 → fuera step-up, entra extensión terminal, carga al 85 %. Menos de 5 h dormidas → una serie menos en todo. Rodillas ≥7 → aviso de no cargar pierna.
- **Progresión:** doble progresión (reps hasta el tope, luego kilos), bloqueada en las semanas 1-4 (tendones). Descarga cada 5ª semana o adelantada si el dolor sube tres registros seguidos.
- **Alertas:** tensión ≥180/110 (no entrena), ≥140/90 (repetir y consultar), codo ≥4 dos partidos seguidos, rodilla ≥6 tras partido, dolor en tendencia ascendente.

## Datos

Doble capa, igual que Atlético 44: `localStorage` (clave `a47v1`, síncrono,
siempre primero) y SQLite en la Pi como sincronización. Gana el último por
marca de tiempo; cada escritura deja instantánea en `historial`.

## Poner en marcha en la Pi

```bash
# 1. Código
git clone <repo> ~/atletico47          # o mueve esta carpeta a su propio repo
cd ~/atletico47
npm install --omit=dev                 # solo @anthropic-ai/sdk, para el Coach

# 2. Coach (opcional): la clave NUNCA va a git
cp coach.ejemplo.json coach.json && nano coach.json

# 3. Servicios
sudo cp systemd/atletico47-*.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now atletico47-web.service
curl http://127.0.0.1:8091/api/salud

# 4. Tailscale Serve, en otro puerto que Atlético 44
sudo tailscale serve --bg --https=10047 http://127.0.0.1:8091

# 5. Push (opcional)
cd servidor-push && npm install && node push.js --claves
# pega la clave pública en Ajustes → Suscribir → Copiar suscripción → suscripciones.json (array)
sudo systemctl enable --now atletico47-push.service
```

Si el Coach no está configurado, la pestaña lo dice y todo lo demás funciona.

## Trabajar en la app

No hay build. Edita `sitio/` y recarga. Para probar con la API:

```bash
node servidor-web.js       # http://127.0.0.1:8091
```

**Antes de commitear cualquier cambio dentro de `sitio/`:**

```bash
./scripts/version-sw.sh    # sube a47-vN -> a47-v(N+1)
```

Iconos: `tools/icono.html` renderizado con Chromium headless a 512, 192 y 180 px
(`?masc=1` para el maskable).

## Desplegar y respaldar

```bash
ssh txetxaki@raspberry.taile8249e.ts.net '~/atletico47/scripts/desplegar.sh'
~/atletico47/scripts/respaldo-db.sh      # cron diario recomendado, ver el script
```

## Lo que falta

- [ ] Nombre definitivo y repo propio (esta carpeta es autocontenida: se mueve tal cual)
- [ ] `coach.json` con la clave
- [ ] Puerto de Tailscale Serve
- [ ] Claves VAPID y `suscripciones.json`
- [ ] Sacar los respaldos de la Pi a otra máquina
- [ ] Una visita de fisio para rodillas y cadera antes de cargar en serio: el plan arranca igual con cargas bajas, pero el rango lo debería confirmar alguien que le vea moverse
