# BBOS v1

**Cloud-based IoT Platform for Armbian Image Configuration**

## Mission Statement

BBOS is a cloud-based IoT platform with core objectives:

1. **Intuitive Interface**: Provide users with an intuitive interface to build JSON configurations for Armbian images
2. **Remote Execution**: Allow users to execute configurations against our BuildServer remotely on the backend  
3. **Armbian Integration**: Leverage comprehensive Armbian documentation and framework capabilities

## Architecture

### Frontend
- **Technology**: React (Electron app OR web SPA)
- **Communication**: WebSocket/Socket.io for real-time backend communication
- **Layout**: FlexLayout for IDE-style docked panels with VS Code styling
- **Features**: 
  - Draggable/lockable panels with visibility toggle
  - Virtual filesystem persistence in localStorage
  - Undo/redo functionality
  - UI component generation from JSON Schema

### Backend
- **Purpose**: Server-based build capabilities and user management
- **Features**:
  - Social login authentication
  - User-scoped resources (build history, configs, logs, outputs)
  - BuildServer integration for remote Armbian image building

### Data Layer
- **Source of Truth**: JSON Schemas for all system entities/types
- **User Isolation**: All resources scoped to authenticated users
- **Persistence**: Configuration state, build history, and user preferences

## Key Features

- 🎨 **IDE-Style Interface**: Docked panels, VS Code visual cues
- 🔧 **Armbian Integration**: Full framework support based on official documentation
- 👤 **User Management**: Social login with isolated workspaces  
- 🏗️ **Remote Building**: Cloud-based Armbian image compilation
- 📋 **Configuration Management**: JSON-based configuration with schema validation
- 🔄 **Real-time Updates**: WebSocket communication for build status
- 💾 **State Persistence**: Layout and configuration persistence
- ↩️ **Undo/Redo**: Full action history management

## Project Structure

```
bbos/
├── frontend/          # React frontend application
├── backend/           # Node.js/Express backend server
├── shared/            # Shared types, schemas, and utilities
├── schemas/           # JSON Schema definitions
├── docs/              # Documentation and API specs
└── deployment/        # Docker and deployment configurations
```

## Development Setup

*Coming soon - project initialization in progress*

## Armbian Documentation References

- [Main Documentation](https://docs.armbian.com/)
- [Advanced Configuration](https://docs.armbian.com/User-Guide_Advanced-Configuration/)
- [Auto Configuration](https://docs.armbian.com/User-Guide_Autoconfig/)
- [Boot Environment](https://docs.armbian.com/User-Guide_Armbian-Config/System/#boot-environment)
- [Storage Configuration](https://docs.armbian.com/User-Guide_Armbian-Config/System/#storage)
- [SSH Daemon](https://docs.armbian.com/User-Guide_Armbian-Config/System/#ssh-daemon)
- [Device Tree Overlays](https://docs.armbian.com/User-Guide_Armbian-Config/System/#device-tree-overlays)
- [Developer Guide](https://docs.armbian.com/Developer-Guide_Overview/)

## License

MIT License - See LICENSE file for details 