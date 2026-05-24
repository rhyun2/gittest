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
    """나눗셈 - 정수면 정수로, 아니면 소수점 2자리"""
    if b == 0:
        raise ValueError("0으로 나눌 수 없습니다.")
    result = round(a / b, 2)
    return int(result) if result == int(result) else result

def power(base, exp):
    """
    거듭제곱을 계산합니다.
    
    Args:
        base: 밑수
        exp: 지수 (정수만 허용, 음수 가능)
    
    Returns:
        base의 exp 제곱 값
    
    Raises:
        TypeError: exp가 정수가 아닌 경우
    
    Examples:
        >>> power(2, 3)
        8
        >>> power(2, -1)
        0.5
    """
    if not isinstance(exp, int):
        raise TypeError("지수는 정수여야 합니다.")
    return base ** exp