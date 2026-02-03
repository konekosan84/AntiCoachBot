# AntiCoach Backend

This FastAPI backend provides a reference implementation of the AntiCoach Platform's core scheduling and business management features. It exposes endpoints for organizations, locations, specialists, services, bookings, payments, notification templates, and summary reports.

## Features
- SQLAlchemy models for multi-tenant organizations, specialists, services, bookings, and payments
- CRUD APIs with validation and basic availability checks for bookings
- Reporting endpoints that aggregate revenue and bookings by day and specialist
- Async notification dispatcher stubs for WhatsApp and Telegram integrations

## Running Locally
```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

The application uses SQLite by default (`anticoach.db`). Replace the connection string in `database.py` for production-ready deployments.

## Next Steps
- Add authentication and authorization (OAuth2, JWT)
- Implement payment provider adapters and webhook handlers
- Expand reporting (services, locations, marketing attribution)
- Connect actual WhatsApp Business and Telegram integrations
- Provide GraphQL API and public booking widget
