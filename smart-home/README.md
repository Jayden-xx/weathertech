# My Smart Home - 기후테크 스마트홈 제어실

## 분석한 실제 파일과 구조

프로젝트는 외부 패키지 없는 HTML/CSS/JavaScript 정적 페이지 구조입니다. 기존 `outputs/web-serial-dashboard` 센서 페이지를 유지하고 출력장치 사이트를 `outputs/smart-home`에 추가했습니다. 기존 센서 서버 5173과 구분하여 5174에서 실행합니다.

요청의 web_serial_firmware.ino는 프로젝트 폴더에 없었습니다. 실제 출력 펌웨어를 `C:/Users/User/Downloads/web_serial_output_firmware/web_serial_output_firmware.ino`에서 찾아 전체 내용을 읽었습니다. 펌웨어는 수정하지 않았습니다.

이미지는 사용자가 지정한 `C:/Users/User/Downloads/픽셀_홈IOT.png`를 그대로 `public/images/smart-home.png`에 복사했습니다. 1672×941 PNG이며 SHA-256 동일성을 확인했습니다. 재생성하거나 편집하지 않았습니다. 왼쪽 현관등(약 11.7%,35%), 내부 부저(29.5%,38%), 상단 조명 네 개(47.5/54/60.8/67.5%,23~28%), 중앙 LCD(57.5%,38%), 오른쪽 창문과 커튼(71~91%,33~65%)에 상대좌표 효과를 배치했습니다. 이미지의 가로세로 비율을 유지하므로 반응형에서도 좌표가 함께 축소됩니다.

## 통신 규칙 및 발견한 차이

- 115200 baud, 8N1, 흐름 제어 없음. 웹은 명령 끝에 LF 한 개를 붙입니다. 펌웨어는 LF, CR, CRLF도 처리합니다.
- 명령은 대소문자 구분, 앞뒤 공백 자동 제거 없음. 최대 95바이트, 초과 시 BUFFER_OVERFLOW.
- ACK: `{"type":"ack","command":"LED:BRIGHTNESS"}`처럼 인수를 뺀 명령 이름. LED:ON/OFF 등은 전체 이름과 동일합니다.
- STATUS는 ACK 없이 전체 status 객체를 반환합니다. 부팅 완료 메시지나 자동 status 전송은 없습니다.
- 오류는 `{"type":"error","code":"INVALID_ARGUMENT"}` 형식으로 code 필드를 사용합니다. UNKNOWN_COMMAND, INVALID_ARGUMENT, INVALID_TEXT, BUFFER_OVERFLOW.
- NEO:ON은 지원하지 않습니다. 켜기 버튼은 선택한 RGB의 NEO:COLOR를 전송합니다.
- LCD는 16×2, I2C 주소 0x27. ASCII 32~126만 허용하고 `|`는 한 번만 구분자로 사용합니다. 펌웨어는 16자를 넘으면 잘라내지만 웹은 각 줄 최대 16자로 제한합니다. 한글은 펌웨어에서도 거부됩니다.
- 커튼 범위 0~180°, 초기값 90°. 열림 방향은 펌웨어에서 지정하지 않았으므로 웹에서 0°/180° 방향을 선택하여 저장합니다.
- 부저 허용값은 31~10000Hz 및 1~60000ms. 자동 종료 후 알림 응답은 없습니다.

## 지원 명령과 버튼

| 장치 | 전송 명령 / 범위 | 펌웨어 동작 |
|---|---|---|
| 현관등 D5 | LED:ON / LED:OFF | 저장된 밝기로 켜기 / 끄기 |
| 현관등 밝기 | LED:BRIGHTNESS:0~255 | 밝기>0이면 켜짐, 0이면 꺼짐 |
| 천장등 D7, 4개 | NEO:COLOR:R,G,B / 각 0~255 | RGB가 모두 0이면 꺼짐, 그 외 켜짐 |
| 천장등 끄기 | NEO:OFF | 저장 RGB는 유지하고 끔 |
| 천장등 밝기 | NEO:BRIGHTNESS:0~255 | 밝기 변경, on 플래그는 유지 |
| 커튼 D8 | CURTAIN:ANGLE:0~180 | 서보 각도 설정 |
| 부저 D6 | BUZZER:TONE:Hz,ms / BUZZER:OFF | 지정 시간 재생 / 즉시 정지 |
| LCD A4/A5 | LCD:TEXT:line1\|line2 / LCD:CLEAR | 두 줄 표시 / 두 줄 비우기 |
| 상태 | STATUS | led, neo, curtain, buzzer, lcd 전체 상태 |

