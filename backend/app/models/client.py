from typing import Optional

from pydantic import BaseModel


class ClientSettings(BaseModel):
    welcome_message: str = "Hello! How can I help you today?"
    system_prompt: Optional[str] = None
    max_history_turns: int = 5
    theme_color: str = "#1E40AF"


class ClientCreate(BaseModel):
    client_id: str
    name: str
    domain: str = ""
    settings: ClientSettings = ClientSettings()


class ClientResponse(BaseModel):
    client_id: str
    name: str
    domain: str
    settings: ClientSettings
