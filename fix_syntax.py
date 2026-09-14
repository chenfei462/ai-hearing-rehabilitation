with open('backend/app/services/dialogue_service.py', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix the escaped quotes in get_session method
old = '''    async def get_session(self, session_id: int) -> Optional[DialogueSession]:
        \\"\\"\\"
        获取会话详情（用于所有权检查）
        \\"\\"\\"'''

new = '''    async def get_session(self, session_id: int) -> Optional[DialogueSession]:
        \"\"\"
        获取会话详情（用于所有权检查）
        \"\"\"'''

content = content.replace(old, new)

with open('backend/app/services/dialogue_service.py', 'w', encoding='utf-8') as f:
    f.write(content)

print('Fixed syntax error')
