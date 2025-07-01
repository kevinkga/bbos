# BBOS Documentation

Welcome to the BBOS (Building Board Operating System) documentation. BBOS is a cloud-based IoT platform that provides an intuitive interface for building JSON configurations for Armbian images and executing them against remote build servers.

## 📚 Documentation Structure

### 🏗️ Architecture & Design
- [System Architecture](./architecture/system-architecture.md) - High-level system overview
- [Component Architecture](./architecture/component-architecture.md) - Detailed component breakdown
- [Data Flow](./architecture/data-flow.md) - How data moves through the system
- [Security Architecture](./architecture/security.md) - Security considerations and implementation

### 🧱 Framework Components
- [Reusable Patterns](./framework/patterns.md) - Identified reusable patterns
- [JSON Schema Framework](./framework/json-schema-framework.md) - Generic schema-driven UI framework
- [FlexLayout Framework](./framework/flexlayout-framework.md) - IDE-style layout system
- [Real-time Framework](./framework/realtime-framework.md) - WebSocket and real-time updates
- [Validation Framework](./framework/validation-framework.md) - Extensible validation system

### 🔧 Implementation Guides
- [Getting Started](./guides/getting-started.md) - Quick start guide
- [Development Setup](./guides/development-setup.md) - Development environment setup
- [Component Development](./guides/component-development.md) - Creating new components
- [Schema Extension](./guides/schema-extension.md) - Extending schemas for new use cases

### 📊 API Documentation
- [REST API](./api/rest-api.md) - Backend REST API documentation
- [WebSocket API](./api/websocket-api.md) - Real-time WebSocket API
- [Authentication API](./api/auth-api.md) - Authentication and authorization

### 🎯 User Documentation
- [User Guide](./user/user-guide.md) - End-user documentation
- [Configuration Guide](./user/configuration-guide.md) - Armbian configuration guide
- [Build Management](./user/build-management.md) - Managing builds and artifacts

### 🛠️ Technical Reference
- [Technology Stack](./reference/tech-stack.md) - Complete technology overview
- [Configuration Reference](./reference/configuration.md) - All configuration options
- [Troubleshooting](./reference/troubleshooting.md) - Common issues and solutions

## 🚀 Quick Links

- **[System Architecture Overview](./architecture/system-architecture.md)** - Start here for system understanding
- **[Reusable Patterns](./framework/patterns.md)** - Framework opportunities
- **[Getting Started](./guides/getting-started.md)** - Begin development
- **[User Guide](./user/user-guide.md)** - End-user documentation

## 🎯 Key Concepts

### Schema-Driven Development
BBOS uses JSON Schema as the single source of truth for:
- UI component generation
- Data validation
- API contracts
- Documentation generation

### Component-Based Architecture
Built on reusable, composable components:
- Panel-based UI system
- Pluggable validation
- Extensible schema system
- Modular build pipeline

### Real-time Collaboration
Designed for multi-user scenarios:
- Real-time build monitoring
- Live configuration updates
- Collaborative editing
- User isolation and security

## 🔄 Framework Opportunities

The BBOS system identifies several patterns that can be generalized into reusable frameworks:

1. **Schema-to-UI Framework** - Automatic UI generation from JSON Schema
2. **IDE Layout Framework** - Flexible, persistent panel-based interfaces
3. **Real-time Collaboration Framework** - Multi-user real-time updates
4. **Build Pipeline Framework** - Extensible build and monitoring system
5. **Validation Framework** - Pluggable, schema-driven validation

## 📈 Versioning

Documentation follows semantic versioning aligned with the BBOS platform:
- **Major**: Breaking changes to APIs or architecture
- **Minor**: New features and framework additions
- **Patch**: Bug fixes and clarifications

Current Version: `1.0.0-alpha`

## 🤝 Contributing

See our [Contributing Guide](./CONTRIBUTING.md) for information on:
- Documentation standards
- Diagram conventions
- Framework extraction process
- Review procedures

---

**Last Updated**: January 2025  
**Next Review**: Q2 2025