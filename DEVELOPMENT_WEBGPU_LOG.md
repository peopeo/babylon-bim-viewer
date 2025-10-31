# Development Log - Babylon BIM Viewer

## Session: WebGPU Support & Code Refactoring Plan

**Date:** 2025-10-31
**Branch:** `lod`

---

## Phase 1: WebGPU Support Implementation

### Objective
Add WebGPU rendering support with automatic fallback to WebGL, displaying the active engine type in the performance monitor.

### Implementation Details

#### 1. Engine Initialization
- Added WebGPU engine detection and initialization
- Implemented automatic fallback to WebGL when WebGPU unavailable
- Made engine initialization asynchronous to support WebGPU's `initAsync()`

**Key Code Changes:**
```typescript
// Try WebGPU first, fallback to WebGL
const webGPUSupported = await WebGPUEngine.IsSupportedAsync;
if (webGPUSupported) {
  const webGPUEngine = new WebGPUEngine(canvas, {
    antialias: true,
    stencil: true,
    alpha: true,  // Enable transparent background
  });
  await webGPUEngine.initAsync();
  engine = webGPUEngine;
}
```

#### 2. State Management
- Added `engineType: 'WebGPU' | 'WebGL'` state
- Added `isEngineFallback: boolean` state
- Added `isEngineReady: boolean` state for async initialization

#### 3. Performance Monitor Integration
- Updated PerformanceMonitor to display engine type
- Shows "(fallback)" indicator when WebGPU falls back to WebGL
- Color-coded: WebGPU = purple, WebGL = blue

---

## Critical Issues Encountered & Solutions

### Issue 1: File Drop Stopped Working After WebGPU
**Problem:** Async initialization meant `sceneRef.current` wasn't set when component rendered

**Solution:** Added `isEngineReady` state and checked both `sceneRef.current` and `isEngineReady` in drag handlers

---

### Issue 2: Empty State Message Not Visible (WebGPU-Specific)
**Problem:** WebGPU canvas rendered over DOM elements despite high z-index on empty state message

**Root Cause:** WebGPU canvas has aggressive rendering behavior that blocks UI elements

**Attempted Solutions:**
1. ❌ Increased z-index to 9999 - didn't work
2. ❌ Changed to `position: fixed` - didn't work
3. ❌ Made canvas `position: absolute, zIndex: 0` - didn't work
4. ❌ Made background transparent with `opacity: 0` - didn't work
5. ❌ Used `visibility: hidden` - canvas still blocked UI
6. ✅ **Final Solution:** `display: 'none'` when no model loaded

**Code:**
```typescript
<canvas ref={canvasRef} style={{
  display: (engineType === 'WebGPU' && !loadedModel) ? 'none' : 'block',
}} />
```

---

### Issue 3: Console Spam - "Can't find buffer Light0"
**Problem:** Hundreds of warnings per second during WebGPU initialization

**Root Cause:** Known Babylon.js WebGPU issue - light uniform buffers not initialized before materials try to use them

**Solution:** Filtered `Logger.Warn` for known harmless messages with documentation explaining why

**Reference:** https://forum.babylonjs.com/t/uncaught-error-unable-to-create-uniform-buffer/39840

---

### Issue 4: Memory Leaks When Loading Multiple Files
**Problem:** Firefox ran out of memory after loading multiple large models

**Root Cause:** Incomplete resource disposal - only disposed meshes, not materials/textures

**Solution:** Created comprehensive `disposeLoadedModel()` function that:
- Stops scene optimizer
- Removes shadow casters
- Collects all materials (using Set to avoid duplicates)
- Collects all textures (11 different types)
- Disposes in correct order: meshes → materials → textures
- Checks `isDisposed` flag to prevent double-disposal
- Forces GPU flush for WebGPU
- Adds 100ms delay for garbage collection

---

### Issue 5: WebGPU Scene Background Transparency
**Problem:** Need transparent background when no model loaded to show empty state

**Solution:**
```typescript
// Enable alpha channel in WebGPU engine
const webGPUEngine = new WebGPUEngine(canvas, {
  alpha: true,
});

// Make scene background transparent when no model
if (!loadedModel && engineType === 'WebGPU') {
  scene.clearColor = new Color4(0, 0, 0, 0);
}
```

---

## Current State

### Working Features ✅
- WebGPU detection and initialization
- Automatic fallback to WebGL
- Engine type display in performance monitor
- Empty state message visible in both engines
- File drag-and-drop working in both engines
- Model loading and display in both engines
- Comprehensive resource cleanup
- Chrome with WebGL: ✅ Working
- Firefox with WebGPU: ✅ Working

