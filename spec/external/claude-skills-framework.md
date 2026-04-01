# Anthropic Claude Skills Framework

> Source: https://github.com/anthropics/skills

## 철학

Anthropic의 skills 시스템 핵심 철학: **"백만 번 재사용 가능한, 다양한 프롬프트에서 동작하는 스킬을 만들어라."**

- **Accessible Customization**: 폴더 + SKILL.md 하나로 구성. 진입장벽 최소화
- **Learning Over Prescribing**: MUST/NEVER 식 규칙이 아닌 *why*를 설명하여 Claude가 추론할 수 있게
- **Practical Illustration**: 하나의 접근법을 강요하지 않고, 다양한 도메인에서 달성 가능한 것을 보여줌
- **Iterative Validation**: 구조화된 평가를 통해 지속적 테스트 및 피드백

## 디렉토리 구조

```
skill-name/
├── SKILL.md              # 메타데이터(YAML frontmatter) + 지시문 (이상적으로 <500줄)
├── LICENSE.txt
└── Bundled Resources (optional)
    ├── scripts/          # 실행 가능한 코드, 유틸리티
    ├── references/       # 문서, 스키마
    └── assets/           # 템플릿, 이미지
```

**핵심 제약**: SKILL.md가 유일한 필수 파일. 나머지는 보조 리소스.

## SKILL.md 구조

### YAML Frontmatter

```yaml
---
name: unique-skill-identifier
description: "트리거 컨텍스트를 명시적으로 언급하는, 약간 적극적인 설명"
license: license-reference
---
```

### Markdown Body

Progressive disclosure 패턴으로 구성:
1. Overview (검색 가능한 키워드로 기능 설명)
2. Guidelines/Standards (실행 가능한 가이드)
3. Features (핵심 기능)
4. Technical details (구현 가이드, 엣지 케이스)
5. Code examples/recipes
6. Cross-references (번들 리소스 참조)

## 주요 스킬 예시 (17개 존재)

| Skill | 용도 | 특징 |
|-------|------|------|
| **skill-creator** | 스킬 생성 가이드 | 메타 스킬. 5대 원칙 + 평가 프레임워크 |
| **pdf** | PDF 읽기/추출/병합/분할 | 도구 선택 결정 테이블, 라이브러리별 구현 |
| **doc-coauthoring** | 협업 문서 작성 | 3단계 워크플로우: 컨텍스트 수집→정제→검증 |
| **mcp-builder** | MCP 서버 생성 | 4단계: 리서치→구현→테스트→평가 |
| **brand-guidelines** | 시각/언어 일관성 | 단순 SKILL.md (컬러코드, 타이포그래피 규칙) |

## 5대 설계 원칙

### 1. Progressive Disclosure
컨텐츠를 계층별로 로드. Description이 주요 트리거 메커니즘 — "약간 적극적으로" 작성하여 undertriggering 방지.

### 2. Explanation Over Rules
경직된 지시가 아닌 *왜* 특정 접근이 중요한지 설명. Claude가 추론하고 엣지 케이스에 적응 가능하게.

### 3. Lean Instructions
실행 트랜스크립트를 검토하여 낭비 지점 식별. 반복 유틸리티는 `scripts/`로 이동.

### 4. Bundled Helpers
테스트 결과 반복 코드 패턴이 발견되면 스킬 디렉토리 내 재사용 가능한 유틸리티로 패키징.

### 5. Iterative Testing
스킬 적용/미적용 쌍으로 테스트, 정량 평가, 구조화된 리뷰로 피드백, 개별 케이스가 아닌 패턴 기반 개선.

## 평가 프레임워크

3개의 전문 에이전트로 구성:

### Grader Agent
- 실행 트랜스크립트 + 출력 파일 직접 검사 (트랜스크립트 주장을 맹신하지 않음)
- Binary pass/fail 판정
- "불확실하면 fail" 원칙

### Comparator Agent
- 블라인드 비교로 편향 방지
- Content(정확성, 완전성) + Structure(구조, 포맷) 2차원 채점
- 결정적 판단: 동등하지 않으면 반드시 승자 선정

### Analyzer Agent
- Post-hoc: 비교 후 언블라인드하여 *왜* 더 나은지 분석
- Benchmark: 다수 실행에서 패턴 도출, 차별화 요소 식별

## 지원 인프라

### Scripts (9개 Python 유틸리티)
- `quick_validate.py` — 빠른 검증
- `run_eval.py` — 테스트 실행
- `run_loop.py` — 반복 개선 워크플로우
- `generate_report.py` — 결과 요약
- `aggregate_benchmark.py` — 교차 분석
- `improve_description.py` — Description 최적화
- `package_skill.py` — 배포 패키지 생성

### Schemas
- evals.json, history.json, grading.json, metrics.json, timing.json, benchmark.json, comparison.json, analysis.json

## 핵심 설계 패턴

1. **Workflow scaffolding without rigidity** — 명확한 단계 정의 + 사용자 주체성 유지
2. **Decision tables for tool selection** — 작업→최적 도구 빠른 매핑
3. **Language-specific guides** — 구현이 컨텍스트에 따라 달라짐을 인정
4. **Practical recipes** — 즉시 사용 가능한 코드 예시
5. **Cross-references** — 관련 스킬 간 모듈화
6. **Edge case documentation** — 명시적 gotchas 및 경고

## agentinc 적용 시 핵심 시사점

1. **SKILL.md 중심 구조**: 단일 진입점(SKILL.md) + 보조 리소스(scripts/, references/, assets/)
2. **Description의 중요성**: 트리거 메커니즘으로서의 description — Claude가 자동 호출할지 결정하는 핵심
3. **번들 리소스 패턴**: 반복 코드를 스크립트로 분리하여 토큰 절약
4. **평가 루프**: 생성→테스트→분석→개선의 반복 사이클이 품질 보장
5. **Progressive disclosure**: 메타데이터 항상 가용 → SKILL.md body 필요시 → 번들 리소스 필요시
