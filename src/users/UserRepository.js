import { UserAccount } from './UserAccount.js';
import { UserResult } from './UserResult.js';

/**
 * Almacenamiento de cuentas sobre localStorage (o cualquier objeto con la
 * interfaz Storage). Ningún método lanza: todos devuelven un UserResult.
 *
 * Usa dos tipos de clave, en un prefijo propio que no se cruza con el de las
 * partidas guardadas (`nexo-world:save:`):
 *
 *   nexo-world:user:<id>     una cuenta, con su credencial
 *   nexo-world:users:index   { format, version, entries: { usernameKey: id } }
 *
 * El índice existe para dos cosas: resolver un nombre a un id sin recorrer
 * todo el almacenamiento, y detectar nombres repetidos. Es un dato derivado:
 * si se daña, las cuentas siguen ahí y se puede reconstruir recorriendo claves.
 */
export class UserRepository {
  static USER_PREFIX = 'nexo-world:user:';
  static INDEX_KEY = 'nexo-world:users:index';
  /**
   * El índice de correos va en su propia clave y no dentro del de nombres a
   * propósito: así el formato ya guardado no cambia y las cuentas creadas
   * antes de que existiera el correo se siguen leyendo sin migrar nada.
   */
  static EMAIL_INDEX_KEY = 'nexo-world:users:emails';
  static FORMAT_ID = 'nexo-world-users';
  static DATA_VERSION = 1;
  static #PROBE_KEY = 'nexo-world:probe';

  #storage;

  /** @param {Storage|null} [storage] por defecto window.localStorage, si está accesible */
  constructor(storage = UserRepository.#resolveDefaultStorage()) {
    this.#storage = storage ?? null;
  }

