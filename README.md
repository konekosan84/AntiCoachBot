# AntiCoach Platform

AntiCoach Platform is a next-generation, YCLIENTS-inspired booking and business automation system tailored for service companies. The project combines online scheduling, payments, media-rich catalogs, deep customization, analytics, and multi-channel notifications.

## Repository Structure
- `docs/` — product vision and architecture documentation
- `backend/` — FastAPI-based reference backend implementation (work in progress)

## Quick Start (Backend)
```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

## Key Capabilities
- Advanced online booking filters by service, specialist, resource, and availability
- Integrated payments with extensible provider adapters
- Customizable client-facing widgets with media support
- Daily, service-level, and specialist-level reporting exports
- CRM, messaging, and marketing integrations (WhatsApp, Telegram, email)
- Automated reminders, confirmations, and promotional campaigns

Refer to `docs/` for the detailed product requirements and architecture roadmap.

