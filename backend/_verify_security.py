"""临时验证脚本：验证 PyJWT + bcrypt 替换后的行为一致性（验证后删除）"""
import os

os.environ.setdefault("SECRET_KEY", "test-secret-key-for-verification-only")

import jwt as pyjwt
from app.core.security import (
    create_access_token,
    verify_token,
    verify_password,
    get_password_hash,
)
from app.core.config import get_settings

settings = get_settings()

ok = True


def check(name, cond):
    global ok
    print(f"[{'PASS' if cond else 'FAIL'}] {name}")
    if not cond:
        ok = False


# 1. 基本 token 生成与验证往返
payload = {"sub": "1", "role": "user"}
token = create_access_token(payload)
check("create_access_token 返回 str", isinstance(token, str))
check("token 为标准三段式 JWT", token.count(".") == 2)

decoded = verify_token(token)
check("verify_token 能解码", decoded is not None)
check("sub 保持一致", decoded.get("sub") == "1")
check("role 保持一致", decoded.get("role") == "user")
check("exp 字段存在", "exp" in decoded)

# 2. 签名算法必须是 HS256
header = pyjwt.get_unverified_header(token)
check("签名算法为 HS256", header.get("alg") == "HS256")
check("token 类型为 JWT", header.get("typ") == "JWT")

# 3. 使用相同密钥/算法可被标准 PyJWT 直接解码（跨库兼容性）
externally = pyjwt.decode(
    token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
)
check("外部 PyJWT 用同密钥可解码（token 格式兼容）", externally["sub"] == "1")

# 4. 无效 token / 错误密钥 / 错误算法 → 返回 None（不抛异常）
check("非法字符串 token 返回 None", verify_token("not-a-token") is None)
tampered = token[:-3] + "abc"
check("篡改签名返回 None", verify_token(tampered) is None)

wrong_key_token = pyjwt.encode(payload, "a-totally-different-key", algorithm="HS256")
check("错误密钥签发的 token 返回 None", verify_token(wrong_key_token) is None)

# 5. 过期 token → 返回 None
from datetime import datetime, timedelta, timezone

expired = pyjwt.encode(
    {
        "sub": "1",
        "role": "user",
        "exp": datetime.now(timezone.utc) - timedelta(days=1),
    },
    settings.SECRET_KEY,
    algorithm="HS256",
)
check("过期 token 返回 None", verify_token(expired) is None)

# 6. payload 不被原字典污染（data.copy 语义保持）
src = {"sub": "9", "role": "therapist"}
create_access_token(src)
check("原始 payload 未被写入 exp", "exp" not in src)

# 7. bcrypt 哈希与校验
h = get_password_hash("s3cret-pw")
check("get_password_hash 返回 str", isinstance(h, str))
check("哈希为 bcrypt 标准格式 ($2b$)", h.startswith("$2b$"))
check("正确密码校验通过", verify_password("s3cret-pw", h) is True)
check("错误密码校验失败", verify_password("wrong-pw", h) is False)

# 8. passlib 历史哈希兼容性（passlib 产生的 $2b$ 哈希应可被 bcrypt 校验）
legacy = "$2b$12$KIXQJ0mZQ8mZQ8mZQ8mZQOe1GdMPTUgPKhLc6r1n6bYvJ8kR0mZQ8m"
try:
    result = verify_password("whatever", legacy)
    check("历史 passlib 哈希不抛异常（格式容错）", isinstance(result, bool))
except Exception as e:
    print(f"[FAIL] 历史哈希校验抛异常: {type(e).__name__}: {e}")
    ok = False

# 9. 确认已不再依赖 jose / passlib
import sys

check("jose 模块未加载", "jose" not in sys.modules)
check("passlib 模块未加载", "passlib" not in sys.modules)

print()
print("=" * 46)
print("全部通过 [OK]" if ok else "存在失败项 [FAIL]")
print("=" * 46)
sys.exit(0 if ok else 1)
