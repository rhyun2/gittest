# calculator.py - 기본 계산기 모듈

def add(a, b):
    """두 수를 더합니다."""
    return a + b

def subtract(a, b):
    """두 수를 뺍니다."""
    return a - b

def multiply(a, b):
    """두 수를 곱합니다."""
    return a * b

def divide(a, b):
    """두 수를 나눕니다."""
    if b == 0:
        raise ValueError("0으로 나눌 수 없습니다.")
    return a / b

def power(base, exp):
    """거듭제곱을 계산합니다."""
    if not isinstance(exp, int):
        raise TypeError("지수는 정수여야 합니다.")
    return base ** exp