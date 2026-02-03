from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Enum, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from .database import Base


class Organization(Base):
    __tablename__ = "organizations"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    slug = Column(String(255), unique=True, nullable=False)
    timezone = Column(String(64), default="Europe/Moscow")

    locations = relationship("Location", back_populates="organization", cascade="all, delete")
    services = relationship("Service", back_populates="organization", cascade="all, delete")
    specialists = relationship("Specialist", back_populates="organization", cascade="all, delete")


class Location(Base):
    __tablename__ = "locations"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False)
    name = Column(String(255), nullable=False)
    address = Column(String(512))
    phone = Column(String(32))

    organization = relationship("Organization", back_populates="locations")
    specialists = relationship("Specialist", back_populates="location")
    bookings = relationship("Booking", back_populates="location")


class Specialist(Base):
    __tablename__ = "specialists"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False)
    location_id = Column(Integer, ForeignKey("locations.id"), nullable=False)
    full_name = Column(String(255), nullable=False)
    avatar_url = Column(String(512))
    bio = Column(Text)
    is_active = Column(Boolean, default=True)

    organization = relationship("Organization", back_populates="specialists")
    location = relationship("Location", back_populates="specialists")
    services = relationship("ServiceSpecialist", back_populates="specialist", cascade="all, delete-orphan")
    bookings = relationship("Booking", back_populates="specialist")


class Service(Base):
    __tablename__ = "services"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    duration_minutes = Column(Integer, nullable=False, default=60)
    base_price = Column(Float, nullable=False, default=0.0)
    media_url = Column(String(512))
    category = Column(String(128))

    organization = relationship("Organization", back_populates="services")
    specialists = relationship("ServiceSpecialist", back_populates="service", cascade="all, delete-orphan")
    bookings = relationship("Booking", back_populates="service")


class ServiceSpecialist(Base):
    __tablename__ = "service_specialists"

    id = Column(Integer, primary_key=True, index=True)
    service_id = Column(Integer, ForeignKey("services.id"), nullable=False)
    specialist_id = Column(Integer, ForeignKey("specialists.id"), nullable=False)
    price_override = Column(Float)
    duration_override = Column(Integer)

    service = relationship("Service", back_populates="specialists")
    specialist = relationship("Specialist", back_populates="services")


class BookingStatus(str, Enum):
    PENDING = "PENDING"
    CONFIRMED = "CONFIRMED"
    CANCELLED = "CANCELLED"
    COMPLETED = "COMPLETED"


class Booking(Base):
    __tablename__ = "bookings"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False)
    location_id = Column(Integer, ForeignKey("locations.id"), nullable=False)
    specialist_id = Column(Integer, ForeignKey("specialists.id"), nullable=False)
    service_id = Column(Integer, ForeignKey("services.id"), nullable=False)
    client_name = Column(String(255), nullable=False)
    client_phone = Column(String(32), nullable=False)
    client_email = Column(String(255))
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime, nullable=False)
    status = Column(Enum(BookingStatus), default=BookingStatus.PENDING, nullable=False)
    notes = Column(Text)

    specialist = relationship("Specialist", back_populates="bookings")
    service = relationship("Service", back_populates="bookings")
    location = relationship("Location", back_populates="bookings")
    payments = relationship("Payment", back_populates="booking", cascade="all, delete-orphan")


class PaymentStatus(str, Enum):
    INITIATED = "INITIATED"
    CAPTURED = "CAPTURED"
    REFUNDED = "REFUNDED"
    FAILED = "FAILED"


class Payment(Base):
    __tablename__ = "payments"

    id = Column(Integer, primary_key=True, index=True)
    booking_id = Column(Integer, ForeignKey("bookings.id"), nullable=False)
    provider = Column(String(64), nullable=False)
    amount = Column(Float, nullable=False)
    currency = Column(String(8), default="RUB")
    status = Column(Enum(PaymentStatus), default=PaymentStatus.INITIATED, nullable=False)
    transaction_reference = Column(String(255))
    metadata = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    booking = relationship("Booking", back_populates="payments")


class NotificationChannel(str, Enum):
    WHATSAPP = "whatsapp"
    TELEGRAM = "telegram"
    EMAIL = "email"
    SMS = "sms"


class NotificationTemplate(Base):
    __tablename__ = "notification_templates"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False)
    channel = Column(Enum(NotificationChannel), nullable=False)
    name = Column(String(255), nullable=False)
    subject = Column(String(255))
    body = Column(Text, nullable=False)
    is_active = Column(Boolean, default=True)

    organization = relationship("Organization")
