$ARGUMENTS

위 인자를 버전 bump 타입(patch/minor/major)으로 사용한다.
인자가 없으면 이전 태그 이후의 변경 내역을 분석하고, patch 또는 minor 중 적절한 것을 추천한 뒤 사용자에게 확인을 받는다.

변경 내역 조회 방법:
```bash
LAST_TAG=$(git describe --tags --abbrev=0 2>/dev/null) && git log "${LAST_TAG}..HEAD" --oneline || git log --oneline
```

---

## 1단계: Pre-flight 체크

아래 항목을 순서대로 확인한다.

### 차단 항목 (하나라도 실패하면 중단하고 원인 진단)

1. `git rev-parse --abbrev-ref HEAD` — main 브랜치인지 확인
2. `git status --porcelain` — working tree가 clean한지 확인
3. `npm whoami` — npm 인증 상태 확인
4. 이전 태그 대비 변경사항이 존재하는지 확인. 변경사항이 없으면 릴리스할 것이 없다고 알리고 중단.
   ```bash
   LAST_TAG=$(git describe --tags --abbrev=0 2>/dev/null) && git log "${LAST_TAG}..HEAD" --oneline || git log --oneline
   ```

### 경고 항목 (결과를 보여주되 계속 진행)

5. `npm audit --omit=dev` — critical/high 취약점이 있으면 경고
6. `npm pack --dry-run 2>&1` — 포함 파일과 크기를 출력. 포함되면 안 되는 파일(.env, tests/, node_modules/ 등)이 있으면 경고

모든 체크 결과를 아래 형식의 테이블로 출력한다:

| 항목 | 상태 | 비고 |
|------|------|------|
| Branch | ✓ main | |
| Clean tree | ✓ | |
| npm auth | ✓ user@example.com | |
| Changes | ✓ 12 commits | |
| Audit | ⚠ 1 moderate | express 관련 |
| Pack size | ✓ 45.2 kB | |

---

## 2단계: Release Notes 생성

`/prompts/release-notes.md`를 읽고 해당 지침을 따른다.

1. 변경 내역을 가져온다:
   ```bash
   LAST_TAG=$(git describe --tags --abbrev=0 2>/dev/null) && git log "${LAST_TAG}..HEAD" --oneline || git log --oneline
   ```
2. 필요시 개별 커밋의 상세 내용을 `git show --stat {hash}`로 확인한다.
3. CHANGELOG.md 엔트리 초안을 작성한다.
4. GitHub Release 본문 초안을 작성한다.
5. 두 초안을 사용자에게 보여주고 확인을 요청한다.
6. 수정 지시가 있으면 반영한다.
7. 확정되면:
   - CHANGELOG.md 파일 상단에 새 엔트리를 추가한다. 파일이 없으면 `# Changelog` 헤더와 함께 새로 생성한다.
   - `git add CHANGELOG.md`를 실행한다.

---

## 3단계: Release Script 실행

```bash
python3 scripts/release.py {bump-type}
```

이 스크립트가 수행하는 것:
- package.json version bump
- npm run build
- npm test
- git commit (package.json + CHANGELOG.md)
- git tag

스크립트 실패 시 에러 메시지를 확인하고 사용자에게 상황을 보고한다.

---

## 4단계: npm publish

사용자에게 `npm publish` 실행 여부를 확인한다. 확인을 받은 후에만 실행한다.

```bash
npm publish
```

실패 시 에러를 진단하고 사용자에게 보고한다.

---

## 5단계: GitHub Release

2단계에서 확정한 GitHub Release 본문으로 릴리스를 생성한다.

1. Release notes를 임시 파일에 저장한다.
2. `--notes-file` 옵션으로 릴리스를 생성한다:

```bash
gh release create v{version} --title "v{version}" --notes-file /tmp/release-notes.md
```

---

## 6단계: Post-publish 검증

아래 커맨드를 실행하여 배포 결과를 검증한다:

1. `npm view agentinc version` — 새 버전이 반영되었는가
2. `gh release view v{version}` — GitHub Release가 존재하는가

결과를 요약 테이블로 출력한다:

| 검증 항목 | 상태 |
|-----------|------|
| npm registry | ✓ v{version} |
| GitHub Release | ✓ v{version} |
