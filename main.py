# main.py - 계산기 실행 파일

from calculator import add, subtract, multiply, divide

def main():
    print("=== 간단한 계산기 ===")
    print(f"10 + 5 = {add(10, 5)}")
    print(f"10 - 5 = {subtract(10, 5)}")
    print(f"10 * 5 = {multiply(10, 5)}")
    print(f"10 / 5 = {divide(10, 5)}")

if __name__ == "__main__":
    main()
