import { ChatResponse } from './ChatResponse.js';
import { TextNormalizer } from './TextNormalizer.js';
import { GameConfig } from '../game/GameConfig.js';
import { createDefaultBlockRegistry } from '../blocks/BlockRegistry.js';
import { createDefaultBiomeRegistry } from '../world/BiomeRegistry.js';
import { NumberFormatter } from './NumberFormatter.js';
import { InputActions } from '../utils/Constants.js';

/**
 * Las respuestas que salen del propio juego.
 *
 * Ninguna respuesta de esta clase tiene un dato escrito a mano: todas se
 * derivan de GameConfig, del BlockRegistry o del estado vivo de la partida. Es
 * la decisión central de docs/CHATBOT.md: si alguien remapea el salto de Space
 * a J, la respuesta cambia sola. Un manual escrito a mano habría seguido
 * diciendo "Space" y nadie se habría enterado.
 *
 * Por eso cada respuesta declara su fuente: es lo que permite verificarla
 * contra el código.
 */
export class GameKnowledge {
  /** Nombre legible de cada acción, para no mostrar el identificador interno. */
  static ACTION_LABELS = Object.freeze({
    [InputActions.MOVE_FORWARD]: 'avanzar',
    [InputActions.MOVE_BACKWARD]: 'retroceder',
    [InputActions.MOVE_LEFT]: 'ir a la izquierda',
    [InputActions.MOVE_RIGHT]: 'ir a la derecha',
    [InputActions.JUMP]: 'saltar',
    [InputActions.SPRINT]: 'correr',
    [InputActions.PAUSE]: 'pausar',
    [InputActions.TOGGLE_DEBUG]: 'mostrar el panel de depuración'
  });

  /**
   * Cómo llama el jugador a cada bloque, cuando no coincide con su etiqueta.
   * Las etiquetas del registro ya están en español, así que esto es solo para
   * los sinónimos ("pasto" por "Cesped", "madera" por "Tronco").
   */
  static BLOCK_ALIASES = Object.freeze({
    pasto: 'Cesped',
    grama: 'Cesped',
    barro: 'Tierra',
    roca: 'Piedra',
    madera: 'Tronco',
    troncos: 'Tronco',
    tabla: 'Tablones',
    tablas: 'Tablones',
    hoja: 'Hojas',
    cristal: 'Vidrio',
    bedrock: 'Roca madre',
    carbon: 'Mineral de carbon',
    hierro: 'Mineral de hierro',
    oro: 'Mineral de oro',
    diamante: 'Mineral de diamante',
    diamantes: 'Mineral de diamante'
  });

  #registry;
  #biomes;
  #config;
  #numbers;
  #contextProvider;

  /**
   * @param {Object} [options]
   * @param {import('../blocks/BlockRegistry.js').BlockRegistry} [options.registry]
   * @param {import('../world/BiomeRegistry.js').BiomeRegistry} [options.biomes]
   * @param {NumberFormatter} [options.numbers]
   * @param {typeof GameConfig} [options.config]
   * @param {(() => Object|null)|null} [options.contextProvider] devuelve el
   *        estado vivo de la partida: { player, world, hotbar, health,
   *        worldGenerator }. Es una función y no el objeto porque el estado
   *        cambia en cada frame y el bot se construye una sola vez.
   */
  constructor({
    config = GameConfig,
    registry = createDefaultBlockRegistry(),
    biomes = createDefaultBiomeRegistry(config.biomes),
    numbers = new NumberFormatter({ config: config.chatbot }),
    contextProvider = null
  } = {}) {
    this.#registry = registry;
    this.#biomes = biomes;
    this.#config = config;
    this.#numbers = numbers;
    this.#contextProvider = contextProvider;
  }

  get registry() {
    return this.#registry;
  }

  get config() {
    return this.#config;
  }

  /**
   * El proveedor de estado no es dependencia del constructor porque el HUD se
   * arma antes de que exista la partida; GameUiBridge lo conecta después.
   */
  setContextProvider(provider) {
    this.#contextProvider = typeof provider === 'function' ? provider : null;
  }

  get #context() {
    if (!this.#contextProvider) return null;
    try {
      return this.#contextProvider();
    } catch {
      // Una partida a medio cargar no debe romper el chat.
      return null;
    }
  }

