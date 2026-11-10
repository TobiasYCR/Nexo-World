import { ScreenType } from './ScreenType.js';

/**
 * Aplica la configuración del jugador (SettingsModel) al juego y a la
 * interfaz: al arrancar con lo guardado y después con cada cambio, incluidos
 * los que hace un preset de calidad.
 *
 * Es el único lugar que sabe qué sistema cambia cada ajuste; la pantalla de
 * Configuración solo edita el modelo.
 */
export class SettingsApplier {
  /**
   * @param {import('../game/Game.js').Game} game
   * @param {import('./HUD.js').HUD} hud
   * @param {{speech?: {setVolume?: Function}}} [options]
   */
  constructor(game, hud, { speech = null } = {}) {
    this.game = game;
    this.hud = hud;
    this.speech = speech;
  }

  /** Aplica todo lo guardado y se suscribe a los cambios. */
  bind(model) {
    if (!model) return;
    for (const [key, value] of Object.entries(model.getAll())) this.apply(key, value);
    model.subscribe((key, value) => this.apply(key, value));
  }

  /** @returns {boolean} true si el ajuste se reconoció */
  apply(key, value) {
    const game = this.game;
    const hud = this.hud;
    switch (key) {
      case 'mouseSensitivity':
        game?.camera?.setSensitivity?.(value);
        return true;
      case 'fov':
        game?.camera?.setFov?.(value);
        return true;
      case 'masterVolume':
        game?.audio?.setMasterVolume?.(value / 100);
        this.speech?.setVolume?.(value / 100);
        return true;
      case 'renderDistance':
        game?.blockRenderer?.setRenderDistance?.(value * (game.world?.chunkSizeX ?? 16));
        return true;
      case 'ambientParticles':
        game?.ambientParticles?.setEnabled?.(value);
        return true;
      case 'particleDensity':
        game?.ambientParticles?.setDensityMultiplier?.(value);
        game?.blockParticles?.setDensityMultiplier?.(value);
        return true;
      case 'cameraEffects':
        game?.cameraEffects?.setEnabled?.(value);
        return true;
      case 'damageEffects':
        game?.damageEffect?.setEnabled?.(value);
        return true;
      case 'frustumCulling':
        game?.blockRenderer?.setFrustumCulling?.(value);
        return true;
      case 'greedyMeshing':
        game?.blockRenderer?.setGreedyMeshing?.(value);
        return true;
      case 'uiScale':
        if (hud?.container?.style) {
          hud.container.style.zoom = String(value);
          hud.container.style.setProperty?.('--nx-ui-scale', String(value));
        }
        return true;
      case 'showBlockName':
        hud?.hotbarView?.setShowBlockName?.(value);
        return true;
      case 'crosshairSize':
        hud?.crosshair?.setSize?.(value);
        return true;
      case 'crosshairOpacity':
        hud?.crosshair?.setOpacity?.(value);
        return true;
      case 'showDebug':
        hud?.debugOverlay?.setVisible?.(value);
        return true;
      case 'debugUpdateInterval':
        hud?.debugOverlay?.setUpdateInterval?.(value / 1000);
        return true;
      case 'showHealthBar': {
        const playing = hud?.screenManager?.currentScreenType === ScreenType.PLAYING;
        hud?.healthBar?.setVisible?.(Boolean(value) && playing);
        return true;
      }
      default:
        // graphicsPreset no se aplica: el modelo ya cambia cada ajuste del preset.
        return false;
    }
  }
}
