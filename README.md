# Santiago · Nivel 7

Invitación digital para el cumpleaños número 7 de Santiago, con temática Sonic y pensada para abrirse desde el teléfono. Cada familia recibe un enlace personal por WhatsApp o correo, confirma su asistencia, guarda la invitación como app o pase de Wallet, juega una carrera de anillos y, el día de la fiesta, comparte fotos en un álbum privado.

**Sitio:** [santiago.teolabs.app](https://santiago.teolabs.app)

![Sonic corre entre anillos dorados: ¡Santiago llega al nivel 7!](public/share.jpg)

## Qué incluye

**Para los invitados**

- Entrada animada: un sobre sellado que Sonic trae con el nombre de la familia.
- Pase personal con la carta de Santiago, fecha, horario y dirección (la dirección solo se muestra con un enlace válido).
- Confirmación por familia (adultos, niños y mensaje), editable después desde el mismo teléfono.
- Agregar al calendario (Google Calendar y `.ics`), cuenta regresiva y recordatorios push voluntarios.
- Instalación como PWA y pase para Apple Wallet / Google Wallet.
- «Birthday Run»: una carrera de 30 segundos con anillos, barreras y récord local.
- Personajes interactivos (Tails, Knuckles, Amy, Silver) con mensajes al tocarlos.
- Álbum privado del día de la fiesta: fotos, comentarios y corazones, solo para invitados.

**Para la organización** (`/#organizar`)

- Lista de invitaciones con enlace y código personal por familia.
- Envío por WhatsApp (mensaje listo para enviar) o por correo con vista previa.
- Resumen de asistentes, registro de llegada el día de la fiesta y moderación del álbum.
- Apertura y cierre del álbum por fechas, y descarga de todas las fotos en ZIP.

## Stack

- **Frontend:** React 19 + TypeScript + Vite, PWA con Workbox.
- **Backend:** Supabase (Auth anónimo, Postgres con RLS, Storage privado, Realtime).
- **Funciones Node en Vercel:** correo SMTP, emisión de pases Wallet, recordatorios push (cron diario) y borrado de invitaciones.
- Sin dependencias de animación ni video: todo es CSS, Web Audio y un bucle de juego propio.

## Estructura

```
api/          Funciones serverless (Vercel)
server/       Lógica compartida de correo, Wallet, push y recordatorios
src/          Aplicación React
supabase/     Migraciones y pruebas SQL
public/       Ilustraciones, iconos y service worker de push
tests/        Pruebas unitarias (Vitest)
```

## Desarrollo local

Requiere Node.js 22.

```sh
npm ci
cp .env.example .env      # completar las variables
npm run dev               # http://127.0.0.1:5173
```

Comandos útiles:

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo con las funciones de correo integradas |
| `npm run build` | Compila TypeScript y genera `dist/` |
| `npm test` | Pruebas unitarias |
| `npm run lint` | Verificación de tipos |
| `npm run assets` | Regenera las imágenes optimizadas, la imagen social y los iconos |
| `npm run niveles [carpeta]` | Prepara y sube la presentación «Niveles anteriores» (ver abajo) |

## Niveles anteriores (presentación para la fiesta)

Diapositivas con la historia del cumpleañero, música de fondo y, al cierre, los mensajes de las familias confirmadas. Solo la organización la ve, en `/#niveles`, pensada para proyectar en un televisor.

1. Coloca en `.local/niveles/` las fotos y videos numerados en el orden deseado (`1.jpg`, `2.mp4`, `3.jpg`…) y las canciones también numeradas (`1.mp3`, `2.m4a`…). Leyendas opcionales en `leyendas.txt`, una por línea: `3: Nivel 2 · 2021`.
2. Ejecuta `npm run niveles` (requiere `ffmpeg` en el PATH). Convierte todo a tamaño de proyección (fotos WebP 1920 px, video 720p H.264, audio AAC 96 k), lo sube a un bucket privado y sincroniza cambios: los archivos quitados de la carpeta se eliminan. Avisa si los videos superan los 2 minutos.
3. En la web, con la cuenta de organización, pulsa **Preparar para la fiesta** en el equipo que irá al televisor: descarga una copia local y la presentación funciona aunque falle la conexión del lugar. `/?tv=1#niveles` la reproduce en bucle a pantalla completa.

## Configuración

### Variables de entorno

Las de prefijo `VITE_` llegan al navegador; el resto solo se usa en el servidor y nunca debe llevar ese prefijo.

| Variable | Uso |
|---|---|
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` | Conexión pública a Supabase |
| `VITE_PUBLIC_SITE_URL` | Origen de los enlaces que se comparten |
| `VITE_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Notificaciones push |
| `SUPABASE_SERVICE_ROLE_KEY` | Funciones del servidor |
| `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASS`, `EMAIL_FROM` | Envío de correos SMTP |
| `WALLETWALLET_API_KEY` | Emisión de pases Wallet |
| `CRON_SECRET` | Protege el endpoint del cron de recordatorios |

### Supabase

1. Crear un proyecto y aplicar, en orden, los archivos de `supabase/migrations/` en el SQL Editor.
2. Activar **Authentication → Sign In / Providers → Anonymous Sign-Ins**.
3. Crear el usuario de la organización en Authentication y ejecutar `supabase/bootstrap-admin.example.sql` con su UUID.
4. Entrar en `/#organizar`, ajustar fecha, horario y dirección, y crear las invitaciones.

## Producción

Alojado en Vercel con despliegue automático: cada push a `master` publica una nueva versión. La configuración de build, funciones, cabeceras y cron está en `vercel.json`. Las variables de entorno se cargan en el panel de Vercel; nunca se incluyen en el repositorio.

## Privacidad

- Los enlaces personales usan tokens aleatorios de 256 bits y los códigos del álbum, 80 bits. La dirección de la fiesta y el álbum solo son visibles con un enlace o código válido.
- Las fotos se reducen en el teléfono antes de subirse, sin metadatos originales, y se guardan en un bucket privado con URLs temporales.
- El sitio no usa analítica ni cookies de terceros.

Proyecto personal y sin fines comerciales. Sonic y sus personajes son marcas de SEGA; las ilustraciones son una creación para este cumpleaños.

---

Desarrollado por **[Teo Labs](https://www.teolabs.app)** ®
