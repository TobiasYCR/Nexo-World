import { Screen } from '../../ui/Screen.js';
import { ScreenType } from '../../ui/ScreenType.js';
import { IntentBus } from '../../ui/IntentBus.js';
import { Modal } from '../components/Modal.js';
import { Button } from '../components/Button.js';
import { AuthService } from '../../auth/AuthService.js';

/**
 * Pantalla de Perfil de Usuario en Nexo World.
 * Muestra información de cuenta, estadísticas, y permite editar nombre y contraseña.
 */
export class ProfileScreen extends Screen {
  #authService;
  #backend2Service;

  /**
   * @param {AuthService} [authService]
   * @param {Object} [backend2Service] Proveedor de puntuaciones/niveles
   * @param {import('../../ui/ScreenManager.js').ScreenManager} [screenManager]
   * @param {IntentBus} [intentBus]
   */
  constructor(authService = null, backend2Service = null, screenManager = null, intentBus = null) {
    super(ScreenType.PROFILE, screenManager, intentBus);
    this.#authService = authService;
    this.#backend2Service = backend2Service;
    this.#buildDOM();
  }

  setAuthService(service) {
    this.#authService = service;
  }

  setBackend2Service(service) {
    this.#backend2Service = service;
  }

  #buildDOM() {
    this.element.className = 'screen screen-profile nx-modal-backdrop';

    this.modal = new Modal({
      title: 'Perfil de Jugador',
      className: 'nx-profile-dialog',
      onClose: () => this.handleBack()
    });

    const body = document.createElement('div');
    body.className = 'nx-profile-body';

    // Alerta de feedback
    this.statusMessage = document.createElement('div');
    this.statusMessage.className = 'nx-form-error-summary';
    this.statusMessage.setAttribute('role', 'alert');
    this.statusMessage.hidden = true;
    body.appendChild(this.statusMessage);

    // 1. Tarjeta resumen del usuario
    const card = document.createElement('div');
    card.className = 'nx-profile-card';

    this.avatarEl = document.createElement('div');
    this.avatarEl.className = 'nx-profile-avatar';
    this.avatarEl.textContent = '👾';

    const infoContainer = document.createElement('div');
    infoContainer.className = 'nx-profile-info';

    this.usernameDisplay = document.createElement('h2');
    this.usernameDisplay.className = 'nx-profile-username';
    this.usernameDisplay.textContent = 'Cargando...';

    this.idDisplay = document.createElement('div');
    this.idDisplay.className = 'nx-profile-badge';
    this.idDisplay.textContent = 'ID: -';

    this.createdAtDisplay = document.createElement('div');
    this.createdAtDisplay.className = 'nx-profile-meta';
    this.createdAtDisplay.textContent = 'Miembro desde: -';

    infoContainer.appendChild(this.usernameDisplay);
    infoContainer.appendChild(this.idDisplay);
    infoContainer.appendChild(this.createdAtDisplay);

    card.appendChild(this.avatarEl);
    card.appendChild(infoContainer);
    body.appendChild(card);

    // 2. Sección: Estadísticas y Progresión (Backend 2)
    const statsSection = document.createElement('div');
    statsSection.className = 'nx-profile-section';

    const statsTitle = document.createElement('h3');
    statsTitle.className = 'nx-section-title';
    statsTitle.textContent = 'Estadísticas del Jugador';

    const statsGrid = document.createElement('div');
    statsGrid.className = 'nx-stats-grid';

    // Puntuación
    const scoreItem = document.createElement('div');
    scoreItem.className = 'nx-stat-item';
    const scoreLabel = document.createElement('div');
    scoreLabel.className = 'nx-stat-label';
    scoreLabel.textContent = 'PUNTUACIÓN';
    this.scoreVal = document.createElement('div');
    this.scoreVal.className = 'nx-stat-val';
    this.scoreVal.id = 'profile-score-val';
    this.scoreVal.textContent = '0';
    scoreItem.appendChild(scoreLabel);
    scoreItem.appendChild(this.scoreVal);

    // Nivel
    const levelItem = document.createElement('div');
    levelItem.className = 'nx-stat-item';
    const levelLabel = document.createElement('div');
    levelLabel.className = 'nx-stat-label';
    levelLabel.textContent = 'NIVEL';
    this.levelVal = document.createElement('div');
    this.levelVal.className = 'nx-stat-val';
    this.levelVal.id = 'profile-level-val';
    this.levelVal.textContent = 'N/D';
    levelItem.appendChild(levelLabel);
    levelItem.appendChild(this.levelVal);

