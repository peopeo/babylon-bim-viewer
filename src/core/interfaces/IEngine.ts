/**
 * Engine abstraction - hides WebGPU vs WebGL implementation details
 *
 * Purpose: Client code shouldn't know which rendering engine is used.
 * This interface provides a unified API for both WebGPU and WebGL engines.
 *
 * Design: Follows Dependency Inversion Principle - depend on abstractions,
 * not concrete implementations.
 */
export interface IEngine {
  /**
   * Type of engine currently running
   * Useful for debugging and optimization decisions
   */
  readonly type: 'WebGPU' | 'WebGL';

  /**
   * Whether this engine was a fallback choice
   * True if WebGPU was attempted but fell back to WebGL
   */
  readonly isFallback: boolean;

  /**
   * Start the rendering loop
   * Abstracts away engine-specific render loop differences
   */
  startRenderLoop(renderFunction: () => void): void;

  /**
   * Stop the rendering loop
   */
  stopRenderLoop(): void;

  /**
   * Resize the engine to match canvas size
   * Called on window resize events
   */
  resize(): void;

  /**
   * Get current frames per second
   */
  getFps(): number;

  /**
   * Get hardware scaling level
   * Lower values = render at lower resolution for performance
   */
  getHardwareScalingLevel(): number;

  /**
   * Set hardware scaling level
   * @param level - Scaling factor (1 = native resolution, 2 = half resolution)
   */
  setHardwareScalingLevel(level: number): void;

  /**
   * Dispose of the engine and release all resources
   */
  dispose(): void;

  /**
   * Get the underlying Babylon.js engine instance
   * Use sparingly - prefer interface methods when possible
   */
  getInternalEngine(): any;
}

/**
 * Configuration for engine creation
 */
export interface EngineConfig {
  /**
   * Prefer WebGPU over WebGL when available
   * Default: true
   */
  preferWebGPU?: boolean;

  /**
   * Enable antialiasing for smoother edges
   * Default: true
   */
  antialias?: boolean;

  /**
   * Enable stencil buffer for advanced rendering
   * Default: true
   */
  stencil?: boolean;

  /**
   * Enable alpha channel for transparent backgrounds
   * Required for WebGPU when showing empty state
   * Default: false (WebGL), true (WebGPU)
   */
  alpha?: boolean;

  /**
   * Preserve canvas drawing buffer for screenshots
   * Default: true
   */
  preserveDrawingBuffer?: boolean;

  /**
   * Browser-specific optimizations
   */
  browserOptimizations?: {
    /**
     * CHROME ONLY: Skip WebGL context lost handling
     * Why: Chrome rarely loses context, skip the overhead
     * Impact: ~10% faster initialization
     * Risk: None - Chrome handles this internally
     */
    doNotHandleContextLost?: boolean;

    /**
     * Request high-performance GPU
     * Prefers discrete GPU over integrated GPU
     * Default: true
     */
    powerPreference?: 'high-performance' | 'low-power' | 'default';
  };
}