  /** Acción lógica -> teclas que la disparan, leído de KEY_BINDINGS. */
  get #keysByAction() {
    const map = {};
    for (const [key, action] of Object.entries(this.#config.input.KEY_BINDINGS)) {
      map[action] = map[action] ?? [];
      map[action].push(key.replace(/^Key/, ''));
    }
    return map;
  }

  /**
   * @param {string} intentId identificador del catálogo ("game.…")
   * @param {string} normalizedQuestion pregunta normalizada, para los matices
   * @returns {Object|null} ChatResponse, o null si esta clase no lo cubre
   */
  answer(intentId, normalizedQuestion = '') {
    const handlers = {
      'game.controls.move': () => this.#controlsMove(),
      'game.controls.jump': () => this.#controlsAction(InputActions.JUMP),
      'game.controls.sprint': () => this.#controlsSprint(),
      'game.controls.pause': () => this.#controlsAction(InputActions.PAUSE),
      'game.controls.debug': () => this.#controlsDebug(),
      'game.controls.hotbar': () => this.#controlsHotbar(),
      'game.controls.interact': () => this.#controlsInteract(),
      'game.controls.inventory': () => this.#controlsInventory(),
      'game.controls.chat': () => this.#controlsChat(),
      'game.blocks.list': () => this.#blocksList(),
      'game.blocks.count': () => this.#blocksCount(),
      'game.blocks.placeable': () => this.#blocksPlaceable(),
      'game.blocks.breakTime': () => this.#blocksBreakTime(),
      'game.ores.list': () => this.#oresList(),
      'game.survival.health': () => this.#survivalHealth(),
      'game.survival.fall': () => this.#survivalFall(),
      'game.survival.death': () => this.#survivalDeath(),
      'game.world.size': () => this.#worldSize(),
      'game.world.chunk': () => this.#worldChunk(),
      'game.world.seed': () => this.#worldSeed(),
      'game.world.biomes': () => this.#worldBiomes(),
      'game.world.caves': () => this.#worldCaves(),
      'game.world.trees': () => this.#worldTrees(),
      'game.world.save': () => this.#worldSave(),
      'game.world.bottom': () => this.#worldBottom(),
      'game.world.ceiling': () => this.#worldCeiling(),
      'game.world.findCaves': () => this.#worldFindCaves(),
      'game.world.mining': () => this.#worldMining(),
      'game.meta.settings': () => this.#metaSettings(),
      'game.meta.performance': () => this.#metaPerformance(),
      'game.meta.account': () => this.#metaAccount(),
      'game.meta.sound': () => this.#metaSound(),
      'game.status.position': () => this.#statusPosition(),
      'game.status.health': () => this.#statusHealth(),
      'game.status.hotbar': () => this.#statusHotbar(),
      'game.status.world': () => this.#statusWorld(),
      'game.about': () => this.#about()
    };

    const handler = handlers[intentId];
    if (!handler) return null;

    // Dentro de los temas de bloques y minerales, un bloque nombrado gana sobre
    // la respuesta genérica: "¿qué dureza tiene el vidrio?" no se contesta con
    // la lista de bloques. Fuera de esos dos temas, no: "¿cómo consigo
    // diamantes?" pregunta por una estrategia, y contestarla con la ficha del
    // bloque sería otra vez un dato correcto sobre otra pregunta.
    const esTemaDeBloques = intentId.startsWith('game.blocks.') || intentId.startsWith('game.ores.');
    return this.answerAboutEntity(normalizedQuestion, { allowGeneric: esTemaDeBloques }) ?? handler();
  }

  /**
   * Preguntas sobre un bloque o mineral nombrado, sin importar la intención.
   * @returns {Object|null}
   */
  answerAboutEntity(normalizedQuestion, { allowGeneric = true } = {}) {
    const question = String(normalizedQuestion ?? '');
    if (question === '') return null;

    const ore = this.#findOre(question);
    const block = this.#findBlock(question);
    const preguntaPorProfundidad = TextNormalizer.mentions(
      question, 'profundidad', 'altura', 'donde', 'encuentro', 'veta', 'minar', 'mina', 'buscar', 'y='
    );
    const preguntaPorPropiedad = TextNormalizer.mentions(
      question, 'dureza', 'duro', 'romp', 'destru', 'suelta', 'drop', 'tira', 'transparen', 'solido'
    );

    // Una pregunta explícita por una propiedad o por la profundidad gana
    // siempre, aunque el matcher haya elegido otro tema: "¿se puede romper el
    // bedrock?" se parece a "¿cómo rompo un bloque?", y sin esto se contestaba
    // con los botones del mouse.
    if (ore && preguntaPorProfundidad) return this.#oreDepth(ore.name, ore.vein);
    if (block && preguntaPorPropiedad) return this.#blockDetail(block, question);

    // Sin pregunta explícita, nombrar un bloque solo alcanza dentro de su
    // propio tema. Si no, "¿cómo consigo diamantes?" se contesta con la ficha
    // del bloque en vez de con dónde buscarlo.
    if (!allowGeneric) return null;
    if (ore) return this.#oreDepth(ore.name, ore.vein);
    return block ? this.#blockDetail(block, question) : null;
  }

