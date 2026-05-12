import asyncio
import json
import os
from typing import Optional

import anthropic

from schemas import GeneratedMarket

_client: Optional[anthropic.Anthropic] = None


def _get_client() -> anthropic.Anthropic:
    global _client
    if _client is None:
        key = os.getenv("ANTHROPIC_API_KEY")
        if not key:
            raise RuntimeError("ANTHROPIC_API_KEY is not configured")
        _client = anthropic.Anthropic(api_key=key)
    return _client


_SYSTEM = "You are helping create prediction markets for a friend group betting app. Always respond with valid JSON only — no markdown, no explanation."

_PROMPT = """Generate a prediction market for this topic: {topic}

Return a JSON object with exactly these fields:
- question_text: a clear YES/NO-style question (max 120 characters)
- description: 1-2 sentences of context or rules for judging the outcome (max 200 characters)
- side_a_label: 2-4 word label for the YES/winning side (e.g. "Ships it", "Gets the job", "Shows up")
- side_b_label: 2-4 word label for the NO/losing side (e.g. "Misses deadline", "Gets rejected", "Bails")
- suggested_resolution_days: integer days from today until this market should resolve (1-365)"""


async def generate_market(topic: str) -> GeneratedMarket:
    prompt = _PROMPT.format(topic=topic)
    client = _get_client()

    def _call() -> GeneratedMarket:
        message = client.messages.create(
            model="claude-haiku-4-5",
            max_tokens=512,
            system=_SYSTEM,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = message.content[0].text
        data = json.loads(raw)
        return GeneratedMarket(**data)

    return await asyncio.to_thread(_call)
