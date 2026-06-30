# Landing JSA para Vercel

Este paquete es la version preparada para publicar en Vercel.

## Archivos principales

- `index.html`: landing page.
- `assets/`: logo, animacion y componente de planes.
- `api/plans.js`: reemplazo de `plans-proxy.php` para Vercel.
- `vercel.json`: configuracion minima del proyecto.

## Como publicar

1. Crea un repositorio en GitHub, por ejemplo `landing-jsa`.
2. Sube el contenido de esta carpeta `vercel-jsa` al repositorio.
3. Entra a Vercel y elige `Add New... > Project`.
4. Importa el repositorio de GitHub.
5. Framework preset: `Other`.
6. Build command: dejar vacio.
7. Output directory: dejar vacio.
8. Deploy.

## Dominio

Cuando Vercel te entregue una URL tipo `landing-jsa.vercel.app`, puedes:

- Cambiar DNS del dominio para apuntar a Vercel.
- O crear una redireccion desde cPanel hacia la URL de Vercel.

La opcion mas limpia es apuntar DNS directamente a Vercel.
