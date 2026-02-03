from datetime import datetime
from typing import List, Optional

from sqlalchemy.orm import Session

from . import models, schemas


def create_organization(db: Session, organization: schemas.OrganizationCreate) -> models.Organization:
    db_obj = models.Organization(**organization.dict())
    db.add(db_obj)
    db.commit()
    db.refresh(db_obj)
    return db_obj


def list_organizations(db: Session) -> List[models.Organization]:
    return db.query(models.Organization).all()


def create_location(db: Session, location: schemas.LocationCreate) -> models.Location:
    db_obj = models.Location(**location.dict())
    db.add(db_obj)
    db.commit()
    db.refresh(db_obj)
    return db_obj


def list_locations(db: Session, organization_id: Optional[int] = None) -> List[models.Location]:
    query = db.query(models.Location)
    if organization_id:
        query = query.filter(models.Location.organization_id == organization_id)
    return query.all()


def create_specialist(db: Session, specialist: schemas.SpecialistCreate) -> models.Specialist:
    db_obj = models.Specialist(**specialist.dict())
    db.add(db_obj)
    db.commit()
    db.refresh(db_obj)
    return db_obj


def list_specialists(
    db: Session,
    organization_id: Optional[int] = None,
    location_id: Optional[int] = None,
) -> List[models.Specialist]:
    query = db.query(models.Specialist)
    if organization_id:
        query = query.filter(models.Specialist.organization_id == organization_id)
    if location_id:
        query = query.filter(models.Specialist.location_id == location_id)
    return query.all()


def create_service(db: Session, service: schemas.ServiceCreate) -> models.Service:
    db_obj = models.Service(**service.dict())
    db.add(db_obj)
    db.commit()
    db.refresh(db_obj)
    return db_obj


def list_services(db: Session, organization_id: Optional[int] = None) -> List[models.Service]:
    query = db.query(models.Service)
    if organization_id:
        query = query.filter(models.Service.organization_id == organization_id)
    return query.all()


def create_booking(db: Session, booking: schemas.BookingCreate) -> models.Booking:
    db_obj = models.Booking(**booking.dict())
    db.add(db_obj)
    db.commit()
    db.refresh(db_obj)
    return db_obj


def list_bookings(
    db: Session,
    organization_id: Optional[int] = None,
    specialist_id: Optional[int] = None,
    service_id: Optional[int] = None,
    status: Optional[models.BookingStatus] = None,
    start_from: Optional[datetime] = None,
    start_to: Optional[datetime] = None,
) -> List[models.Booking]:
    query = db.query(models.Booking)
    if organization_id:
        query = query.filter(models.Booking.organization_id == organization_id)
    if specialist_id:
        query = query.filter(models.Booking.specialist_id == specialist_id)
    if service_id:
        query = query.filter(models.Booking.service_id == service_id)
    if status:
        query = query.filter(models.Booking.status == status)
    if start_from:
        query = query.filter(models.Booking.start_time >= start_from)
    if start_to:
        query = query.filter(models.Booking.start_time <= start_to)
    return query.order_by(models.Booking.start_time.desc()).all()


def create_payment(db: Session, payment: schemas.PaymentCreate) -> models.Payment:
    db_obj = models.Payment(**payment.dict())
    db.add(db_obj)
    db.commit()
    db.refresh(db_obj)
    return db_obj


def list_payments(db: Session, booking_id: Optional[int] = None) -> List[models.Payment]:
    query = db.query(models.Payment)
    if booking_id:
        query = query.filter(models.Payment.booking_id == booking_id)
    return query.order_by(models.Payment.created_at.desc()).all()


def create_notification_template(
    db: Session, template: schemas.NotificationTemplateCreate
) -> models.NotificationTemplate:
    db_obj = models.NotificationTemplate(**template.dict())
    db.add(db_obj)
    db.commit()
    db.refresh(db_obj)
    return db_obj


def list_notification_templates(
    db: Session, organization_id: Optional[int] = None, channel: Optional[models.NotificationChannel] = None
) -> List[models.NotificationTemplate]:
    query = db.query(models.NotificationTemplate)
    if organization_id:
        query = query.filter(models.NotificationTemplate.organization_id == organization_id)
    if channel:
        query = query.filter(models.NotificationTemplate.channel == channel)
    return query.all()