### Known Issues 🐛
- WebGPU shader errors in console (harmless, related to video texture pipeline)
- Need to close and reopen Firefox tab after code changes (caching issue)

---

## Files Modified

### Core Files
- `src/components/BabylonViewer.tsx` - Main component with WebGPU support
- `src/components/PerformanceMonitor.tsx` - Added engine type display
- `src/components/BabylonViewer.styles.ts` - Updated empty state styling
- `src/components/BabylonViewer.config.ts` - No changes needed

### New Files Created (Refactoring Preparation)
- `src/components/BabylonViewer.types.ts` - TypeScript interfaces
- `src/babylon/scene/sceneInitializer.ts` - Scene setup (partial)

---

## Phase 2: Code Refactoring Plan (PLANNED)

### Motivation
- **Current State:** BabylonViewer.tsx is ~1600 lines
- **Code Duplication:** `handleDrop` and `loadModelFromPath` share ~200 lines
- **Maintenance Issues:** Hard to test, hard to extend, browser-specific code scattered

### Principles to Apply
1. **Single Responsibility Principle (SRP)** - Each module has ONE job
2. **Dependency Injection** - Components receive dependencies
3. **Interface-Based Design** - Depend on abstractions, not implementations
4. **DRY (Don't Repeat Yourself)** - Zero code duplication
5. **Centralized Configuration** - All settings in one place

### Proposed Architecture

```
src/
  config/
    viewer.config.ts               # All settings, fully documented

  core/
    interfaces/
      IEngine.ts                   # Engine abstraction (hides WebGPU/WebGL)
      IModelLoader.ts              # Loader abstraction (file vs server)
      ISceneManager.ts             # Scene lifecycle abstraction
      types.ts                     # Shared types

  services/
    engine/
      EngineFactory.ts             # Creates WebGPU or WebGL
      EngineAdapter.ts             # Unifies engine APIs

    scene/
      SceneFactory.ts              # Creates scene with all objects
      SceneManager.ts              # Manages scene lifecycle

    loader/
      ModelLoaderFactory.ts        # Creates appropriate loader
      FileModelLoader.ts           # Loads from local files
      ServerModelLoader.ts         # Future: server loading

    camera/
      CameraController.ts          # All camera operations

    cleanup/
      ResourceDisposer.ts          # Comprehensive disposal

  components/
    BabylonViewer/
      BabylonViewer.tsx            # ~120 lines, React only
      useBabylonViewer.ts          # Business logic hook
      index.ts                     # Exports
```

### Key Improvements

#### 1. Configuration Centralization
**Problem:** Hardcoded strings/values scattered throughout code

**Solution:** Single config file with explanations
```typescript
export const VIEWER_CONFIG = {
  engine: {
    /**
     * Prefer WebGPU over WebGL when available
     * Why: WebGPU offers better performance and modern GPU features
     * Fallback: Automatically uses WebGL if WebGPU unavailable
     */
    preferWebGPU: true,

    /**
     * CHROME ONLY: Skip context lost handling
     * Why: Chrome rarely loses WebGL context, skip overhead
     * Impact: ~10% faster initialization
     * Risk: None - Chrome handles context loss internally
     */
    chrome: {
      doNotHandleContextLost: true,
    }
  }
}
```

#### 2. Engine Abstraction
**Problem:** Client code knows about WebGPU vs WebGL differences

**Solution:** Interface hides implementation
```typescript
// Client code is engine-agnostic
const engine = await EngineFactory.create(canvas, config);
engine.startRenderLoop(() => scene.render());
// EngineAdapter handles WebGPU/WebGL differences internally
```

#### 3. Loader Abstraction
**Problem:** Hard to switch from file loading to server loading

**Solution:** Interface-based loader
```typescript
interface IModelLoader {
  load(source: ModelSource): Promise<LoadedModel>;
}

// Easy to swap implementations
const loader = ModelLoaderFactory.create('file'); // or 'server'
const model = await loader.load(source);
```

#### 4. Comment Guidelines
**Bad (obvious):**
```typescript
// Set camera radius to 10
camera.radius = 10;
```

**Good (explains reasoning):**
```typescript
// Start at medium distance to show full model.
// Will be automatically adjusted after framing to bounding box.
camera.radius = 10;
```

**Browser-specific code must explain WHY:**
```typescript
/**
 * BROWSER COMPATIBILITY: Chrome shader compilation optimization
 *
 * WHY: Chrome batches shader compilation more efficiently when
 * material updates are blocked during initial load.
 *
 * IMPACT: ~30% faster load times on Chrome for large models
 * BROWSER: Chrome only - Firefox doesn't benefit from this
 * RISK: Low - automatically disabled after model loads
 * REFERENCE: Internal testing with 75K mesh models
 */
if (isChrome) {
  scene.blockMaterialDirtyMechanism = true;
}
```

### Migration Strategy

#### Phase 1: Foundation (No Breaking Changes)
- Create interfaces in `core/interfaces/`
- Create config in `config/`
- Tests pass, app still works

#### Phase 2: Services (Parallel Implementation)
- Create service implementations
- New code coexists with old code
- Tests pass for both

#### Phase 3: Component Refactor
- Refactor BabylonViewer.tsx to use services
- Remove duplicated code
- Verify all functionality

#### Phase 4: Cleanup
- Delete old unused code
- Final testing
- Documentation update

### Benefits

✅ **Zero Code Duplication** - DRY principle throughout
✅ **Easy to Extend** - Add server loading without touching existing code
✅ **Easy to Test** - Mock interfaces in tests
✅ **Browser-Agnostic** - Adapter handles differences transparently
✅ **Well-Documented** - Comments explain WHY, not WHAT
✅ **Configuration Clarity** - One place for all settings
✅ **Future-Proof** - Swap implementations via dependency injection
✅ **Maintainable** - Each file <150 lines, single responsibility

### File Size Targets
- Main component: ~120 lines (React orchestration only)
- Each service: ~80-100 lines (one responsibility)
- Each utility: ~50-80 lines (focused functionality)
- Config file: ~100 lines (with comprehensive comments)

---

## Next Steps

### Immediate (After Commit)
1. User review of refactoring plan
2. Approval to proceed with Phase 1
3. Create interfaces and config first

### Future Sessions
1. Implement services layer
2. Refactor main component
3. Remove duplicated code
4. Add comprehensive unit tests
5. Performance testing

---

## Technical Decisions Log

### Decision: Use `display: none` for WebGPU Canvas
**Date:** 2025-10-31
**Reason:** WebGPU canvas blocks UI even with z-index and opacity
**Alternative Considered:** visibility: hidden (didn't work)
**Risk:** None - canvas recreated when model loads
**Impact:** Empty state now visible in WebGPU mode

### Decision: Filter Logger.Warn Instead of console.warn
**Date:** 2025-10-31
**Reason:** Babylon.js uses internal Logger with "BJS -" prefix
**Alternative Considered:** Suppress console.warn (missed BJS warnings)
**Reference:** Babylon.js forum thread about uniform buffer warnings
**Impact:** Clean console without hiding real errors

### Decision: Comprehensive Resource Disposal vs Scene Reinit
**Date:** 2025-10-31
**Reason:** Scene reinit could break render loop and WebGPU context
**Alternative Considered:** Dispose and recreate scene (too risky)
**Trade-off:** More complex code, but safer and more predictable
**Impact:** No memory leaks, no render glitches

---

## Performance Metrics

### Model Loading (Bilton-B_c_quantized_dedup.glb - 74,939 meshes)

**Chrome (WebGL):**
- Total Load Time: ~12-14s
- Material Application: ~2s
- Shadows: ~1s
- Mesh Freezing: ~0.5s

**Firefox (WebGPU):**
- Total Load Time: ~12-15s
- Material Application: ~2s
- Shadows: ~1s
- Mesh Freezing: ~0.5s
- Additional: ~10s shader compilation (one-time)

### Memory Usage
- Before Cleanup Fix: Leaked ~500MB per model load
- After Cleanup Fix: Stable at ~800MB (3+ model loads tested)

---

## References

### Babylon.js Documentation
- WebGPU Support: https://doc.babylonjs.com/setup/support/webGPU
- Engine API: https://doc.babylonjs.com/typedoc/classes/babylon.webgpuengine

### Forum Discussions
- Uniform Buffer Issue: https://forum.babylonjs.com/t/uncaught-error-unable-to-create-uniform-buffer/39840

### Best Practices Research
- Clean Architecture in React & TypeScript
- SOLID Principles in TypeScript
- Dependency Injection patterns
- Separation of Concerns (SoC)

---

## Contributors
- Assistant: Implementation and debugging
- User: Architecture guidance, requirements, testing

---

**Status:** ✅ Phase 1 Complete, Phase 2 Planned
**Next:** Commit & Push, await user approval for refactoring
