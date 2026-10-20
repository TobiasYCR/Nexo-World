import { Screen } from '../../ui/Screen.js';
import { ScreenType } from '../../ui/ScreenType.js';
import { IntentBus } from '../../ui/IntentBus.js';
import { Modal } from '../components/Modal.js';
import { Button } from '../components/Button.js';
import { AuthService } from '../../auth/AuthService.js';

/**
 * Pantalla de Inicio de Sesión de Nexo World.
 * Permite acceder con credenciales de cuenta, jugar como invitado o ir a registro.
 */
export class LoginScreen extends Screen {
  #authService;

  /**
   * @param {AuthService} [authService]
   * @param {import('../../ui/ScreenManager.js').ScreenManager} [screenManager]
   * @param {IntentBus} [intentBus]
   */
  constructor(authService = null, screenManager = null, intentBus = null) {
    super(ScreenType.LOGIN, screenManager, intentBus);
    this.#authService = authService;
    this.#buildDOM();
  }

  setAuthService(service) {
    this.#authService = service;
  }

  #buildDOM() {
    this.element.className = 'screen screen-login nx-modal-backdrop';

    this.modal = new Modal({
      title: 'Iniciar Sesión en Nexo World',
      className: 'nx-auth-dialog',
      onClose: () => this.handleBack()
    });

    const body = document.createElement('div');
    body.className = 'nx-auth-form';

    // Mensaje de estado / error general
    this.statusMessage = document.createElement('div');
    this.statusMessage.className = 'nx-form-error-summary';
    this.statusMessage.setAttribute('role', 'alert');
    this.statusMessage.hidden = true;
    body.appendChild(this.statusMessage);

    // Campo: Usuario o Correo
    const idGroup = document.createElement('div');
    idGroup.className = 'nx-form-group';
    const idLabel = document.createElement('label');
    idLabel.className = 'nx-form-label';
    idLabel.textContent = 'Usuario o Correo Electrónico *';
    idLabel.htmlFor = 'login-input-identifier';

    this.identifierInput = document.createElement('input');
    this.identifierInput.id = 'login-input-identifier';
    this.identifierInput.type = 'text';
    this.identifierInput.className = 'nx-input nx-form-input';
    this.identifierInput.placeholder = 'Ej: AlexVoxel o tu@correo.com';
    this.identifierInput.autocomplete = 'username';
    this.identifierInput.required = true;
    this.identifierInput.setAttribute('aria-label', 'Usuario o correo');

    idGroup.appendChild(idLabel);
    idGroup.appendChild(this.identifierInput);
    body.appendChild(idGroup);

    // Campo: Contraseña
    const passGroup = document.createElement('div');
    passGroup.className = 'nx-form-group';
    const passLabel = document.createElement('label');
    passLabel.className = 'nx-form-label';
    passLabel.textContent = 'Contraseña *';
    passLabel.htmlFor = 'login-input-password';

    this.passwordInput = document.createElement('input');
    this.passwordInput.id = 'login-input-password';
    this.passwordInput.type = 'password';
    this.passwordInput.className = 'nx-input nx-form-input';
    this.passwordInput.placeholder = 'Tu contraseña';
    this.passwordInput.autocomplete = 'current-password';
    this.passwordInput.required = true;
    this.passwordInput.setAttribute('aria-label', 'Contraseña');

    passGroup.appendChild(passLabel);
    passGroup.appendChild(this.passwordInput);
    body.appendChild(passGroup);

    // Enlaces auxiliares
    const linksRow = document.createElement('div');
    linksRow.className = 'nx-auth-links';

    const forgotBtn = document.createElement('button');
    forgotBtn.type = 'button';
    forgotBtn.className = 'nx-link-btn';
    forgotBtn.textContent = '¿Olvidaste tu contraseña?';
    forgotBtn.addEventListener('click', () => {
      this.screenManager?.open(ScreenType.PASSWORD_RECOVERY);
    });

    linksRow.appendChild(forgotBtn);
    body.appendChild(linksRow);

