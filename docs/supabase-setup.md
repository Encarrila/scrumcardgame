# Configuracion de Supabase

Esta version usa Supabase como sincronizacion gratuita inicial para que cada equipo juegue desde navegadores distintos.

## 1. Crear las tablas

1. Abrir el proyecto de Supabase.
2. Ir a **SQL Editor**.
3. Ejecutar el contenido de `docs/supabase-schema.sql`.

## 2. Activar Realtime

Para que el tablero del equipo se refresque en vivo:

1. Ir a **Database > Replication**.
2. Activar Realtime para la tabla `teams`.

Tambien se puede hacer desde SQL:

```sql
alter publication supabase_realtime add table teams;
```

## 3. Habilitar permisos para el piloto

La aplicacion no usa login todavia. Para una clase piloto sin datos sensibles, ejecutar tambien el contenido de `docs/supabase-policies.sql`.

Estas politicas permiten que la clave publica cree sesiones y actualice equipos. Cuando se quiera endurecer seguridad, el siguiente paso es agregar autenticacion o codigos firmados por docente/alumno antes de usar RLS restrictivo.

## 4. URL de prueba

Cuando GitHub Pages este activo, usar:

- Docente: `https://encarrila.github.io/scrumcardgame/?mode=teacher`
- Alumno/equipo: el link de equipo que genera la pantalla docente.
