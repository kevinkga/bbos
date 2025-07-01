# System Architecture

## Overview

BBOS (Building Board Operating System) is a cloud-based IoT platform designed with a microservices architecture that supports real-time collaboration, schema-driven development, and extensible build pipelines.

## High-Level Architecture

```mermaid
graph TB
    subgraph "Client Layer"
        Web[Web Application]
        Desktop[Desktop Application]
        Mobile[Mobile Application]
    end
    
    subgraph "API Gateway"
        Gateway[API Gateway<br/>- Authentication<br/>- Rate Limiting<br/>- Load Balancing]
    end
    
    subgraph "Application Services"
        Auth[Authentication Service]
        Config[Configuration Service]
        Build[Build Service]
        User[User Service]
        Schema[Schema Service]
    end
    
    subgraph "Real-time Layer"
        WS[WebSocket Server]
        Queue[Message Queue]
        Notifications[Notification Service]
    end
    
    subgraph "Build Infrastructure"
        Workers[Build Workers]
        Registry[Artifact Registry]
        Storage[File Storage]
    end
    
    subgraph "Data Layer"
        DB[(Primary Database)]
        Cache[(Redis Cache)]
        Search[(Search Engine)]
    end
    
    Web --> Gateway
    Desktop --> Gateway
    Mobile --> Gateway
    
    Gateway --> Auth
    Gateway --> Config
    Gateway --> Build
    Gateway --> User
    Gateway --> Schema
    
    Auth --> DB
    Config --> DB
    Build --> Queue
    User --> DB
    Schema --> DB
    
    Queue --> Workers
    Workers --> Registry
    Workers --> Storage
    
    WS --> Notifications
    Notifications --> Queue
    
    Config --> Cache
    Build --> Cache
    Schema --> Cache
```

## Component Architecture

### Frontend Architecture

```mermaid
graph TB
    subgraph "Frontend Application"
        subgraph "Framework Layer"
            FlexFramework[FlexLayout Framework]
            SchemaFramework[Schema-to-UI Framework]
            RTFramework[Real-time Framework]
            ValidationFramework[Validation Framework]
        end
        
        subgraph "Application Layer"
            Layout[Layout Manager]
            Panels[Panel System]
            Forms[Form Engine]
            State[State Management]
        end
        
        subgraph "Component Layer"
            ConfigEditor[Configuration Editor]
            BuildMonitor[Build Monitor]
            FileExplorer[File Explorer]
            Documentation[Documentation Viewer]
        end
        
        subgraph "Service Layer"
            API[API Client]
            WebSocket[WebSocket Client]
            Storage[Local Storage]
            Auth[Auth Manager]
        end
    end
    
    FlexFramework --> Layout
    SchemaFramework --> Forms
    RTFramework --> WebSocket
    ValidationFramework --> Forms
    
    Layout --> Panels
    Panels --> ConfigEditor
    Panels --> BuildMonitor
    Panels --> FileExplorer
    Panels --> Documentation
    
    Forms --> ConfigEditor
    State --> Layout
    State --> Forms
    
    API --> Auth
    WebSocket --> BuildMonitor
    Storage --> Layout
```

### Backend Architecture

```mermaid
graph TB
    subgraph "Backend Services"
        subgraph "Core Services"
            AuthService[Authentication Service<br/>- JWT Management<br/>- Social Login<br/>- User Sessions]
            UserService[User Service<br/>- Profile Management<br/>- Preferences<br/>- Access Control]
            SchemaService[Schema Service<br/>- Schema Validation<br/>- UI Schema Generation<br/>- Documentation]
        end
        
        subgraph "Configuration Services"
            ConfigService[Configuration Service<br/>- CRUD Operations<br/>- Versioning<br/>- Templates]
            ValidationService[Validation Service<br/>- Schema Validation<br/>- Business Rules<br/>- Cross-validation]
        end
        
        subgraph "Build Services"
            BuildService[Build Service<br/>- Job Management<br/>- Queue Management<br/>- Status Tracking]
            WorkerService[Worker Service<br/>- Build Execution<br/>- Resource Management<br/>- Artifact Generation]
            ArtifactService[Artifact Service<br/>- Storage Management<br/>- Download Links<br/>- Cleanup]
        end
        
        subgraph "Infrastructure Services"
            NotificationService[Notification Service<br/>- Real-time Updates<br/>- Email Notifications<br/>- WebSocket Management]
            LoggingService[Logging Service<br/>- Structured Logging<br/>- Log Aggregation<br/>- Analytics]
            MonitoringService[Monitoring Service<br/>- Health Checks<br/>- Metrics Collection<br/>- Alerting]
        end
    end
    
    AuthService --> UserService
    SchemaService --> ValidationService
    ConfigService --> ValidationService
    BuildService --> WorkerService
    WorkerService --> ArtifactService
    BuildService --> NotificationService
    
    UserService --> LoggingService
    ConfigService --> LoggingService
    BuildService --> LoggingService
    
    MonitoringService --> LoggingService
```

## Data Architecture

### Data Flow Diagram