    // Permitir enviar con Enter
    const handleKeyEnter = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.submit();
      }
    };
    this.identifierInput.addEventListener('keydown', handleKeyEnter);
    this.passwordInput.addEventListener('keydown', handleKeyEnter);

    // Botón de acción principal: INGRESAR (ancho completo)
    this.submitBtn = new Button({
      text: 'INGRESAR',
      variant: 'primary',
      id: 'login-btn-submit',
      onClick: () => this.submit()
    });
    this.submitBtn.element.className += ' nx-auth-btn-full nx-auth-submit-btn';
    body.appendChild(this.submitBtn.element);

    // Divisor visual elegante
    const divider = document.createElement('div');
    divider.className = 'nx-auth-divider';
    divider.innerHTML = '<span>o también</span>';
    body.appendChild(divider);

    // Acciones secundarias en cuadrícula balanceada (2 columnas)
    const secondaryRow = document.createElement('div');
    secondaryRow.className = 'nx-auth-grid-actions';

    this.registerBtn = new Button({
      text: 'CREAR CUENTA',
      variant: 'secondary',
      id: 'login-btn-go-register',
      onClick: () => {
        this.screenManager?.open(ScreenType.REGISTER);
      }
    });

    this.guestBtn = new Button({
      text: 'MODO INVITADO',
      variant: 'secondary',
      id: 'login-btn-guest',
      onClick: () => this.handlePlayAsGuest()
    });

    secondaryRow.appendChild(this.registerBtn.element);
    secondaryRow.appendChild(this.guestBtn.element);
    body.appendChild(secondaryRow);

    this.modal.addBodyItem(body);

    // Botón de pie: Volver al Menú
    this.backBtn = new Button({
      text: 'VOLVER AL MENÚ',
      variant: 'secondary',
      id: 'login-btn-back',
      onClick: () => this.handleBack()
    });
    this.backBtn.element.className += ' nx-auth-btn-full';

    this.modal.addFooterItem(this.backBtn);

    this.element.appendChild(this.modal.element);
  }

  show(params = {}) {
    super.show(params);
    this.clearError();
    this.passwordInput.value = '';
    setTimeout(() => {
      this.identifierInput?.focus?.();
    }, 50);
  }

  showError(message) {
    if (this.statusMessage) {
      this.statusMessage.textContent = message;
      this.statusMessage.hidden = false;
    }
  }

  clearError() {
    if (this.statusMessage) {
      this.statusMessage.textContent = '';
      this.statusMessage.hidden = true;
    }
  }

  setLoading(loading) {
    if (this.submitBtn) {
      this.submitBtn.element.disabled = loading;
      this.submitBtn.element.textContent = loading ? 'INGRESANDO...' : 'INGRESAR';
    }
    if (this.guestBtn) this.guestBtn.element.disabled = loading;
    if (this.registerBtn) this.registerBtn.element.disabled = loading;
    if (this.backBtn) this.backBtn.element.disabled = loading;
  }

  async submit() {
    this.clearError();

    const identifier = (this.identifierInput?.value || '').trim();
    const password = this.passwordInput?.value || '';

    if (!identifier) {
      this.showError('Por favor ingresa tu usuario o correo.');
      this.identifierInput.focus();
      return;
    }

    if (!password) {
      this.showError('Por favor ingresa tu contraseña.');
      this.passwordInput.focus();
      return;
    }

    if (!this.#authService) {
      this.showError('Servicio de autenticación no disponible.');
      return;
    }

    this.setLoading(true);

    try {
      const result = await this.#authService.login({ identifier, password });

      if (!result.ok) {
        this.showError(result.message || 'Error al iniciar sesión.');
        return;
      }

      if (this.intentBus) {
        this.intentBus.emit(IntentBus.Events.SHOW_TOAST, {
          message: `¡Bienvenido de nuevo, ${result.user.username}!`,
          type: 'success'
        });
      }

      this.screenManager?.open(ScreenType.MENU);
    } catch (err) {
      this.showError('Ocurrió un error inesperado al conectar.');
    } finally {
      this.setLoading(false);
    }
  }

  handlePlayAsGuest() {
    this.#authService?.playAsGuest();
    if (this.intentBus) {
      this.intentBus.emit(IntentBus.Events.SHOW_TOAST, {
        message: 'Modo Invitado activo (partidas locales).',
        type: 'info'
      });
    }
    this.screenManager?.open(ScreenType.MENU);
  }

  handleBack() {
    this.screenManager?.open(ScreenType.MENU);
  }
}
