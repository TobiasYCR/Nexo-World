import { Screen } from '../../ui/Screen.js';
import { ScreenType } from '../../ui/ScreenType.js';
import { IntentBus } from '../../ui/IntentBus.js';
import { Modal } from '../components/Modal.js';
import { Button } from '../components/Button.js';
import { AuthService } from '../../auth/AuthService.js';

/**
 * Pantalla de Recuperación de Contraseña de Nexo World.
 * Permite solicitar el restablecimiento de acceso mediante correo electrónico.
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
    infoP.textContent = 'Ingresa el correo electrónico asociado a tu cuenta. Si está registrado en Nexo World, te enviaremos las instrucciones de recuperación.';
    body.appendChild(infoP);

    this.statusMessage = document.createElement('div');
    this.statusMessage.className = 'nx-form-error-summary';
    this.statusMessage.setAttribute('role', 'alert');
    this.statusMessage.hidden = true;
    body.appendChild(this.statusMessage);

    const emailGroup = document.createElement('div');
    emailGroup.className = 'nx-form-group';
    const emailLabel = document.createElement('label');
    emailLabel.className = 'nx-form-label';
    emailLabel.textContent = 'Correo Electrónico *';
    emailLabel.htmlFor = 'recovery-input-email';

    this.emailInput = document.createElement('input');
    this.emailInput.id = 'recovery-input-email';
    this.emailInput.type = 'email';
    this.emailInput.className = 'nx-input nx-form-input';
    this.emailInput.placeholder = 'tu@correo.com';
    this.emailInput.required = true;
    this.emailInput.setAttribute('aria-label', 'Correo electrónico');

    this.emailInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.submit();
      }
    });

    emailGroup.appendChild(emailLabel);
    emailGroup.appendChild(this.emailInput);
    body.appendChild(emailGroup);

    this.modal.addBodyItem(body);

    this.submitBtn = new Button({
      text: 'ENVIAR INSTRUCCIONES',
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

  show(params = {}) {
    super.show(params);
    this.clearMessage();
    setTimeout(() => {
      this.emailInput?.focus?.();
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

    const email = (this.emailInput?.value || '').trim();
    if (!email) {
      this.showMessage('Por favor ingresa un correo electrónico.');
      this.emailInput.focus();
      return;
    }

    if (!this.#authService) {
      this.showMessage('Servicio de autenticación no disponible.');
      return;
    }

    this.submitBtn.element.disabled = true;
    this.submitBtn.element.textContent = 'ENVIANDO...';

    try {
      const result = await this.#authService.recoverPassword(email);
      if (result.ok) {
        this.showMessage(result.message || 'Instrucciones enviadas. Revisa tu casilla.', true);
        this.emailInput.value = '';
      } else {
        this.showMessage(result.message || 'Error al procesar la solicitud.');
      }
    } catch {
      this.showMessage('Error al conectar con el servidor.');
    } finally {
      this.submitBtn.element.disabled = false;
      this.submitBtn.element.textContent = 'ENVIAR INSTRUCCIONES';
    }
  }

  handleBack() {
    this.screenManager?.open(ScreenType.LOGIN);
  }
}