    // Rango
    const rankItem = document.createElement('div');
    rankItem.className = 'nx-stat-item';
    const rankLabel = document.createElement('div');
    rankLabel.className = 'nx-stat-label';
    rankLabel.textContent = 'RANGO GLOBAL';
    this.rankVal = document.createElement('div');
    this.rankVal.className = 'nx-stat-val';
    this.rankVal.id = 'profile-rank-val';
    this.rankVal.textContent = 'N/D';
    rankItem.appendChild(rankLabel);
    rankItem.appendChild(this.rankVal);

    statsGrid.appendChild(scoreItem);
    statsGrid.appendChild(levelItem);
    statsGrid.appendChild(rankItem);

    statsSection.appendChild(statsTitle);
    statsSection.appendChild(statsGrid);
    body.appendChild(statsSection);

    // 3. Sección: Edición de Perfil
    const editSection = document.createElement('div');
    editSection.className = 'nx-profile-section nx-profile-edit';

    const editTitle = document.createElement('h3');
    editTitle.className = 'nx-section-title';
    editTitle.textContent = 'Modificar Datos de Cuenta';

    // Editar Nombre
    const nameEditGroup = document.createElement('div');
    nameEditGroup.className = 'nx-form-group';
    const nameEditLabel = document.createElement('label');
    nameEditLabel.className = 'nx-form-label';
    nameEditLabel.textContent = 'Nuevo Nombre Visible';

    this.newUsernameInput = document.createElement('input');
    this.newUsernameInput.type = 'text';
    this.newUsernameInput.className = 'nx-input nx-form-input';
    this.newUsernameInput.placeholder = 'Nuevo nombre';
    this.newUsernameInput.maxLength = 20;

    nameEditGroup.appendChild(nameEditLabel);
    nameEditGroup.appendChild(this.newUsernameInput);
    editSection.appendChild(nameEditGroup);

    // Cambiar Contraseña
    const passEditRow = document.createElement('div');
    passEditRow.className = 'nx-form-row';

    const currentPassGroup = document.createElement('div');
    currentPassGroup.className = 'nx-form-group nx-col';
    const currentPassLabel = document.createElement('label');
    currentPassLabel.className = 'nx-form-label';
    currentPassLabel.textContent = 'Contraseña Actual';

    this.currentPassInput = document.createElement('input');
    this.currentPassInput.type = 'password';
    this.currentPassInput.className = 'nx-input nx-form-input';
    this.currentPassInput.placeholder = 'Requerida si cambias contraseña';

    currentPassGroup.appendChild(currentPassLabel);
    currentPassGroup.appendChild(this.currentPassInput);

    const newPassGroup = document.createElement('div');
    newPassGroup.className = 'nx-form-group nx-col';
    const newPassLabel = document.createElement('label');
    newPassLabel.className = 'nx-form-label';
    newPassLabel.textContent = 'Nueva Contraseña';

    this.newPassInput = document.createElement('input');
    this.newPassInput.type = 'password';
    this.newPassInput.className = 'nx-input nx-form-input';
    this.newPassInput.placeholder = 'Mínimo 6 caracteres';

    newPassGroup.appendChild(newPassLabel);
    newPassGroup.appendChild(this.newPassInput);

    passEditRow.appendChild(currentPassGroup);
    passEditRow.appendChild(newPassGroup);
    editSection.appendChild(passEditRow);

    body.appendChild(editSection);
    this.modal.addBodyItem(body);

    // Botones de acción del pie
    this.saveBtn = new Button({
      text: 'GUARDAR CAMBIOS',
      variant: 'primary',
      id: 'profile-btn-save',
      onClick: () => this.handleSaveChanges()
    });

    this.logoutBtn = new Button({
      text: 'CERRAR SESIÓN',
      variant: 'danger',
      id: 'profile-btn-logout',
      onClick: () => this.handleLogout()
    });

    this.backBtn = new Button({
      text: 'VOLVER AL MENÚ',
      variant: 'secondary',
      id: 'profile-btn-back',
      onClick: () => this.handleBack()
    });

    this.modal.addFooterItem(this.saveBtn);
    this.modal.addFooterItem(this.logoutBtn);
    this.modal.addFooterItem(this.backBtn);

