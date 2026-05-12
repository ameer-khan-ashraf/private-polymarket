import asyncio
import json
import os
from typing import Optional

import openai

from schemas import GeneratedMarket

_client: Optional[openai.OpenAI] = None


def _get_client() -> openai.OpenAI:
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
    model = os.getenv("OPENROUTER_MODEL", "z-ai/glm-4.5-air:free")

    def _call() -> GeneratedMarket:
        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": _SYSTEM},
                {"role": "user", "content": prompt},
            ],
            max_tokens=1024,
        )
        raw = response.choices[0].message.content
        if not raw:
            raise ValueError(f"LLM returned no content (finish_reason={response.choices[0].finish_reason!r})")
        # strip markdown code fences some models add despite instructions
        raw = raw.strip()
        if raw.startswith("```"):
            raw = raw.split("```", 2)[1]
            if raw.startswith("json"):
                raw = raw[4:]
            raw = raw.rsplit("```", 1)[0].strip()
        data = json.loads(raw)
        return GeneratedMarket(**data)

    return await asyncio.to_thread(_call)
