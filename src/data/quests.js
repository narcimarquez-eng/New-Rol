// Misiones secundarias (data-driven).
//   type: 'kill'    -> derrotar `count` enemigos de tipo `enemy`
//         'collect' -> tener `count` unidades de `item`
//         'talk'    -> hablar con el NPC `target`
//         'deliver' -> llevar `item` al NPC `target` (lo entrega el que la encarga)
// Los diálogos de cada fase viven aquí, así el sistema de NPCs las gestiona solo:
//   offer (ofrecer), active (en curso), complete (entregar), done (después),
//   target (al hablar con el objetivo de 'talk'/'deliver').
export const QUESTS = {
  // ---------------------------------------------------------------- Cuevas Heladas
  q_soup: {
    name: 'Sopa caliente', zone: 'caves', giver: 'olaf', type: 'deliver', item: 'termo', target: 'sven',
    desc: 'Lleva el termo de sopa de Olaf a su compañero Sven, refugiado en la cueva del noreste.',
    reward: [['potion', 2], ['coin', 30]],
    lines: {
      offer: ['¡Brrr! Bienvenido a las Cuevas Heladas, forastero.', 'Mi compañero Sven fue a explorar el noreste y no ha vuelto. Seguro que está muerto de frío.', '¿Le llevarías este termo de sopa caliente?'],
      active: ['Sven estará en el refugio de roca del noreste. Sigue la pared este hacia el norte.'],
      target: ['¡Sopa! ¡Olaf, eres un santo! Llevo dos días comiendo nieve.', 'Gracias, amigo. Toma esto: a mí ya no me hace falta.', 'Por cierto... en la sala de los bloques hay una pared que suena hueca. ¡Al oeste!'],
      done: ['Sven ha vuelto sano y salvo. ¡Te debo una!'],
    },
  },
  q_wolves: {
    name: 'Lobos hambrientos', zone: 'caves', giver: 'olaf', type: 'kill', enemy: 'wolf', count: 5,
    desc: 'Los lobos de las nieves rondan el campamento de Olaf. Derrota a 5.',
    reward: [['heart_container', 1]],
    lines: {
      offer: ['Una cosa más: los lobos de las nieves no nos dejan dormir.', 'Si acabas con cinco, te daré algo que encontré congelado en el lago.'],
      active: ['Los lobos cazan en la explanada y en el valle del este. ¡Cuidado con sus embestidas!'],
      complete: ['¡Por fin podremos dormir tranquilos! Toma, te lo prometí.'],
      done: ['Sin lobos, el campamento es casi acogedor. Casi.'],
    },
  },
  q_crystals: {
    name: 'Cristales de escarcha', zone: 'caves', giver: 'greta', type: 'collect', item: 'frost_crystal', count: 5, consume: true,
    desc: 'Greta, la minera, necesita 5 cristales de escarcha. Brillan en rincones de toda la cueva.',
    reward: [['stamina_up', 1], ['coin', 60]],
    lines: {
      offer: ['¡Ey! Soy Greta, minera de cristales.', 'Los cristales de escarcha sueltos brillan como pequeñas estrellas azules. Necesito cinco para mi lámpara eterna.', '¿Me ayudas a encontrarlos?'],
      active: ['Busca por el lago, el refugio del noreste, la guarida de los lobos... ¡y donde nadie mira!'],
      complete: ['¡Cinco cristales perfectos! Mi lámpara brillará cien años.', 'Toma este elixir: los mineros lo usamos para aguantar el frío.'],
      done: ['¡Mira qué luz! Gracias a ti, ya no necesito antorcha.'],
    },
  },
  q_mineral: {
    name: 'Mineral de las cuevas', zone: 'village', giver: 'herrero', type: 'collect', item: 'mineral', count: 1, consume: true,
    desc: 'Gonzalo puede forjar una espada mejor con un mineral raro de las Cuevas Heladas.',
    reward: [['sword_steel', 1]],
    requires: { quest: { id: 'q_package', state: 'done' } },
    lines: {
      offer: ['Dicen que en las Cuevas Heladas, más allá del bosque, hay un mineral estelar escondido.', 'Si me lo traes, te forjaré la mejor espada que hayas visto.'],
      active: ['Mineral estelar... brilla con un tono violeta. Seguro que está bien escondido en las cuevas.'],
      complete: ['¡Por mi yunque! Es mineral estelar de verdad.', '¡Clang, clang, clang! ... Aquí tienes: ¡la Espada de acero!'],
      done: ['Cuida esa espada. Es lo mejor que he forjado nunca.'],
    },
  },
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
  // ---------------------------------------------------------------- Desierto Perdido
  q_borg: {
    name: 'Huesos en la arena', zone: 'desert', giver: 'borg', type: 'kill', enemy: 'skeletonMinion', count: 4,
    desc: 'Borg el Bárbaro quiere ver de qué pasta estás hecho: destruye 4 esqueletos enterrados (se levantan al acercarte).',
    reward: [['potion', 1]], recruit: 'borg',
    lines: {
      offer: ['¡JA! ¿Otro aventurero perdido en las dunas?', 'Los esqueletos se levantan de la arena cuando pasas a su lado. Yo ya he roto unos cuantos.', 'Destruye cuatro y te acompañaré hasta el mismísimo templo. ¿Trato hecho?'],
      active: ['Hay esqueletos enterrados por todo el desierto: en las dunas del sur, en las del este... ¡y delante del templo!'],
      complete: ['¡Cuatro! No está mal para alguien con ese escudito.', '¡Borg va contigo! Mi hacha y tu espada, ¿quién nos va a parar?'],
      done: ['¡Adelante!'],
    },
  },
  q_scorpions: {
    name: 'Plaga de escorpiones', zone: 'desert', giver: 'zahra', type: 'kill', enemy: 'scorpion', count: 5,
    desc: 'Los escorpiones de las dunas del este atacan las caravanas de Zahra. Derrota a 5.',
    reward: [['heart_container', 1], ['coin', 40]],
    lines: {
      offer: ['Bienvenido a mi puesto, viajero. Agua, pociones... y malas noticias.', 'Los escorpiones del este han envenenado a dos de mis camellos.', 'Si acabas con cinco, te daré algo muy valioso.'],
      active: ['Los escorpiones viven en las dunas del este, entre los cactus. Su aguijón envenena: una poción lo cura.'],
      complete: ['¡Por fin podré mandar la caravana! Toma: lo encontré en una tumba del cañón.'],
      done: ['Las caravanas vuelven a pasar. ¡Gracias!'],
    },
  },
  q_amulet: {
    name: 'El amuleto de la familia', zone: 'desert', giver: 'cedric', type: 'collect', item: 'amulet', count: 1, consume: true,
    desc: 'Sir Cedric perdió el amuleto de su familia en las ruinas del oeste. Dice que lo vio caer detrás de un muro... que no parecía un muro.',
    reward: [['stamina_up', 1], ['coin', 50]],
    lines: {
      offer: ['Saludos. Soy Sir Cedric, de la guardia del castillo.', 'Huyendo de los esqueletos de las ruinas del oeste perdí el amuleto de mi familia.', 'Cayó tras un muro al sur de las ruinas... juraría que el muro se movió. ¿Lo buscarías?'],
      active: ['Al suroeste de las ruinas hay una pared que no es como las demás. Prueba a atravesarla.'],
      complete: ['¡El amuleto de mi padre! No sé cómo agradecértelo.', 'Toma este elixir: los caballeros lo bebemos antes de las batallas largas.'],
      done: ['Cuando lleguemos al castillo, lucharé a tu lado. Lo prometo.'],
    },
  },
  q_shards: {
    name: 'Fragmentos de sol', zone: 'desert', giver: 'aldric', type: 'collect', item: 'sun_shard', count: 3, consume: true, requires: { flag: 'met_aldric' },
    desc: 'Sir Aldric busca 3 fragmentos solares perdidos: brillan en el cañón, en el oasis y en las dunas del sureste.',
    reward: [['potion', 2], ['coin', 80]],
    lines: {
      offer: ['Cuando el templo cayó, su gran cristal se rompió en pedazos.', 'Tres fragmentos siguen brillando en el desierto: en el cañón del este, en el oasis y en las dunas del sureste.', 'Tráemelos y te recompensaré.'],
      active: ['Brillan como pequeños soles. Uno en el cañón, otro junto al oasis y otro en las dunas del sureste.'],
      complete: ['¡Los tres fragmentos! El templo aún guarda su luz.', 'Toma esto para el camino. Lo vas a necesitar.'],
      done: ['Que la luz del sol te guíe.'],
    },
  },

  // ---------------------------------------------------------------- Castillo Final
  q_banners: {
    name: 'Los estandartes del reino', zone: 'castle', giver: 'cedric', type: 'collect', item: 'royal_banner', count: 3, consume: true,
    desc: 'Sir Cedric quiere recuperar los 3 estandartes reales que Malakar arrancó: en el jardín, en los cuarteles y en la cripta.',
    reward: [['heart_container', 1]], recruit: 'cedric',
    lines: {
      offer: ['¡Has llegado! Sabía que vendrías.', 'Malakar arrancó los estandartes del reino y los tiró por el castillo como trapos viejos.', 'Hay uno en el jardín, otro en los cuarteles y otro en la cripta. Tráemelos y lucharé a tu lado.'],
      active: ['El jardín está al oeste del patio; los cuarteles, al este. La cripta... detrás del Ala de la Llama.'],
      complete: ['¡Los tres estandartes! El reino aún vive.', 'Mi espada es tuya. ¡Vamos a por Malakar!'],
      done: ['¡Por el reino!'],
    },
  },
  q_knights: {
    name: 'Caballeros caídos', zone: 'castle', giver: 'bartolo', type: 'kill', enemy: 'darkKnight', count: 6,
    desc: 'Bartolo, el cocinero del castillo, no puede salir de los cuarteles: derrota a 6 caballeros oscuros.',
    reward: [['potion', 2], ['coin', 80]],
    lines: {
      offer: ['¡Shh! ¿Eres de los buenos? ¡Uf!', 'Soy Bartolo, el cocinero. Los caballeros de la guardia... Malakar los convirtió en sombras.', 'Si derrotas a seis, podré volver a mi cocina. Te daré lo mejor de la despensa.'],
      active: ['Patrullan el patio, los cuarteles y la antesala. Llevan escudo: ¡rompe su guardia con el último golpe del combo!'],
      complete: ['¡Seis! Por fin podré encender los fogones.', 'Toma: pociones de la despensa y unas monedas que guardaba en el bote de la sal.'],
      done: ['¡Esta noche hay estofado para todos!'],
    },
  },
  q_tome: {
    name: 'El tomo de los sellos', zone: 'castle', giver: 'isolda', type: 'collect', item: 'lost_tome', count: 1, consume: true,
    desc: 'Isolda, la bibliotecaria, busca el Tomo de los sellos, escondido en una cámara de la cripta.',
    reward: [['stamina_up', 1], ['coin', 60]],
    lines: {
      offer: ['Bienvenido a la Torre de la Luz... o lo que queda de ella.', 'El Tomo de los sellos explica cómo se forjaron los sellos de la Gran Puerta. Lo escondieron en la cripta.', 'La cámara del tomo se abre con una losa: empuja el bloque de piedra hasta su placa.'],
      active: ['La cripta está al noreste, tras el Ala de la Llama. Cuidado con los muertos que duermen allí.'],
      complete: ['¡El Tomo de los sellos! Gracias, de verdad.', 'Toma este elixir: te dará aliento para el último combate.'],
      done: ['Que la luz te acompañe ante el trono.'],
    },
  },
};
