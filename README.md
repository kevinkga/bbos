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
- ⚡ **Intuitive Hardware Flashing**: Double-click image files to flash directly to hardware
- 🌐 **Browser-Based Flashing**: Web Serial API support for direct device communication

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

## Build System Configuration

BBOS supports two build modes:

### Demo Mode (Default)
- **Purpose**: Development and testing without internet requirements
- **Behavior**: Creates small mock text files instead of downloading real Armbian images
- **File Size**: ~1-2 KB text files  
- **Requirements**: None (works offline)
- **Configuration**: `DEMO_MODE=true` (default in development)

### Production Mode
- **Purpose**: Real Armbian image building with actual downloads
- **Behavior**: Downloads multi-gigabyte Armbian images from dl.armbian.com
- **File Size**: 500MB - 2GB+ real bootable images
- **Requirements**: 
  - Internet connection
  - Significant disk space (5GB+ recommended)
  - System utilities: `kpartx`, `sudo` access for image mounting
- **Configuration**: `DEMO_MODE=false`

### Switching Modes

1. **Enable Real Image Downloads** (Production Mode):
   ```bash
   cd backend
   echo "DEMO_MODE=false" >> .env
   npm run dev
   ```

2. **Return to Demo Mode** (Development):
   ```bash
   cd backend
   echo "DEMO_MODE=true" >> .env
   npm run dev
   ```

### Current Status

If you're seeing small "image" files (~1-2KB), you're in **Demo Mode**. The build button IS working correctly - it's just creating mock files for development. To get real Armbian images, switch to Production Mode as shown above.

## Hardware Flashing

BBOS makes flashing Armbian images to hardware incredibly intuitive:

### Quick Start
1. **Complete a build** - Ensure your Armbian configuration build finishes successfully
2. **Find the image** - Navigate to your completed build in the Builds panel
3. **Double-click to flash** - Simply double-click any `.img` file with the ⚡ icon
4. **Choose method** - Select backend (rkdeveloptool) or browser (Web Serial API)
5. **Connect device** - Put your Rockchip board in maskrom mode and connect via USB-C

### Supported Methods

#### Backend Method (Recommended)
- Uses `rkdeveloptool` for proven reliability
- Supports all Rockchip devices (RK3588, RK3399, RK3566, etc.)
- Automatic device detection and mode switching
- Real-time progress via WebSocket

#### Browser Method (Experimental)
- Direct hardware communication from your browser
- No backend dependencies required
- Works with Chrome/Edge/Opera (Web Serial API)
- Perfect for remote or cloud deployments

### Visual Cues
- **⚡ Icon**: Indicates flashable image files
- **Tooltip**: Hover for flashing instructions
- **Context Menu**: Right-click for additional options
- **Color Highlighting**: Flashable images appear in accent color

## Environment Variables

Copy `backend/.env.example` to `backend/.env` and customize:

```bash
cd backend
cp .env.example .env
# Edit .env file to configure your settings
```

Key variables:
- `DEMO_MODE`: Controls mock vs real image building
- `BUILD_DIR`: Where build artifacts are stored
- `DOWNLOAD_CACHE`: Where downloaded images are cached
- `PORT`: Backend server port

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