상태 응답 필드: led.on/brightness, neo.on/r/g/b/brightness, curtain.angle, buzzer.on/frequency, lcd.line1/line2. 이 상태는 출력 설정값이며 실물의 빛·소리·기계 위치를 센서로 확인한 피드백이 아닙니다.

생활 모드는 새 펌웨어 명령을 만들지 않고 다음 명령을 순서대로 조합합니다. 각 명령 ACK 및 이어지는 STATUS 확인 후 다음 명령으로 넘어갑니다.

- 귀가: BUZZER:OFF → LED:BRIGHTNESS:200 → NEO:BRIGHTNESS:180 → NEO:COLOR:255,218,156 → CURTAIN:ANGLE:열림각도 → LCD:TEXT:Welcome Home|Climate Smart
- 외출: BUZZER:OFF → LED:OFF → NEO:OFF → CURTAIN:ANGLE:닫힘각도 → LCD:TEXT:Away Mode|See You Soon
- 절전: BUZZER:OFF → LED:OFF → NEO:BRIGHTNESS:40 → NEO:COLOR:255,218,156 → CURTAIN:ANGLE:열림각도 → LCD:TEXT:Eco Mode|Save Energy

실패 시 모드를 즉시 중단하고 연결을 정리합니다. 이미 성공한 명령은 자동으로 되돌리지 않으며 화면에 일부 적용 가능성을 알립니다. 재연결하여 STATUS로 실제 설정값을 확인하세요.

## 주요 파일

- index.html: 상단 연결, 왼쪽 장치별 카드, 오른쪽 집 이미지, 하단 로그. 모바일은 이미지와 카드를 세로로 배치합니다.
- style.css: 따뜻한 크림/녹색 UI 및 상대좌표 오버레이. 충분한 버튼 높이, 키보드 포커스, 애니메이션 감소 설정.
- app.js: 개별 조작, 모드, 상태 렌더링, 2초 간격 STATUS 조회, 최대 500개 통신 로그.
- protocol.js: 인수 검증, JSON Lines 누적 파싱, 단일 명령/응답 큐, ACK 매칭, 타임아웃과 스트림 정리.
- server.mjs: Node 내장 HTTP 기반 localhost 정적 파일 서버. 백엔드 장치 제어와 DB는 없습니다.
- tests/protocol.test.mjs: 통신 상태 및 오류 처리 검증.
- public/images/smart-home.png: 제공 이미지 원본 복사본.

## 실행 및 테스트 순서

```powershell
cd 'C:\Users\User\Documents\Codex\2026-10-31\web-serial-api-web-serial-sensor\outputs\smart-home'
node server.mjs
```

접속: http://localhost:5174 . Node.js 18 이상, 패키지 설치 불필요. 종료 Ctrl+C. 다른 포트가 필요하면 PORT 환경변수를 지정하세요.

1. 제공 출력장치 펌웨어를 Arduino UNO에 업로드합니다. 시리얼 모니터·플로터와 다른 연결 탭을 닫습니다.
2. 데이터 USB 케이블 연결 후 Web Serial을 지원하는 데스크톱 Chrome 또는 Edge에서 접속합니다.
3. Arduino 연결 클릭 → 실제 USB 시리얼 포트 선택. 이 PC의 앞선 확인에서는 CH340(COM3)이 있었지만 포트는 재연결에 따라 바뀔 수 있습니다. 내장 COM1과 혼동하지 마세요.
4. 2.2초 안정화 후 STATUS를 요청하고 유효한 응답을 받아야 연결됨 및 제어 가능으로 표시합니다. 응답은 최대 3.5초 대기합니다.
5. 현관등부터 장치를 하나씩 조작하고 ACK와 STATUS, 실물 반응을 함께 확인합니다. 슬라이더는 놓을 때 전송하며 색상은 선택 완료 시 전송합니다.
6. 커튼은 실물 조립 방향을 확인해 열림 각도 방향을 설정합니다. 끝점에서 기구가 걸리지 않는지 확인합니다.
7. 부저 자동 종료는 2초 간격 STATUS로 갱신하므로 화면 표시에는 조회 간격만큼 지연이 있을 수 있습니다.
8. 생활 모드를 실행하고 명령별 성공 확인, 해제 및 재연결을 확인합니다.

