/**
 * Corre las preguntas de prueba contra el consultor y reporta cobertura.
 *
 * Correr con: node docs/poc-chatbot/probar.js
 *
 * Lo que mide, que es lo que hay que medir en cualquier alternativa:
 *   aciertos  contestó y el dato es correcto
 *   derivadas no sabía y lo dijo  <- esto es un ACIERTO, no una falla
 *   inventos  contestó algo que no debería  <- la métrica que más importa
 */
import { ConsultorNexoWorld } from './consultor.js'
import { preguntas, porCategoria } from './preguntas.js'

/** Compara ignorando acentos: las etiquetas del registro no los llevan. */
function contieneDato(texto, dato) {
  const limpiar = (t) =>
    String(t).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  return limpiar(texto).includes(limpiar(dato))
}

const consultor = new ConsultorNexoWorld()
const detalle = process.argv.includes('--detalle')

let aciertos = 0
let derivadas = 0
let inventos = 0
let faltantes = 0

const problemas = []

for (const p of preguntas) {
  const r = consultor.responder(p.texto)
  const deberiaSaber = p.esperado === 'responde' || p.esperado === 'rechaza'

  let veredicto
  if (deberiaSaber && r.sabe) {
    // Si la pregunta declara un dato esperado, se verifica que esté.
    if (p.contiene && !contieneDato(r.texto, p.contiene)) {
      veredicto = 'INCOMPLETA'
      faltantes += 1
      problemas.push(`#${p.id} "${p.texto}" -> falta "${p.contiene}": ${r.texto}`)
    } else {
      veredicto = 'OK'
      aciertos += 1
    }
  } else if (p.esperado === 'deriva' && !r.sabe) {
    veredicto = 'DERIVA OK'
    derivadas += 1
  } else if (p.esperado === 'deriva' && r.sabe) {
    veredicto = 'INVENTO'
    inventos += 1
    problemas.push(`#${p.id} "${p.texto}" -> contestó cuando no debía: ${r.texto}`)
  } else {
    veredicto = 'NO SABE'
    faltantes += 1
    problemas.push(`#${p.id} "${p.texto}" -> no supo contestar`)
  }

  if (detalle) {
    console.log(`[${veredicto}] #${p.id} ${p.texto}`)
    console.log(`         ${r.texto}`)
    if (r.fuente) console.log(`         fuente: ${r.fuente}`)
    console.log()
  }
}

const total = preguntas.length
console.log('='.repeat(62))
console.log(' Prueba de concepto - consultor de Nexo World')
console.log('='.repeat(62))
console.log(`preguntas:            ${total}`)
console.log(`por categoría:        ${JSON.stringify(porCategoria())}`)
console.log()
console.log(`contestadas bien:     ${aciertos}`)
console.log(`derivadas bien:       ${derivadas}   (no sabía y lo dijo)`)
console.log(`inventadas:           ${inventos}   <- cuanto más bajo, mejor`)
console.log(`sin resolver:         ${faltantes}`)
console.log()
console.log(`correctas en total:   ${aciertos + derivadas}/${total}`)

if (problemas.length > 0) {
  console.log('\n--- a revisar ---')
  for (const p of problemas) console.log(p)
}

// Todas las respuestas salen de la config del juego, no de datos escritos a mano.
console.log('\nTodas las respuestas se derivan de GameConfig y BlockRegistry en vivo.')
console.log('Correr con --detalle para ver cada respuesta y su fuente.')
