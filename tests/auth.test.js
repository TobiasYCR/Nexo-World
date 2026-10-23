import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { installDomStub, uninstallDomStub } from './support/domStub.js';
import { AuthSession } from '../src/auth/AuthSession.js';
import { SessionManager } from '../src/auth/SessionManager.js';
import { BackendAuthClient } from '../src/auth/BackendAuthClient.js';
import { AuthService } from '../src/auth/AuthService.js';
import { IntentBus } from '../src/ui/IntentBus.js';
import { ScreenType } from '../src/ui/ScreenType.js';
import { ScreenManager } from '../src/ui/ScreenManager.js';
import { UiStateManager } from '../src/ui/UiStateManager.js';
import { LoginScreen } from '../src/interface/screens/LoginScreen.js';
import { RegisterScreen } from '../src/interface/screens/RegisterScreen.js';
import { ProfileScreen } from '../src/interface/screens/ProfileScreen.js';
import { PasswordRecoveryScreen } from '../src/interface/screens/PasswordRecoveryScreen.js';
import { MenuScreen } from '../src/ui/MenuScreen.js';
import { HUD } from '../src/ui/HUD.js';

let dom;

beforeEach(() => {
  dom = installDomStub();
});

afterEach(() => {
  uninstallDomStub();
});

// Helper para crear un cliente simulado de Backend 1
function createMockBackendClient(overrides = {}) {
  const usersDb = new Map();

  return {
    usersDb,
    async register({ username, email, password }) {
      if (overrides.registerFailsNetwork) {
        return { ok: false, code: 'NETWORK_ERROR', message: 'No se pudo conectar con el servidor.' };
      }
      if (usersDb.has(username) || usersDb.has(email)) {
        return { ok: false, code: 'USER_ALREADY_EXISTS', message: 'El usuario o correo ya está en uso.' };
      }
      const user = {
        id: `usr_${Math.random().toString(36).slice(2, 8)}`,
        username,
        email,
        createdAt: Date.now()
      };
      usersDb.set(username, { ...user, password });
      usersDb.set(email, { ...user, password });

      return {
        ok: true,
        data: {
          token: `token_${user.id}`,
          expiresAt: Date.now() + 3600 * 1000,
          user
        }
      };
    },

    async login({ identifier, password }) {
      if (overrides.loginFailsNetwork) {
        return { ok: false, code: 'NETWORK_ERROR', message: 'Error de conexión.' };
      }
      const record = usersDb.get(identifier);
      if (!record || record.password !== password) {
        return { ok: false, code: 'INVALID_CREDENTIALS', message: 'Credenciales inválidas.' };
      }
      return {
        ok: true,
        data: {
          token: `token_${record.id}`,
          expiresAt: Date.now() + 3600 * 1000,
          user: {
            id: record.id,
            username: record.username,
            email: record.email,
            createdAt: record.createdAt
          }
        }
      };
    },

    async logout(token) {
      return { ok: true, data: { success: true } };
    },

    async updateProfile(token, updates) {
      if (overrides.updateFails) {
        return { ok: false, code: 'UPDATE_FAILED', message: 'Error al actualizar.' };
      }
      return {
        ok: true,
        data: {
          user: {
            id: 'usr_123',
            username: updates.username || 'AlexUpdated',
            email: 'alex@ejemplo.com',
            createdAt: Date.now()
          }
        }
      };
    },

    async recoverPassword({ email }) {
      if (overrides.recoverFailsNetwork) {
        return { ok: false, code: 'NETWORK_ERROR', message: 'Falla de red.' };
      }
      return {
        ok: true,
        data: {
          message: 'Instrucciones enviadas.'
        }
      };
    }
  };
}

// ============================================================================
// 1. REGISTRO DE CUENTAS
// ============================================================================

test('AuthService valida campos obligatorios en el registro', async () => {
  const service = new AuthService({ client: createMockBackendClient() });

  // Nombre vacío
  let res = await service.register({ username: '', email: 'a@b.com', password: '123456', confirmPassword: '123456' });
  assert.equal(res.ok, false);
  assert.equal(res.code, 'INVALID_USERNAME');

  // Nombre con caracteres inválidos
  res = await service.register({ username: 'user@!', email: 'a@b.com', password: '123456', confirmPassword: '123456' });
  assert.equal(res.ok, false);
  assert.equal(res.code, 'INVALID_USERNAME');

  // Email inválido
  res = await service.register({ username: 'Alex', email: 'correo-invalido', password: '123456', confirmPassword: '123456' });
  assert.equal(res.ok, false);
  assert.equal(res.code, 'INVALID_EMAIL');

  // Contraseña muy corta
  res = await service.register({ username: 'Alex', email: 'alex@b.com', password: '123', confirmPassword: '123' });
  assert.equal(res.ok, false);
  assert.equal(res.code, 'INVALID_PASSWORD');

  // Contraseñas no coinciden
  res = await service.register({ username: 'Alex', email: 'alex@b.com', password: 'password1', confirmPassword: 'password2' });
  assert.equal(res.ok, false);
  assert.equal(res.code, 'PASSWORD_MISMATCH');
});

