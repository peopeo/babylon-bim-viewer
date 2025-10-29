# Babylon BIM Viewer

A clean, reusable React component for viewing GLB files using Babylon.js.

## Features

- Drag & drop interface for loading GLB files
- Loading progress indicator with animated spinner and percentage display
- Arc rotate camera with mouse controls (rotation, panning, zooming)
- Interactive toolbar with:
  - Toggle buttons for grid, axes, and manipulation gizmos
  - Interactive gizmos for rotating, moving, and scaling loaded models
  - Camera view presets (top, bottom, front, back, left, right)
  - Fit to view button for auto-framing
- Grid ground plane with customizable material
- 3D axes viewer at the origin
- Hemisphere and directional lighting with shadows
- Auto-framing of loaded models
- Optional Babylon.js Inspector for debugging
- Zero inertia for precise, responsive controls

## Getting Started

### Install Dependencies

```bash
npm install
```

### Run Development Server

```bash
npm run dev
```

### Build for Production

```bash
npm run build
```

## Usage

### Basic Usage

```tsx
import { BabylonViewer } from './components/BabylonViewer';

function App() {
  return <BabylonViewer />;
}
```

### With Inspector Enabled

```tsx
import { BabylonViewer } from './components/BabylonViewer';

function App() {
  return <BabylonViewer enableInspector={true} />;
}
```

### Custom Dimensions

```tsx
import { BabylonViewer } from './components/BabylonViewer';

function App() {
  return (
    <BabylonViewer
      width="800px"
      height="600px"
    />
  );
}
```

## Component Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `width` | `string` | `"100%"` | Width of the viewer container |
| `height` | `string` | `"100vh"` | Height of the viewer container |
| `enableInspector` | `boolean` | `false` | Enable Babylon.js Inspector for debugging |

## Controls

### Mouse Controls
- **Left Click + Drag**: Rotate camera around the model
- **Right Click + Drag**: Pan camera
- **Mouse Wheel**: Zoom in/out
- **Drag & Drop**: Drop a GLB file anywhere on the canvas to load it

### Toolbar Controls
The viewer includes a toolbar in the top-left corner with the following controls:

**Toggle Buttons:**
- **Grid (⊞)**: Show/hide the ground grid
- **Axes (⚹)**: Show/hide the 3D axes gizmo
- **Gizmo (⟲)**: Show/hide rotation, position, and scale gizmos for the loaded model (only available when a model is loaded)

**Camera Views:**
- **↑ (Top)**: View from above
- **↓ (Bottom)**: View from below
- **F (Front)**: Front view
- **B (Back)**: Back view
- **L (Left)**: Left side view
- **R (Right)**: Right side view

**Additional Controls:**
- **Fit to View**: Button in bottom-right corner to frame the loaded model

## Technical Details

### Architecture

The component follows a modular architecture with separated concerns:

- **BabylonViewer.tsx** - Main React component
- **BabylonViewer.config.ts** - All configuration settings (camera, lights, materials, UI)
- **BabylonViewer.styles.ts** - Centralized style definitions
- **BabylonViewer.utils.ts** - Reusable utility functions

### Scene Setup

- **Camera**: ArcRotateCamera with configurable limits
- **Lights**:
  - HemisphericLight for ambient lighting
  - DirectionalLight with shadow generation
- **Ground**: Grid material with customizable appearance
- **Axes**: 3D axes viewer showing X (red), Y (green), Z (blue)

### File Loading

The component accepts GLB files via drag & drop. When a file is dropped:
1. Previous model is disposed (if any)
2. New model is loaded using SceneLoader
3. Shadows are automatically enabled
4. Camera frames the model automatically

### Customization

All hardcoded values are extracted to `BabylonViewer.config.ts`. To customize:

```typescript
// Edit src/components/BabylonViewer.config.ts
export const VIEWER_CONFIG = {
  camera: {
    wheelPrecision: 5, // Change scroll zoom sensitivity (lower = more sensitive)
    panningSensibility: 50, // Change mouse panning sensitivity (lower = more sensitive)
    inertia: 0, // Camera momentum (0 = stops immediately, 0.9 = lots of momentum)
    radius: 15, // Change initial camera distance
    // ... other settings
  },
  ui: {
    colors: {
      primary: 'rgba(255, 100, 100, 0.9)', // Change button color
      // ... other colors
    },
  },
  // ... other configurations
};
```

## Dependencies

- React 18.3+
- Babylon.js 8.33+
- TypeScript 5.5+
- Vite 5.4+

## License

MIT
