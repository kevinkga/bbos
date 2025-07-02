import React, { useState, useEffect, useMemo } from 'react';
import { Modal, Input, List, Typography, Tag, Space } from 'antd';
import { 
  SearchOutlined, 
  ThunderboltOutlined, 
  DesktopOutlined, 
  ApiOutlined, 
  SettingOutlined,
  BuildOutlined,
  FolderOutlined,
  ReloadOutlined,
  SaveOutlined,
  CopyOutlined
} from '@ant-design/icons';
import { useAppStore, useAppActions } from '../stores/app';
import { messageService } from '../services/messageService';

const { Text } = Typography;

interface CommandAction {
  id: string;
  title: string;
  description: string;
  category: 'Navigation' | 'Build' | 'Layout' | 'Hardware' | 'File' | 'Network';
  icon: React.ReactNode;
  shortcut?: string;
  action: () => void;
  keywords: string[];
}

interface CommandPaletteProps {
  visible: boolean;
  onClose: () => void;
  onNavigateToPanel?: (panelId: string) => void;
  onTriggerBuild?: (configId?: string) => void;
  onTriggerFlash?: () => void;
  onOpenFileExplorer?: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  visible,
  onClose,
  onNavigateToPanel,
  onTriggerBuild,
  onTriggerFlash,
  onOpenFileExplorer
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  
  const { configurations, buildJobs, layout } = useAppStore();
  const { 
    saveLayout, 
    setTheme, 
    duplicateConfiguration,
    setActivePanel 
  } = useAppActions();

