import React, { useState, useCallback, useMemo } from 'react';
import { App, FloatButton, Tooltip } from 'antd';
import { 
  ControlOutlined, 
  QuestionCircleOutlined, 
  SettingOutlined,
  ThunderboltOutlined
} from '@ant-design/icons';
import { CommandPalette } from './CommandPalette';
import { 
  useKeyboardShortcuts, 
  createNavigationShortcuts,
  createBuildShortcuts,
  createLayoutShortcuts,
  createHardwareShortcuts,
  getAllShortcuts,
  type KeyboardShortcut
} from '../hooks/useKeyboardShortcuts';
import { useAppStore, useAppActions } from '../stores/app';
import { messageService } from '../services/messageService';

interface IDEManagerProps {
  onNavigateToPanel?: (panelId: string) => void;
  onTriggerBuild?: (configId?: string) => void;
  onTriggerFlash?: () => void;
  onOpenFileExplorer?: () => void;
  onResetLayout?: () => void;
  children: React.ReactNode;
}

export const IDEManager: React.FC<IDEManagerProps> = ({
  onNavigateToPanel,
  onTriggerBuild,
  onTriggerFlash,
  onOpenFileExplorer,
  onResetLayout,
  children
}) => {
  const { notification } = App.useApp();
  const [commandPaletteVisible, setCommandPaletteVisible] = useState(false);
  const [shortcutsHelpVisible, setShortcutsHelpVisible] = useState(false);

  const { configurations, theme, layout } = useAppStore();
  const { saveLayout, setTheme } = useAppActions();

  // Helper functions for shortcuts
  const getLastConfiguration = useCallback(() => {
    return configurations.length > 0 ? configurations[0].id : undefined;
  }, [configurations]);

  const handleSaveLayout = useCallback(() => {
    if (layout) {
      const layoutName = `Layout_${new Date().toISOString().slice(0, 16).replace(/:/g, '-')}`;
      saveLayout(layoutName, layout);
      messageService.success(`Layout saved as ${layoutName}`);
    } else {
      messageService.warning('No layout to save');
    }
  }, [layout, saveLayout]);

  const handleToggleTheme = useCallback(() => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    messageService.success(`Switched to ${newTheme} theme`);
  }, [theme, setTheme]);

  const handleCancelAllBuilds = useCallback(() => {
    // This would typically call a build service to cancel active builds
    messageService.info('Cancelling all active builds...');
    notification.info({
      message: 'Build Cancellation',
      description: 'All active builds have been cancelled.',
      placement: 'topRight'
    });
  }, [notification]);

  const handleQuickFlash = useCallback(() => {
    onTriggerFlash?.();
    onNavigateToPanel?.('hardware-flash');
    messageService.info('Opening hardware flash panel');
  }, [onTriggerFlash, onNavigateToPanel]);

  const handleOpenSPIOperations = useCallback(() => {
    onNavigateToPanel?.('hardware-flash');
    setTimeout(() => {
      messageService.info('Navigate to Hardware Flash and select SPI operations');
    }, 500);
  }, [onNavigateToPanel]);

  // Create all shortcut groups
  const navigationShortcuts = useMemo(() => 
    createNavigationShortcuts(onNavigateToPanel || (() => {})), 
    [onNavigateToPanel]
  );

  const buildShortcuts = useMemo(() => 
    createBuildShortcuts(
      onTriggerBuild || (() => {}), 
      handleCancelAllBuilds,
      getLastConfiguration
    ), 
    [onTriggerBuild, handleCancelAllBuilds, getLastConfiguration]
  );

  const layoutShortcuts = useMemo(() => 
    createLayoutShortcuts(
      handleSaveLayout,
      onResetLayout || (() => {}),
      handleToggleTheme
    ), 
    [handleSaveLayout, onResetLayout, handleToggleTheme]
  );

  const hardwareShortcuts = useMemo(() => 
    createHardwareShortcuts(
      handleQuickFlash,
      handleOpenSPIOperations
    ), 
    [handleQuickFlash, handleOpenSPIOperations]
  );

  // Command palette shortcut
  const commandPaletteShortcuts: KeyboardShortcut[] = useMemo(() => [
    {
      key: 'p',
      ctrlKey: true,
      action: () => setCommandPaletteVisible(true),
      description: 'Open Command Palette',
      category: 'General'
    },
    {
      key: '?',
      ctrlKey: true,
      action: () => setShortcutsHelpVisible(true),
      description: 'Show keyboard shortcuts help',
      category: 'General'
    }
  ], []);

  // Combine all shortcuts
  const allShortcuts = useMemo(() => [
    ...commandPaletteShortcuts,
    ...navigationShortcuts,
    ...buildShortcuts,
    ...layoutShortcuts,
    ...hardwareShortcuts
  ], [
    commandPaletteShortcuts,
    navigationShortcuts, 
    buildShortcuts, 
    layoutShortcuts, 
    hardwareShortcuts
  ]);

  // Enable keyboard shortcuts
  useKeyboardShortcuts({ shortcuts: allShortcuts });

  const showShortcutsHelp = useCallback(() => {
    const shortcutsByCategory = allShortcuts.reduce((acc, shortcut) => {
      const category = shortcut.category || 'General';
      if (!acc[category]) acc[category] = [];
      acc[category].push(shortcut);
      return acc;
    }, {} as Record<string, KeyboardShortcut[]>);

    const formatShortcut = (shortcut: KeyboardShortcut): string => {
      const parts: string[] = [];
      if (shortcut.ctrlKey) parts.push('Ctrl');
      if (shortcut.shiftKey) parts.push('Shift');
      if (shortcut.altKey) parts.push('Alt');
      if (shortcut.metaKey) parts.push('Cmd');
      parts.push(shortcut.key.toUpperCase());
      return parts.join('+');
    };

    const content = Object.entries(shortcutsByCategory).map(([category, shortcuts]) => (
      `<div style="margin-bottom: 16px;">
        <strong style="color: #1890ff; font-size: 14px;">${category}</strong>
        ${shortcuts.map(shortcut => 
          `<div style="display: flex; justify-content: space-between; padding: 4px 0;">
            <span>${shortcut.description}</span>
            <code style="background: #f5f5f5; padding: 2px 6px; border-radius: 3px; font-size: 12px;">
              ${formatShortcut(shortcut)}
            </code>
          </div>`
        ).join('')}
      </div>`
    )).join('');

    notification.info({
      message: 'Keyboard Shortcuts',
      description: (
        <div dangerouslySetInnerHTML={{ __html: content }} />
      ),
      duration: 10,
      placement: 'topRight',
      style: { width: 450 }
    });
  }, [allShortcuts, notification]);

  // Update shortcuts help action
  React.useEffect(() => {
    if (shortcutsHelpVisible) {
      showShortcutsHelp();
      setShortcutsHelpVisible(false);
    }
  }, [shortcutsHelpVisible, showShortcutsHelp]);

  return (
    <>
      {children}
      
      {/* Command Palette */}
      <CommandPalette
        visible={commandPaletteVisible}
        onClose={() => setCommandPaletteVisible(false)}
        onNavigateToPanel={onNavigateToPanel}
        onTriggerBuild={onTriggerBuild}
        onTriggerFlash={onTriggerFlash}
        onOpenFileExplorer={onOpenFileExplorer}
      />

      {/* IDE Quick Actions */}
      <FloatButton.Group
        trigger="hover"
        type="primary"
        style={{ right: 24, bottom: 24 }}
        icon={<ControlOutlined />}
        tooltip="IDE Quick Actions"
      >
        <Tooltip title="Command Palette (Ctrl+P)" placement="left">
          <FloatButton
            icon={<ControlOutlined />}
            onClick={() => setCommandPaletteVisible(true)}
          />
        </Tooltip>
        
        <Tooltip title="Quick Flash (Ctrl+F)" placement="left">
          <FloatButton
            icon={<ThunderboltOutlined />}
            onClick={handleQuickFlash}
          />
        </Tooltip>
        
        <Tooltip title="Layout Settings" placement="left">
          <FloatButton
            icon={<SettingOutlined />}
            onClick={handleSaveLayout}
          />
        </Tooltip>
        
        <Tooltip title="Keyboard Shortcuts (Ctrl+?)" placement="left">
          <FloatButton
            icon={<QuestionCircleOutlined />}
            onClick={showShortcutsHelp}
          />
        </Tooltip>
      </FloatButton.Group>

      {/* Global status indicator */}
      <div style={{
        position: 'fixed',
        top: 8,
        right: 8,
        zIndex: 1000,
        pointerEvents: 'none'
      }}>
        <div style={{
          fontSize: '11px',
          color: '#999',
          backgroundColor: 'rgba(0,0,0,0.03)',
          padding: '2px 6px',
          borderRadius: '3px',
          border: '1px solid rgba(0,0,0,0.06)'
        }}>
          IDE Mode | {allShortcuts.length} shortcuts active | {theme} theme
        </div>
      </div>
    </>
  );
}; 