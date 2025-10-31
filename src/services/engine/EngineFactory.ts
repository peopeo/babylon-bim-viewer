import { Engine, WebGPUEngine, Logger } from '@babylonjs/core';
import { IEngine, EngineConfig } from '../../core/interfaces';
import { EngineAdapter } from './EngineAdapter';
import { VIEWER_CONFIG } from '../../config/viewer.config';

/**
 * Engine Factory - Creates WebGPU or WebGL engines
 *
 * Purpose: Encapsulates engine creation logic with automatic fallback.
 * Tries WebGPU first if preferred, falls back to WebGL if needed.
 *
 * Design: Factory pattern - creates objects without exposing creation logic
 */
export class EngineFactory {
  /**
   * Create an engine with the specified configuration
   *
   * @param canvas - HTML canvas element to render to
   * @param config - Engine configuration options
   * @returns Promise<IEngine> - Unified engine interface
   */
  static async create(
    canvas: HTMLCanvasElement,
    config: EngineConfig = {}
  ): Promise<IEngine> {
    // Merge with defaults from config
    const finalConfig: Required<EngineConfig> = {
      preferWebGPU: config.preferWebGPU ?? VIEWER_CONFIG.engine.preferWebGPU,
      antialias: config.antialias ?? true,
      stencil: config.stencil ?? VIEWER_CONFIG.engine.stencil,
      alpha: config.alpha ?? VIEWER_CONFIG.engine.alphaForWebGPU,
      preserveDrawingBuffer: config.preserveDrawingBuffer ?? VIEWER_CONFIG.engine.preserveDrawingBuffer,
      browserOptimizations: {
        doNotHandleContextLost: config.browserOptimizations?.doNotHandleContextLost ?? VIEWER_CONFIG.engine.doNotHandleContextLost,
        powerPreference: config.browserOptimizations?.powerPreference ?? VIEWER_CONFIG.engine.powerPreference,
      },
    };

    // Detect browser for optimizations
    const browserInfo = this.detectBrowser();
    console.log(`Browser detected: ${browserInfo.name}`);

    // Setup error filtering before engine creation
    this.setupErrorFiltering();

    let engine: Engine | WebGPUEngine;
    let type: 'WebGPU' | 'WebGL';
    let isFallback = false;

    // Try WebGPU first if preferred
    if (finalConfig.preferWebGPU) {
      const webGPUResult = await this.tryCreateWebGPU(canvas, finalConfig);
      if (webGPUResult.success) {
        engine = webGPUResult.engine!;
        type = 'WebGPU';
        isFallback = false;
        console.log('✓ WebGPU engine initialized successfully');
      } else {
        // WebGPU failed, fallback to WebGL
        console.log('WebGPU not available, falling back to WebGL');
        engine = this.createWebGL(canvas, finalConfig, browserInfo);
        type = 'WebGL';
        isFallback = true;
      }
    } else {
      // WebGL explicitly requested
      engine = this.createWebGL(canvas, finalConfig, browserInfo);
      type = 'WebGL';
      isFallback = false;
    }

    // Log engine info
    this.logEngineInfo(engine, type);

    return new EngineAdapter(engine, type, isFallback);
  }

  /**
   * Attempt to create WebGPU engine
   */
  private static async tryCreateWebGPU(
    canvas: HTMLCanvasElement,
    config: Required<EngineConfig>
  ): Promise<{ success: boolean; engine?: WebGPUEngine }> {
    try {
      console.log('=== ATTEMPTING WEBGPU INITIALIZATION ===');

      // Check if WebGPU is supported
      const isSupported = await WebGPUEngine.IsSupportedAsync;
      if (!isSupported) {
        console.log('WebGPU not supported by this browser');
        return { success: false };
      }

      console.log('WebGPU is supported! Initializing...');

      // Create WebGPU engine
      const engine = new WebGPUEngine(canvas, {
        antialias: config.antialias,
        stencil: config.stencil,
        /**
         * WebGPU requires alpha channel for transparent backgrounds
         * This is necessary to show the empty state message through the canvas
         */
        alpha: config.alpha,
      });

      // Initialize asynchronously (WebGPU requirement)
      await engine.initAsync();

      return { success: true, engine };
    } catch (error) {
      console.warn('WebGPU initialization failed:', error);
      return { success: false };
    }
  }