  // Define available commands
  const commands: CommandAction[] = useMemo(() => [
    // Navigation commands
    {
      id: 'nav-welcome',
      title: 'Go to Welcome',
      description: 'Open the welcome panel',
      category: 'Navigation',
      icon: <DesktopOutlined />,
      shortcut: 'Ctrl+Shift+W',
      action: () => onNavigateToPanel?.('welcome'),
      keywords: ['welcome', 'home', 'start']
    },
    {
      id: 'nav-armbian-config',
      title: 'Go to Armbian Configuration',
      description: 'Open the Armbian configuration editor',
      category: 'Navigation', 
      icon: <SettingOutlined />,
      shortcut: 'Ctrl+Shift+C',
      action: () => onNavigateToPanel?.('armbian-config'),
      keywords: ['config', 'configuration', 'armbian', 'settings']
    },
    {
      id: 'nav-builds',
      title: 'Go to Builds',
      description: 'Open the builds panel',
      category: 'Navigation',
      icon: <BuildOutlined />,
      shortcut: 'Ctrl+Shift+B',
      action: () => onNavigateToPanel?.('builds'),
      keywords: ['builds', 'compile', 'make']
    },
    {
      id: 'nav-flash',
      title: 'Go to Hardware Flash',
      description: 'Open the hardware flashing panel',
      category: 'Navigation',
      icon: <ThunderboltOutlined />,
      shortcut: 'Ctrl+Shift+F',
      action: () => onNavigateToPanel?.('hardware-flash'),
      keywords: ['flash', 'hardware', 'spi', 'webusb']
    },
    {
      id: 'nav-network',
      title: 'Go to Network',
      description: 'Open the network topology panel',
      category: 'Navigation',
      icon: <ApiOutlined />,
      shortcut: 'Ctrl+Shift+N',
      action: () => onNavigateToPanel?.('network'),
      keywords: ['network', 'topology', 'nodes', 'subnet']
    },
    {
      id: 'nav-explorer',
      title: 'Go to File Explorer',
      description: 'Open the file explorer panel',
      category: 'Navigation',
      icon: <FolderOutlined />,
      shortcut: 'Ctrl+Shift+E',
      action: () => onOpenFileExplorer?.(),
      keywords: ['files', 'explorer', 'browse']
    },

    // Build commands
    {
      id: 'build-quick',
      title: 'Quick Build',
      description: 'Start a build with the last used configuration',
      category: 'Build',
      icon: <BuildOutlined />,
      shortcut: 'Ctrl+B',
      action: () => {
        const lastConfig = configurations[0];
        if (lastConfig) {
          onTriggerBuild?.(lastConfig.id);
          messageService.success(`Starting build for ${lastConfig.name}`);
        } else {
          messageService.warning('No configurations available for quick build');
        }
      },
      keywords: ['build', 'compile', 'quick', 'fast']
    },
    {
      id: 'build-all',
      title: 'Build All Configurations',
      description: 'Start builds for all configurations',
      category: 'Build',
      icon: <BuildOutlined />,
      action: () => {
        configurations.forEach(config => onTriggerBuild?.(config.id));
        messageService.success(`Started builds for ${configurations.length} configurations`);
      },
      keywords: ['build', 'all', 'batch', 'multiple']
    },

    // Hardware commands
    {
      id: 'flash-quick',
      title: 'Quick Flash',
      description: 'Open hardware flash with last successful build',
      category: 'Hardware',
      icon: <ThunderboltOutlined />,
      shortcut: 'Ctrl+F',
      action: () => {
        onTriggerFlash?.();
        onNavigateToPanel?.('hardware-flash');
      },
      keywords: ['flash', 'hardware', 'quick', 'webusb']
    },
    {
      id: 'spi-clear',
      title: 'SPI Clear Operation', 
      description: 'Quick access to SPI flash clearing',
      category: 'Hardware',
      icon: <ThunderboltOutlined />,
      action: () => {
        onNavigateToPanel?.('hardware-flash');
        messageService.info('Navigate to Hardware Flash panel and select SPI Clear mode');
      },
      keywords: ['spi', 'clear', 'erase', 'flash']
    },

    // Layout commands
    {
      id: 'layout-save',
      title: 'Save Layout',
      description: 'Save the current layout configuration',
      category: 'Layout',
      icon: <SaveOutlined />,
      shortcut: 'Ctrl+S',
      action: () => {
        if (layout) {
          const layoutName = `Layout_${new Date().toISOString().slice(0, 16).replace(/:/g, '-')}`;
          saveLayout(layoutName, layout);
          messageService.success(`Layout saved as ${layoutName}`);
        }
      },
      keywords: ['save', 'layout', 'workspace']
    },
    {
      id: 'layout-reset',
      title: 'Reset Layout',
      description: 'Reset to default VSCode layout',
      category: 'Layout',
      icon: <ReloadOutlined />,
      shortcut: 'Ctrl+Shift+R',
      action: () => {
        // This would trigger layout reset in the parent component
        messageService.success('Layout reset to default');
        onClose();
      },
      keywords: ['reset', 'layout', 'default', 'vscode']
    },

    // Theme commands
    {
      id: 'theme-light',
      title: 'Switch to Light Theme',
      description: 'Change to light color theme',
      category: 'Layout',
      icon: <SettingOutlined />,
      action: () => {
        setTheme('light');
        messageService.success('Switched to light theme');
      },
      keywords: ['theme', 'light', 'bright']
    },
    {
      id: 'theme-dark',
      title: 'Switch to Dark Theme', 
      description: 'Change to dark color theme',
      category: 'Layout',
      icon: <SettingOutlined />,
      action: () => {
        setTheme('dark');
        messageService.success('Switched to dark theme');
      },
      keywords: ['theme', 'dark', 'night']
    },

    // Configuration commands
    ...configurations.slice(0, 5).map(config => ({
      id: `config-${config.id}`,
      title: `Edit ${config.name}`,
      description: `Open ${config.name} configuration`,
      category: 'File' as const,
      icon: <SettingOutlined />,
      action: () => {
        setActivePanel(`config-${config.id}`);
        onNavigateToPanel?.('armbian-config');
      },
      keywords: ['config', 'edit', config.name.toLowerCase(), 'configuration']
    })),

    // Recent builds commands
    ...buildJobs.slice(0, 3).map(build => ({
      id: `build-${build.id}`,
      title: `View Build ${build.id.slice(0, 8)}`,
      description: `View build details for ${build.configurationSnapshot?.name || 'Unknown'}`,
      category: 'Build' as const,
      icon: <BuildOutlined />,
      action: () => {
        setActivePanel(`build-${build.id}`);
        onNavigateToPanel?.('builds');
      },
      keywords: ['build', 'view', build.status, build.configurationSnapshot?.name?.toLowerCase() || '']
    }))
  ], [configurations, buildJobs, layout, onNavigateToPanel, onTriggerBuild, onTriggerFlash, onOpenFileExplorer, saveLayout, setTheme, setActivePanel, onClose]);

