from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr

from .models import BookingStatus, NotificationChannel, PaymentStatus


class OrganizationBase(BaseModel):
    name: str
    slug: str
    timezone: str = "Europe/Moscow"


class OrganizationCreate(OrganizationBase):
    pass


class OrganizationRead(OrganizationBase):
    id: int

    class Config:
        orm_mode = True


class LocationBase(BaseModel):
    name: str
    address: Optional[str] = None
    phone: Optional[str] = None


class LocationCreate(LocationBase):
    organization_id: int


class LocationRead(LocationBase):
    id: int
    organization_id: int

    class Config:
        orm_mode = True


class SpecialistBase(BaseModel):
    full_name: str
    avatar_url: Optional[str] = None
    bio: Optional[str] = None
    is_active: bool = True


class SpecialistCreate(SpecialistBase):
    organization_id: int
    location_id: int


class SpecialistRead(SpecialistBase):
    id: int
    organization_id: int
    location_id: int

    class Config:
        orm_mode = True


class ServiceBase(BaseModel):
    name: str
    description: Optional[str] = None
    duration_minutes: int
    base_price: float
    media_url: Optional[str] = None
    category: Optional[str] = None


class ServiceCreate(ServiceBase):
    organization_id: int


class ServiceRead(ServiceBase):
    id: int
    organization_id: int

    class Config:
        orm_mode = True


class BookingBase(BaseModel):
    organization_id: int
    location_id: int
    specialist_id: int
    service_id: int
    client_name: str
    client_phone: str
    client_email: Optional[EmailStr] = None
    start_time: datetime
    end_time: datetime
    status: BookingStatus = BookingStatus.PENDING
    notes: Optional[str] = None


class BookingCreate(BookingBase):
    pass


class BookingRead(BookingBase):
    id: int

    class Config:
        orm_mode = True


class PaymentBase(BaseModel):
    booking_id: int
    provider: str
    amount: float
    currency: str = "RUB"
    status: PaymentStatus = PaymentStatus.INITIATED
    transaction_reference: Optional[str] = None
    metadata: Optional[str] = None


class PaymentCreate(PaymentBase):
    pass


class PaymentRead(PaymentBase):
    id: int
    created_at: datetime

    class Config:
        orm_mode = True


class NotificationTemplateBase(BaseModel):
    organization_id: int
    channel: NotificationChannel
    name: str
    subject: Optional[str] = None
    body: str
    is_active: bool = True


class NotificationTemplateCreate(NotificationTemplateBase):
    pass


class NotificationTemplateRead(NotificationTemplateBase):
    id: int

    class Config:
        orm_mode = True
