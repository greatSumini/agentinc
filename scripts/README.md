# scripts/

auto-startup 프로젝트의 자동화 스크립트를 관리하는 디렉토리.

## 스크립트 목록

| 스크립트 | 역할 | 관련 파일 |
|---|---|---|
| `run-phases.py` | task의 phase를 순차 실행하는 runner | `tasks/*/index.json`, `tasks/*/phase*.md`, `prompts/task-create.md` |
| `soul-manager.py` | soul TOML 항목의 last_used_at 갱신, stale 항목 조회, 항목 제거/유예 | `soul/**/*.toml`, `.claude/commands/review-soul.md` |
| `create-pr.py` | PR 생성 및 tasks/index.json 업데이트 | `tasks/index.json` |
| `_utils.py` | 스크립트 공용 유틸리티 (프로젝트 루트 탐색 등) | - |

## 의존성

- Python 3.10+
- 외부 패키지 설치: `pip install -r scripts/requirements.txt`

## 실행 방법

```bash
# 프로젝트 루트에서 실행
python3 scripts/run-phases.py <task-dir>

# 예시
python3 scripts/run-phases.py 14-auto-startup
```
