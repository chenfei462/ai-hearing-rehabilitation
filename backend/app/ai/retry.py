"""
公共重试+退避逻辑

提取自 ASR/TTS/LLM 三个网关的重复实现。
所有网关共享同一套指数退避策略，仅在配置参数上有所不同。
"""
import asyncio
from typing import Callable, TypeVar, Awaitable, Optional

from loguru import logger

T = TypeVar("T")


async def retry_with_backoff(
    coro_factory: Callable[[], Awaitable[T]],
    max_retries: int = 3,
    base_delay: float = 1.0,
    timeout: float = 30.0,
    service_name: str = "AI",
    raise_on_exhaust: bool = True,
) -> Optional[T]:
    """
    带指数退避的通用重试包装器

    :param coro_factory: 返回协程的 callable（每次重试需创建新协程）
    :param max_retries: 最大重试次数
    :param base_delay: 基础延迟（秒），每次重试翻倍
    :param timeout: 单次调用超时（秒）
    :param service_name: 服务名（用于日志）
    :param raise_on_exhaust: 重试耗尽时是否抛出异常（True）或返回 None（False）
    :return: 协程结果，或 None（仅当 raise_on_exhaust=False 且重试耗尽时）
    """
    last_exc: Optional[Exception] = None

    for attempt in range(max_retries + 1):
        try:
            return await asyncio.wait_for(coro_factory(), timeout=timeout)
        except asyncio.TimeoutError as e:
            last_exc = e
            logger.warning(
                f"[{service_name}] 超时 attempt={attempt + 1}/{max_retries + 1}"
            )
            if attempt < max_retries:
                delay = base_delay * (2 ** attempt)
                await asyncio.sleep(delay)
        except Exception as e:
            last_exc = e
            logger.warning(
                f"[{service_name}] 异常 attempt={attempt + 1}/{max_retries + 1}: {e}"
            )
            if attempt < max_retries:
                delay = base_delay * (2 ** attempt)
                await asyncio.sleep(delay)

    # 重试耗尽
    if raise_on_exhaust:
        raise last_exc  # type: ignore
    return None


def make_retry_wrapper(
    max_retries: int,
    base_delay: float,
    timeout: float,
    service_name: str,
    raise_on_exhaust: bool = True,
) -> Callable[[Callable[[], Awaitable[T]]], Awaitable[Optional[T]]]:
    """
    创建预配置的重试包装器

    返回一个接受 coro_factory 参数的函数，省略重复传入固定配置。

    Usage::

        retry = make_retry_wrapper(
            max_retries=3, base_delay=1.0, timeout=10.0, service_name="ASR"
        )
        result = await retry(my_coroutine)
    """
    async def wrapper(coro_factory: Callable[[], Awaitable[T]]) -> Optional[T]:
        return await retry_with_backoff(
            coro_factory,
            max_retries=max_retries,
            base_delay=base_delay,
            timeout=timeout,
            service_name=service_name,
            raise_on_exhaust=raise_on_exhaust,
        )
    return wrapper