```mermaid
flowchart TD
    subgraph "Data Sources"
        UserInput[User Input]
        ArmbianDocs[Armbian Documentation]
        BuildResults[Build Results]
        SystemMetrics[System Metrics]
    end
    
    subgraph "Data Processing"
        Validation[Schema Validation]
        Transformation[Data Transformation]
        Enrichment[Data Enrichment]
    end
    
    subgraph "Data Storage"
        Primary[(Primary Database<br/>PostgreSQL)]
        Cache[(Redis Cache)]
        Files[(File Storage<br/>S3/MinIO)]
        Search[(Elasticsearch)]
    end
    
    subgraph "Data Consumption"
        UI[User Interface]
        API[REST API]
        Reports[Reports & Analytics]
        Notifications[Real-time Notifications]
    end
    
    UserInput --> Validation
    ArmbianDocs --> Enrichment
    BuildResults --> Transformation
    SystemMetrics --> Transformation
    
    Validation --> Primary
    Transformation --> Primary
    Enrichment --> Search
    
    Primary --> Cache
    Primary --> Files
    Primary --> Search
    
    Cache --> UI
    Primary --> API
    Search --> Reports
    Primary --> Notifications
```

### Database Schema

```mermaid
erDiagram
    USER {
        uuid id PK
        string email
        string name
        string avatar_url
        string provider
        timestamp created_at
        timestamp updated_at
    }
    
    CONFIGURATION {
        uuid id PK
        uuid user_id FK
        string name
        text description
        jsonb config_data
        jsonb ui_schema
        int version
        timestamp created_at
        timestamp updated_at
    }
    
    BUILD_JOB {
        uuid id PK
        uuid user_id FK
        uuid configuration_id FK
        string status
        jsonb config_snapshot
        jsonb progress
        timestamp queued_at
        timestamp started_at
        timestamp completed_at
    }
    
    BUILD_LOG {
        uuid id PK
        uuid build_job_id FK
        string level
        text message
        string component
        timestamp created_at
    }
    
    ARTIFACT {
        uuid id PK
        uuid build_job_id FK
        string name
        string type
        int size
        string url
        string checksum_algorithm
        string checksum_value
        timestamp expires_at
    }
    
    LAYOUT {
        uuid id PK
        uuid user_id FK
        string name
        jsonb layout_config
        boolean is_default
        timestamp created_at
        timestamp updated_at
    }
    
    USER ||--o{ CONFIGURATION : owns
    USER ||--o{ BUILD_JOB : creates
    USER ||--o{ LAYOUT : customizes
    CONFIGURATION ||--o{ BUILD_JOB : builds
    BUILD_JOB ||--o{ BUILD_LOG : generates
    BUILD_JOB ||--o{ ARTIFACT : produces
```

## Security Architecture

### Authentication & Authorization Flow

```mermaid
sequenceDiagram
    participant Client
    participant Gateway
    participant Auth
    participant Service
    participant Database
    
    Client->>Gateway: Request with credentials
    Gateway->>Auth: Validate credentials
    Auth->>Database: Check user data
    Database-->>Auth: User information
    Auth-->>Gateway: JWT token
    Gateway-->>Client: Authenticated response
    
    Client->>Gateway: API request with JWT
    Gateway->>Gateway: Validate JWT
    Gateway->>Service: Forward request
    Service->>Database: Data operation
    Database-->>Service: Data response
    Service-->>Gateway: Service response
    Gateway-->>Client: API response
```

### Security Layers

```mermaid
graph TB
    subgraph "Security Layers"
        subgraph "Network Security"
            TLS[TLS/HTTPS]
            Firewall[Web Application Firewall]
            DDoS[DDoS Protection]
        end
        
        subgraph "API Security"
            Auth[JWT Authentication]
            RateLimit[Rate Limiting]
            CORS[CORS Configuration]
            Validation[Input Validation]
        end
        
        subgraph "Application Security"
            RBAC[Role-Based Access Control]
            DataIsolation[User Data Isolation]
            Encryption[Data Encryption]
            Audit[Audit Logging]
        end
        
        subgraph "Infrastructure Security"
            Secrets[Secret Management]
            NetworkPolicy[Network Policies]
            Container[Container Security]
            Monitoring[Security Monitoring]
        end
    end
    
    TLS --> Auth
    Firewall --> RateLimit
    Auth --> RBAC
    RBAC --> DataIsolation
    DataIsolation --> Encryption
    Encryption --> Secrets
    Audit --> Monitoring
```

## Deployment Architecture

### Container Architecture