## 코드/화면 검증

Node 내장 테스트 7개 통과: 전체 명령 및 범위/ASCII 검증, STATUS 스키마, 분할 바이트·CRLF·여러 줄, 잘못된 JSON 이후 복구, prefix ACK 매칭과 다른 ACK 무시, 모드 직렬화/각 명령 뒤 STATUS, 오류 시 후속 명령 중단, 타임아웃 연결 종료, 포트 열기 실패 시 잘못된 close 방지, 선택 취소, 물리적 분리를 흉내 낸 스트림 오류와 재연결 및 lock 해제. 실제 장치 응답을 만들지 않고 테스트에서만 ReadableStream/WritableStream 대역을 사용했습니다.

HTTP 페이지·JavaScript·이미지 200, 제공 이미지 파일 해시 동일, JavaScript 구문 검사 통과. 브라우저에서 이미지 로드, 연결 전 장치 조작 비활성, 미확인 효과 숨김, PC/모바일 배치 및 가로 넘침 없음, 콘솔 오류 없음을 확인했습니다.

실제 Arduino 연결·ACK·각 출력장치 동작은 이번 구현에서 확인하지 않았습니다. 실물에서는 D5 LED 극성과 저항/PWM, D6 수동 부저 음색과 자동 종료, D7 NeoPixel 개수·전원·색 순서, D8 서보 전원/공통 접지/기구 범위, LCD 0x27 주소·배선·16자 표시를 추가 확인해야 합니다. 전체 모드 동작과 USB 분리/재연결도 실물 검증 대상입니다.

## 상태 표현과 오류 처리

이미지 원본에 이미 불빛과 커튼이 그려져 있어 CSS로 실제 장면을 완전히 다시 렌더링할 수는 없습니다. LED/천장등은 발광 또는 어두운 마스크, 커튼은 창문 위 천 패턴의 폭, LCD는 텍스트 레이어, 부저는 점멸 링으로 보드의 확인된 설정을 표현합니다. 원본 커튼이 실제로 사라지는 편집 효과가 아니라 개폐 정도를 나타내는 오버레이입니다. 커튼의 개폐 비율은 끝점 사이 각도에 대한 시각적 비율이고 실측 위치가 아닙니다.

연결 해제 시 모든 효과를 숨기고 미확인으로 표시합니다. 바탕 그림은 장치의 실제 상태를 보장하지 않습니다. ACK만으로 임의 상태를 추정하지 않고 유효한 STATUS 결과로 갱신합니다. 오류, 쓰기 실패, 타임아웃이면 세션을 정리하고 사용자에게 알립니다. ACK에 요청 ID가 없으므로 타임아웃 후 계속 재전송하지 않고 연결을 종료하여 늦은 ACK의 오인 매칭을 막습니다. 64KiB 초과 줄은 다음 LF까지 폐기합니다.

포트 사용 중이면 다른 프로그램의 시리얼 연결을 닫으세요. 잘못된 JSON은 원문과 설명을 로그에 보존하며, 필요한 응답이 안 오면 시간 초과로 종료합니다. 포트 종료에 실패하면 연결 해제를 다시 누르세요. 브라우저 미지원/비보안 컨텍스트는 연결 버튼을 비활성화하고 안내합니다. 정상 종료에는 연결 해제를 사용하세요. 탭 강제 종료 때 비동기 정리를 보장할 수 없으며, 연결 해제 자체는 출력장치 끄기 명령이 아닙니다.

## 2026-10-31 COM3 무응답 진단 및 연결 보완

입력/출력 페이지는 같은 UNO라면 같은 USB 시리얼 COM 포트를 사용합니다. CH340 식별자 VID 6790(0x1A86), PID 29987(0x7523)는 COM3 장치와 일치합니다. COM1은 출력용으로 따로 지정하는 포트가 아닙니다.

실제 COM3를 115200 baud, DTR=true로 열고 3초 대기 후 STATUS를 보낸 진단에서 유효한 전체 상태를 수신했습니다: led.on=false/brightness=255, neo.on=false/RGB=0/brightness=255, curtain.angle=90, buzzer.on=false/frequency=0, lcd.line1="Climate Smart", lcd.line2="Home Ready". 진단 후 포트는 닫았습니다. 펌웨어 응답 수신은 확인했으나 각 출력장치를 켜거나 기구를 움직이는 실물 검증은 수행하지 않았습니다.

