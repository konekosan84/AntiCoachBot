from enum import Enum
from typing import Dict

import httpx


class Messenger(str, Enum):
    WHATSAPP = "whatsapp"
    TELEGRAM = "telegram"


class NotificationError(Exception):
    pass


async def send_whatsapp_message(phone: str, message: str, credentials: Dict[str, str]) -> None:
    """Stub WhatsApp sender.

    Replace with actual WhatsApp Business API integration. This implementation
    simply validates input and raises if credentials are missing.
    """

    if not credentials.get("api_key"):
        raise NotificationError("WhatsApp credentials are missing")
    # Placeholder for real request
    async with httpx.AsyncClient() as client:
        await client.post("https://httpbin.org/post", json={"to": phone, "message": message})


async def send_telegram_message(chat_id: str, message: str, bot_token: str) -> None:
    if not bot_token:
        raise NotificationError("Telegram bot token is required")
    async with httpx.AsyncClient() as client:
        await client.post(
            f"https://api.telegram.org/bot{bot_token}/sendMessage",
            json={"chat_id": chat_id, "text": message},
        )


async def dispatch_notification(channel: Messenger, payload: Dict[str, str], secrets: Dict[str, str]) -> None:
    if channel == Messenger.WHATSAPP:
        await send_whatsapp_message(payload["recipient"], payload["message"], secrets)
    elif channel == Messenger.TELEGRAM:
        await send_telegram_message(payload["recipient"], payload["message"], secrets.get("bot_token", ""))
    else:
        raise NotificationError(f"Unsupported channel: {channel}")
