import { ArcRotateCamera, Vector3 } from '@babylonjs/core';
import { ModelStats } from '../../core/interfaces';

/**
 * Camera Controller - Manages camera operations
 *
 * Purpose: Encapsulates camera manipulation logic.
 * Provides methods for fitting view, setting positions, etc.
 *
 * Design: Controller pattern - manages camera behavior
 */
export class CameraController {
  private camera: ArcRotateCamera;

  constructor(camera: ArcRotateCamera) {
    this.camera = camera;
  }

  /**
   * Fit camera to view entire model
   *
   * Calculates optimal camera distance and position to show
   * the entire model based on its bounding box.
   *
   * @param stats - Model statistics with bounding box
   * @param padding - Extra space around model (multiplier, default 2.0)
   */
  fitToView(stats: ModelStats, padding: number = 2.0): void {
    const { size, center } = stats.boundingBox;

    // Calculate max dimension
    const maxDimension = Math.max(size.x, size.y, size.z);

    // Set camera radius with padding
    const targetRadius = maxDimension * padding;
    this.camera.radius = targetRadius;

    // Point camera at model center
    this.camera.target = center;

    console.log(`Camera fitted to view: radius=${targetRadius.toFixed(2)}, center=${center}`);
  }

  /**
   * Set camera to specific position
   *
   * @param alpha - Horizontal rotation (radians)
   * @param beta - Vertical rotation (radians)
   * @param radius - Distance from target
   * @param target - Look-at point
   */
  setPosition(alpha: number, beta: number, radius: number, target?: Vector3): void {
    this.camera.alpha = alpha;
    this.camera.beta = beta;
    this.camera.radius = radius;

    if (target) {
      this.camera.target = target;
    }
  }

  /**
   * Reset camera to default position
   *
   * Uses configuration defaults for alpha, beta, radius, target.
   */
  reset(defaultAlpha: number, defaultBeta: number, defaultRadius: number, defaultTarget: Vector3): void {
    this.setPosition(defaultAlpha, defaultBeta, defaultRadius, defaultTarget);
    console.log('Camera reset to default position');
  }

  /**
   * Get camera position info
   *
   * @returns Object with alpha, beta, radius, target
   */
  getPosition(): { alpha: number; beta: number; radius: number; target: Vector3 } {
    return {
      alpha: this.camera.alpha,
      beta: this.camera.beta,
      radius: this.camera.radius,
      target: this.camera.target.clone(),
    };
  }

  /**
   * Enable or disable camera controls
   *
   * @param enabled - True to enable, false to disable
   */
  setControlsEnabled(enabled: boolean): void {
    if (enabled) {
      this.camera.attachControl(true);
    } else {
      this.camera.detachControl();
    }
  }
}