웹은 포트 open 후 DTR=true, RTS=false를 명시하고 2.5초 안정화 대기 후 초기 STATUS 응답을 최대 8초 기다리도록 수정했습니다. 일반 명령 제한은 3.5초 유지. 브라우저/드라이버가 신호 설정을 지원하지 않으면 로그에 남기고 상태 조회를 계속합니다. 초기화 실패 안내는 포트 열기 실패와 열린 포트의 무응답을 구분하며 수신 바이트 수도 표시합니다. 코드 테스트는 8개 통과했습니다. 웹에서의 재연결 성공은 별도로 확인해야 합니다.

## 조명 장면 전환 (최신 적용)

기존 CSS 원형 발광/검정 마스크를 제거하고 1672×941 장면 4개를 등록했습니다. home-off.png(모두 꺼짐), home-led.png(현관등만 켜짐), home-neo.png(천장등만 켜짐), smart-home.png(기존 모두 켜짐)입니다. 새 3개는 내장 image_gen 편집 도구로 원본 구도와 물체 위치를 유지하며 조명만 바꾸도록 생성했습니다. 원본은 보존합니다. 생성 편집 특성상 세부 픽셀의 미세한 차이는 있을 수 있습니다.

장면은 모두 미리 로드·디코딩하고, STATUS로 확인된 on 및 brightness 값으로 source-over 혼합 비율을 계산합니다(scenes.js). 전환 시간 420ms, 움직임 감소 환경에서는 즉시 전환합니다. 천장등 RGB가 모두 0이거나 brightness=0이면 꺼짐 장면으로 취급합니다. 새 배경은 따뜻한 백색 기준이며 임의 RGB의 정확한 방 조명 색상을 재현하지 않습니다. 실제 RGB 값은 상태 요약에서 확인합니다. 모르는 상태에서는 꺼진 그림을 기본 일러스트로 보여주되 상태 미확인을 명시하며, 연결 성공을 가정하지 않습니다.

검증: 통신 및 장면 혼합 테스트 9개 통과. 브라우저에서 네 이미지 모두 동일 크기로 정상 로드, 기존 발광 마스크 display:none, 콘솔 오류 없음, 가로 넘침 없음을 확인했습니다. 실제 장치 조작 후 전환은 이번 변경에서 직접 확인하지 않았습니다.

커튼 개선 권장: 네 조명 장면의 창문 부분에서 기존 커튼을 제거한 클린 배경을 준비하고, 동일 픽셀 스타일의 투명 커튼 및 고정 레일/모터 레이어를 분리합니다. 창문 사각형에 맞는 perspective transform 또는 SVG clipPath 안에서 커튼의 오른쪽 고정점을 유지하고 폭을 각도 비율로 보간합니다. 단순 가로 확대 대신 8~12개의 세로 주름 스트립 간격을 조절하면 천 질감이 늘어나지 않고 주름이 접힙니다. 확인된 STATUS 각도로만 목표값을 설정하며, 이동 시간은 실제 서보와 기구에서 측정한 값으로 조정합니다. 새 입력이 오면 현재 표시 위치에서 새 목표로 이어 이동합니다. 현재 단순 천 패턴 오버레이는 유지했고, 이 분리 자산 애니메이션은 아직 구현하지 않았습니다.

이미지 생성 공통 프롬프트: Edit the attached pixel-art house image for a registered animation scene variant. Keep EXACTLY the original canvas size, framing, camera, perspective, pixel art style and all object positions. Do not redraw architecture, sofa, table, curtains, plants, buzzer, LCD or any other detail. Preserve the LCD cyan glow and sunny outdoor view. Change ONLY electric lamp illumination and the associated small local warm spill on walls and floor. Do not darken the whole scene: natural daylight remains. No text or UI. This edited frame will crossfade over the original, so perfect geometry alignment is critical.
변형 지시: BOTH LIGHT GROUPS OFF / ONLY LEFT PORCH LANTERN ON / ONLY FOUR CEILING BULBS ON. 각 꺼진 램프의 노란 광원과 빛 번짐을 제거하고 중립색 유리와 전구로 표현하도록 지정했습니다.
