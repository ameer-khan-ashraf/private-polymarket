import asyncio
import os
from typing import Optional

from google import genai
from google.genai import types

from schemas import GeneratedMarket

_client: Optional[genai.Client] = None


def _get_client() -> genai.Client:
    global _client
    if _client is None:
        key = os.getenv("GEMINI_API_KEY")
        if not key:
            raise RuntimeError("GEMINI_API_KEY is not configured")
        _client = genai.Client(api_key=key)
    return _client


_PROMPT = """You are helping create a prediction market for a friend group betting app.
Given a topic, generate a market. Rules:
- question_text: a clear YES/NO-style question about the topic (max 120 characters)
- description: 1-2 sentences of context or rules for judging the outcome (max 200 characters)
- side_a_label: 2-4 word label for the YES/winning side (e.g. "Ships it", "Gets the job", "Shows up")
- side_b_label: 2-4 word label for the NO/losing side (e.g. "Misses deadline", "Gets rejected", "Bails")
- suggested_resolution_days: integer days from today until this market should resolve (1-365)

Topic: {topic}"""


async def generate_market(topic: str) -> GeneratedMarket:
    prompt = _PROMPT.format(topic=topic)
    client = _get_client()

    def _call() -> GeneratedMarket:
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=GeneratedMarket,
            ),
        )
        if response.parsed is None:
            raise ValueError("LLM returned a response that could not be parsed")
        return response.parsed

    return await asyncio.to_thread(_call)