test('AuthService registra una cuenta válida y crea una sesión autenticada', async () => {
  const mockClient = createMockBackendClient();
  const service = new AuthService({ client: mockClient });

  const res = await service.register({
    username: 'SteveVoxel',
    email: 'steve@nexo.com',
    password: 'securePassword123',
    confirmPassword: 'securePassword123'
  });

  assert.equal(res.ok, true);
  assert.equal(res.user.username, 'SteveVoxel');
  assert.equal(service.isAuthenticated, true);
  assert.equal(service.getCurrentUser().username, 'SteveVoxel');
});

test('AuthService detecta usuarios duplicados informados por Backend 1', async () => {
  const mockClient = createMockBackendClient();
  const service = new AuthService({ client: mockClient });

  // Primer registro exitoso
  await service.register({
    username: 'SteveVoxel',
    email: 'steve@nexo.com',
    password: 'password123',
    confirmPassword: 'password123'
  });

  // Intentar registrar el mismo usuario
  const duplicateRes = await service.register({
    username: 'SteveVoxel',
    email: 'otro@nexo.com',
    password: 'password123',
    confirmPassword: 'password123'
  });

  assert.equal(duplicateRes.ok, false);
  assert.equal(duplicateRes.code, 'USER_ALREADY_EXISTS');
});

// ============================================================================
// 2. INICIO DE SESIÓN
// ============================================================================

test('AuthService valida campos vacíos al iniciar sesión', async () => {
  const service = new AuthService({ client: createMockBackendClient() });

  let res = await service.login({ identifier: '', password: '123' });
  assert.equal(res.ok, false);
  assert.equal(res.code, 'INVALID_INPUT');

  res = await service.login({ identifier: 'user', password: '' });
  assert.equal(res.ok, false);
  assert.equal(res.code, 'INVALID_INPUT');
});

test('AuthService maneja credenciales incorrectas retornadas por Backend 1', async () => {
  const service = new AuthService({ client: createMockBackendClient() });

  const res = await service.login({ identifier: 'no_existe', password: 'bad_password' });
  assert.equal(res.ok, false);
  assert.equal(res.code, 'INVALID_CREDENTIALS');
  assert.equal(service.isAuthenticated, false);
});

test('AuthService inicia sesión con credenciales válidas', async () => {
  const mockClient = createMockBackendClient();
  const service = new AuthService({ client: mockClient });

  await service.register({
    username: 'AlexBuilder',
    email: 'alex@nexo.com',
    password: 'mypassword',
    confirmPassword: 'mypassword'
  });

  await service.logout();
  assert.equal(service.isAuthenticated, false);

  const loginRes = await service.login({ identifier: 'AlexBuilder', password: 'mypassword' });
  assert.equal(loginRes.ok, true);
  assert.equal(service.isAuthenticated, true);
  assert.equal(service.getCurrentUser().username, 'AlexBuilder');
});

test('AuthService maneja errores de conexión sin romper la app', async () => {
  const failingClient = createMockBackendClient({ loginFailsNetwork: true });
  const service = new AuthService({ client: failingClient });

  const res = await service.login({ identifier: 'test', password: 'password' });
  assert.equal(res.ok, false);
  assert.equal(res.code, 'NETWORK_ERROR');
});

// ============================================================================
// 3. GESTIÓN DE SESIONES Y PERSISTENCIA
// ============================================================================

test('SessionManager restaura sesión válida desde Storage al recargar', () => {
  const storage = dom.window.localStorage;
  const sessionManager = new SessionManager(storage);

  const session = AuthSession.create({
    token: 'jwt_token_123',
    expiresAt: Date.now() + 100000,
    user: { id: 'usr_1', username: 'MinerBob', email: 'bob@nexo.com' }
  });

  sessionManager.saveSession(session);

  // Simular recarga con nueva instancia leyendo el mismo Storage
  const restoredManager = new SessionManager(storage);
  const activeSession = restoredManager.getSession();

  assert.equal(activeSession.isAuthenticated, true);
  assert.equal(activeSession.user.username, 'MinerBob');
  assert.equal(activeSession.token, 'jwt_token_123');
});

test('SessionManager limpia automáticamente sesiones expiradas', () => {
  const storage = dom.window.localStorage;
  const sessionManager = new SessionManager(storage);

  // Sesión vencida (expiresAt en el pasado)
  const expiredSession = new AuthSession({
    token: 'jwt_expired',
    expiresAt: Date.now() - 5000,
    user: { id: 'usr_2', username: 'OldUser' },
    isGuest: false
  });

  sessionManager.saveSession(expiredSession);

  const activeSession = sessionManager.getSession();
  assert.equal(activeSession.isAuthenticated, false);
  assert.equal(activeSession.isGuest, true);
});

test('AuthService.logout limpia la sesión y los datos privados del usuario', async () => {
  const mockClient = createMockBackendClient();
  const service = new AuthService({ client: mockClient });

  await service.register({
    username: 'PrivateUser',
    email: 'private@nexo.com',
    password: 'password123',
    confirmPassword: 'password123'
  });

  assert.equal(service.isAuthenticated, true);

  await service.logout();

  assert.equal(service.isAuthenticated, false);
  assert.equal(service.isGuest, true);
  assert.equal(service.getCurrentUser().username, 'Invitado');
});

