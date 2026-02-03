from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from . import crud, models, schemas
from .database import get_db

router = APIRouter()


@router.post("/organizations", response_model=schemas.OrganizationRead)
def create_organization(
    payload: schemas.OrganizationCreate, db: Session = Depends(get_db)
):
    return crud.create_organization(db, payload)


@router.get("/organizations", response_model=List[schemas.OrganizationRead])
def list_organizations(db: Session = Depends(get_db)):
    return crud.list_organizations(db)


@router.post("/locations", response_model=schemas.LocationRead)
def create_location(payload: schemas.LocationCreate, db: Session = Depends(get_db)):
    return crud.create_location(db, payload)


@router.get("/locations", response_model=List[schemas.LocationRead])
def list_locations(
    organization_id: Optional[int] = None, db: Session = Depends(get_db)
):
    return crud.list_locations(db, organization_id=organization_id)


@router.post("/specialists", response_model=schemas.SpecialistRead)
def create_specialist(
    payload: schemas.SpecialistCreate, db: Session = Depends(get_db)
):
    return crud.create_specialist(db, payload)


@router.get("/specialists", response_model=List[schemas.SpecialistRead])
def list_specialists(
    organization_id: Optional[int] = None,
    location_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    return crud.list_specialists(
        db, organization_id=organization_id, location_id=location_id
    )


@router.post("/services", response_model=schemas.ServiceRead)
def create_service(payload: schemas.ServiceCreate, db: Session = Depends(get_db)):
    return crud.create_service(db, payload)


@router.get("/services", response_model=List[schemas.ServiceRead])
def list_services(organization_id: Optional[int] = None, db: Session = Depends(get_db)):
    return crud.list_services(db, organization_id=organization_id)


@router.post("/bookings", response_model=schemas.BookingRead)
def create_booking(payload: schemas.BookingCreate, db: Session = Depends(get_db)):
    # simple availability check placeholder
    overlap = (
        db.query(models.Booking)
        .filter(models.Booking.specialist_id == payload.specialist_id)
        .filter(models.Booking.status != models.BookingStatus.CANCELLED)
        .filter(
            models.Booking.start_time < payload.end_time,
            models.Booking.end_time > payload.start_time,
        )
        .first()
    )
    if overlap:
        raise HTTPException(status_code=409, detail="Specialist is not available")
    return crud.create_booking(db, payload)


@router.get("/bookings", response_model=List[schemas.BookingRead])
def list_bookings(
    organization_id: Optional[int] = Query(None),
    specialist_id: Optional[int] = Query(None),
    service_id: Optional[int] = Query(None),
    status: Optional[models.BookingStatus] = Query(None),
    start_from: Optional[datetime] = Query(None),
    start_to: Optional[datetime] = Query(None),
    db: Session = Depends(get_db),
):
    return crud.list_bookings(
        db,
        organization_id=organization_id,
        specialist_id=specialist_id,
        service_id=service_id,
        status=status,
        start_from=start_from,
        start_to=start_to,
    )


@router.post("/payments", response_model=schemas.PaymentRead)
def create_payment(payload: schemas.PaymentCreate, db: Session = Depends(get_db)):
    return crud.create_payment(db, payload)


@router.get("/payments", response_model=List[schemas.PaymentRead])
def list_payments(booking_id: Optional[int] = None, db: Session = Depends(get_db)):
    return crud.list_payments(db, booking_id=booking_id)


@router.post(
    "/notification-templates", response_model=schemas.NotificationTemplateRead
)
def create_notification_template(
    payload: schemas.NotificationTemplateCreate, db: Session = Depends(get_db)
):
    return crud.create_notification_template(db, payload)


@router.get(
    "/notification-templates",
    response_model=List[schemas.NotificationTemplateRead],
)
def list_notification_templates(
    organization_id: Optional[int] = None,
    channel: Optional[models.NotificationChannel] = None,
    db: Session = Depends(get_db),
):
    return crud.list_notification_templates(
        db, organization_id=organization_id, channel=channel
    )


@router.get("/reports/daily")
def report_daily_summary(
    organization_id: int,
    start_date: datetime,
    end_date: datetime,
    db: Session = Depends(get_db),
):
    data = (
        db.query(
            func.date(models.Booking.start_time).label("date"),
            func.count(models.Booking.id).label("bookings"),
            func.sum(models.Payment.amount).label("revenue"),
        )
        .join(models.Payment, models.Booking.payments)
        .filter(models.Booking.organization_id == organization_id)
        .filter(models.Booking.start_time >= start_date)
        .filter(models.Booking.start_time <= end_date)
        .group_by(func.date(models.Booking.start_time))
        .order_by(func.date(models.Booking.start_time))
        .all()
    )
    return [dict(row._mapping) for row in data]


@router.get("/reports/specialists")
def report_specialist_performance(
    organization_id: int, start_date: datetime, end_date: datetime, db: Session = Depends(get_db)
):
    data = (
        db.query(
            models.Specialist.id.label("specialist_id"),
            models.Specialist.full_name.label("full_name"),
            func.count(models.Booking.id).label("bookings"),
            func.sum(models.Payment.amount).label("revenue"),
        )
        .join(models.Booking, models.Specialist.bookings)
        .join(models.Payment, models.Booking.payments)
        .filter(models.Specialist.organization_id == organization_id)
        .filter(models.Booking.start_time >= start_date)
        .filter(models.Booking.start_time <= end_date)
        .group_by(models.Specialist.id)
        .all()
    )
    return [dict(row._mapping) for row in data]
