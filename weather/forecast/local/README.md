# 로컬 Python 실행본

상위 README의 로컬 실행·키 설정 설명을 참고하세요. Python 3.10 이상, 외부 패키지 불필요입니다.

1. KEY.env.example을 KEY.env로 복사해 실제 키를 입력합니다. 파일 위치는 이 README와 server.py가 있는 폴더입니다.
2. 서버실행.cmd를 실행합니다. 키가 없어도 안내 화면은 실행됩니다.
3. 서버 준비 완료 후 http://127.0.0.1:8080/outlook 에 접속합니다.
4. 터미널에서 Ctrl+C로 종료합니다. KEY.env 변경 후 재시작합니다.

터미널 직접 실행: `py -3 -X utf8 server.py` 또는 Python 3.10 이상으로 확인한 `python -X utf8 server.py`.
자동 검사: 이 폴더에서 `python -m unittest -v test_server`.
운영체제 KMA_SERVICE_KEY가 KEY.env보다 우선합니다. KEY.env의 UTF-8/BOM·주석·빈 줄을 지원합니다.
키를 채팅이나 저장소에 올리지 마세요. 배포용 Sites 버전은 상위 sites/에 별도 있습니다.