  /** En modo privado o con cookies bloqueadas, el solo acceso a localStorage lanza. */
  static #resolveDefaultStorage() {
    try {
      return globalThis.localStorage ?? null;
    } catch {
      return null;
    }
  }

  /** Prueba real de escritura: algunos navegadores exponen localStorage pero rechazan setItem. */
  get isAvailable() {
    if (!this.#storage) return false;
    try {
      this.#storage.setItem(UserRepository.#PROBE_KEY, '1');
      this.#storage.removeItem(UserRepository.#PROBE_KEY);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * @param {string} id
   * @returns {{ok:boolean, reason:string|null, account?:UserAccount}}
   */
  findById(id) {
    const { Reasons } = UserResult;
    if (!this.#storage) return UserResult.fail(Reasons.STORAGE_UNAVAILABLE);
    if (typeof id !== 'string' || id.length === 0) return UserResult.fail(Reasons.NOT_FOUND);

    const raw = this.#read(UserRepository.#keyFor(id));
    if (!raw.ok) return raw;
    if (raw.value === null) return UserResult.fail(Reasons.NOT_FOUND);

    const parsed = UserRepository.#parseEnvelope(raw.value);
    if (!parsed.ok) return parsed;

    const account = UserAccount.fromStoredJSON(parsed.payload);
    if (account === null) return UserResult.fail(Reasons.CORRUPT_DATA, 'faltan campos obligatorios de la cuenta');
    return UserResult.ok({ account });
  }

  /**
   * @param {string} usernameKey nombre ya normalizado con UserAccount.normalizeUsername
   * @returns {{ok:boolean, reason:string|null, account?:UserAccount}}
   */
  findByUsernameKey(usernameKey) {
    const index = this.readIndex();
    if (!index.ok) return index;
    const id = index.entries[usernameKey];
    if (id === undefined) return UserResult.fail(UserResult.Reasons.NOT_FOUND);
    return this.findById(id);
  }

  /**
   * @param {string} emailKey correo ya normalizado
   * @returns {{ok:boolean, reason:string|null, account?:UserAccount}}
   */
  findByEmailKey(emailKey) {
    const index = this.readEmailIndex();
    if (!index.ok) return index;
    const id = index.entries[emailKey];
    if (id === undefined) return UserResult.fail(UserResult.Reasons.NOT_FOUND);
    return this.findById(id);
  }

  /**
   * Guarda una cuenta nueva y la agrega al índice.
   *
   * Escribe primero la cuenta y después el índice. Si el índice falla, borra la
   * cuenta recién escrita: es preferible perder el registro a dejar una cuenta
   * invisible ocupando espacio, que ninguna búsqueda por nombre encontraría.
   *
   * @param {UserAccount} account
   */
  insert(account) {
    const { Reasons } = UserResult;
    if (!this.#storage) return UserResult.fail(Reasons.STORAGE_UNAVAILABLE);

    const index = this.readIndex();
    if (!index.ok) return index;
    if (index.entries[account.usernameKey] !== undefined) {
      return UserResult.fail(Reasons.USERNAME_TAKEN);
    }

    const emails = this.readEmailIndex();
    if (!emails.ok) return emails;
    if (account.emailKey !== null && emails.entries[account.emailKey] !== undefined) {
      return UserResult.fail(Reasons.EMAIL_TAKEN);
    }

    const written = this.#write(UserRepository.#keyFor(account.id), account.toStoredJSON());
    if (!written.ok) return written;

    const entries = { ...index.entries, [account.usernameKey]: account.id };
    const indexed = this.#writeIndex(entries);
    if (!indexed.ok) {
      this.#remove(UserRepository.#keyFor(account.id));
      return indexed;
    }

    if (account.emailKey !== null) {
      const porCorreo = { ...emails.entries, [account.emailKey]: account.id };
      const indexadoCorreo = this.#writeEmailIndex(porCorreo);
      if (!indexadoCorreo.ok) {
        // Mismo criterio que arriba: se deshace todo antes que dejar una
        // cuenta a medio indexar.
        this.#remove(UserRepository.#keyFor(account.id));
        this.#writeIndex(index.entries);
        return indexadoCorreo;
      }
    }
    return UserResult.ok({ account: account.toPublicJSON() });
  }

  /**
   * Actualiza una cuenta existente. Si cambió el nombre, mueve la entrada del
   * índice en la misma operación.
   *
   * @param {UserAccount} account
   * @param {string} [previousUsernameKey] clave anterior, si el nombre cambió
   */
  update(account, previousUsernameKey = account.usernameKey, previousEmailKey = account.emailKey) {
    const { Reasons } = UserResult;
    if (!this.#storage) return UserResult.fail(Reasons.STORAGE_UNAVAILABLE);

    const index = this.readIndex();
    if (!index.ok) return index;

    const nameChanged = previousUsernameKey !== account.usernameKey;
    if (nameChanged) {
      const ocupadoPor = index.entries[account.usernameKey];
      if (ocupadoPor !== undefined && ocupadoPor !== account.id) {
        return UserResult.fail(Reasons.USERNAME_TAKEN);
      }
    }

    const written = this.#write(UserRepository.#keyFor(account.id), account.toStoredJSON());
    if (!written.ok) return written;

    if (nameChanged) {
      const entries = { ...index.entries };
      delete entries[previousUsernameKey];
      entries[account.usernameKey] = account.id;
      const indexed = this.#writeIndex(entries);
      if (!indexed.ok) return indexed;
    }

    if (previousEmailKey !== account.emailKey) {
      const emails = this.readEmailIndex();
      if (!emails.ok) return emails;
      const ocupado = account.emailKey === null ? undefined : emails.entries[account.emailKey];
      if (ocupado !== undefined && ocupado !== account.id) {
        return UserResult.fail(Reasons.EMAIL_TAKEN);
      }
      const porCorreo = { ...emails.entries };
      if (previousEmailKey !== null) delete porCorreo[previousEmailKey];
      if (account.emailKey !== null) porCorreo[account.emailKey] = account.id;
      const indexado = this.#writeEmailIndex(porCorreo);
      if (!indexado.ok) return indexado;
    }
    return UserResult.ok({ account: account.toPublicJSON() });
  }

  /** @param {string} id */
  delete(id) {
    const { Reasons } = UserResult;
    if (!this.#storage) return UserResult.fail(Reasons.STORAGE_UNAVAILABLE);

    const found = this.findById(id);
    if (!found.ok) return found;

    const index = this.readIndex();
    if (!index.ok) return index;

    const entries = { ...index.entries };
    delete entries[found.account.usernameKey];
    const indexed = this.#writeIndex(entries);
    if (!indexed.ok) return indexed;

    if (found.account.emailKey !== null) {
      const emails = this.readEmailIndex();
      if (emails.ok) {
        const porCorreo = { ...emails.entries };
        delete porCorreo[found.account.emailKey];
        this.#writeEmailIndex(porCorreo);
      }
    }

    this.#remove(UserRepository.#keyFor(id));
    return UserResult.ok();
  }

  /**
   * Lee el índice. Un índice ausente no es un error: significa que todavía no
   * se registró nadie.
   * @returns {{ok:boolean, reason:string|null, entries?:Object<string,string>}}
   */
  readIndex() {
    return this.#readMapa(UserRepository.INDEX_KEY);
  }

  /** Lee un índice clave -> id. Ausente no es error: todavía no hay nadie. */
  #readMapa(clave) {
    const { Reasons } = UserResult;
    if (!this.#storage) return UserResult.fail(Reasons.STORAGE_UNAVAILABLE);

    const raw = this.#read(clave);
    if (!raw.ok) return raw;
    if (raw.value === null) return UserResult.ok({ entries: {} });

    const parsed = UserRepository.#parseEnvelope(raw.value);
    if (!parsed.ok) return parsed;

    const entries = parsed.payload;
    if (entries === null || typeof entries !== 'object' || Array.isArray(entries)) {
      return UserResult.fail(Reasons.CORRUPT_DATA, 'el índice de usuarios no es un objeto');
    }
    // Se filtran las entradas con forma inválida en vez de rechazar el índice
    // entero: una clave rota no debería impedir entrar a las demás cuentas.
    const limpias = {};
    for (const [key, id] of Object.entries(entries)) {
      if (typeof key === 'string' && key.length > 0 && typeof id === 'string' && id.length > 0) {
        limpias[key] = id;
      }
    }
    return UserResult.ok({ entries: limpias });
  }

  /** Vistas públicas de todas las cuentas registradas, sin credenciales. */
  listPublic() {
    const index = this.readIndex();
    if (!index.ok) return index;

    const accounts = [];
    for (const id of Object.values(index.entries)) {
      const found = this.findById(id);
      // Una cuenta dañada se omite: listar perfiles no es una operación que
      // deba fallar entera por un registro roto.
      if (found.ok) accounts.push(found.account.toPublicJSON());
    }
    return UserResult.ok({ accounts });
  }

  #read(key) {
    try {
      return UserResult.ok({ value: this.#storage.getItem(key) ?? null });
    } catch (error) {
      return UserResult.fail(UserResult.Reasons.STORAGE_UNAVAILABLE, String(error));
    }
  }

  #write(key, payload) {
    const { Reasons } = UserResult;
    let json;
    try {
      json = JSON.stringify({
        format: UserRepository.FORMAT_ID,
        dataVersion: UserRepository.DATA_VERSION,
        payload
      });
    } catch (error) {
      return UserResult.fail(Reasons.WRITE_FAILED, String(error));
    }
    try {
      this.#storage.setItem(key, json);
      return UserResult.ok({ bytes: json.length });
    } catch (error) {
      return UserResult.fail(UserRepository.#reasonForWriteError(error), String(error));
    }
  }

  /** Mismo formato y mismas garantías que readIndex, en su propia clave. */
  readEmailIndex() {
    return this.#readMapa(UserRepository.EMAIL_INDEX_KEY);
  }

  #writeIndex(entries) {
    return this.#write(UserRepository.INDEX_KEY, entries);
  }

  #writeEmailIndex(entries) {
    return this.#write(UserRepository.EMAIL_INDEX_KEY, entries);
  }

  #remove(key) {
    try {
      this.#storage.removeItem(key);
    } catch {
      // Si no se puede borrar, no hay nada mejor que hacer desde acá: quien
      // llamó ya recibió el error de la operación principal.
    }
  }

  static #keyFor(id) {
    return `${UserRepository.USER_PREFIX}${id}`;
  }

  /** Valida el sobre común a las cuentas y al índice. */
  static #parseEnvelope(raw) {
    const { Reasons } = UserResult;
    let envelope;
    try {
      envelope = JSON.parse(raw);
    } catch (error) {
      return UserResult.fail(Reasons.CORRUPT_DATA, `JSON inválido: ${error.message}`);
    }
    if (envelope === null || typeof envelope !== 'object' || envelope.format !== UserRepository.FORMAT_ID) {
      return UserResult.fail(Reasons.CORRUPT_DATA, 'no es un registro de usuarios de Nexo World');
    }
    if (envelope.dataVersion !== UserRepository.DATA_VERSION) {
      return UserResult.fail(
        Reasons.INCOMPATIBLE_VERSION,
        `datos v${envelope.dataVersion}, se esperaba v${UserRepository.DATA_VERSION}`
      );
    }
    return UserResult.ok({ payload: envelope.payload });
  }

  /** Mismo criterio que SaveManager: el nombre del error de cuota varía por navegador. */
  static #reasonForWriteError(error) {
    const { Reasons } = UserResult;
    const name = error?.name ?? '';
    const code = error?.code;
    if (name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED' || code === 22 || code === 1014) {
      return Reasons.QUOTA_EXCEEDED;
    }
    if (name === 'SecurityError') return Reasons.STORAGE_UNAVAILABLE;
    return Reasons.WRITE_FAILED;
  }
}
