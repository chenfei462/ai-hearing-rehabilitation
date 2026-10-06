from app.core.safety import find_safety_keyword, contains_safety_keyword


def test_safety_matching_is_case_insensitive_and_returns_the_matched_keyword():
    keywords = ["医疗建议", "赌博"]

    assert find_safety_keyword("请给我医疗建议", keywords) == "医疗建议"
    assert contains_safety_keyword("我想 赌博", keywords) is True
    assert contains_safety_keyword("今天练习发音", keywords) is False