// ============================================================================
// 4. MODO INVITADO Y COMPATIBILIDAD
// ============================================================================

test('AuthService.playAsGuest activa el modo invitado sin requerir cuenta', () => {
  const service = new AuthService({ client: createMockBackendClient() });

  const res = service.playAsGuest();
  assert.equal(res.ok, true);
  assert.equal(service.isAuthenticated, false);
  assert.equal(service.isGuest, true);
  assert.equal(service.getCurrentUser().id, 'guest');
});

// ============================================================================
// 5. PERFIL DE USUARIO Y EDICIÓN
// ============================================================================

test('ProfileScreen muestra datos reales del usuario y permite cerrar sesión', async () => {
  const mockClient = createMockBackendClient();
  const service = new AuthService({ client: mockClient });
  const intentBus = new IntentBus();
  const screenManager = new ScreenManager(dom.uiRoot, intentBus);

  await service.register({
    username: 'CraftMaster',
    email: 'craft@nexo.com',
    password: 'password123',
    confirmPassword: 'password123'
  });

  const profileScreen = new ProfileScreen(service, null, screenManager, intentBus);
  profileScreen.show();

  assert.equal(profileScreen.usernameDisplay.textContent, 'CraftMaster');
  assert.ok(profileScreen.idDisplay.textContent.includes('ID: usr_'));

  // Cerrar sesión desde la pantalla
  await profileScreen.handleLogout();
  assert.equal(service.isAuthenticated, false);
});

test('ProfileScreen integra estadísticas de Backend 2 cuando están disponibles', async () => {
  const service = new AuthService({ client: createMockBackendClient() });
  await service.register({ username: 'Hero', email: 'h@n.com', password: 'password', confirmPassword: 'password' });

  const backend2Mock = {
    getPersonalScore: (id) => 1450,
    getPlayerLevel: (id) => 12,
    getLeaderboardRank: (id) => 3
  };

  const profileScreen = new ProfileScreen(service, backend2Mock);
  profileScreen.show();

  assert.equal(profileScreen.scoreVal.textContent, '1450');
  assert.equal(profileScreen.levelVal.textContent, '12');
  assert.equal(profileScreen.rankVal.textContent, '#3');
});

// ============================================================================
// 6. PANTALLAS DE INTERFAZ Y ACCESIBILIDAD
// ============================================================================

test('LoginScreen y RegisterScreen previenen envíos incompletos con foco y roles accesibles', async () => {
  const intentBus = new IntentBus();
  const screenManager = new ScreenManager(dom.uiRoot, intentBus);
  const service = new AuthService({ client: createMockBackendClient() });

  const loginScreen = new LoginScreen(service, screenManager, intentBus);
  loginScreen.show();

  // Intento de envío vacío
  await loginScreen.submit();
  assert.equal(loginScreen.statusMessage.hidden, false);
  assert.equal(loginScreen.statusMessage.getAttribute('role'), 'alert');

  const registerScreen = new RegisterScreen(service, screenManager, intentBus);
  registerScreen.show();

  await registerScreen.submit();
  assert.equal(registerScreen.statusMessage.hidden, false);
  assert.equal(registerScreen.statusMessage.getAttribute('role'), 'alert');
});

test('MenuScreen adapta su barra de usuario según el estado autenticado o invitado', async () => {
  const intentBus = new IntentBus();
  const service = new AuthService({ client: createMockBackendClient(), intentBus });
  const menuScreen = new MenuScreen(null, intentBus, service);

  // Estado inicial: Invitado
  assert.ok(menuScreen.userBadge.textContent.includes('Invitado'));
  assert.ok(menuScreen.authActionBtn.textContent.includes('INICIAR SESIÓN'));

  // Tras registrarse
  await service.register({
    username: 'OnlineAlex',
    email: 'online@alex.com',
    password: 'password123',
    confirmPassword: 'password123'
  });

  menuScreen.updateUserBadge();
  assert.ok(menuScreen.userBadge.textContent.includes('OnlineAlex'));
  assert.ok(menuScreen.authActionBtn.textContent.includes('MI PERFIL'));

  // Tras cerrar sesión
  await service.logout();
  menuScreen.updateUserBadge();
  assert.ok(menuScreen.userBadge.textContent.includes('Invitado'));
});

// ============================================================================
// 7. INTEGRACIÓN CON HUD COMPLETO
// ============================================================================

test('HUD registra todas las pantallas de autenticación correctamente', () => {
  const hud = new HUD('ui-root');

  assert.ok(hud.screenManager.get(ScreenType.LOGIN));
  assert.ok(hud.screenManager.get(ScreenType.REGISTER));
  assert.ok(hud.screenManager.get(ScreenType.PROFILE));
  assert.ok(hud.screenManager.get(ScreenType.PASSWORD_RECOVERY));
  assert.ok(hud.authService);
});