  // Filter commands based on search query
  const filteredCommands = useMemo(() => {
    if (!searchQuery.trim()) return commands;
    
    const query = searchQuery.toLowerCase();
    return commands.filter(command => 
      command.title.toLowerCase().includes(query) ||
      command.description.toLowerCase().includes(query) ||
      command.keywords.some(keyword => keyword.includes(query)) ||
      command.category.toLowerCase().includes(query)
    );
  }, [commands, searchQuery]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!visible) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev => 
            prev < filteredCommands.length - 1 ? prev + 1 : 0
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => 
            prev > 0 ? prev - 1 : filteredCommands.length - 1
          );
          break;
        case 'Enter':
          e.preventDefault();
          if (filteredCommands[selectedIndex]) {
            filteredCommands[selectedIndex].action();
            onClose();
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [visible, filteredCommands, selectedIndex, onClose]);

  // Reset selection when search changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [searchQuery]);

  // Reset state when modal opens
  useEffect(() => {
    if (visible) {
      setSearchQuery('');
      setSelectedIndex(0);
    }
  }, [visible]);

  const getCategoryColor = (category: CommandAction['category']) => {
    const colors = {
      'Navigation': 'blue',
      'Build': 'green', 
      'Layout': 'purple',
      'Hardware': 'orange',
      'File': 'cyan',
      'Network': 'magenta'
    };
    return colors[category];
  };

  return (
    <Modal
      title={
        <Space>
          <SearchOutlined />
          <span>Command Palette</span>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            Type to search commands...
          </Text>
        </Space>
      }
      open={visible}
      onCancel={onClose}
      footer={null}
      width={600}
      styles={{
        body: { padding: 0 }
      }}
      centered
    >
      <Input
        autoFocus
        placeholder="Type a command or search..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        style={{ 
          borderRadius: 0, 
          borderLeft: 'none', 
          borderRight: 'none',
          fontSize: '16px',
          padding: '12px 16px'
        }}
        prefix={<SearchOutlined style={{ color: '#999' }} />}
      />
      
      <List
        style={{ 
          maxHeight: '400px', 
          overflowY: 'auto',
          borderTop: '1px solid #f0f0f0'
        }}
        dataSource={filteredCommands}
        renderItem={(command, index) => (
          <List.Item
            key={command.id}
            onClick={() => {
              command.action();
              onClose();
            }}
            style={{
              padding: '12px 16px',
              cursor: 'pointer',
              backgroundColor: index === selectedIndex ? '#f5f5f5' : 'transparent',
              borderLeft: index === selectedIndex ? '3px solid #1890ff' : '3px solid transparent'
            }}
            onMouseEnter={() => setSelectedIndex(index)}
          >
            <List.Item.Meta
              avatar={command.icon}
              title={
                <Space>
                  <span>{command.title}</span>
                  <Tag color={getCategoryColor(command.category)}>
                    {command.category}
                  </Tag>
                  {command.shortcut && (
                    <Tag style={{ marginLeft: 'auto' }}>
                      {command.shortcut}
                    </Tag>
                  )}
                </Space>
              }
              description={command.description}
            />
          </List.Item>
        )}
        locale={{
          emptyText: (
            <div style={{ padding: '40px', textAlign: 'center' }}>
              <SearchOutlined style={{ fontSize: '24px', color: '#ccc' }} />
              <div style={{ marginTop: '12px' }}>
                <Text type="secondary">No commands found for "{searchQuery}"</Text>
                <br />
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  Try searching for "build", "flash", "config", or "layout"
                </Text>
              </div>
            </div>
          )
        }}
      />
      
      <div style={{ 
        padding: '8px 16px', 
        borderTop: '1px solid #f0f0f0', 
        backgroundColor: '#fafafa',
        fontSize: '12px',
        color: '#999'
      }}>
        <Space split={<span>•</span>}>
          <span>↑↓ Navigate</span>
          <span>Enter Execute</span>
          <span>Esc Close</span>
        </Space>
      </div>
    </Modal>
  );
}; 