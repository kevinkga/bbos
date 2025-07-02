import { useEffect, useCallback, useRef } from 'react';

export interface KeyboardShortcut {
  key: string;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  metaKey?: boolean;
  action: () => void;
  description: string;
  category?: string;
  preventDefault?: boolean;
}

interface UseKeyboardShortcutsOptions {
  shortcuts: KeyboardShortcut[];
  enabled?: boolean;
}

export const useKeyboardShortcuts = ({ shortcuts, enabled = true }: UseKeyboardShortcutsOptions) => {
  const shortcutsRef = useRef<KeyboardShortcut[]>([]);
  
  // Update shortcuts ref when shortcuts change
  useEffect(() => {
    shortcutsRef.current = shortcuts;
  }, [shortcuts]);

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!enabled) return;

    // Don't trigger shortcuts when user is typing in an input
    const target = event.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.contentEditable === 'true') {
      // Exception: Allow Ctrl+P (command palette) even in inputs
      if (!(event.ctrlKey && event.key === 'p')) {
        return;
      }
    }

    for (const shortcut of shortcutsRef.current) {
      const keyMatches = shortcut.key.toLowerCase() === event.key.toLowerCase();
      const ctrlMatches = !!shortcut.ctrlKey === !!event.ctrlKey;
      const shiftMatches = !!shortcut.shiftKey === !!event.shiftKey;
      const altMatches = !!shortcut.altKey === !!event.altKey;
      const metaMatches = !!shortcut.metaKey === !!event.metaKey;

      if (keyMatches && ctrlMatches && shiftMatches && altMatches && metaMatches) {
        if (shortcut.preventDefault !== false) {
          event.preventDefault();
          event.stopPropagation();
        }
        shortcut.action();
        break; // Only execute the first matching shortcut
      }
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown, enabled]);

  // Helper to format shortcut display
  const formatShortcut = useCallback((shortcut: KeyboardShortcut): string => {
    const parts: string[] = [];
    
    if (shortcut.ctrlKey) parts.push('Ctrl');
    if (shortcut.shiftKey) parts.push('Shift');
    if (shortcut.altKey) parts.push('Alt');
    if (shortcut.metaKey) parts.push('Cmd');
    
    parts.push(shortcut.key.toUpperCase());
    
    return parts.join('+');
  }, []);

  return { formatShortcut };
};

// Predefined shortcut groups
export const createNavigationShortcuts = (
  onNavigateToPanel: (panelId: string) => void
): KeyboardShortcut[] => [
  {
    key: 'w',
    ctrlKey: true,
    shiftKey: true,
    action: () => onNavigateToPanel('welcome'),
    description: 'Go to Welcome panel',
    category: 'Navigation'
  },
  {
    key: 'c',
    ctrlKey: true,
    shiftKey: true,
    action: () => onNavigateToPanel('armbian-config'),
    description: 'Go to Armbian Configuration',
    category: 'Navigation'
  },
  {
    key: 'b',
    ctrlKey: true,
    shiftKey: true,
    action: () => onNavigateToPanel('builds'),
    description: 'Go to Builds panel',
    category: 'Navigation'
  },
  {
    key: 'f',
    ctrlKey: true,
    shiftKey: true,
    action: () => onNavigateToPanel('hardware-flash'),
    description: 'Go to Hardware Flash panel',
    category: 'Navigation'
  },
  {
    key: 'n',
    ctrlKey: true,
    shiftKey: true,
    action: () => onNavigateToPanel('network'),
    description: 'Go to Network panel',
    category: 'Navigation'
  },
  {
    key: 'e',
    ctrlKey: true,
    shiftKey: true,
    action: () => onNavigateToPanel('file-explorer'),
    description: 'Go to File Explorer',
    category: 'Navigation'
  }
];

export const createBuildShortcuts = (
  onTriggerBuild: (configId?: string) => void,
  onCancelAllBuilds: () => void,
  getLastConfiguration: () => string | undefined
): KeyboardShortcut[] => [
  {
    key: 'b',
    ctrlKey: true,
    action: () => {
      const lastConfigId = getLastConfiguration();
      if (lastConfigId) {
        onTriggerBuild(lastConfigId);
      }
    },
    description: 'Quick build with last configuration',
    category: 'Build'
  },
  {
    key: 'b',
    ctrlKey: true,
    altKey: true,
    action: () => onCancelAllBuilds(),
    description: 'Cancel all active builds',
    category: 'Build'
  }
];

export const createLayoutShortcuts = (
  onSaveLayout: () => void,
  onResetLayout: () => void,
  onToggleTheme: () => void
): KeyboardShortcut[] => [
  {
    key: 's',
    ctrlKey: true,
    action: () => onSaveLayout(),
    description: 'Save current layout',
    category: 'Layout'
  },
  {
    key: 'r',
    ctrlKey: true,
    shiftKey: true,
    action: () => onResetLayout(),
    description: 'Reset layout to default',
    category: 'Layout'
  },
  {
    key: 't',
    ctrlKey: true,
    action: () => onToggleTheme(),
    description: 'Toggle theme (light/dark)',
    category: 'Layout'
  }
];

export const createHardwareShortcuts = (
  onQuickFlash: () => void,
  onOpenSPIOperations: () => void
): KeyboardShortcut[] => [
  {
    key: 'f',
    ctrlKey: true,
    action: () => onQuickFlash(),
    description: 'Quick flash to hardware',
    category: 'Hardware'
  },
  {
    key: 's',
    ctrlKey: true,
    altKey: true,
    action: () => onOpenSPIOperations(),
    description: 'Open SPI operations',
    category: 'Hardware'
  }
];

// Helper to get all shortcuts for display purposes
export const getAllShortcuts = (
  navigationShortcuts: KeyboardShortcut[],
  buildShortcuts: KeyboardShortcut[],
  layoutShortcuts: KeyboardShortcut[],
  hardwareShortcuts: KeyboardShortcut[]
): KeyboardShortcut[] => [
  ...navigationShortcuts,
  ...buildShortcuts,
  ...layoutShortcuts,
  ...hardwareShortcuts
];

export default useKeyboardShortcuts; 