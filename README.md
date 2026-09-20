# Santiago · Nivel 7

Invitación digital al cumpleaños de Santiago, con temática Sonic y una experiencia pensada para teléfonos.

**Sitio:** [santiago.teolabs.app](https://santiago.teolabs.app)

## Funcionalidades

- Invitaciones personales para compartir por WhatsApp o correo.
- Confirmación de asistencia por familia y acceso al calendario.
- Entradas animadas, personajes interactivos y una carrera con puntos.
- Muro privado de fotos con actualizaciones, comentarios y corazones.
- Panel de organización, registro de llegada y descarga del álbum.
- Instalación como PWA y recordatorios push voluntarios del cumpleaños y la fiesta.

## Desarrollo

Requiere Node.js 22.

```sh
npm ci
npm run dev
```

Completar las variables locales a partir de [.env.example](.env.example). Las claves privadas se utilizan únicamente en el servidor. Las migraciones de base de datos están en `supabase/migrations`.

## Producción

Frontend React + TypeScript + Vite, con Supabase para autenticación, base de datos y fotos privadas. Alojado en Vercel; el envío de correo se ejecuta mediante una función Node.

```sh
npm run build
```

La configuración de publicación está en `vercel.json`. El panel permite abrir el álbum para pruebas y restaurar después las fechas de la fiesta.

Los pases Apple Wallet y Google Wallet requieren configurar un emisor y sus URLs; su emisión todavía no está implementada.

---

Desarrollado por **[Teo Labs](https://www.teolabs.app)** ®
