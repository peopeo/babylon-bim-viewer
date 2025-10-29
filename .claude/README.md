# Babylon BIM Viewer - Project Instructions

## Project Overview
This is a clean, reusable React component for viewing GLB/glTF files using Babylon.js.

## Tech Stack
- React 18 + TypeScript
- Babylon.js 8.33+ (core, loaders, materials, inspector)
- Vite for build tooling

## Coding Guidelines
- Use functional components with hooks
- Keep component logic clean and well-commented
- Prefer TypeScript strict mode
- Use inline styles for component-specific styling
- apply best practice patterns like DRY
- don't hard code configuration values and other settings throughout the code, keep everything together in a setting object  

## Component Architecture
- `BabylonViewer` is the main reusable component
- All Babylon.js scene setup happens in a single useEffect
- Use refs for Babylon objects (engine, scene, camera, etc.)
- Cleanup is critical - dispose all Babylon resources on unmount

## Key Features
- Drag & drop GLB file loading
- Arc rotate camera controls
- Grid material ground plane
- 3D axes viewer
- Shadow support
- Fit to view functionality
- Optional Babylon Inspector

## Development Commands
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- always take care that no old server instances are running in the background an serve outdated versions for testing