  // ------------------------------------------------------------------ controles

  #controlsMove() {
    const keys = this.#keysByAction;
    const movement = [
      InputActions.MOVE_FORWARD,
      InputActions.MOVE_LEFT,
      InputActions.MOVE_BACKWARD,
      InputActions.MOVE_RIGHT
    ]
      .filter((action) => keys[action])
      .map((action) => `${keys[action].join('/')} para ${GameKnowledge.ACTION_LABELS[action]}`)
      .join(', ');

    const jump = keys[InputActions.JUMP]?.join(' o ');
    return ChatResponse.known(
      `Te movés con ${movement}. Para saltar, ${jump}. Para correr, mantené ` +
        `${keys[InputActions.SPRINT]?.join(' o ')} mientras te movés. La cámara va con el mouse.`,
      ChatResponse.Topics.CONTROLS,
      'GameConfig.input.KEY_BINDINGS'
    );
  }

  #controlsAction(action) {
    const keys = this.#keysByAction[action];
    const label = GameKnowledge.ACTION_LABELS[action] ?? action;
    if (!keys || keys.length === 0) {
      return ChatResponse.unknown(
        `No hay ninguna tecla asignada a ${label} en esta configuración.`,
        ChatResponse.Topics.CONTROLS,
        'GameConfig.input.KEY_BINDINGS'
      );
    }
    return ChatResponse.known(
      `Para ${label}, ${keys.join(' o ')}.`,
      ChatResponse.Topics.CONTROLS,
      'GameConfig.input.KEY_BINDINGS'
    );
  }

  #controlsSprint() {
    const keys = this.#keysByAction[InputActions.SPRINT];
    const multiplier = this.#config.player.SPRINT_MULTIPLIER;
    if (!keys) return this.#controlsAction(InputActions.SPRINT);
    return ChatResponse.known(
      `Mantené ${keys.join(' o ')} mientras te movés: vas ${this.#numbers.format(multiplier)}× más rápido.`,
      ChatResponse.Topics.CONTROLS,
      'GameConfig.input.KEY_BINDINGS + GameConfig.player.SPRINT_MULTIPLIER'
    );
  }

  #controlsDebug() {
    const keys = this.#keysByAction[InputActions.TOGGLE_DEBUG];
    return ChatResponse.known(
      `Con ${keys?.join(' o ') ?? 'F3'} abrís el panel de depuración: FPS, tu posición, ` +
        'el chunk en el que estás, los bloques dibujados y el bloque al que apuntás.',
      ChatResponse.Topics.CONTROLS,
      'GameConfig.input.KEY_BINDINGS'
    );
  }

  #controlsHotbar() {
    const size = this.#config.inventory.HOTBAR_SIZE;
    return ChatResponse.known(
      `Con las teclas 1 a ${size} elegís el slot de la hotbar, y también podés cambiarlo ` +
        'con la rueda del mouse.',
      ChatResponse.Topics.CONTROLS,
      'GameConfig.inventory.HOTBAR_SIZE + GameConfig.input.HOTBAR_KEY_PREFIX'
    );
  }

  #controlsInteract() {
    const reach = this.#config.blocks.REACH_DISTANCE / this.#config.world.BLOCK_SIZE;
    return ChatResponse.known(
      'Click izquierdo mantenido rompe el bloque al que apuntás; click derecho coloca el ' +
        `que tengas seleccionado en la hotbar. El alcance es de ${this.#numbers.format(reach)} bloques.`,
      ChatResponse.Topics.CONTROLS,
      'GameConfig.blocks.REACH_DISTANCE'
    );
  }

  #controlsInventory() {
    return ChatResponse.known(
      'Con E abrís el inventario y elegís qué bloque poner en cada slot. Con E o Escape lo cerrás.',
      ChatResponse.Topics.CONTROLS,
      'src/ui/HUD.js (atajos de pantalla)'
    );
  }

  #controlsChat() {
    const key = this.#config.chatbot.TOGGLE_KEY.replace(/^Key/, '');
    return ChatResponse.known(
      `Con ${key} abrís y cerrás este chat durante la partida, y con Escape también se cierra. ` +
        'Mientras escribís, las teclas no mueven al personaje.',
      ChatResponse.Topics.CONTROLS,
      'GameConfig.chatbot.TOGGLE_KEY'
    );
  }

  // ------------------------------------------------------------------- bloques

  #blocksList() {
    const labels = this.#registry.placeableTypes().map((type) => type.label);
    return ChatResponse.known(
      `Los bloques del juego son: ${labels.join(', ')}.`,
      ChatResponse.Topics.BLOCKS,
      'BlockRegistry'
    );
  }

  #blocksCount() {
    const total = this.#registry.placeableTypes().length;
    return ChatResponse.known(
      `Hay ${total} tipos de bloque además del aire.`,
      ChatResponse.Topics.BLOCKS,
      'BlockRegistry'
    );
  }

  #blocksPlaceable() {
    const starters = this.#registry.starterTypes().map((type) => type.label);
    const all = this.#registry.placeableTypes().length;
    return ChatResponse.known(
      `Podés colocar cualquiera de los ${all} tipos de bloque. Arrancás con ` +
        `${starters.join(', ')} en la hotbar, y el resto lo elegís desde el inventario.`,
      ChatResponse.Topics.BLOCKS,
      'BlockRegistry (starterTypes / placeableTypes)'
    );
  }

  #blocksBreakTime() {
    const perHardness = this.#config.blocks.BREAK_TIME_PER_HARDNESS;
    const hardest = this.#registry
      .placeableTypes()
      .filter((type) => type.breakable)
      .sort((a, b) => b.hardness - a.hardness)[0];

    const example = hardest
      ? ` ${hardest.label}, que es el más duro que se puede romper (dureza ` +
        `${this.#numbers.format(hardest.hardness)}), tarda ` +
        `${this.#numbers.format(hardest.hardness * perHardness, 2)} segundos.`
      : '';

    return ChatResponse.known(
      `Romper un bloque tarda su dureza × ${this.#numbers.format(perHardness)} segundos.${example} No hay ` +
        `herramientas: ` +
        'el tiempo depende solo del bloque.',
      ChatResponse.Topics.BLOCKS,
      'GameConfig.blocks.BREAK_TIME_PER_HARDNESS + BlockRegistry'
    );
  }

  #blockDetail(block, question) {
    const source = 'BlockRegistry';

    if (TextNormalizer.mentions(question, 'suelta', 'drop', 'sale', 'tira', 'deja')) {
      const drops = block.drops.map((id) => this.#registry.get(id)?.label ?? `id ${id}`);
      return ChatResponse.known(
        `${block.label} suelta: ${drops.join(', ') || 'nada'}.`,
        ChatResponse.Topics.BLOCKS,
        source
      );
    }

    if (TextNormalizer.mentions(question, 'romp', 'destru', 'breakable')) {
      if (!block.breakable) {
        return ChatResponse.known(`${block.label} no se puede romper.`, ChatResponse.Topics.BLOCKS, source);
      }
      const seconds = this.#numbers.format(block.hardness * this.#config.blocks.BREAK_TIME_PER_HARDNESS, 2);
      return ChatResponse.known(
        `${block.label} se puede romper: dureza ${this.#numbers.format(block.hardness)}, unos ` +
          `${seconds} segundos.`,
        ChatResponse.Topics.BLOCKS,
        `${source} + GameConfig.blocks.BREAK_TIME_PER_HARDNESS`
      );
    }

    if (TextNormalizer.mentions(question, 'transparen', 'se ve a traves', 'luz')) {
      return ChatResponse.known(
        `${block.label} ${block.transparent ? 'es transparente' : 'no es transparente'}.`,
        ChatResponse.Topics.BLOCKS,
        source
      );
    }

    if (TextNormalizer.mentions(question, 'dureza', 'duro', 'resisten')) {
      return ChatResponse.known(
        `${block.label} tiene dureza ${this.#numbers.format(block.hardness)}.`,
        ChatResponse.Topics.BLOCKS,
        source
      );
    }

    const drops = block.drops.map((id) => this.#registry.get(id)?.label ?? `id ${id}`);
    return ChatResponse.known(
      `${block.label}: dureza ${this.#numbers.format(block.hardness)}, ` +
        `${block.solid ? 'sólido' : 'no sólido'}, ` +
        `${block.transparent ? 'transparente' : 'opaco'}, ` +
        `${block.breakable ? `se puede romper y suelta ${drops.join(', ') || 'nada'}` : 'no se puede romper'}.`,
      ChatResponse.Topics.BLOCKS,
      source
    );
  }

  #findBlock(question) {
    for (const [alias, label] of Object.entries(GameKnowledge.BLOCK_ALIASES)) {
      if (TextNormalizer.mentionsWord(question, alias)) {
        const byAlias = this.#registry.values().find(
          (type) => TextNormalizer.normalize(type.label) === TextNormalizer.normalize(label)
        );
        if (byAlias) return byAlias;
      }
    }

    // Se busca la etiqueta más larga que aparezca: "piedra partida" gana sobre
    // "piedra" cuando la pregunta nombra las dos palabras.
    let found = null;
    for (const type of this.#registry.placeableTypes()) {
      const label = TextNormalizer.normalize(type.label);
      if (label.length > 2 && TextNormalizer.mentionsWord(question, label)) {
        if (found === null || label.length > TextNormalizer.normalize(found.label).length) {
          found = type;
        }
      }
    }
    return found;
  }

  // ----------------------------------------------------------------- minerales

  #findOre(question) {
    const entries = Object.entries(this.#config.ores);
    for (const [name, vein] of entries) {
      const label = this.#registry.get(vein.BLOCK)?.label ?? name;
      if (TextNormalizer.mentionsWord(question, label, name)) return { name, vein };
    }
    // El jugador dice "diamante", no "Mineral de diamante".
    for (const [name, vein] of entries) {
      const label = TextNormalizer.normalize(this.#registry.get(vein.BLOCK)?.label ?? name);
      const bare = label.replace('mineral de ', '');
      if (bare.length > 2 && TextNormalizer.mentionsWord(question, bare)) return { name, vein };
    }
    return null;
  }

  #oreDepth(name, vein) {
    const label = this.#registry.get(vein.BLOCK)?.label ?? name;
    return ChatResponse.known(
      `${label} aparece entre las alturas Y=${vein.MIN_Y} y Y=${vein.MAX_Y}, en vetas de ` +
        `${vein.MIN_SIZE} a ${vein.MAX_SIZE} bloques, con ` +
        `${this.#numbers.format(vein.VEINS_PER_CHUNK)} vetas por chunk.`,
      ChatResponse.Topics.ORES,
      'GameConfig.ores'
    );
  }

  #oresList() {
    const list = Object.entries(this.#config.ores)
      .map(([name, vein]) => {
        const label = this.#registry.get(vein.BLOCK)?.label ?? name;
        return `${label} (Y=${vein.MIN_Y}–${vein.MAX_Y})`;
      })
      .join(', ');
    return ChatResponse.known(
      `Los minerales del juego son: ${list}. Cuanto más bajo cavás, más raro lo que aparece.`,
      ChatResponse.Topics.ORES,
      'GameConfig.ores'
    );
  }

  // -------------------------------------------------------------- supervivencia

  #survivalHealth() {
    const survival = this.#config.survival;
    return ChatResponse.known(
      `Tenés ${survival.MAX_HEALTH} puntos de vida como máximo, que son ` +
        `${survival.MAX_HEALTH / 2} corazones. El único daño que hay por ahora es el de caída.`,
      ChatResponse.Topics.SURVIVAL,
      'GameConfig.survival'
    );
  }

  #survivalFall() {
    const survival = this.#config.survival;
    // El umbral está en velocidad de impacto, no en bloques, así que se
    // convierte con v² = 2·g·h para que la respuesta le sirva al jugador.
    //
    // La gravedad se LEE de GameConfig.player.GRAVITY. En la prueba de concepto
    // estaba escrita a mano como 980 (la gravedad terrestre en cm/s²) y la
    // respuesta daba 0,9 bloques en vez de 3,5: exactamente el error que el bot
    // existe para evitar.
    const gravity = Math.abs(this.#config.player.GRAVITY);
    const blocks = Math.round(
      ((survival.FALL_DAMAGE_THRESHOLD ** 2) / (2 * gravity * this.#config.world.BLOCK_SIZE)) * 10
    ) / 10;

    return ChatResponse.known(
      `Te lastimás cuando el impacto pasa de ${survival.FALL_DAMAGE_THRESHOLD} unidades/s, ` +
        `que son unos ${this.#numbers.format(blocks)} bloques de caída. Cada unidad por encima ` +
        `del umbral quita ${this.#numbers.format(survival.FALL_DAMAGE_MULTIPLIER)} puntos de vida.`,
      ChatResponse.Topics.SURVIVAL,
      'GameConfig.survival + GameConfig.player.GRAVITY'
    );
  }

  #survivalDeath() {
    return ChatResponse.known(
      `Si la vida llega a 0 reaparecés en la superficie y la salud vuelve a ` +
        `${this.#config.survival.MAX_HEALTH}. No se pierde nada de la hotbar: ` +
        'todavía no hay penalización por morir.',
      ChatResponse.Topics.SURVIVAL,
      'GameConfig.survival + src/game/Game.js (respawn)'
    );
  }

  // --------------------------------------------------------------------- mundo

  #worldSize() {
    const world = this.#config.world;
    return ChatResponse.known(
      `El mundo mide ${world.WORLD_WIDTH}×${world.WORLD_HEIGHT}×${world.WORLD_DEPTH} bloques ` +
        `(ancho × alto × profundidad), con bloques de ${world.BLOCK_SIZE} unidades. Es finito: ` +
        'no se genera terreno nuevo al caminar.',
      ChatResponse.Topics.WORLD,
      'GameConfig.world'
    );
  }

  #worldChunk() {
    const chunk = this.#config.chunk;
    return ChatResponse.known(
      `Un chunk es una columna de ${chunk.SIZE_X}×${chunk.SIZE_Z} bloques. El mundo se divide ` +
        'así para redibujar solo la parte que cambió cuando rompés o colocás algo.',
      ChatResponse.Topics.WORLD,
      'GameConfig.chunk'
    );
  }

  #worldSeed() {
    return ChatResponse.known(
      `La semilla por defecto es ${this.#config.world.SEED}. Podés cambiarla con ?seed=123 en la ` +
        'URL o al crear un mundo nuevo: la misma semilla genera siempre el mismo terreno.',
      ChatResponse.Topics.WORLD,
      'GameConfig.world.SEED + src/main.js'
    );
  }

  #worldBiomes() {
    // Los pesos de GameConfig dicen cuáles están activos; las etiquetas en
    // español las tiene el registro, así que hacen falta los dos.
    const active = this.#biomes.values().filter((biome) => biome.weight > 0);
    return ChatResponse.known(
      `Hay ${active.length} biomas: ${active.map((biome) => biome.label).join(', ')}. Cada uno ` +
        'cambia el bloque de superficie, la altura del terreno y cuántos árboles crecen.',
      ChatResponse.Topics.WORLD,
      'GameConfig.biomes + BiomeRegistry'
    );
  }

  #worldCaves() {
    const caves = this.#config.caves;
    if (!caves.ENABLED) {
      return ChatResponse.known(
        'Las cuevas están desactivadas en esta configuración.',
        ChatResponse.Topics.WORLD,
        'GameConfig.caves.ENABLED'
      );
    }
    return ChatResponse.known(
      `Sí: hay túneles y cavernas entre las alturas Y=${caves.MIN_DEPTH} y Y=${caves.MAX_DEPTH}. ` +
        'Algunas se abren a la superficie, así que a veces se entra sin cavar.',
      ChatResponse.Topics.WORLD,
      'GameConfig.caves'
    );
  }

  #worldTrees() {
    const world = this.#config.world;
    return ChatResponse.known(
      `Sí, con troncos y hojas. Miden entre ${world.TREE_MIN_HEIGHT} y ${world.TREE_MAX_HEIGHT} ` +
        `bloques, se separan al menos ${world.TREE_MIN_DISTANCE} bloques entre sí y son más ` +
        'frecuentes en el bosque que en la llanura.',
      ChatResponse.Topics.WORLD,
      'GameConfig.world + GameConfig.worldGeneration.TREE_CLUSTER_SCALE'
    );
  }

  #worldSave() {
    return ChatResponse.known(
      'La partida se guarda en el navegador, con localStorage, desde el menú de pausa. No se ' +
        'sube a ningún servidor: si borrás los datos del sitio, se pierde.',
      ChatResponse.Topics.WORLD,
      'src/persistence/SaveManager.js'
    );
  }

  #about() {
    const world = this.#config.world;
    return ChatResponse.known(
      `Nexo World es un sandbox de voxels 3D hecho para la facultad, en JavaScript sobre p5.js ` +
        `en modo WEBGL. Tenés un mundo de ${world.WORLD_WIDTH}×${world.WORLD_HEIGHT}×` +
        `${world.WORLD_DEPTH} bloques con biomas, cuevas y minerales: podés caminar, romper, ` +
        'construir y guardar la partida.',
      ChatResponse.Topics.WORLD,
      'GameConfig.world + README.md'
    );
  }


  #worldBottom() {
    const bedrock = this.#registry.values().find((type) => !type.breakable && type.solid);
    const capas = this.#config.worldGeneration.BEDROCK_LAYERS;
    return ChatResponse.known(
      `Abajo de todo hay ${bedrock?.label ?? 'roca madre'}: ${capas} capas desde Y=0, y no se puede ` +
        `romper. Más abajo que Y=0 no hay nada, y si te caés fuera del mundo por debajo de ` +
        `Y=${this.#config.player.VOID_Y} reaparecés en la superficie.`,
      ChatResponse.Topics.WORLD,
      'GameConfig.worldGeneration.BEDROCK_LAYERS + GameConfig.player.VOID_Y'
    );
  }

  #worldCeiling() {
    const world = this.#config.world;
    const margen = this.#config.worldGeneration.SKY_MARGIN;
    return ChatResponse.known(
      `El techo está en Y=${world.WORLD_HEIGHT - 1}: arriba de eso no entra ningún bloque. La ` +
        `generación deja al menos ${margen} bloques libres sobre el punto más alto del terreno, ` +
        'así que te queda bastante aire para construir.',
      ChatResponse.Topics.WORLD,
      'GameConfig.world.WORLD_HEIGHT + GameConfig.worldGeneration.SKY_MARGIN'
    );
  }

  #worldFindCaves() {
    const caves = this.#config.caves;
    if (!caves.ENABLED) return this.#worldCaves();
    return ChatResponse.known(
      `Hay dos formas: cavar derecho hacia abajo hasta Y=${caves.MAX_DEPTH} o menos, o buscar una ` +
        'entrada natural. Algunas cuevas se abren a la superficie, así que a veces se ve el agujero ' +
        `desde arriba. El grueso está entre Y=${caves.MIN_DEPTH} y Y=${caves.MAX_DEPTH}.`,
      ChatResponse.Topics.WORLD,
      'GameConfig.caves'
    );
  }

  #worldMining() {
    const ores = Object.entries(this.#config.ores);
    // El más profundo es el más raro: se ordena por MAX_Y en vez de escribir
    // "los diamantes están abajo", que deja de ser cierto si alguien cambia los
    // rangos de GameConfig.ores.
    const masProfundo = ores.slice().sort((a, b) => a[1].MAX_Y - b[1].MAX_Y)[0];
    const label = this.#registry.get(masProfundo[1].BLOCK)?.label ?? masProfundo[0];
    return ChatResponse.known(
      `Cuanto más abajo, más raro lo que sale. Lo más difícil de conseguir es ${label}, entre ` +
        `Y=${masProfundo[1].MIN_Y} y Y=${masProfundo[1].MAX_Y}. Conviene cavar en escalera hasta ` +
        'esa altura y seguir las cuevas, que te ahorran romper bloques.',
      ChatResponse.Topics.ORES,
      'GameConfig.ores'
    );
  }

  #metaSettings() {
    return ChatResponse.known(
      'Con O abrís la configuración durante la partida, y desde el menú principal también. Ahí ' +
        'están el campo de visión, la sensibilidad del mouse, el tamaño de la mira, los volúmenes ' +
        'y qué partes del HUD se ven. Los ajustes quedan guardados en el navegador.',
      ChatResponse.Topics.CONTROLS,
      'src/interface/screens/SettingsScreen.js + SettingsStorage'
    );
  }

  #metaPerformance() {
    const world = this.#config.world;
    const total = world.WORLD_WIDTH * world.WORLD_HEIGHT * world.WORLD_DEPTH;
    return ChatResponse.known(
      `El juego dibuja bloque por bloque, así que el mundo entero son ${total.toLocaleString('es-AR')} ` +
        'celdas posibles y lo que se ve pesa. Si va lento: bajá la distancia de render en la ' +
        'configuración y cerrá otras pestañas. Si el navegador no tiene aceleración por GPU, WebGL ' +
        'corre por software y los FPS se caen aunque la máquina sea buena.',
      ChatResponse.Topics.WORLD,
      'GameConfig.world + GameConfig.rendering'
    );
  }

  #metaAccount() {
    return ChatResponse.known(
      'Podés jugar como invitado o crear una cuenta desde el menú principal. La cuenta sirve para ' +
        'separar perfiles en la misma máquina: los datos quedan en tu navegador, no se suben a ' +
        'ningún servidor. La contraseña se guarda derivada con PBKDF2, nunca en texto plano.',
      ChatResponse.Topics.WORLD,
      'src/users/ (UserManager, PasswordHasher)'
    );
  }

  #metaSound() {
    return ChatResponse.known(
      'Sí: hay sonido al romper y al colocar bloques. Los navegadores no dejan sonar nada hasta que ' +
        'hacés un clic en la página, así que si no escuchás nada, hacé clic una vez. Los volúmenes ' +
        'se ajustan en la configuración.',
      ChatResponse.Topics.WORLD,
      'src/audio/AudioManager.js + GameConfig.audio'
    );
  }

  // ------------------------------------------------------- estado de la partida

  #noGame() {
    return ChatResponse.unknown(
      'Eso solo lo puedo responder con una partida en curso. Entrá al mundo y volvé a preguntarme.',
      ChatResponse.Topics.STATUS
    );
  }

  #statusPosition() {
    const context = this.#context;
    const player = context?.player;
    const world = context?.world;
    if (!player || !world) return this.#noGame();

    const block = world.worldToBlock(player.position.x, player.position.y, player.position.z);
    return ChatResponse.known(
      `Estás en el bloque X=${block.x}, Y=${block.y}, Z=${block.z}` +
        `${player.isOnGround ? ', pisando suelo' : ', en el aire'}.`,
      ChatResponse.Topics.STATUS,
      'Player.position (estado de la partida)'
    );
  }

  #statusHealth() {
    const health = this.#context?.health;
    if (!health) return this.#noGame();
    return ChatResponse.known(
      `Te quedan ${health.current} de ${health.max} puntos de vida.`,
      ChatResponse.Topics.STATUS,
      'PlayerHealth (estado de la partida)'
    );
  }

  #statusHotbar() {
    const hotbar = this.#context?.hotbar;
    if (!hotbar) return this.#noGame();

    const selected = hotbar.selectedSlot;
    const label = selected?.blockType?.label;
    if (!label) {
      return ChatResponse.known(
        `El slot ${hotbar.selectedIndex + 1} está vacío.`,
        ChatResponse.Topics.STATUS,
        'Hotbar (estado de la partida)'
      );
    }
    return ChatResponse.known(
      `Tenés ${label} en el slot ${hotbar.selectedIndex + 1}` +
        `${selected.count ? ` (${selected.count} unidades)` : ''}.`,
      ChatResponse.Topics.STATUS,
      'Hotbar (estado de la partida)'
    );
  }

  #statusWorld() {
    const context = this.#context;
    const player = context?.player;
    const world = context?.world;
    if (!player || !world) return this.#noGame();

    const block = world.worldToBlock(player.position.x, player.position.y, player.position.z);
    const below = world.getBlockType(block.x, block.y - 1, block.z);
    const biome = context.worldGenerator?.getBiomeAt?.(block.x, block.z);
    const surface = world.getSurfaceHeight(block.x, block.z);

    const parts = [];
    if (biome?.label) parts.push(`Estás en el bioma ${biome.label}`);
    else parts.push('Estás en el mundo');
    if (below?.label) parts.push(`pisando ${below.label}`);
    parts.push(`la superficie de esta columna está en Y=${surface}`);

    return ChatResponse.known(
      `${parts.join(', ')}.`,
      ChatResponse.Topics.STATUS,
      'World + WorldGenerator (estado de la partida)'
    );
  }
}
