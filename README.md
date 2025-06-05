# backend-addi-external

Backend simple en Node.js (Koa) para validar imágenes mediante un endpoint.

## Estructura del proyecto

```
src/
  app.ts
  index.ts
  config/
    routes.ts
  handlers/
    checkImages.ts
  middleware/
    index.ts
    logger.ts
```

## Instalación

```sh
yarn install
```

## Scripts

- `yarn dev` – Ejecuta el servidor en modo desarrollo.
- `yarn build` – Compila el proyecto TypeScript.
- `yarn start` – Inicia el servidor compilado.

## Uso

### Endpoint: `/check-images`

- **Método:** POST
- **Body:** Array de objetos con la propiedad `imageUrl`.

#### Ejemplo de request

```json
[
  { "imageUrl": "https://ejemplo.com/imagen1.jpg" },
  { "imageUrl": "https://ejemplo.com/imagen2.png" }
]
```

#### Ejemplo de respuesta

```json
[
  {
    "message": "Image fetched successfully",
    "valid": true,
    "imageUrl": "https://ejemplo.com/imagen1.jpg"
  },
  {
    "message": "Error fetching image: Not Found",
    "valid": false,
    "imageUrl": "https://ejemplo.com/imagen2.png"
  }
]
```

## Middleware

- `logger`: Registra en consola cada petición recibida.

## Configuración de rutas

Las rutas están definidas en [`src/config/routes.ts`](src/config/routes.ts).

## Licencia

MIT