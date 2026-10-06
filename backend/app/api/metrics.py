"""
监控 API 路由
提供指标查询和告警端点
"""
from fastapi import APIRouter, Depends, HTTPException, status
from app.api.deps import get_current_user
from app.models.user import User
from app.monitoring.metrics import metrics_collector
from app.schemas.response import success_response

router = APIRouter()


@router.get("/metrics")
async def get_metrics(current_user: User = Depends(get_current_user)):
    """
    获取监控指标汇总
    用于 Grafana / Prometheus 拉取或前端监控面板
    仅 therapist 可访问
    """
    if current_user.role != "therapist":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": 40301, "message": "需要听力师权限"},
        )
    metrics = metrics_collector.get_summary()
    return success_response(data=metrics, message="指标获取成功")


@router.get("/metrics/ai-latency")
async def get_ai_latency(current_user: User = Depends(get_current_user)):
    """
    获取 AI 服务延迟统计
    用于性能监控和告警
    仅 therapist 可访问
    """
    if current_user.role != "therapist":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": 40301, "message": "需要听力师权限"},
        )
    stats = metrics_collector.get_ai_latency_stats()

    # 添加告警状态
    alerts = {}
    thresholds = {
        "asr": 500,   # ASR < 500ms
        "tts": 2000,  # TTS < 2s
        "llm": 3000,  # LLM < 3s
    }
    for service, threshold in thresholds.items():
        service_stats = stats.get(service, {})
        p95 = service_stats.get("p95_ms", 0)
        alerts[service] = {
            "threshold_ms": threshold,
            "p95_ms": p95,
            "status": "ok" if p95 < threshold else "warning",
        }

    return success_response(
        data={"latency": stats, "alerts": alerts},
        message="AI 延迟统计",
    )


@router.get("/metrics/errors")
async def get_errors(
    limit: int = 20,
    current_user: User = Depends(get_current_user),
):
    """获取最近错误
    仅 therapist 可访问
    """
    if current_user.role != "therapist":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": 40301, "message": "需要听力师权限"},
        )
    errors = metrics_collector.get_recent_errors(limit)
    return success_response(data=errors, message="错误列表")
