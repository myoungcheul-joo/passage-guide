# Passage Guide

Open a Bible passage and see everything in your vault that touches it, gathered into one sidebar: commentaries (in your own priority order), your notes, sermons, illustrations and books. It works from the note properties you already use, so there is nothing to import and no network access.

> Source is viewable, but this is not open-source software. Free to install and use for personal, church and non-profit purposes. See [LICENSE](LICENSE).

## What it does

- Reads a passage coordinate from each note (the `passage` / `본문` property, `ref_start` and `ref_end`, `bible_refs`, or the file name) and groups notes by overlapping passage ranges.
- Sections for commentaries, your own notes, sermons, illustrations, devotional material, books, original-language studies, and cross-references. Commentaries follow a priority list you write in a plain note.
- Shows the passage in the translations you choose, with one-click insert into the note you are editing.
- Illustration finder: search illustrations by theme, type, audience, season or passage, and insert them.
- Memo notes anchored to a passage, and a command that writes the passage coordinates into a note's properties.
- Folder names, priority order and sections are all configurable in settings, so it fits any vault. The command 「패시지 가이드 시작하기」 (get started) creates sample folders and notes.

## Bible text

This plugin ships **no Bible text**. To see passages in the side panel, place per-book JSON files in your vault (default `성경번역본/<translation>/01창세기.json` ... `66요한계시록.json`, format `{"chapters": {"1": {"1": "..."}}}`) and use Settings → "Find in vault". Use only translations that are in the public domain or that you legally own and converted yourself.

## Install

Settings → Community plugins → search "Passage Guide". Manual install: copy `main.js`, `manifest.json` and `styles.css` from the latest release into `.obsidian/plugins/passage-guide/`.

The interface and the default folder names are in Korean; most folder names can be changed in settings. The detailed guide below is in Korean.

Author: Myoungcheul Joo, https://pkm-institute.netlify.app

---

## 한국어 안내 — 패시지 가이드 (passage-guide)

로고스 바이블의 Passage Guide 원리 — **모든 자료가 같은 본문 좌표로 묶여 있다** — 를 옵시디언 볼트 안에서 구현한 플러그인입니다.
본문 하나(예: 마 22:15-22)를 열면, 볼트 안에서 그 본문을 다룬 **주석 · 나의 메모 · 설교 · 예화 · 도서**가 오른쪽 사이드바에 칸별로 모입니다.
**예화 탐색기**도 함께 들어 있습니다. (번역본 나란히 보기 창은 별도 플러그인 「Bible Translation Compare」입니다.)

v0.3.0부터 **어느 볼트에서나** 쓸 수 있습니다. 폴더 이름은 설정에서 자기 볼트에 맞게 정합니다.

## 5분 시작
1. 볼트의 `.obsidian/plugins/passage-guide/` 폴더에 `main.js` · `manifest.json` · `styles.css`를 넣고, 설정 → 커뮤니티 플러그인에서 **패시지 가이드**를 켭니다.
2. 명령 팔레트(Cmd/Ctrl+P)에서 **「패시지 가이드 시작하기」**를 실행합니다.
   - `설교/` `예화/` `주석/` `도서/` `성경연구/` `성경번역본/` 폴더, 순서표 노트, 예시 노트 3개를 만듭니다(이미 있는 파일은 건드리지 않음).
   - 볼트 안에 번역본 JSON이 있으면 찾아서 연결합니다.
   - 예시 설교를 열고 패시지 가이드를 보여 줍니다.
3. 이제 노트마다 속성 **`본문: 마 22:15-22`** 만 적으면 그 노트가 가이드에 모입니다.

## 노트를 가이드에 넣는 법 — 본문 좌표
| 속성 | 뜻 |
|---|---|
| `본문` (또는 `bible_refs`·`passage`·`scripture`) | 이 노트가 다루는 본문. 여러 개도 됨: `[마 22:15-22, 롬 13:1-7]` |
| `ref_start` · `ref_end` | 핵심 본문 좌표(숫자). 명령 **「이 노트에 본문 좌표 넣기」**가 `본문`·선택한 글·파일 이름에서 읽어 자동으로 넣어 줍니다 |

본문 속성이 없는 노트는 **파일 이름**(`마10_24-33_주해`, `…(삼하 16장5-14절)`), `book`·`chapter` 속성, 노트 안의 **`관련 본문: 마 6:22-23, 창 13:10` 같은 줄**에서 본문을 읽습니다(설정 `refFromFilename`).

좌표 = 책 번호×1,000,000 + 장×1,000 + 절 (마 22:15 → 40022015). 핵심 본문(`ref_*`)이 겹치는 노트가 인용 본문(`bible_refs`)만 겹치는 노트보다 앞에 섭니다.
본문 표기는 `마22:15-22`, `마태복음 22장 15-22절`, `시 23편`, `요한1서 3:16`, `롬 8` 모두 알아봅니다.

## 어느 칸에 모이나 (설정 → 볼트 구조)
폴더 이름 **또는** 노트 속성 `type`으로 정해집니다. 폴더 이름은 설정에서 바꿀 수 있습니다.

