import re

with open('backend/app/api/dialogue.py', 'r', encoding='utf-8') as f:
    content = f.read()

# For handle_turn
old_handle = '''    redis = await get_redis()
    service = DialogueService(db, redis_client=redis)
    try:
        result = await service.handle_turn(session_id, audio_bytes)
        return success_response(data=result)
    except ValueError as e:
        return error_response(code=40001, message=str(e))
    except Exception as e:
        logger.error(f\"处理对话轮次失败: {e}\")
        return error_response(code=50001, message=\"服务内部错误\")'''

new_handle = '''    redis = await get_redis()
    service = DialogueService(db, redis_client=redis)
    # Add ownership check
    session = await service.get_session(session_id)
    if not session or session.user_id != current_user.id:
        raise HTTPException(status_code=403, detail={\"code\": 40301, \"message\": \"无权访问该对话session\"})
    try:
        result = await service.handle_turn(session_id, audio_bytes)
        return success_response(data=result)
    except ValueError as e:
        return error_response(code=40001, message=str(e))
    except Exception as e:
        logger.error(f\"处理对话轮次失败: {e}\")
        return error_response(code=50001, message=\"服务内部错误\")'''

content = content.replace(old_handle, new_handle)

# For finish_session
old_finish = '''    redis = await get_redis()
    service = DialogueService(db, redis_client=redis)
    try:
        result = await service.finish_session(session_id)
        return success_response(data=result)
    except ValueError as e:
        return error_response(code=40001, message=str(e))
    except Exception as e:
        logger.error(f\"结束对话会话失败: {e}\")
        return error_response(code=50001, message=\"服务内部错误\")'''

new_finish = '''    redis = await get_redis()
    service = DialogueService(db, redis_client=redis)
    # Add ownership check
    session = await service.get_session(session_id)
    if not session or session.user_id != current_user.id:
        raise HTTPException(status_code=403, detail={\"code\": 40301, \"message\": \"无权访问该对话session\"})
    try:
        result = await service.finish_session(session_id)
        return success_response(data=result)
    except ValueError as e:
        return error_response(code=40001, message=str(e))
    except Exception as e:
        logger.error(f\"结束对话会话失败: {e}\")
        return error_response(code=50001, message=\"服务内部错误\")'''

content = content.replace(old_finish, new_finish)

with open('backend/app/api/dialogue.py', 'w', encoding='utf-8') as f:
    f.write(content)

print('Updated dialogue.py')
