# Diagramme entité-relation

Généré à partir de `prisma/schema.prisma`. Le diagramme s'affiche directement sur GitHub.

```mermaid
erDiagram
    User {
        int id PK
        string email UK
        string password
        string name
        Role role
        int quarterId FK
        datetime createdAt
    }

    Quarter {
        int id PK
        string code UK
        string name
        boolean seaAccess
        int disasterLevel
        boolean retentionLowered
    }

    Adjacency {
        int quarterId PK, FK
        int neighborId PK, FK
    }

    ResourceType {
        int id PK
        string name UK
    }

    Inventory {
        int id PK
        int quarterId FK
        int resourceTypeId FK
        int initialQuantity
        int quantity
    }

    Reservation {
        int id PK
        int quarterId FK
        int resourceTypeId FK
        int userId FK
        int quantity
        datetime startDate
        datetime endDate
        ReservationStatus status
        datetime createdAt
    }

    Transfer {
        int id PK
        int fromQuarterId FK
        int toQuarterId FK
        int transitQuarterId FK
        int resourceTypeId FK
        int quantity
        TransferRoute route
        TransferStatus status
        int requestedById FK
        int approvedById FK
        datetime createdAt
        datetime deliveredAt
    }

    Quarter |o--o{ User : "rattache"
    Quarter ||--o{ Adjacency : "quarter"
    Quarter ||--o{ Adjacency : "neighbor"
    Quarter ||--o{ Inventory : "possede"
    ResourceType ||--o{ Inventory : "stocke"
    Quarter ||--o{ Reservation : "reserve dans"
    ResourceType ||--o{ Reservation : "concerne"
    User ||--o{ Reservation : "fait"
    Quarter ||--o{ Transfer : "donne (from)"
    Quarter ||--o{ Transfer : "recoit (to)"
    Quarter |o--o{ Transfer : "traverse (transit)"
    ResourceType ||--o{ Transfer : "concerne"
    User ||--o{ Transfer : "demande"
    User |o--o{ Transfer : "approuve"
```

## Valeurs des enums

| Enum | Valeurs |
|---|---|
| Role | QC, LC, CD, ADMIN |
| ReservationStatus | PENDING, CONFIRMED, CANCELLED |
| TransferStatus | PENDING, APPROVED, REJECTED, DELIVERED |
| TransferRoute | LAND, SEA |
