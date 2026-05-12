import asyncio
import re
import time
from typing import Optional

import feedparser
import httpx

from schemas import NewsItem

FEEDS = [
    ("BBC News", "https://feeds.bbci.co.uk/news/rss.xml"),
    ("The Guardian", "https://www.theguardian.com/world/rss"),
    ("NPR News", "https://feeds.npr.org/1001/rss.xml"),
]

_cache: dict = {"articles": [], "expires": 0.0}
_fetch_lock = asyncio.Lock()
CACHE_TTL = 300  # 5 minutes


def _strip_html(text: str) -> str:
    return re.sub(r"<[^>]+>", "", text).strip()


def _safe_int(val) -> int:
    try:
        return int(val or 0)
    except (ValueError, TypeError):
        return 0


def _extract_image(entry: dict) -> Optional[str]:
    thumbnails = entry.get("media_thumbnail") or []
    if thumbnails:
        return thumbnails[0].get("url") or None
    contents = entry.get("media_content") or []
    if contents:
        best = max(contents, key=lambda c: _safe_int(c.get("width")))
        return best.get("url") or None
    return None


async def _fetch_feed(source: str, url: str) -> list[NewsItem]:
    try:
        async with httpx.AsyncClient(timeout=8.0, follow_redirects=True) as client:
            resp = await client.get(url, headers={"User-Agent": "Mozilla/5.0"})
        parsed = feedparser.parse(resp.text)
        items = []
        for entry in parsed.entries[:8]:
            items.append(NewsItem(
                id=entry.get("id", entry.get("link", "")),
                title=_strip_html(entry.get("title", "")),
                description=_strip_html(entry.get("summary", "")),
                url=entry.get("link", ""),
                source=source,
                published_at=entry.get("published", ""),
                image_url=_extract_image(entry),
            ))
        return items
    except Exception:
        return []


async def get_news() -> list[NewsItem]:
    now = time.time()
    if _cache["expires"] > now and _cache["articles"]:
        return _cache["articles"]

    async with _fetch_lock:
        # Re-check after acquiring lock — another coroutine may have populated cache
        now = time.time()
        if _cache["expires"] > now and _cache["articles"]:
            return _cache["articles"]

        results = await asyncio.gather(*[_fetch_feed(src, url) for src, url in FEEDS])
        articles = [item for feed in results for item in feed]

        _cache["articles"] = articles
        _cache["expires"] = now + CACHE_TTL
        return articles
