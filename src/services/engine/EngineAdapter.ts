import { Engine, WebGPUEngine } from '@babylonjs/core';
import { IEngine } from '../../core/interfaces';

/**
 * Engine Adapter - Unifies WebGPU and WebGL APIs
 *
 * Purpose: Provides a consistent interface regardless of which engine is running.
 * Client code doesn't need to know if it's using WebGPU or WebGL.
 *
 * Design: Adapter pattern - wraps Babylon.js engines with unified interface
 */
export class EngineAdapter implements IEngine {
  private readonly engine: Engine | WebGPUEngine;
  private readonly engineType: 'WebGPU' | 'WebGL';
  private readonly wasFallback: boolean;

  constructor(
    engine: Engine | WebGPUEngine,
    type: 'WebGPU' | 'WebGL',
    isFallback: boolean
  ) {
    this.engine = engine;
    this.engineType = type;
    this.wasFallback = isFallback;
  }

  get type(): 'WebGPU' | 'WebGL' {
    return this.engineType;
  }

  get isFallback(): boolean {
    return this.wasFallback;
  }

  startRenderLoop(renderFunction: () => void): void {
    this.engine.runRenderLoop(renderFunction);
  }

  stopRenderLoop(): void {
    this.engine.stopRenderLoop();
  }

  resize(): void {
    this.engine.resize();
  }

  getFps(): number {
    return this.engine.getFps();
  }

  getHardwareScalingLevel(): number {
    return this.engine.getHardwareScalingLevel();
  }

  setHardwareScalingLevel(level: number): void {
    this.engine.setHardwareScalingLevel(level);
  }

  dispose(): void {
    this.engine.dispose();
  }

  getInternalEngine(): Engine | WebGPUEngine {
    return this.engine;
  }
}