    this.element.appendChild(this.modal.element);
  }

  show(params = {}) {
    super.show(params);
    this.clearFeedback();
    this.refreshUserData();
  }

  refreshUserData() {
    const user = this.#authService?.getCurrentUser();
    const isGuest = this.#authService?.isGuest;

    if (!user || isGuest) {
      this.usernameDisplay.textContent = 'Modo Invitado (Sin Cuenta)';
      this.idDisplay.textContent = 'ID: invitado_local';
      this.createdAtDisplay.textContent = 'Las partidas y ajustes son locales.';
      if (this.scoreVal) this.scoreVal.textContent = '0';
      if (this.levelVal) this.levelVal.textContent = 'N/D';
      if (this.rankVal) this.rankVal.textContent = 'N/D';
      if (this.saveBtn) this.saveBtn.element.disabled = true;
      if (this.logoutBtn) this.logoutBtn.element.textContent = 'INICIAR SESIÓN';
      return;
    }

    if (this.saveBtn) this.saveBtn.element.disabled = false;
    if (this.logoutBtn) this.logoutBtn.element.textContent = 'CERRAR SESIÓN';

    this.usernameDisplay.textContent = user.username;
    this.idDisplay.textContent = `ID: ${user.id}`;

    if (user.createdAt) {
      const dateStr = new Date(user.createdAt).toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
      this.createdAtDisplay.textContent = `Miembro desde: ${dateStr}`;
    } else {
      this.createdAtDisplay.textContent = 'Miembro de Nexo World';
    }

    this.newUsernameInput.value = user.username;
    this.currentPassInput.value = '';
    this.newPassInput.value = '';

    // Consultar puntuaciones y niveles con Backend 2 si están disponibles
    this.#loadBackend2Stats(user.id);
  }

  #loadBackend2Stats(userId) {
    if (this.#backend2Service) {
      try {
        const score = this.#backend2Service.getPersonalScore?.(userId);
        if (score !== undefined && this.scoreVal) this.scoreVal.textContent = String(score);

        const level = this.#backend2Service.getPlayerLevel?.(userId);
        if (level !== undefined && this.levelVal) this.levelVal.textContent = String(level);

        const rank = this.#backend2Service.getLeaderboardRank?.(userId);
        if (rank !== undefined && this.rankVal) this.rankVal.textContent = `#${rank}`;
      } catch {
        // Silencioso: mantener N/D
      }
    } else {
      if (this.scoreVal) this.scoreVal.textContent = '0';
      if (this.levelVal) this.levelVal.textContent = 'N/D';
      if (this.rankVal) this.rankVal.textContent = 'N/D';
    }
  }

  showFeedback(message, isSuccess = false) {
    if (this.statusMessage) {
      this.statusMessage.textContent = message;
      this.statusMessage.className = isSuccess ? 'nx-form-success-summary' : 'nx-form-error-summary';
      this.statusMessage.hidden = false;
    }
  }

  clearFeedback() {
    if (this.statusMessage) {
      this.statusMessage.textContent = '';
      this.statusMessage.hidden = true;
    }
  }

  async handleSaveChanges() {
    this.clearFeedback();

    const newName = this.newUsernameInput.value.trim();
    const currentPass = this.currentPassInput.value;
    const newPass = this.newPassInput.value;

    const updates = {};
    const currentUser = this.#authService?.getCurrentUser();

    if (newName && newName !== currentUser?.username) {
      updates.username = newName;
    }

    if (newPass) {
      updates.currentPassword = currentPass;
      updates.newPassword = newPass;
    }

    if (Object.keys(updates).length === 0) {
      this.showFeedback('No se ingresaron cambios para guardar.');
      return;
    }

    this.saveBtn.element.disabled = true;
    this.saveBtn.element.textContent = 'GUARDANDO...';

    try {
      const result = await this.#authService.updateProfile(updates);
      if (result.ok) {
        this.showFeedback('¡Cambios guardados con éxito!', true);
        this.currentPassInput.value = '';
        this.newPassInput.value = '';
        this.refreshUserData();
        if (this.intentBus) {
          this.intentBus.emit(IntentBus.Events.SHOW_TOAST, {
            message: 'Perfil de usuario actualizado.',
            type: 'success'
          });
        }
      } else {
        this.showFeedback(result.message || 'Error al actualizar el perfil.');
      }
    } catch (err) {
      this.showFeedback('Error al conectar con el servidor.');
    } finally {
      this.saveBtn.element.disabled = false;
      this.saveBtn.element.textContent = 'GUARDAR CAMBIOS';
    }
  }

  async handleLogout() {
    const isGuest = this.#authService?.isGuest;
    if (isGuest) {
      this.screenManager?.open(ScreenType.LOGIN);
      return;
    }

    await this.#authService?.logout();
    if (this.intentBus) {
      this.intentBus.emit(IntentBus.Events.SHOW_TOAST, {
        message: 'Sesión cerrada correctamente.',
        type: 'info'
      });
    }
    this.screenManager?.open(ScreenType.MENU);
  }

  handleBack() {
    this.screenManager?.open(ScreenType.MENU);
  }
}
