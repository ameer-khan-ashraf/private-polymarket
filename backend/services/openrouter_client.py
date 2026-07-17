import os
from typing import Optional

import openai

_client: Optional[openai.OpenAI] = None


def get_client() -> openai.OpenAI:
    global _client
    if _client is None:
        key = os.getenv("OPENROUTER_API_KEY")
        if not key:
            raise RuntimeError("OPENROUTER_API_KEY is not configured")
        _client = openai.OpenAI(
            api_key=key,
            base_url="https://openrouter.ai/api/v1",
        )
    return _client