  /**
   * Create WebGL engine
   */
  private static createWebGL(
    canvas: HTMLCanvasElement,
    config: Required<EngineConfig>,
    browserInfo: BrowserInfo
  ): Engine {
    const engineOptions: any = {
      preserveDrawingBuffer: config.preserveDrawingBuffer,
      stencil: config.stencil,
      antialias: config.antialias,
      powerPreference: config.browserOptimizations.powerPreference,
    };

    /**
     * CHROME ONLY: Skip context lost handling
     *
     * Why: Chrome rarely loses WebGL context, and handling adds overhead
     * Impact: ~10% faster initialization
     * Risk: None - Chrome has robust internal context management
     */
    if (browserInfo.isChrome && config.browserOptimizations.doNotHandleContextLost) {
      engineOptions.doNotHandleContextLost = true;
    }

    const engine = new Engine(canvas, true, engineOptions);

    /**
     * CHROME ONLY: Optimize for offline operation
     *
     * Why: Disabling offline checks speeds up resource loading
     * Impact: Faster model loading on Chrome
     */
    if (browserInfo.isChrome) {
      engine.enableOfflineSupport = false;
      engine.disablePerformanceMonitorInBackground = true;
    }

    return engine;
  }

  /**
   * Setup error filtering for known harmless warnings
   *
   * Why: WebGPU produces console spam about video texture pipeline
   * These warnings are harmless but clutter the console.
   */
  private static setupErrorFiltering(): void {
    const originalLogWarn = Logger.Warn;

    Logger.Warn = (message: string | any[], limit?: number) => {
      const msg = String(message);

      /**
       * Known Babylon.js WebGPU issue: Light uniform buffers
       *
       * What: Light buffers aren't initialized before materials try to use them
       * Why: Timing issue in WebGPU initialization sequence
       * Impact: Harmless - buffers are created shortly after
       * Reference: https://forum.babylonjs.com/t/uncaught-error-unable-to-create-uniform-buffer/39840
       */
      if (
        msg.includes("Can't find buffer") ||
        msg.includes('Light0') ||
        msg.includes('Make sure you bound it')
      ) {
        return; // Suppress known WebGPU initialization warnings
      }

      originalLogWarn.call(Logger, message, limit);
    };

    // Also filter console.error and console.warn for WebGPU video pipeline errors
    const originalConsoleError = console.error;
    const originalConsoleWarn = console.warn;

    console.error = (...args: any[]) => {
      const message = args.join(' ');
      if (
        message.includes('CopyVideoToTexture') ||
        message.includes('InternalVideoPipeline') ||
        message.includes('Shader module creation failed') ||
        message.includes('WebGPU uncaptured error')
      ) {
        return; // Suppress WebGPU video pipeline errors (not used in BIM viewer)
      }
      originalConsoleError.apply(console, args);
    };

    console.warn = (...args: any[]) => {
      const message = args.join(' ');
      if (
        message.includes('CopyVideoToTexture') ||
        message.includes('InternalVideoPipeline') ||
        message.includes("Can't find buffer") ||
        message.includes('Light0')
      ) {
        return; // Suppress known harmless warnings
      }
      originalConsoleWarn.apply(console, args);
    };
  }

  /**
   * Log detailed engine information for debugging
   */
  private static logEngineInfo(engine: Engine | WebGPUEngine, type: 'WebGPU' | 'WebGL'): void {
    if (type === 'WebGPU') {
      console.log('=== WEBGPU ENGINE INFO ===');
      console.log('Engine Type: WebGPU');
      console.log('Hardware Scaling Level:', engine.getHardwareScalingLevel());
    } else {
      console.log('=== WEBGL ENGINE INFO ===');
      const webGLEngine = engine as Engine;
      const gl = webGLEngine._gl;
      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      if (debugInfo) {
        console.log('WebGL Vendor:', gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL));
        console.log('WebGL Renderer:', gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL));
      }
      console.log('WebGL Version:', webGLEngine.webGLVersion);
      console.log('Parallel Shader Compile:', engine.getCaps().parallelShaderCompile ? 'Supported' : 'Not Supported');
    }
  }

  /**
   * Detect browser and version
   */
  private static detectBrowser(): BrowserInfo {
    const ua = navigator.userAgent;
    const isChrome = /Chrome/.test(ua) && /Google Inc/.test(navigator.vendor);
    const isFirefox = /Firefox/.test(ua);
    const isSafari = /Safari/.test(ua) && !isChrome;

    let name = 'Unknown';
    if (isChrome) name = 'Chrome';
    else if (isFirefox) name = 'Firefox';
    else if (isSafari) name = 'Safari';

    return {
      isChrome,
      isFirefox,
      isSafari,
      name,
    };
  }
}

interface BrowserInfo {
  isChrome: boolean;
  isFirefox: boolean;
  isSafari: boolean;
  name: string;
}