```mermaid
graph TB
    subgraph "Container Orchestration"
        subgraph "Frontend Tier"
            WebApp[Web Application Container]
            CDN[CDN/Static Assets]
        end
        
        subgraph "API Tier"
            Gateway[API Gateway Container]
            AuthSvc[Auth Service Container]
            ConfigSvc[Config Service Container]
            BuildSvc[Build Service Container]
        end
        
        subgraph "Worker Tier"
            BuildWorker1[Build Worker 1]
            BuildWorker2[Build Worker 2]
            BuildWorkerN[Build Worker N]
        end
        
        subgraph "Data Tier"
            PostgreSQL[(PostgreSQL)]
            Redis[(Redis)]
            Storage[(Object Storage)]
        end
        
        subgraph "Monitoring Tier"
            Prometheus[Prometheus]
            Grafana[Grafana]
            AlertManager[Alert Manager]
        end
    end
    
    WebApp --> Gateway
    CDN --> WebApp
    Gateway --> AuthSvc
    Gateway --> ConfigSvc
    Gateway --> BuildSvc
    
    BuildSvc --> BuildWorker1
    BuildSvc --> BuildWorker2
    BuildSvc --> BuildWorkerN
    
    AuthSvc --> PostgreSQL
    ConfigSvc --> PostgreSQL
    BuildSvc --> Redis
    BuildWorker1 --> Storage
    
    Gateway --> Prometheus
    AuthSvc --> Prometheus
    Prometheus --> Grafana
    Prometheus --> AlertManager
```

## Framework Extraction Opportunities

### 1. Schema-to-UI Framework
**Pattern**: Automatic UI generation from JSON Schema
**Reusability**: High - applicable to any JSON Schema-driven application
**Components**: Form generators, validation, custom widgets

### 2. IDE Layout Framework
**Pattern**: Flexible, persistent panel-based interfaces
**Reusability**: High - applicable to any complex web application
**Components**: Panel system, layout persistence, drag-and-drop

### 3. Real-time Collaboration Framework
**Pattern**: Multi-user real-time updates with conflict resolution
**Reusability**: Medium-High - applicable to collaborative applications
**Components**: WebSocket management, state synchronization, user presence

### 4. Build Pipeline Framework
**Pattern**: Extensible, monitored build and deployment pipelines
**Reusability**: High - applicable to any CI/CD system
**Components**: Job queue, worker management, artifact storage

### 5. Validation Framework
**Pattern**: Pluggable, schema-driven validation with custom rules
**Reusability**: High - applicable to any data validation scenario
**Components**: Validation engine, rule definitions, error handling

## Performance Considerations

### Scalability Patterns

```mermaid
graph LR
    subgraph "Horizontal Scaling"
        LB[Load Balancer]
        App1[App Instance 1]
        App2[App Instance 2]
        AppN[App Instance N]
    end
    
    subgraph "Caching Strategy"
        CDN[CDN Cache]
        Redis[Redis Cache]
        AppCache[Application Cache]
    end
    
    subgraph "Database Scaling"
        Primary[(Primary DB)]
        Replica1[(Read Replica 1)]
        Replica2[(Read Replica 2)]
    end
    
    LB --> App1
    LB --> App2
    LB --> AppN
    
    CDN --> AppCache
    AppCache --> Redis
    
    App1 --> Primary
    App1 --> Replica1
    App2 --> Replica2
```

### Caching Strategy

- **CDN**: Static assets, public documentation
- **Redis**: Session data, frequently accessed configurations
- **Application Cache**: Schema definitions, user preferences
- **Database Query Cache**: Common queries, lookup data

## Monitoring and Observability

### Metrics Collection

```mermaid
graph TB
    subgraph "Application Metrics"
        RequestMetrics[Request Metrics]
        BusinessMetrics[Business Metrics]
        ErrorMetrics[Error Metrics]
    end
    
    subgraph "Infrastructure Metrics"
        ContainerMetrics[Container Metrics]
        DatabaseMetrics[Database Metrics]
        NetworkMetrics[Network Metrics]
    end
    
    subgraph "User Experience Metrics"
        PerformanceMetrics[Performance Metrics]
        AvailabilityMetrics[Availability Metrics]
        UsageMetrics[Usage Metrics]
    end
    
    RequestMetrics --> Prometheus
    BusinessMetrics --> Prometheus
    ErrorMetrics --> Prometheus
    ContainerMetrics --> Prometheus
    DatabaseMetrics --> Prometheus
    NetworkMetrics --> Prometheus
    PerformanceMetrics --> Prometheus
    AvailabilityMetrics --> Prometheus
    UsageMetrics --> Prometheus
    
    Prometheus --> Grafana
    Prometheus --> AlertManager
```

## Technology Stack Alignment

| Layer | Technology | Justification |
|-------|------------|---------------|
| Frontend | React + TypeScript | Type safety, component reusability |
| UI Framework | FlexLayout + MUI | IDE-style interface, professional components |
| State Management | Zustand + React Query | Simple state, server state caching |
| Backend | Node.js + TypeScript | Shared language, JSON-native |
| Database | PostgreSQL | ACID compliance, JSON support |
| Cache | Redis | Performance, session storage |
| Message Queue | Redis/Bull | Job processing, real-time updates |
| Container | Docker + Kubernetes | Scalability, deployment consistency |
| Monitoring | Prometheus + Grafana | Metrics collection, visualization |

## Next Steps

1. **Framework Extraction**: Identify and extract reusable patterns
2. **Component Development**: Build core framework components
3. **Integration Testing**: Test framework integration points
4. **Performance Optimization**: Implement caching and scaling strategies
5. **Security Hardening**: Implement security best practices

---

This architecture provides a solid foundation for both the BBOS application and the extracted frameworks that can benefit other projects in the ecosystem.