| 칸 | 기본 폴더 | 또는 type |
|---|---|---|
| 📚 주석 | `주석/<주석 이름>/…` (주석 이름 = 그 아래 폴더) | `type: 주석` + `author` 또는 `commentary` 속성 |
| ✍️ 나의 주석 | 경로에 `나의 주석` · `성경 메모` · `성경주해` 폴더 | `나의주석` · `성경주해` · `메모` |
| 🎤 설교 | `설교/` (날짜순 — `설교일`·`sermon_date`·`date` 등) | `설교` · `설교문` |
| 💡 예화 | `예화/` · 도서의 `04 예화`·`05 인용문` | `예화` |
| 🧩 묵상 자료 | 경로에 `큐티` 폴더 | `큐티` · `QT` · `묵상` |
| 📘 도서 | `도서/` | `도서` · `문헌노트` |
| 🔤 원어 | 경로에 `원어연구` 폴더 | `원어` |
| 🗂️ 연구 | `성경연구/` | `성경연구` |
| 📕 책 전체 | 책 이름 폴더(`마태복음`, `40 마태복음`, `b40 마태복음`) 안의 책 전체 노트 | `개론` |

그 밖의 설정: 숨김 폴더(인박스 등을 가이드에서 가리기), 색인하지 않을 폴더(템플릿), 📝 메모 폴더 규칙(`성경 메모/{nn} {book}`), **먼저 볼 저자**(예: 자기 교단 신학자를 맨 위 칸에).

## 우선순위 서재 — 주석 순서 정하기
순서표 노트(기본 `패시지 가이드 순서표.md`)의 ```yaml 블록을 읽습니다. 「시작하기」가 예시를 만들어 줍니다.
```yaml
# priority-library
WBC: 20            # 숫자가 작을수록 먼저
매튜헨리: 60
_default: 95       # 순서표에 없는 주석
check: [WBC]       # ⚠ 걸러 읽을 주석
check_notes:
  WBC: 권마다 저자 입장이 다르다   # ⚠에 마우스를 올리면 보임
sermon_first: [매튜헨리]  # ✍️ 설교 모드에서 맨 앞으로
no_cite: []        # 취소선(인용하지 않음)
book_folders: []   # 주석 폴더 안의 단행본 → 📘 도서 칸
```
이름은 대소문자·띄어쓰기를 무시하고 앞부분만 맞아도 같은 것으로 봅니다(`NIV 적용주석` ↔ `적용주석`).

## 번역본 (본문 칸)
**플러그인에는 성경 본문이 들어 있지 않습니다.** 번역본 JSON을 볼트에 넣어야 본문 칸이 동작합니다.
- 위치: `<번역본 루트>/<번역본 폴더>/01창세기.json … 66요한계시록.json` (기본 루트 `성경번역본`)
- 형식: `{"chapters": {"1": {"1": "태초에 하나님이…", "2": "…"}}}`
- 설정의 **「볼트에서 자동 찾기」**가 볼트 안의 번역본 폴더를 찾아 목록을 만듭니다.
- `관주` 폴더(교차참조 JSON)가 있으면 🔗 관주 칸이 생깁니다.
- 저작권: 저작권이 끝난 번역본(개역한글·KJV 등)이나 **정품으로 가진 자료를 본인이 변환한 것**만 쓰십시오. 저작권 있는 번역본을 AI로 새로 만들어 넣지 마십시오.

## 명령 (단축키는 설정 → 단축키에서 지정)
| 명령 | 하는 일 |
|---|---|
| 패시지 가이드 열기 (오른쪽 사이드바) | 열린 노트의 본문으로 가이드를 연다(선택 영역 → ref_* → 본문·bible_refs → 파일 이름 → 커서 줄 순). 리본 🧭 아이콘과 같다 |
| 패시지 가이드 창으로 열기 | 넓은 창으로 |
| 예화 탐색 / 예화 탐색 — 지금 본문으로 | 주제·유형·대상·절기·본문으로 예화 찾기 |
| 이 본문에 메모 노트 만들기 / 열기 | 메모 폴더에 좌표가 찍힌 메모 노트(로고스 Note Anchors) |
| 이 노트에 본문 좌표 넣기 | `ref_start`·`ref_end`·`ref_scope`(+`본문`)를 속성에 넣는다 |
| 패시지 가이드 시작하기 | 폴더·순서표·예시 노트 만들기 + 번역본 찾기 |
| 패시지 가이드 색인 새로고침 | 색인 다시 만들기(노트가 바뀌면 자동으로도 됨) |

## 알려진 한계
- 본문 파서가 정규식 뒤보기(look-behind)를 씁니다. iOS·iPadOS 16.4보다 옛 버전 모바일 앱에서는 켜지지 않을 수 있습니다.
- 예화 탐색기의 큰 주제·유형 목록은 목회자 PKM 연구소 예화 표준(v1.2)을 따릅니다.

## 바뀐 점
- 0.3.1 (2026-11-24): 역본대조 창·명령을 뺐습니다(별도 플러그인 Bible Translation Compare로 분리). 본문 칸의 번역본 표시와 관주는 그대로입니다. 콘솔 로그 제거
- 0.3.0 (2026-11-06): **어느 볼트에서나** — 폴더·저자 규칙을 모두 설정으로 · 노트 속성 `type`으로도 칸 정하기 · 「시작하기」(폴더·순서표·예시) · 「이 노트에 본문 좌표 넣기」 · 번역본 폴더 자동 찾기 · 순서표에 `check_notes`·`sermon_first`·`no_cite`·`book_folders` · 좌표 노트가 없을 때 안내. 0.2.x를 쓰던 볼트는 예전 설정과 동작을 그대로 이어받음
- 0.2.0 (2026-10-19): 설교 날짜·횟수 · 예화 「사용됨」 · 🔗 관주 칸 · 맨 위 요약줄 · 숨김 폴더
- 0.1.1 (2026-10-19): 숫자로 쓴 서신 이름 · 핵심/인용 두 층 정렬 · 예화 탐색 핵심 본문 가점 · 바뀐 노트만 다시 색인

만든 이: 주명철 (목회자 PKM 연구소)
