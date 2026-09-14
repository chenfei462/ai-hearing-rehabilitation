"""日期工具

不同数据库对日期聚合函数的返回类型不一致：
- PostgreSQL / MySQL：返回 ``date`` 对象
- SQLite：``func.date()`` 返回 ``'YYYY-MM-DD'`` 字符串

``to_date()`` 统一将其规范化为 ``date`` 对象，避免跨库比较时抛出
``TypeError: '<' not supported between instances of 'str' and 'datetime.date'``。
"""
from datetime import date, datetime


def to_date(value) -> date | None:
    """将数据库返回的日期值规范化为 ``date`` 对象

    Args:
        value: ``date`` / ``datetime`` 对象，或 ``'YYYY-MM-DD'`` 格式字符串

    Returns:
        规范化后的 ``date`` 对象；无法解析时返回 ``None``
    """
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    if isinstance(value, str):
        try:
            return datetime.strptime(value[:10], "%Y-%m-%d").date()
        except ValueError:
            return None
    return None
