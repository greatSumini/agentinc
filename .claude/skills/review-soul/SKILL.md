지금까지 대화를 기반으로 `/soul/` 하위 TOML 파일들의 항목을 검토하고 갱신한다.

## TOML 엔트리 형식

```toml
[[entries]]
id = 1
created_at = "2026-03-18"
last_used_at = "2026-03-21"
content = "엔트리 내용"
```

## 워크플로우

### 단계 1: Soul 문서 읽기

`/soul/` 하위의 모든 `.toml` 파일을 읽는다:
- `soul/ai/insights.toml`, `soul/ai/gotchas.toml`
- `soul/master/insights.toml`, `soul/master/gotchas.toml`
- `soul/project/insights.toml`, `soul/project/gotchas.toml`

### 단계 1.5: 신규 항목 제안 (선택)

이번 대화에서 새로 발견된 인사이트나 gotcha가 있다면:
1. 추가할 파일, 내용을 사용자에게 제시
2. 사용자 피드백 후, 승인된 항목만 해당 TOML 파일에 직접 추가
3. 새 항목의 `id`는 해당 파일 내 `max(id) + 1`

### 단계 2: 유용한 항목 식별

현재까지의 대화를 되돌아보며:
- 이번 대화에서 실제로 참조된 항목
- 참조되지는 않았지만, 참조했다면 유용했을 항목

해당 항목들을 파일 경로, id, content와 함께 목록으로 제시한다.

**→ 사용자 피드백 대기**

### 단계 3: 사용자 검증

사용자가 확인한 항목만 유지. 제외된 항목은 목록에서 뺀다.

### 단계 4: last_used_at 갱신

검증된 항목들에 대해 Bash로 실행:
```bash
python3 scripts/soul-manager.py touch 파일:id [파일:id ...]
```

예시:
```bash
python3 scripts/soul-manager.py touch soul/ai/insights.toml:1 soul/master/gotchas.toml:2
```

### 단계 5: Stale 항목 추출

Bash로 실행:
```bash
python3 scripts/soul-manager.py stale --days 14 --format human
```

결과가 있으면 사용자에게 보여주고, 각 항목에 대해 제거 또는 유지 여부 확인.

**→ 사용자 피드백 대기**

### 단계 6: 제거 및 유예 처리

- 제거 대상:
  ```bash
  python3 scripts/soul-manager.py remove 파일:id [파일:id ...]
  ```

- 유예 대상 (사용자가 남기기로 한 것):
  ```bash
  python3 scripts/soul-manager.py grace 파일:id [파일:id ...]
  ```

## 규칙

- 각 단계에서 사용자 피드백을 받은 뒤 다음 단계로 진행
- soul-manager.py 호출은 반드시 Bash 도구로 실행
