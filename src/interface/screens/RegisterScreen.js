import { Screen } from '../../ui/Screen.js';
import { ScreenType } from '../../ui/ScreenType.js';
import { IntentBus } from '../../ui/IntentBus.js';
import { Modal } from '../components/Modal.js';
import { Button } from '../components/Button.js';
import { AuthService } from '../../auth/AuthService.js';

/**
 * Pantalla de Registro de Cuentas en Nexo World.
 * Valida formato de usuario, email y contraseñas, y se comunica con Backend 1.
 */
export class RegisterScreen extends Screen {
  #authService;

  /**
   * @param {AuthService} [authService]
   * @param {import('../../ui/ScreenManager.js').ScreenManager} [screenManager]
   * @param {IntentBus} [intentBus]
   */
  constructor(authService = null, screenManager = null, intentBus = null) {
    super(ScreenType.REGISTER, screenManager, intentBus);
    this.#authService = authService;
    this.#buildDOM();
  }

  setAuthService(service) {
    this.#authService = service;
  }

  #buildDOM() {
    this.element.className = 'screen screen-register nx-modal-backdrop';

    this.modal = new Modal({
      title: 'Crear Cuenta en Nexo World',
      className: 'nx-auth-dialog',
      onClose: () => this.handleBack()
    });

    const body = document.createElement('div');
    body.className = 'nx-auth-form';

    // Alerta de error accesible
    this.statusMessage = document.createElement('div');
    this.statusMessage.className = 'nx-form-error-summary';
    this.statusMessage.setAttribute('role', 'alert');
    this.statusMessage.hidden = true;
    body.appendChild(this.statusMessage);

    // 1. Campo: Nombre de usuario
    const uGroup = document.createElement('div');
    uGroup.className = 'nx-form-group';
    const uLabel = document.createElement('label');
    uLabel.className = 'nx-form-label';
    uLabel.textContent = 'Nombre de Usuario * (3 a 20 caracteres)';
    uLabel.htmlFor = 'register-input-username';

    this.usernameInput = document.createElement('input');
    this.usernameInput.id = 'register-input-username';
    this.usernameInput.type = 'text';
    this.usernameInput.className = 'nx-input nx-form-input';
    this.usernameInput.placeholder = 'Ej: AlexVoxel';
    this.usernameInput.maxLength = 20;
    this.usernameInput.autocomplete = 'username';
    this.usernameInput.required = true;
    this.usernameInput.setAttribute('aria-label', 'Nombre de usuario');

    uGroup.appendChild(uLabel);
    uGroup.appendChild(this.usernameInput);
    body.appendChild(uGroup);

    // 2. Campo: Correo electrónico
    const eGroup = document.createElement('div');
    eGroup.className = 'nx-form-group';
    const eLabel = document.createElement('label');
    eLabel.className = 'nx-form-label';
    eLabel.textContent = 'Correo Electrónico *';
    eLabel.htmlFor = 'register-input-email';

    this.emailInput = document.createElement('input');
    this.emailInput.id = 'register-input-email';
    this.emailInput.type = 'email';
    this.emailInput.className = 'nx-input nx-form-input';
    this.emailInput.placeholder = 'tu@correo.com';
    this.emailInput.autocomplete = 'email';
    this.emailInput.required = true;
    this.emailInput.setAttribute('aria-label', 'Correo electrónico');

    eGroup.appendChild(eLabel);
    eGroup.appendChild(this.emailInput);
    body.appendChild(eGroup);

    // 3. Campo: Contraseña
    const pGroup = document.createElement('div');
    pGroup.className = 'nx-form-group';
    const pLabel = document.createElement('label');
    pLabel.className = 'nx-form-label';
    pLabel.textContent = 'Contraseña * (mínimo 6 caracteres)';
    pLabel.htmlFor = 'register-input-password';

    this.passwordInput = document.createElement('input');
    this.passwordInput.id = 'register-input-password';
    this.passwordInput.type = 'password';
    this.passwordInput.className = 'nx-input nx-form-input';
    this.passwordInput.placeholder = 'Mínimo 6 caracteres';
    this.passwordInput.autocomplete = 'new-password';
    this.passwordInput.required = true;
    this.passwordInput.setAttribute('aria-label', 'Contraseña');

