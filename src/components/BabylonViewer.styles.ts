import { CSSProperties } from 'react';
import { VIEWER_CONFIG } from './BabylonViewer.config';

const { colors, spacing, borderRadius, shadows, transitions, zIndex, fonts, toolbar } = VIEWER_CONFIG.ui;

/**
 * Centralized styles for the Babylon.js viewer component
 */

export const styles = {
  container: (width: string, height: string): CSSProperties => ({
    position: 'relative',
    width,
    height,
    overflow: 'hidden',
  }),

  canvas: (): CSSProperties => ({
    width: '100%',
    height: '100%',
    display: 'block',
    outline: 'none',
  }),

  dragOverlay: (): CSSProperties => ({
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.primaryLight,
    border: `3px dashed ${colors.primaryBorder}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
    zIndex: zIndex.overlay,
  }),

  dragOverlayText: (): CSSProperties => ({
    backgroundColor: colors.dark,
    color: colors.white,
    padding: `${spacing.medium} ${spacing.large}`,
    borderRadius: borderRadius.default,
    fontSize: '24px',
    fontFamily: fonts.default,
  }),

  emptyState: (): CSSProperties => ({
    position: 'fixed',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    textAlign: 'center',
    color: 'white',
    fontFamily: fonts.default,
    pointerEvents: 'none',
    zIndex: 9999,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    padding: '40px',
    borderRadius: '12px',
    border: '2px solid rgba(74, 222, 128, 0.5)',
  }),

  emptyStateEmoji: (): CSSProperties => ({
    fontSize: '48px',
    marginBottom: spacing.medium,
  }),

  emptyStateTitle: (): CSSProperties => ({
    fontSize: '20px',
    fontWeight: 'bold',
  }),

  emptyStateSubtitle: (): CSSProperties => ({
    fontSize: '14px',
    marginTop: spacing.small,
  }),

  button: (): CSSProperties => ({
    position: 'absolute',
    bottom: spacing.medium,
    right: spacing.medium,
    padding: '12px 20px',
    backgroundColor: colors.primary,
    color: colors.white,
    border: 'none',
    borderRadius: borderRadius.default,
    fontSize: '14px',
    fontWeight: '600',
    fontFamily: fonts.default,
    cursor: 'pointer',
    boxShadow: shadows.default,
    transition: transitions.default,
    zIndex: zIndex.button,
  }),

  buttonHover: {
    backgroundColor: colors.primaryHover,
    transform: 'translateY(-2px)',
    boxShadow: shadows.hover,
  },

  buttonNormal: {
    backgroundColor: colors.primary,
    transform: 'translateY(0)',
    boxShadow: shadows.default,
  },

  // Toolbar styles
  toolbar: (): CSSProperties => ({
    position: 'absolute',
    top: spacing.medium,
    left: spacing.medium,
    display: 'flex',
    flexDirection: 'column',
    gap: toolbar.buttonGap,
    zIndex: zIndex.toolbar,
  }),

  toolbarRow: (): CSSProperties => ({
    display: 'flex',
    gap: toolbar.buttonGap,
  }),

  toolbarButton: (isActive?: boolean): CSSProperties => ({
    width: toolbar.buttonSize,
    height: toolbar.buttonSize,
    backgroundColor: isActive ? colors.primary : 'rgba(50, 50, 60, 0.9)',
    color: colors.white,
    border: 'none',
    borderRadius: borderRadius.default,
    fontSize: '12px',
    fontWeight: '600',
    fontFamily: fonts.default,
    cursor: 'pointer',
    boxShadow: shadows.default,
    transition: transitions.default,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  }),

  toolbarButtonHover: {
    backgroundColor: colors.primary,
    transform: 'scale(1.05)',
  },

  toolbarButtonNormal: (isActive?: boolean): CSSProperties => ({
    backgroundColor: isActive ? colors.primary : 'rgba(50, 50, 60, 0.9)',
    transform: 'scale(1)',
  }),

  // Loading indicator styles
  loadingOverlay: (): CSSProperties => ({
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: zIndex.overlay,
  }),

  loadingContent: (): CSSProperties => ({
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: spacing.medium,
  }),

  loadingSpinner: (): CSSProperties => ({
    width: '60px',
    height: '60px',
    border: `4px solid ${colors.primaryLight}`,
    borderTop: `4px solid ${colors.primary}`,
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  }),

  loadingText: (): CSSProperties => ({
    color: colors.white,
    fontSize: '18px',
    fontWeight: '600',
    fontFamily: fonts.default,
    textAlign: 'center',
  }),

  loadingSubtext: (): CSSProperties => ({
    color: colors.textLight,
    fontSize: '14px',
    fontFamily: fonts.default,
    textAlign: 'center',
  }),

  progressBarContainer: (): CSSProperties => ({
    width: '300px',
    height: '8px',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: '4px',
    overflow: 'hidden',
    marginTop: spacing.small,
  }),

  progressBar: (progress: number): CSSProperties => ({
    width: `${progress}%`,
    height: '100%',
    backgroundColor: colors.primary,
    transition: 'width 0.3s ease',
  }),

  progressText: (): CSSProperties => ({
    color: colors.white,
    fontSize: '24px',
    fontWeight: 'bold',
    fontFamily: fonts.default,
    marginTop: spacing.small,
  }),
} as const;
