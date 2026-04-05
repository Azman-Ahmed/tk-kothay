# Database Model Overview

This document provides a visual representation of the `tk-kothay` database schema.

```mermaid
erDiagram
    users ||--o{ expenses : owns
    users ||--o{ incomes : owns
    users ||--o{ daily_spends : owns
    users ||--o{ savings_goals : owns
    users ||--o{ recurring_expenses : owns
    users ||--o{ recurring_payments : owns
    users ||--o{ loans : owns

    recurring_expenses ||--o{ recurring_payments : tracks

    expenses {
        uuid id PK
        uuid user_id FK
        text category
        numeric amount
        date date
        text notes
        timestamp created_at
    }

    incomes {
        uuid id PK
        uuid user_id FK
        text source
        numeric amount
        date date
        text notes
        timestamp created_at
    }

    daily_spends {
        uuid id PK
        uuid user_id FK
        numeric amount
        text note
        date date
        timestamp created_at
    }

    savings_goals {
        uuid id PK
        uuid user_id FK
        text name
        numeric current_amount
        numeric target_amount
        boolean is_recurring
        text frequency
        numeric monthly_amount
        text start_month
        int duration_months
    }

    recurring_expenses {
        uuid id PK
        uuid user_id FK
        text name
        text category
        numeric amount
        date start_date
        date end_date
        text frequency
        int payment_day
        text notes
    }

    recurring_payments {
        uuid id PK
        uuid recurring_expense_id FK
        text payment_month
        timestamp paid_at
        uuid user_id FK
    }

    loans {
        uuid id PK
        uuid user_id FK
        text partner_name
        numeric amount
        numeric remaining_amount
        text type
        date start_date
        date due_date
        numeric interest_rate
    }
```

### Key Relationships
- **User Ownership**: All tables are linked to the Supabase `auth.users` table via `user_id`. Row Level Security (RLS) ensures users can only see their own data.
- **EMI Tracking**: The `recurring_payments` table links to `recurring_expenses` to track which specific months of a recurring bill have been paid.
