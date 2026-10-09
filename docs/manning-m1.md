# M1 — Manning canónico al guardar

`POST /api/fincas/:fincaId/calculos` conserva JWT y la comprobación de propiedad
de la finca. Luego valida inputs, calcula Manning e inserta únicamente columnas
existentes. No se agregó un endpoint público ni se modificó frontend, JWT o schema.

## Request y compatibilidad

```json
{
  "nombre_calculo": "Canal Norte",
  "tipo_canal": "rectangular",
  "b": 1,
  "h": 0.5,
  "n": 0.012,
  "S": 0.001
}
```

Inputs aplicables: números JSON finitos; h/n/S > 0. Rectangular requiere b > 0;
triangular z > 0; trapezoidal b > 0 y z >= 0. Dimensiones no aplicables se
normalizan a null. El cliente antiguo puede enviar A/P/Q_m3s/R/V u otros
derivados: se ignoran completamente. El nombre es opcional (default existente
"Cálculo sin nombre"); si se proporciona debe ser texto no vacío tras trim,
de hasta 255 caracteres, capacidad VARCHAR declarada en la migration actual.

## Cálculo y respuesta

Las fórmulas y su orden de operaciones coinciden con src/utils/manning.js del
frontend: R=A/P; Q=(1/n)*A*Math.pow(R,2/3)*Math.sqrt(S); V=Q/A. No hay redondeo
intermedio. A/P/R/V/Q deben ser finitos y positivos.

201 conserva message/calculoId y agrega calculo con nombre, tipo_canal,
b/h/z/n/S y A/P/R/V/Q_m3s. R y V no se insertan porque no existen esas columnas.
El objeto calculo es el resultado numérico del servidor **antes de la conversión
DECIMAL en MySQL**, no una representación exacta de la fila almacenada.

400 invalid_input: payload/tipos/rangos/nombre inválidos. 422 invalid_geometry:
overflow, underflow u otros derivados inválidos. Se mantiene error como string,
con code y fields adicionales. JSON malformado recibe JSON genérico sin body ni
stack. Otros errores siguen su tratamiento previo. Auth conserva 401 sin token,
403 inválido/expirado y 404 para finca ausente/ajena.

## Precisión: pendiente para M3

M1 escribe Numbers sin redondear en columnas existentes. El schema declarado
contiene b/h/z/n DECIMAL(8,4), S DECIMAL(10,6), A/P DECIMAL(10,4),
Q_m3s DECIMAL(12,6). No se verificó aquí el schema vivo ni se ejecutó SQL de
migrations. Los tests compilan la migration a SQL únicamente en memoria.

Ejemplos de la pérdida esperable por esas escalas (observaciones, no round-trip
MySQL ejecutado):

| Campo | Valor del cálculo | Representación esperable con escala actual |
| --- | --- | --- |
| n | 0.01234 | 0.0123 |
| S | 0.0000001 | 0.000000 |
| P triangular golden | 1.4142135623730951 | 1.4142 |
| Q rectangular golden | 0.5228961337882106 | 0.522896 |

Un valor finito aceptado por el servicio puede exceder capacidad DECIMAL y causar
error de persistencia. Un valor positivo pequeño puede almacenarse como cero.
M1 no impone máximos arbitrarios ni corrige estos efectos redondeando la fórmula.
La respuesta solo es exitosa después del insert, pero no certifica un round-trip
sin pérdida. No debe compararse el historial bit a bit con la respuesta canónica.

En M3 verificar schema vivo, SQL mode y datos reales. Evaluar inputs (dimensiones,
n, S) por separado de derivados (A, P, Q). Comparar DECIMAL con mayor escala,
DOUBLE o estrategia mixta; **no está decidido migrar las ocho columnas a DOUBLE**.
Preservar filas históricas: una conversión no recupera precisión perdida.

## Verificación

`npm ci`, `npm test` (node:test, sin dependencias nuevas) y `git diff --check`.
Tests del servicio puro, HTTP con Express/JWT reales y Knex acotadamente simulado,
JSON malformado, regresiones de historial/edición/borrado, CORS/contacto con SMTP
simulado y arranque con entorno sintético. Ningún test envía correo o consulta
Aiven. Round-trip MySQL y entrega SMTP real siguen sin certificar.
