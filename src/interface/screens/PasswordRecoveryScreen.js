import { Screen } from '../../ui/Screen.js';
import { ScreenType } from '../../ui/ScreenType.js';
import { IntentBus } from '../../ui/IntentBus.js';
import { Modal } from '../components/Modal.js';
import { Button } from '../components/Button.js';
import { AuthService } from '../../auth/AuthService.js';

/**
 * Recuperar el acceso con un código de administrador.
 *
 * El juego no manda correos: quien olvidó la contraseña le pide a un
 * administrador un código (npm run admin -- reset-password <usuario>) y acá lo
 * usa para poner una contraseña nueva. El código vence a los 30 minutos y sirve
 * una sola vez.
 */
export class PasswordRecoveryScreen extends Screen {
  #authService;

  /**
   * @param {AuthService} [authService]
   * @param {import('../../ui/ScreenManager.js').ScreenManager} [screenManager]
   * @param {IntentBus} [intentBus]
   */
  constructor(authService = null, screenManager = null, intentBus = null) {
    super(ScreenType.PASSWORD_RECOVERY, screenManager, intentBus);
    this.#authService = authService;
    this.#buildDOM();
  }

  setAuthService(service) {
    this.#authService = service;
  }

  #buildDOM() {
    this.element.className = 'screen screen-recovery nx-modal-backdrop';

    this.modal = new Modal({
      title: 'Recuperar Acceso a tu Cuenta',
      className: 'nx-auth-dialog',
      onClose: () => this.handleBack()
    });

    const body = document.createElement('div');
    body.className = 'nx-auth-form';

    const infoP = document.createElement('p');
    infoP.className = 'nx-auth-instruction';
    infoP.textContent =
      'Pedile a un administrador del juego un código de recuperación. ' +
      'Escribí tu usuario o correo, el código y tu contraseña nueva.';
    body.appendChild(infoP);

    this.statusMessage = document.createElement('div');
    this.statusMessage.className = 'nx-form-error-summary';
    this.statusMessage.setAttribute('role', 'alert');
    this.statusMessage.hidden = true;
    body.appendChild(this.statusMessage);

    this.identifierInput = this.#field(body, {
      id: 'recovery-input-identifier',
      label: 'Usuario o correo *',
      type: 'text',
      placeholder: 'tu usuario o tu@correo.com',
      autocomplete: 'username'
    });
    this.codeInput = this.#field(body, {
      id: 'recovery-input-code',
      label: 'Código del administrador *',
      type: 'text',
      placeholder: 'ABCD-EFGH',
      autocomplete: 'one-time-code'
    });
    this.passwordInput = this.#field(body, {
      id: 'recovery-input-password',
      label: 'Contraseña nueva *',
      type: 'password',
      placeholder: '',
      autocomplete: 'new-password'
    });
    this.confirmInput = this.#field(body, {
      id: 'recovery-input-confirm',
      label: 'Repetí la contraseña nueva *',
      type: 'password',
      placeholder: '',
      autocomplete: 'new-password'
    });

    this.modal.addBodyItem(body);

    this.submitBtn = new Button({
      text: 'CAMBIAR CONTRASEÑA',
      variant: 'primary',
      id: 'recovery-btn-submit',
      onClick: () => this.submit()
    });

    this.backBtn = new Button({
      text: 'VOLVER AL LOGIN',
      variant: 'secondary',
      id: 'recovery-btn-back',
      onClick: () => this.handleBack()
    });

    this.modal.addFooterItem(this.submitBtn);
    this.modal.addFooterItem(this.backBtn);

    this.element.appendChild(this.modal.element);
  }

  #field(container, { id, label, type, placeholder, autocomplete }) {
    const group = document.createElement('div');
    group.className = 'nx-form-group';
    const labelElement = document.createElement('label');
    labelElement.className = 'nx-form-label';
    labelElement.textContent = label;
    labelElement.htmlFor = id;

    const input = document.createElement('input');
    input.id = id;
    input.type = type;
    input.className = 'nx-input nx-form-input';
    input.placeholder = placeholder;
    input.required = true;
    input.setAttribute('autocomplete', autocomplete);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.submit();
      }
    });

    group.appendChild(labelElement);
    group.appendChild(input);
    container.appendChild(group);
    return input;
  }

  show(params = {}) {
    super.show(params);
    this.clearMessage();
    setTimeout(() => {
      this.identifierInput?.focus?.();
    }, 50);
  }

  showMessage(message, isSuccess = false) {
    if (this.statusMessage) {
      this.statusMessage.textContent = message;
      this.statusMessage.className = isSuccess ? 'nx-form-success-summary' : 'nx-form-error-summary';
      this.statusMessage.hidden = false;
    }
  }

  clearMessage() {
    if (this.statusMessage) {
      this.statusMessage.textContent = '';
      this.statusMessage.hidden = true;
    }
  }

  async submit() {
    this.clearMessage();

    if (!this.#authService) {
      this.showMessage('Servicio de autenticación no disponible.');
      return null;
    }

    this.submitBtn.element.disabled = true;
    this.submitBtn.element.textContent = 'CAMBIANDO...';

    try {
      const result = await this.#authService.resetPassword({
        identifier: this.identifierInput.value,
        code: this.codeInput.value,
        newPassword: this.passwordInput.value,
        confirmPassword: this.confirmInput.value
      });
      if (result.ok) {
        this.showMessage(result.message, true);
        this.codeInput.value = '';
        this.passwordInput.value = '';
        this.confirmInput.value = '';
      } else {
        this.showMessage(result.message || 'No se pudo cambiar la contraseña.');
      }
      return result;
    } catch {
      this.showMessage('Error al conectar con el servidor.');
      return null;
    } finally {
      this.submitBtn.element.disabled = false;
      this.submitBtn.element.textContent = 'CAMBIAR CONTRASEÑA';
    }
  }

  handleBack() {
    this.screenManager?.open(ScreenType.LOGIN);
  }
}
