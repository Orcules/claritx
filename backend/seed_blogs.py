"""
Seed script: exports all hardcoded blog posts from blogPosts.ts into the published_blogs DB table.

Usage (from backend/):
  python3 seed_blogs.py

Reads DATABASE_URL from .env file.
"""
import asyncio
import json
import os
import re
import sys
from pathlib import Path

# ── Load .env ──────────────────────────────────────────────────────────────────
env_path = Path(__file__).parent / ".env"
if env_path.exists():
    for line in env_path.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, _, v = line.partition("=")
            os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))

# ── Parse blogPosts.ts ─────────────────────────────────────────────────────────
TS_FILE = Path(__file__).parent.parent / "src/data/blogPosts.ts"

def extract_blogs_from_ts():
    """
    Parse the TypeScript file by locating each blog object boundary and
    extracting key fields using regex.  Content is extracted between the
    `content: \`` backtick and the closing backtick before the next field.
    """
    src = TS_FILE.read_text(encoding="utf-8")

    # Split on each top-level blog object start: `  {\n    slug:`
    # We'll find each blog block by locating slug lines and then parsing fields
    slug_pattern = re.compile(r'^\s{2,4}slug:\s*"([^"]+)"', re.MULTILINE)
    slugs = [(m.group(1), m.start()) for m in slug_pattern.finditer(src)]

    blogs = []
    for i, (slug, start) in enumerate(slugs):
        # The block ends just before the next slug start (or end of array)
        end = slugs[i + 1][1] if i + 1 < len(slugs) else len(src)
        block = src[start:end]

        def get_field(name, block=block):
            m = re.search(rf'{name}:\s*"((?:[^"\\]|\\.)*)"', block)
            return m.group(1).replace('\\"', '"') if m else ""

        def get_int_field(name, block=block):
            m = re.search(rf'{name}:\s*(\d+)', block)
            return int(m.group(1)) if m else 5

        def get_tags(block=block):
            m = re.search(r'tags:\s*\[([^\]]+)\]', block)
            if not m:
                return []
            return [t.strip().strip('"') for t in m.group(1).split(",")]

        def get_image(block=block):
            m = re.search(r'image:\s*"([^"]+)"', block)
            return m.group(1) if m else ""

        def get_content(block=block):
            """Extract the template-literal content block."""
            m = re.search(r'content:\s*`([\s\S]*?)`\s*,\s*\n\s*author:', block)
            return m.group(1).strip() if m else ""

        title      = get_field("title")
        excerpt    = get_field("excerpt")
        author     = get_field("author") or "ClaritX Research Team"
        published_at = get_field("publishedAt")
        meta       = get_field("metaDescription")
        read_time  = get_int_field("readTime")
        tags       = get_tags()
        image_key  = get_image()
        content    = get_content()

        # Map TS image keys → a stable CDN/relative path the frontend can use
        image_url = f"/images/blog/{image_key}.jpg" if image_key else None

        if not title or not content:
            print(f"  ⚠ Skipping {slug} — could not extract title/content")
            continue

        blogs.append({
            "slug": slug,
            "title": title,
            "excerpt": excerpt,
            "content": content,
            "author": author,
            "published_at": published_at or "2025-01-01",
            "read_time": read_time,
            "tags": tags,
            "image_url": image_url,
            "meta_description": meta,
            "sources": [],
        })

    return blogs


# ── DB seed ────────────────────────────────────────────────────────────────────
async def seed():
    from sqlalchemy.ext.asyncio import create_async_engine
    from sqlalchemy.pool import NullPool
    from sqlalchemy import text

    db_url = os.environ.get("DATABASE_URL", "")
    if not db_url:
        print("ERROR: DATABASE_URL not set. Add it to backend/.env")
        sys.exit(1)

    db_url = db_url.replace("postgresql://", "postgresql+asyncpg://")
    engine = create_async_engine(db_url, echo=False, poolclass=NullPool)

    blogs = extract_blogs_from_ts()
    print(f"\nParsed {len(blogs)} blog posts from blogPosts.ts")

    inserted = 0
    skipped = 0

    from datetime import datetime

    async with engine.connect() as conn:
        for b in blogs:
            # Check for existing slug
            res = await conn.execute(
                text("SELECT id FROM published_blogs WHERE slug = :slug"),
                {"slug": b["slug"]}
            )
            if res.fetchone():
                print(f"  SKIP (already exists): {b['slug']}")
                skipped += 1
                continue

            # Convert published_at string to datetime
            try:
                pub_dt = datetime.fromisoformat(b["published_at"].replace("Z", "+00:00"))
            except ValueError:
                # Fallback for simple YYYY-MM-DD
                pub_dt = datetime.strptime(b["published_at"], "%Y-%m-%d")

            await conn.execute(text("""
                INSERT INTO published_blogs (
                    slug, title, excerpt, content, author,
                    published_at, read_time, tags,
                    image_url, meta_description, sources
                ) VALUES (
                    :slug, :title, :excerpt, :content, :author,
                    :published_at, :read_time, :tags,
                    :image_url, :meta_description, :sources
                )
            """), {
                "slug":            b["slug"],
                "title":           b["title"],
                "excerpt":         b["excerpt"],
                "content":         b["content"],
                "author":          b["author"],
                "published_at":    pub_dt,
                "read_time":       b["read_time"],
                "tags":            b["tags"],
                "image_url":       b["image_url"],
                "meta_description": b["meta_description"],
                "sources":         json.dumps(b["sources"]),
            })
            print(f"  ✓ Inserted: {b['slug']}")
            inserted += 1

        await conn.commit()

    print(f"\nDone! Inserted {inserted}, skipped {skipped} (already present).")
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(seed())
