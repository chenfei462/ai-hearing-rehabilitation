"""共享安全关键词匹配逻辑。"""

from collections.abc import Iterable


def find_safety_keyword(text: str, keywords: Iterable[str]) -> str | None:
    """返回文本中命中的第一个关键词，没有命中则返回 None。"""
    normalized_text = text.casefold()
    return next(
        (keyword for keyword in keywords if keyword.casefold() in normalized_text),
        None,
    )


def contains_safety_keyword(text: str, keywords: Iterable[str]) -> bool:
    """判断文本是否命中安全关键词。"""
    return find_safety_keyword(text, keywords) is not None
