# Convenciones de Nexo World

Acuerdos para que cuatro personas puedan trabajar en paralelo sin generar fricción.

## Archivos y módulos

- Una clase por archivo. El nombre del archivo coincide exactamente con el de la clase.
- Módulos ES nativos, con extensión explícita: `import { World } from '../world/World.js';`.
- Los imports se ordenan: dependencias del proyecto primero por cercanía, luego `utils`.
- Nada de exportaciones por defecto salvo en `main.js`.

## Nombres

- Código en inglés (`BlockRegistry`, `renderedBlocks`), documentación y comentarios en español.
- Clases en `PascalCase`, métodos y variables en `camelCase`, constantes en `SCREAMING_SNAKE_CASE`.
- Los booleanos empiezan con `is`, `has`, `wants` o `should`.
- Los métodos que devuelven algo se nombran por lo que devuelven (`getSurfaceHeight`); los que actúan, por lo que hacen (`teleportTo`).

## Clases

- Miembros privados con `#`. Lo público es el contrato y se cambia con cuidado.
- El constructor construye; no genera mundos, no carga assets, no engancha eventos. Para eso están `start()` y `attach()`.
- Las dependencias se reciben por constructor. Ninguna clase busca sus colaboradores por su cuenta.
- Nada de clases con más de una responsabilidad principal ni de objetos que "saben de todo".

## Comentarios

Se escriben comentarios cuando explican **por qué**: una decisión de arquitectura, un comportamiento no evidente, un algoritmo o una restricción del navegador. No se comentan cosas que el nombre ya dice.

```js
// Mal
// Suma uno al contador
this.count += 1;

// Bien
// Perder el foco deja teclas "trabadas" si no se limpia el estado.
this.#pressed.clear();
```

## Unidades y convenciones numéricas

- Tiempo en **segundos** (`deltaTime`). La conversión desde milisegundos ocurre una sola vez, en `main.js`.
- Ángulos en **radianes**. Si un valor de configuración se expresa en grados, el nombre lo dice (`FOV_DEGREES`).
- Ningún valor ajustable se escribe inline: va en `GameConfig`. Lo que no es ajustable va en `Constants`.

## Bloques

Está prohibido comparar ids de bloque con condicionales encadenados:

```js
// Prohibido
if (blockId === 1) { ... } else if (blockId === 2) { ... }

// Correcto
const type = registry.get(blockId);
if (type.solid) { ... }
```

Si hace falta un comportamiento nuevo por tipo, se agrega como propiedad del `BlockType` y se declara en el registro.

## Git

- Ramas por funcionalidad: `feat/colisiones`, `fix/camara-pitch`.
- Mensajes de commit en imperativo y en español, con prefijo de tipo: `feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`.
- Un commit por cambio con sentido propio. Nada de commits que mezclan tres funcionalidades.

## Antes de abrir un pull request

- `npm test` en verde.
- `npm run build` sin errores.
- El juego abre en `npm run dev` con la consola limpia.
- Sin archivos ni dependencias que el cambio no necesite.