    pGroup.appendChild(pLabel);
    pGroup.appendChild(this.passwordInput);
    body.appendChild(pGroup);

    // 4. Campo: Confirmar Contraseña
    const cpGroup = document.createElement('div');
    cpGroup.className = 'nx-form-group';
    const cpLabel = document.createElement('label');
    cpLabel.className = 'nx-form-label';
    cpLabel.textContent = 'Confirmar Contraseña *';
    cpLabel.htmlFor = 'register-input-confirm-password';

    this.confirmPasswordInput = document.createElement('input');
    this.confirmPasswordInput.id = 'register-input-confirm-password';
    this.confirmPasswordInput.type = 'password';
    this.confirmPasswordInput.className = 'nx-input nx-form-input';
    this.confirmPasswordInput.placeholder = 'Repite tu contraseña';
    this.confirmPasswordInput.autocomplete = 'new-password';
    this.confirmPasswordInput.required = true;
    this.confirmPasswordInput.setAttribute('aria-label', 'Confirmar contraseña');

    cpGroup.appendChild(cpLabel);
    cpGroup.appendChild(this.confirmPasswordInput);
    body.appendChild(cpGroup);

    // Enviar con tecla Enter
    const handleKeyEnter = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.submit();
      }
    };
    this.usernameInput.addEventListener('keydown', handleKeyEnter);
    this.emailInput.addEventListener('keydown', handleKeyEnter);
    this.passwordInput.addEventListener('keydown', handleKeyEnter);
    this.confirmPasswordInput.addEventListener('keydown', handleKeyEnter);

    this.modal.addBodyItem(body);

    // Botones del pie
    this.submitBtn = new Button({
      text: 'CREAR CUENTA',
      variant: 'primary',
      id: 'register-btn-submit',
      onClick: () => this.submit()
    });

    this.loginBtn = new Button({
      text: 'YA TENGO CUENTA',
      variant: 'secondary',
      id: 'register-btn-go-login',
      onClick: () => {
        this.screenManager?.open(ScreenType.LOGIN);
      }
    });

    this.backBtn = new Button({
      text: 'VOLVER',
      variant: 'secondary',
      id: 'register-btn-back',
      onClick: () => this.handleBack()
    });

    this.modal.addFooterItem(this.submitBtn);
    this.modal.addFooterItem(this.loginBtn);
    this.modal.addFooterItem(this.backBtn);

    this.element.appendChild(this.modal.element);
  }

  show(params = {}) {
    super.show(params);
    this.clearError();
    this.passwordInput.value = '';
    this.confirmPasswordInput.value = '';
    setTimeout(() => {
      this.usernameInput?.focus?.();
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
      this.submitBtn.element.textContent = loading ? 'CREANDO CUENTA...' : 'CREAR CUENTA';
    }
    if (this.loginBtn) this.loginBtn.element.disabled = loading;
    if (this.backBtn) this.backBtn.element.disabled = loading;
  }

  async submit() {
    this.clearError();

    const username = (this.usernameInput?.value || '').trim();
    const email = (this.emailInput?.value || '').trim();
    const password = this.passwordInput?.value || '';
    const confirmPassword = this.confirmPasswordInput?.value || '';

    if (!this.#authService) {
      this.showError('Servicio de autenticación no disponible.');
      return;
    }

    this.setLoading(true);

    try {
      const result = await this.#authService.register({
        username,
        email,
        password,
        confirmPassword
      });

      if (!result.ok) {
        this.showError(result.message || 'Error al registrar la cuenta.');
        return;
      }

      if (this.intentBus) {
        this.intentBus.emit(IntentBus.Events.SHOW_TOAST, {
          message: `¡Cuenta creada! Bienvenido a Nexo World, ${result.user.username}.`,
          type: 'success'
        });
      }

      this.screenManager?.open(ScreenType.MENU);
    } catch (err) {
      this.showError('Ocurrió un error inesperado al procesar el registro.');
    } finally {
      this.setLoading(false);
    }
  }

  handleBack() {
    this.screenManager?.open(ScreenType.MENU);
  }
}
