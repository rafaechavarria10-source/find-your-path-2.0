# Supabase para Find Your Path

Este directorio contiene la tabla, las Edge Functions y la configuración que usa `index.html`.

## 1. Crear y configurar el proyecto

1. Crea un proyecto en Supabase.
2. En **Project Settings → API**, copia la **Project URL** y la clave pública **anon** en formato JWT. La configuración de Edge Functions usa `verify_jwt = true`.
3. En `index.html`, completa `FYP.config.supabase.url` y `FYP.config.supabase.anonKey`. No pongas una clave `service_role` en el HTML.
4. Configura `FYP.config.leads.privacyUrl` con el enlace público al aviso de privacidad y `privacyVersion` con la versión real del aviso. El envío se mantiene bloqueado si falta cualquiera de estos valores.

## 2. Crear la tabla y desplegar funciones

Instala e inicia sesión con Supabase CLI, vincula el directorio al proyecto y ejecuta:

```powershell
supabase link --project-ref TU_PROJECT_REF
supabase db push
supabase functions deploy participant-leads
supabase functions deploy admissions-admin
```

El runtime de Supabase proporciona `SUPABASE_URL`, `SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY` a las Edge Functions. La clave de servicio se usa únicamente en el servidor para insertar y consultar datos. No se necesita configurarla dentro del HTML.

## 3. Autorizar personal de admisiones

1. En **Authentication → Users**, crea una cuenta de acceso para cada persona autorizada.
2. En **SQL Editor**, asigna el rol de admisiones a cada cuenta, sustituyendo el correo:

```sql
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
  || '{"role":"admissions"}'::jsonb
where email = 'admisiones@tu-dominio.com';
```

La persona debe cerrar sesión e iniciar sesión nuevamente después de cambiar su rol. La función `admissions-admin` verifica el usuario y el rol `app_metadata.role` antes de devolver registros. RLS y los permisos SQL impiden que el navegador consulte directamente la tabla.

## 4. Verificar el despliegue

- Envía un formulario de prueba y confirma que devuelve éxito solo cuando se insertó una fila en `public.participants`.
- Prueba una solicitud sin consentimiento y otra sin aviso/version; ambas deben rechazarse.
- Comprueba que un usuario anónimo no pueda seleccionar filas de `participants`.
- Inicia sesión en el panel con la cuenta autorizada y verifica filtros y exportación CSV.
- Comprueba que una cuenta sin el rol `admissions` reciba acceso denegado.

El formulario conserva el recorrido y los resultados localmente en el navegador; los datos de contacto y el resumen de resultados se envían a Supabase solo cuando la persona envía el formulario con consentimiento.
