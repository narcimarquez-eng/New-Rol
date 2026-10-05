// Misiones secundarias (data-driven).
//   type: 'kill'    -> derrotar `count` enemigos de tipo `enemy`
//         'collect' -> tener `count` unidades de `item`
//         'talk'    -> hablar con el NPC `target`
//         'deliver' -> llevar `item` al NPC `target` (lo entrega el que la encarga)
// Los diálogos de cada fase viven aquí, así el sistema de NPCs las gestiona solo:
//   offer (ofrecer), active (en curso), complete (entregar), done (después),
//   target (al hablar con el objetivo de 'talk'/'deliver').
export const QUESTS = {
  q_cat: {
    name: 'El gato perdido', zone: 'village', giver: 'lucia', type: 'talk', target: 'misi',
    desc: 'Lucía ha perdido a su gato Misi. Suele esconderse cerca del agua, al este.',
    reward: [['coin', 30], ['potion', 1]],
    lines: {
      offer: ['¡Ay, menos mal que pasas por aquí!', 'Mi gato Misi se ha escapado otra vez... Le encanta mirar los peces del estanque.', '¿Me ayudarías a encontrarlo?'],
      active: ['¿Has visto a Misi? Es naranja y muy dormilón. Busca cerca del estanque del este.'],
      target: ['¡Miau! (Misi se frota contra tus botas y ronronea. Parece que quiere volver a casa.)'],
      complete: ['¡Misi! ¡Has vuelto! Muchísimas gracias, de verdad.', 'Toma, no es mucho, pero te lo has ganado.'],
      done: ['Misi no se separa de la ventana desde que volvió. ¡Gracias otra vez!'],
    },
  },
  q_package: {
    name: 'Recado del herrero', zone: 'village', giver: 'herrero', type: 'deliver', item: 'package', target: 'granjero',
    desc: 'Lleva el paquete de Gonzalo al granjero Tomás, junto a la granja del este.',
    reward: [['coin', 25], ['potion', 1]],
    lines: {
      offer: ['¡Eh, tú! Tengo las herraduras nuevas de Tomás, el granjero.', 'Yo no puedo dejar la fragua encendida... ¿Se las llevas?'],
      active: ['La granja de Tomás está al este, siguiendo el camino. ¡No las pierdas!'],
      target: ['¡Mis herraduras! Gonzalo es el mejor herrero del valle.', 'Gracias por traerlas. Toma esto por las molestias.'],
      done: ['Ese Tomás... siempre me paga con calabazas. ¡Pero qué calabazas!'],
    },
  },
  q_slimes: {
    name: 'Plaga de limos', zone: 'village', giver: 'granjero', type: 'kill', enemy: 'slime', count: 5,
    desc: 'Los limos del Prado Sur se comen las cosechas de Tomás. Derrota a 5.',
    reward: [['heart_container', 1]],
    requires: { quest: { id: 'q_package', state: 'done' } },
    lines: {
      offer: ['Ya que estás... Los limos del Prado Sur se están comiendo mis calabazas.', 'Si acabas con cinco de ellos te daré algo que guardo desde hace años.'],
      active: ['Los limos saltan por el Prado Sur, al otro lado de la valla. ¡Cinco, recuerda!'],
      complete: ['¡Mis calabazas están a salvo! Toma: lo encontré enterrado en el campo hace años.', 'Dicen que da fuerza al corazón de quien lo lleva.'],
      done: ['Este año la cosecha va a ser enorme. ¡Pásate a por calabazas!'],
    },
  },
  q_goblins: {
    name: 'Cazadora de trasgos', zone: 'forest', giver: 'iria', type: 'kill', enemy: 'goblin', count: 8,
    desc: 'Iria quiere limpiar el bosque de trasgos. Derrota a 8 (también valen los del laberinto).',
    reward: [['stamina_up', 1], ['coin', 40]],
    lines: {
      offer: ['Shh... Llevo días siguiendo a una banda de trasgos.', 'Si me ayudas a derrotar a ocho, compartiré contigo mi elixir de vigor.'],
      active: ['Los trasgos rondan por todo el bosque, y dentro del laberinto hay aún más.'],
      complete: ['¡Buen trabajo! Pocos aguantan una pelea con ocho trasgos. ¡Toma, te lo has ganado!'],
      done: ['Con menos trasgos, por fin puedo cazar tranquila.'],
    },
  },
  q_axe: {
    name: 'El hacha perdida', zone: 'forest', giver: 'lenador', type: 'collect', item: 'axe', count: 1, consume: true,
    desc: 'Íñigo perdió su hacha en una arboleda del noreste. Dicen que hay un hueco escondido entre los árboles...',
    reward: [['heart_container', 1], ['coin', 30]],
    lines: {
      offer: ['¡Maldita sea! Un trasgo me robó el hacha y huyó hacia la arboleda del noreste.', 'Esos bichos conocen pasadizos entre los árboles que nosotros no vemos...', '¿Me la traerías?'],
      active: ['Busca en la arboleda del noreste. A veces los árboles no son tan sólidos como parecen.'],
      complete: ['¡Mi hacha! ¡Mi vieja amiga! Gracias, de corazón.', 'Toma esto. Lo encontré dentro de un tronco hueco.'],
      done: ['Ahora puedo volver a cortar leña. ¡Gracias otra vez!'],
    },
  },
  q_wisps: {
    name: 'Luces del bosque', zone: 'forest', giver: 'hada', type: 'collect', item: 'wisp', count: 5, consume: true,
    desc: 'El hada Lys ha perdido 5 luces del bosque. Están escondidas por todo el bosque (¡también en el laberinto!).',
    reward: [['sword_up', 1]],
    lines: {
      offer: ['Hola, pequeño héroe... Soy Lys, el hada de esta fuente.', 'Mis luces del bosque se han dispersado por la espesura. Sin ellas la fuente se apaga.', 'Si me traes cinco, bendeciré tu espada.'],
      active: ['Las luces brillan con un tono verde. Busca en rincones escondidos... y en el laberinto.'],
      complete: ['¡Mis luces! La fuente vuelve a cantar.', 'Como prometí: que esta espada brille contra la oscuridad.'],
      done: ['La fuente siempre curará tus heridas. Acércate cuando lo necesites.'],
    },
  },
};
