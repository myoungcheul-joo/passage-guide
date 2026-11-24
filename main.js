'use strict';

// 패시지 가이드 v0.3.0 (어느 볼트에서나) — 로고스 Passage Guide 원리(표준 좌표 + 범위 겹침 + 칸 나누기)를 볼트 자료로 구현
// 한 플러그인에 두 가지를 넣음: ① 패시지 가이드(우선순위 서재 순 주석·내 메모·설교·예화 모으기)
//                               ② 예화 탐색기(주제·유형·본문으로 찾기·삽입). 역본대조 창은 별도 플러그인(bible-translation-compare)
// 좌표 = 책번호×1,000,000 + 장×1000 + 절. 파서 규칙은 scripts/passage-guide/bible_ref.py·guide.js와 같다.

const { Plugin, Modal, ItemView, Notice, PluginSettingTab, Setting, MarkdownView, normalizePath, TFile } = require('obsidian');

const GUIDE_VIEW = 'passage-guide-view';

// ───────────────────────── 성경 66권 ─────────────────────────
const BOOKS = [[1,'창세기','창'],[2,'출애굽기','출'],[3,'레위기','레'],[4,'민수기','민'],[5,'신명기','신'],[6,'여호수아','수'],[7,'사사기','삿'],[8,'룻기','룻'],[9,'사무엘상','삼상'],[10,'사무엘하','삼하'],[11,'열왕기상','왕상'],[12,'열왕기하','왕하'],[13,'역대상','대상'],[14,'역대하','대하'],[15,'에스라','스'],[16,'느헤미야','느'],[17,'에스더','에'],[18,'욥기','욥'],[19,'시편','시'],[20,'잠언','잠'],[21,'전도서','전'],[22,'아가','아'],[23,'이사야','사'],[24,'예레미야','렘'],[25,'예레미야애가','애'],[26,'에스겔','겔'],[27,'다니엘','단'],[28,'호세아','호'],[29,'요엘','욜'],[30,'아모스','암'],[31,'오바댜','옵'],[32,'요나','욘'],[33,'미가','미'],[34,'나훔','나'],[35,'하박국','합'],[36,'스바냐','습'],[37,'학개','학'],[38,'스가랴','슥'],[39,'말라기','말'],[40,'마태복음','마'],[41,'마가복음','막'],[42,'누가복음','눅'],[43,'요한복음','요'],[44,'사도행전','행'],[45,'로마서','롬'],[46,'고린도전서','고전'],[47,'고린도후서','고후'],[48,'갈라디아서','갈'],[49,'에베소서','엡'],[50,'빌립보서','빌'],[51,'골로새서','골'],[52,'데살로니가전서','살전'],[53,'데살로니가후서','살후'],[54,'디모데전서','딤전'],[55,'디모데후서','딤후'],[56,'디도서','딛'],[57,'빌레몬서','몬'],[58,'히브리서','히'],[59,'야고보서','약'],[60,'베드로전서','벧전'],[61,'베드로후서','벧후'],[62,'요한일서','요일'],[63,'요한이서','요이'],[64,'요한삼서','요삼'],[65,'유다서','유'],[66,'요한계시록','계']];
const N2 = {}; const AB = {}; const FULL = {};
for (const [n, f, a] of BOOKS) { N2[f] = n; N2[a] = n; AB[n] = a; FULL[n] = f; }
for (const [k, n] of Object.entries({ '룻': 8, '욥': 18, '아가서': 22, '예레미야 애가': 25, '애가': 25, '계시록': 66, '마태': 40, '마가': 41, '누가': 42, '요한': 43, '역대기상': 13, '역대기하': 14, '사무엘 상': 9, '사무엘 하': 10, '열왕기 상': 11, '열왕기 하': 12, '역대 상': 13, '역대 하': 14, '역대기 상': 13, '역대기 하': 14, '요한1서': 62, '요한2서': 63, '요한3서': 64 })) if (!(k in N2)) N2[k] = n;
// 숫자로 쓴 서신 이름(2026-10-19, bible_ref.py·guide.js와 같음): '요한1서'가 요한복음 1장으로 읽히던 오류. 띄어 쓴 꼴·'1요한'꼴도 인정
for (const [base, ns] of Object.entries({ '요한': [62, 63, 64], '베드로': [60, 61], '고린도': [46, 47], '데살로니가': [52, 53], '디모데': [54, 55] })) ns.forEach((n, i) => { const k = i + 1; for (const nm of [base + k + '서', base + ' ' + k + '서', k + base, k + ' ' + base]) if (!(nm in N2)) N2[nm] = n; });
const CH = [50,40,27,36,34,24,21,4,31,24,22,25,29,36,10,13,10,42,150,31,12,8,66,52,5,48,12,14,3,9,1,4,7,3,3,3,2,14,4,28,16,24,21,28,16,16,13,6,6,4,4,5,3,6,4,3,1,13,5,5,3,5,1,1,1,22];
const SHORT = new Set([...BOOKS.map((x) => x[2]), '룻', '욥', '마태', '마가', '누가', '요한', '애가', '아가']);
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const NAMES = Object.keys(N2).sort((a, b) => b.length - a.length).map((n) => (n === '아가' ? '아가(?![가-힣])' : n === '요한' ? '요한(?=[ \\t_]?\\d)(?![ \\t]?[123](?:\\s*[·・,]\\s*[123])+\\s*서)' : /^\d/.test(n) ? '(?<![\\d:：.,\\-~])' + esc(n) + '(?=[ \\t_]?\\d)' : esc(n) + (SHORT.has(n) ? '(?=[ \\t_]?\\d)' : ''))); // '요한1·2·3서'는 요한복음 아님 · '1요한'은 앞이 숫자·구절 기호면 안 됨
const BRE = new RegExp('(?<![가-힣])(' + NAMES.join('|') + ')\\s*(.*)');
const C = (b, c, v) => b * 1e6 + c * 1e3 + v;
// 쉼표로 붙은 절은 연속일 때만 한 범위('3:5, 6' → 3:5-6, '3:5, 8' → 3:5)
const COMMA = /^\s*[,，]\s*(\d{1,3})(?:\s*[-~–—]\s*(\d{1,3}))?(?!\d)(?!\s*[:：장])/;
function extendComma(t, v2) { for (;;) { const m = t.match(COMMA); if (!m || +m[1] !== v2 + 1) return v2; v2 = +(m[2] || m[1]); t = t.slice(m[0].length); } }
function fixRange(s, e) {
  const b = Math.floor(s / 1e6), c = Math.floor(s / 1e3) % 1e3, mx = CH[b - 1] || 150, ce = Math.floor(e / 1e3) % 1e3;
  if (!(c >= 1 && c <= mx) || !(ce >= 1 && ce <= mx)) return null;
  if (e < s && ce < c) return [e, s];
  if (e < s) { const z = ce === c ? e % 1e3 : null; e = (z === c + 1 && c + 1 <= mx) ? C(b, c + 1, 999) : C(b, c, 999); }
  return [s, e];
}
function afterBook(b, r) {
  r = r.trim(); let x;
  if (CH[b - 1] === 1) {
    x = r.match(/^(?:1\s*[:：장]\s*)?(\d{1,3})\s*절?\s*(?:[-~–—]\s*(\d{1,3}))?(?![\d:])/);
    if (x && !/^1\s*장?\s*$/.test(r)) { const v1 = +x[1]; const v2 = extendComma(r.slice(x[0].length), x[2] ? +x[2] : v1); return [C(b, 1, v1), C(b, 1, v2)]; }
  }
  x = r.match(/^(\d{1,3})\s*(?:[:：_]|장\s*_?\s*)\s*(\d{1,3})\s*절?\s*(?:[-~–—]\s*(?:(\d{1,3})\s*[:：.]\s*)?(\d{1,3}))?/);
  if (x) { const c1 = +x[1], v1 = +x[2], c2 = x[3] ? +x[3] : c1; const v2 = extendComma(r.slice(x[0].length), x[4] ? +x[4] : v1); return [C(b, c1, v1), C(b, c2, v2)]; }
  x = r.match(/^(\d{1,3})\s*[-~–]\s*(\d{1,3})\s*장/); if (x) return [C(b, +x[1], 1), C(b, +x[2], 999)];
  x = r.match(/^(\d{1,3})\s*(?:장|편)?(?![\d:])/); if (x && +x[1] <= 150) return [C(b, +x[1], 1), C(b, +x[1], 999)];
  return null;
}
// 본문 표기 → [시작좌표, 끝좌표] (책 이름 필수). 알아볼 수 없으면 null
function parseRef(s) {
  if (s == null) return null; s = String(s).normalize('NFC').trim().replace(/^["'\[\]]+|["'\[\]]+$/g, '');
  const m = s.match(BRE); if (!m) return null; const b = N2[m[1]];
  const r = afterBook(b, m[2]); if (r) return fixRange(r[0], r[1]);
  if (!/\d/.test(m[2])) return [C(b, 0, 0), C(b, 999, 999)];
  return null;
}
function fmtRange(s, e, full) {
  const b = Math.floor(s / 1e6), c1 = Math.floor(s / 1e3) % 1e3, v1 = s % 1e3, c2 = Math.floor(e / 1e3) % 1e3, v2 = e % 1e3;
  const a = full ? (FULL[b] || '?') + ' ' : (AB[b] || '?');
  if (c1 === 0) return a + (full ? '전체' : ' 전체');
  if (v1 === 1 && v2 === 999) return c1 === c2 ? `${a}${c1}장` : `${a}${c1}-${c2}장`;
  if (s === e) return `${a}${c1}:${v1}`;
  return c1 === c2 ? `${a}${c1}:${v1}-${v2}` : `${a}${c1}:${v1}-${c2}:${v2}`;
}
// 범위 너비 단계: 10절 안 / 한 장 안 / 여러 장 / 책 전체. 같은 단계 안에서는 핵심 본문(ref_start·ref_end)이 인용 본문(bible_refs)보다 앞
const widthTier = (w) => (w < 10 ? 0 : w < 1000 ? 1 : w < 998000 ? 2 : 3);
const byFit = (a, b) => widthTier(a.w) - widthTier(b.w) || (b.primary ? 1 : 0) - (a.primary ? 1 : 0) || a.w - b.w || a.s - b.s;
// 설교 날짜 (소장 결정 A-가): 이 순서로 읽고, 값 안에 YYYY-MM-DD(또는 YYYY.MM.DD·YYYYMMDD)가 있는 첫 값을 쓴다
const SERMON_DATE_KEYS = ['설교일', '설교작성일', '일자', 'date', 'sermon_date', '날짜'];
function parseDate(v) {
  for (const x of v == null || v === '' ? [] : Array.isArray(v) ? v : [v]) {
    const t = String(x); const m = t.match(/(\d{4})\s*[-./]\s*(\d{1,2})\s*[-./]\s*(\d{1,2})/) || t.match(/(?<!\d)(\d{4})(\d{2})(\d{2})(?!\d)/);
    if (m && +m[2] >= 1 && +m[2] <= 12 && +m[3] >= 1 && +m[3] <= 31) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  }
  return null;
}
const arr = (v) => (v == null || v === '' ? [] : Array.isArray(v) ? v.filter((x) => x != null && x !== '').map(String) : [String(v)]);
const nfc = (s) => String(s || '').normalize('NFC');
// 관주 JSON 한 절의 글 → [{ s, e, text }]. 줄 머리 '롬 4:25 …'은 그 책, 책 이름 없는 '7:14 …'은 앞줄의 책(앞줄이 없으면 이 책),
// 본문 표기가 없는 줄은 앞 관주 본문이 줄바꿈된 나머지, 책 이름을 못 읽는 줄(깨진 글자)은 버린다
function crossRefsOf(txt, own) {
  const out = []; let book = null;
  for (const line of String(txt || '').split('\n')) {
    const t = line.trim(); if (!t) continue;
    let m = t.match(/^(\S+\s\d+:\d+(?:-\d+)?)\s*(.*)$/);
    if (m && !/^\d/.test(m[1])) { const r = parseRef(m[1]); if (!r) continue; book = Math.floor(r[0] / 1e6); out.push({ s: r[0], e: r[1], text: m[2] }); continue; }
    m = t.match(/^(\d{1,3}):(\d{1,3})(?:-(\d{1,3}))?\s*(.*)$/);
    if (m) { const b = book || own; const r = fixRange(C(b, +m[1], +m[2]), C(b, +m[1], +(m[3] || m[2]))); if (r) out.push({ s: r[0], e: r[1], text: m[4] }); continue; }
    if (out.length) out[out.length - 1].text += ' ' + t;
  }
  return out;
}
// 노트 글 안의 본문 줄 → [[시작, 끝, false]] — '관련 본문: 마 6:22-23, 창 13:10-15', '본문: 욘 1:3, 5'
// 책 이름이 빠진 조각은 앞 조각의 책(·장)을 이어받고, 괄호 설명 '(야라드)'은 버린다
const BODY_REF_LINE = /^[ \t]*(?:[-*>][ \t]*)?\**[ \t]*(?:관련[ \t]*본문|성경[ \t]*본문|핵심[ \t]*본문|참고[ \t]*본문|본문)[ \t]*\**[ \t]*[:：][ \t]*\**(.+)$/gm;
function bodyRefsOf(text) {
  const out = []; let n = 0;
  for (const m of String(text || '').matchAll(BODY_REF_LINE)) {
    if (++n > 20) break;
    let book = null, ch = null;
    for (let seg of m[1].replace(/\([^)]*\)/g, ' ').replace(/[*_`\[\]]/g, ' ').split(/[,;，、·]/)) {
      seg = seg.trim(); if (!seg) continue;
      let r = parseRef(seg);
      if (!r && book && /^\d/.test(seg)) r = parseRef(FULL[book] + ' ' + (/[:：장]/.test(seg) || ch == null ? seg : ch + ':' + seg));
      if (!r) continue;
      book = Math.floor(r[0] / 1e6); ch = Math.floor(r[1] / 1e3) % 1e3;
      if (r[0] % 1e6 !== 0) out.push([r[0], r[1], false]);
    }
  }
  return out;
}
const normKey = (s) => nfc(s).toLowerCase().replace(/[\s_·\-]/g, '');

// ───────────────────────── 기본 설정 ─────────────────────────
// v0.3.0: 볼트마다 폴더 구조가 다르므로 경로·저자 목록을 모두 설정으로 뺐다.
//   profile 'generic' = 새 볼트(누구나), profile 'legacy' = 주명철 pkm 볼트(0.2.x의 동작 그대로)
// 아래 LEGACY_* 상수는 legacy 프로필에서 순서표 노트에 값이 없을 때만 쓴다.
const LEGACY_PRIORITY = {
  '옥스포드': 10, '에메트 주해 성서대전': 15,
  'WBC': 20, '신약의구약사용': 20, '김세윤': 21, '리델보스': 22, '슐라터': 23, '칼빈': 24, '클라우스베스터만': 25,
  'BST': 30, 'NIV 적용주석': 31, '적용주석': 31, '엑스포지멘터리': 32, 'BKC': 33, '현대성서주석': 34, 'LAB': 35,
  '카리스': 40,
  '에더스하임': 50, '메시아1-4': 50, '보젠': 51, '예수 시대의 갈릴래아': 51, '톰라이트': 52,
  'Pulpit_H': 60, '매튜헨리': 61, 'Expositors': 62, 'Ellicott': 63, 'Meyer': 64, '스펄전': 65, '마틴로이드존스': 66, '라일': 67, '캠벨몰간': 68, '아이언사이드': 69, '아더핑크': 70,
  '메인아이디어': 80, '이재철': 81, '옥한흠': 82, '이동원': 83, '하용조': 84, '홍정길': 85,
  '생삶': 90, '기타': 98, '_default': 95,
};
const LEGACY_CHECK = ['WBC', '현대성서주석', '클라우스베스터만', '톰라이트', '아더핑크', 'BKC', 'BST', '윗트니스 리'];
const LEGACY_CHECK_NOTES = {
  'WBC': '권마다 저자 입장이 다르고 비평적 견해가 섞여 있다',
  '현대성서주석': '역사비평 전제가 강하다', '클라우스베스터만': '역사비평 전제가 강하다',
  '톰라이트': '칭의(새 관점), 재림 본문을 주후 70년으로 해석',
  '아더핑크': '이중예정·제한속죄 — 웨슬리안 선행은총·보편속죄와 충돌',
  'BKC': '세대주의 전천년설', 'BST': '성령세례·성결 본문에서 두 번째 축복을 인정하지 않음',
  '윗트니스 리': '지방교회 신학. 인용하지 않는다',
};
const LEGACY_NO_CITE = ['윗트니스 리'];
// 주석이 아니라 단행본인 저자별 폴더 → "도서" 칸
const LEGACY_BOOK_FOLDERS = ['팀 켈러의 방탕한 선지자', '건강한 삶을 위한 최고의 습관', '나를 향한 하나님의 은혜의 추격전', '부르짖음에_응답하시는_하나님', '그리스도인의행위와삶 임시은'];

// pkm 볼트(0.2.x) 설정 — 이미 data.json이 있는데 schema가 없으면 이 값으로 이어받는다
const LEGACY_PROFILE = {
  profile: 'legacy',
  priorityNote: '30-39 Biblical Studies/🧭 패시지 가이드/로고스 바이블에서 배울 점.md',
  sermonFolders: ['50-59 Sermons'],
  illustrationFolder: '60-69 Resources/64 예화자료',
  booksFolder: '60-69 Resources/61 Books',
  extraBookFolders: ['70-79 Books'],
  commentaryMarkers: ['저자별'],
  myNotesMarkers: ['성경주해', '나의 주석', '나의성경주해'],
  origLangMarkers: ['원어연구'],
  devotionalMarkers: ['66 생삶격연', '생삶'],
  devotionalLabel: '🧩 생명의삶 자료',
  researchFolders: ['30-39 Biblical Studies'],
  hiddenFolders: ['00 Meta'],
  skipFolders: ['_logs', '00 Meta/09 Templates', 'scripts', '.trash', '_trash'],
  memoFolderOT: '30-39 Biblical Studies/31 OT Studies/b{nn} {book}/나의 주석',
  memoFolderNT: '30-39 Biblical Studies/32 NT Studies/b{nn} {book}/나의 주석',
  pinnedAuthor: '웨슬리',
  pinnedLabel: '⭐ 신학 점검 칸 — 웨슬리',
  otUseAuthors: ['신약의구약사용'],
  legacyTiers: true,
  refFromFilename: false,
  verseTranslation: '개역개정',
};

const DEFAULT_SETTINGS = {
  schema: 3,
  profile: 'generic',
  priorityNote: '패시지 가이드 순서표.md',
  sermonMode: false,
  followActive: true,
  perAuthor: 4,
  hideMeta: true, // 숨김 폴더(hiddenFolders)의 노트를 가이드에서 숨김
  // ── 볼트 구조 (폴더 이름 규칙) — 설정 화면에서 바꿀 수 있다 ──
  sermonFolders: ['설교'], // 이 폴더 노트 또는 type: 설교 → 🎤 설교
  extraBookFolders: [], // booksFolder 말고도 도서로 볼 폴더
  commentaryMarkers: ['주석', '저자별'], // 경로에 '/주석/저자/…'가 있으면 그 다음 폴더 이름이 저자(주석 이름)
  myNotesMarkers: ['나의 주석', '성경 메모', '성경주해'], // → ✍️ 나의 주석
  origLangMarkers: ['원어연구'], // → 🔤 원어
  devotionalMarkers: ['큐티'], // → 🧩 묵상 자료
  devotionalLabel: '🧩 묵상(QT) 자료',
  researchFolders: ['성경연구'], // → 🗂️ 연구
  hiddenFolders: [], // 숨김 단추로 가릴 폴더 (예: 인박스)
  skipFolders: ['.trash', '_trash', '템플릿', 'Templates'], // 아예 색인하지 않을 폴더
  memoFolderOT: '성경 메모/{nn} {book}', // {nn}=책번호 두 자리, {book}=책 이름, {abbr}=약어
  memoFolderNT: '성경 메모/{nn} {book}',
  pinnedAuthor: '', // 이 이름이 들어간 저자는 순위와 상관없이 맨 위 칸
  pinnedLabel: '⭐ 먼저 볼 주석',
  otUseAuthors: [], // 신약의 구약 사용 주석처럼 🔗 구약 인용 칸으로 보낼 저자
  legacyTiers: false,
  refFromFilename: true, // 본문 속성이 없으면 파일 이름(마10_24-33…, …(삼하 16장5-14절))이나 book·chapter 속성에서 본문을 읽는다
  verseTranslation: '', // 관주에 마우스를 올릴 때 보여 줄 번역본(비우면 켜 둔 첫 번역본)
  // 역본대조
  translationRoot: '성경번역본',
  translations: [
    { key: 'krv1961', label: '개역한글', folder: '개역한글', enabled: true },
    { key: 'kjv', label: 'KJV', folder: 'KJV', enabled: true },
    { key: 'kwanju', label: '관주', folder: '관주', enabled: false, crossref: true },
  ],
  guideTranslations: ['개역한글'], // 패시지 가이드 본문 칸에 펼쳐 보여줄 번역본(나머지는 접음)
  // 예화 탐색기
  illustrationFolder: '예화',
  booksFolder: '도서',
  modalSize: null, modalPos: null,
};
// legacy(pkm) 번역본 목록 — 0.2.x 기본값
const LEGACY_TRANSLATIONS = {
  translationRoot: '30-39 Biblical Studies/35 성경번역본/번역본JSON',
  guideTranslations: ['개역개정'],
  translations: [
    { key: 'krv', label: '개역개정', folder: '개역개정', enabled: true },
    { key: 'standard', label: '표준새번역', folder: '표준새번역', enabled: true },
    { key: 'saehangeul', label: '새한글성경', folder: '새한글성경', enabled: true },
    { key: 'gongdong', label: '공동번역', folder: '공동번역', enabled: true },
    { key: 'modern', label: '현대인의성경', folder: '현대인의성경', enabled: true },
    { key: 'nrsv', label: 'NRSV', folder: 'NRSV', enabled: true },
    { key: 'esv', label: 'ESV', folder: 'ESV', enabled: true },
    { key: 'niv', label: 'NIV', folder: 'NIV', enabled: true },
    { key: 'kwanju', label: '관주', folder: '관주', enabled: true },
    { key: 'krv_strong', label: '개역개정(스트롱)', folder: '개역개정(스트롱)', enabled: false },
  ],
};
// 설정 문자열 목록 다루기
const list = (v) => (Array.isArray(v) ? v : String(v || '').split(',')).map((x) => normalizePath(String(x).trim())).filter((x) => x && x !== '/');
// 경로가 폴더 목록 중 하나 안에 있나 (폴더 이름 앞부분 일치: '30-39'도 '30-39 Biblical Studies/…'에 맞음)
const inFolders = (p, folders) => list(folders).some((f) => p === f || p.startsWith(f + '/') || (/[\d\s]$/.test(f) && p.startsWith(f)));
// 경로 어디엔가 이 이름의 폴더가 있나 ('/나의 주석/')
const hasSeg = (p, names) => { const segs = p.split('/').slice(0, -1); return list(names).some((n) => segs.includes(n) || p.startsWith(n + '/')); };
const isSermonType = (T) => T.some((t) => t === '설교' || t === '설교문' || t === 'sermon');
const isCrossref = (t) => !!(t && (t.crossref || t.folder === '관주' || t.label === '관주'));

// ───────────────────────── 역본대조 (번역본 JSON) ─────────────────────────
function sortedChapterNumbers(ch) { return Object.keys(ch).map(Number).sort((a, b) => a - b); }
function extractVerses(ch, v1, v2) {
  if (!ch) return [];
  if (v1 == null) return sortedChapterNumbers(ch).map((n) => [n, ch[String(n)]]);
  const out = []; const end = v2 || v1;
  for (let v = v1; v <= end; v++) if (ch[String(v)] !== undefined) out.push([v, ch[String(v)]]);
  return out;
}
async function readJson(app, p) {
  try { if (!(await app.vault.adapter.exists(p))) return null; return JSON.parse(await app.vault.adapter.read(p)); } catch (e) { return null; }
}
// [시작좌표, 끝좌표] → 번역본별 { label, text, truncated }
async function lookupRange(app, settings, QS, QE, maxVerses) {
  const b = Math.floor(QS / 1e6); const name = FULL[b]; if (!name) return [];
  const c1 = Math.floor(QS / 1e3) % 1e3, v1 = QS % 1e3, c2 = Math.floor(QE / 1e3) % 1e3, v2 = QE % 1e3;
  const padded = String(b).padStart(2, '0'); const out = [];
  for (const t of settings.translations) {
    if (!t.enabled) continue;
    const data = await readJson(app, normalizePath(`${settings.translationRoot}/${t.folder}/${padded}${name}.json`));
    const chapters = data && data.chapters ? data.chapters : null;
    const lines = []; let truncated = false;
    if (chapters) {
      const cs = c1 === 0 ? [1] : []; for (let c = c1; c <= c2 && c1 > 0; c++) cs.push(c);
      for (const c of cs) {
        const ch = chapters[String(c)]; if (!ch) continue;
        const a = c === c1 && v1 !== 1 ? v1 : 1;
        const z = c === c2 && v2 !== 999 ? v2 : 999;
        for (const [v, txt] of extractVerses(ch, a, z)) {
          if (lines.length >= (maxVerses || 400)) { truncated = true; break; }
          lines.push((cs.length > 1 ? `${c}:` : '') + `${v} ${txt}`);
        }
        if (truncated) break;
      }
    }
    out.push({ label: t.label, text: lines.length ? lines.join('\n') : null, truncated });
  }
  return out;
}

// ───────────────────────── 예화 탐색기 (표준 v1.2) ─────────────────────────
const THEMES = {
  '복음과 구원': ['은혜', '하나님의 사랑', '십자가', '부활', '거듭남', '구원의 확신', '하나님의 자녀', '영접과 결단', '하나님 나라', '예수 그리스도'],
  '죄와 회개': ['죄', '유혹', '욕심', '거짓', '회개', '죄 사함', '양심', '영적 싸움'],
  '믿음과 신뢰': ['믿음의 결단', '의심과 확신', '맡김', '섭리', '기적', '염려와 두려움', '하나님의 약속', '창조주 하나님', '하나님의 성품', '신앙과 세계관', '하나님의 인도와 분별'],
  '성결과 성화': ['성결', '성품 변화', '순종', '정직', '절제', '경건 훈련', '말과 혀', '성숙', '그리스도와의 동행'],
  '성령과 치유': ['성령 충만', '성령의 열매', '은사', '신유', '마음의 상처와 치유', '질병과 건강'],
  '재림과 영생': ['죽음', '천국', '재림', '심판', '영원한 소망', '이별과 장례', '인생의 마지막 준비'],
  '사랑과 화해': ['이웃 사랑', '원수 사랑', '서로 용서', '화해', '관계 회복', '우정', '하나됨', '친절과 배려'],
  '겸손과 섬김': ['겸손', '교만', '섬김', '희생', '나눔과 구제', '충성', '봉사', '헌신'],
  '고난과 위로': ['고난의 의미', '시련 극복', '인내', '위로', '상실과 슬픔', '낙심과 절망', '외로움', '실패와 재기', '기다림'],
  '기도와 예배': ['기도 응답', '끈질긴 기도', '중보기도', '기도의 삶', '예배', '찬양', '감사', '말씀 묵상', '주일과 안식', '헌금과 십일조'],
  '제자도와 사명': ['제자의 길', '소명과 사명', '전도', '선교', '순교와 박해', '용기', '비전', '부흥', '섬기는 리더십'],
  '교회와 가정': ['교회', '성도의 교제', '부부', '자녀교육', '부모 공경', '가정 신앙', '노년', '다음 세대', '목회자', '설교와 말씀 사역'],
  '삶과 지혜': ['지혜', '시간', '물질과 재정', '일과 직장', '청지기', '정의와 공의', '나라와 사회', '정체성과 자존감', '습관', '성공과 실패', '행복과 만족', '창조세계와 환경', '참된 복과 기복'],
};
const STORY_TYPES = ['실화', '인물', '역사', '간증', '우화', '비유', '유머', '시'];
const MATERIAL_TYPES = ['성경배경', '인용', '교훈'];
const TONES = ['감동', '위로', '도전', '경고', '웃음', '깨달음'];
const SEASONS = ['신년', '사순절', '고난주간', '부활절', '어버이주일', '성령강림절', '맥추감사절', '추수감사절', '종교개혁주일', '성탄절', '송년'];
const NON_ILLUSTRATION_TYPES = new Set(['아이디어노트', 'idea', '인용문모음', '예화허브', 'index-note', '예화인덱스', '예화집', 'deprecated', '주석', '설교자료', 'README', '메타노트']);

function usagePointTexts(up) {
  const out = [];
  if (Array.isArray(up)) { for (const it of up) { if (it && typeof it === 'object') for (const [k, v] of Object.entries(it)) out.push(`${k}: ${v}`); else if (typeof it === 'string') out.push(it); } }
  else if (typeof up === 'string' && up) out.push(up);
  return out;
}
function stripFrontmatter(raw) { const m = raw.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/); return m ? raw.slice(m[0].length) : raw; }
function bookNumFromText(s) { const m = nfc(s).trim().match(BRE); return m ? N2[m[1]] : null; }
function normRefLabel(s) { const m = nfc(s).trim().match(BRE); return m ? (FULL[N2[m[1]]] + (m[2] ? ' ' + m[2].trim() : '')).trim() : String(s); }
// 검색어에서 본문 찾기: "마 5", "마태복음 5:3-12", "롬8" → 좌표 범위
function extractRefQuery(query) {
  const m = nfc(query).match(BRE);
  if (!m || !/\d/.test(m[2])) return { range: null, rest: query };
  const range = parseRef(m[0]);
  if (!range) return { range: null, rest: query };
  // 본문 뒤에 붙은 낱말은 검색어로 남긴다
  const tail = m[2].replace(/^[\d\s:：장절편,，\-~–—_.]+/, '');
  return { range, rest: (query.slice(0, m.index) + ' ' + tail).trim() };
}

// ───────────────────────── 공용: 삽입·링크 ─────────────────────────
function insertAtEditor(plugin, text, closeFn) {
  const editor = plugin.getTargetEditor();
  if (!editor) { new Notice('삽입할 노트가 열려 있지 않습니다.'); return false; }
  editor.replaceSelection(text);
  if (closeFn) closeFn(); else new Notice('삽입 완료');
  return true;
}
function linkFor(plugin, file) {
  const from = plugin.getTargetFile(); return plugin.app.fileManager.generateMarkdownLink(file, from ? from.path : '');
}

// ───────────────────────── 패시지 가이드 패널 ─────────────────────────
// 칸 목록 — '점검'(먼저 볼 저자)과 '생삶'(묵상 자료) 칸 이름은 설정에서 온다
function catsFor(s) {
  return [
    ['본문', '📖 본문 (번역본 대조)'], ['점검', s.pinnedLabel || '⭐ 먼저 볼 주석'], ['주석', '📚 주석'], ['구약인용', '🔗 구약 인용 (상호참조)'], ['관주', '🔗 관주 (교차참조)'],
    ['원어', '🔤 원어 연구'], ['주해', '✍️ 나의 주석·성경주해'], ['설교', '🎤 나의 설교·묵상'], ['예화', '💡 예화'],
    ['생삶', s.devotionalLabel || '🧩 묵상 자료'], ['도서', '📘 도서'], ['연구', '🗂️ 성경연구 노트'], ['기타', '📄 그 밖의 자료'], ['책전체', '📕 책 전체를 다루는 자료'],
  ];
}
const OPEN_DEFAULT = new Set(['본문', '점검', '주석', '구약인용', '관주', '주해', '설교', '예화']);
// 맨 위 요약줄의 짧은 이름
const SHORT_LABEL = { 점검: '먼저 볼', 주석: '주석', 구약인용: '구약 인용', 관주: '관주', 원어: '원어', 주해: '나의 주석', 설교: '설교', 예화: '예화', 생삶: '묵상', 도서: '도서', 연구: '연구', 기타: '그 밖', 책전체: '책 전체' };
const shortLabel = (s, key) => (key === '점검' && s.pinnedAuthor ? s.pinnedAuthor : key === '생삶' && s.profile === 'legacy' ? '생삶' : SHORT_LABEL[key]);

// ── 패시지창 링크: 오른쪽 분할의 새 탭에서 열기 (2026-11-02) ──
// 처음 누르면 편집창 오른쪽에 분할을 만들고, 그다음부터는 그 분할 창에 새 탭으로 쌓는다.
// Cmd(Ctrl)+클릭은 지금 탭에서 연다.
function openInSplit(plugin, path, e) {
  const ws = plugin.app.workspace;
  if (e && (e.metaKey || e.ctrlKey)) { ws.openLinkText(path, '', false); return; }
  const file = plugin.app.vault.getAbstractFileByPath(path);
  if (!file) { ws.openLinkText(path, '', 'split'); return; }
  let leaf = null;
  try {
    const prev = plugin._pgSplitLeaf;
    let alive = false;
    if (prev) ws.iterateRootLeaves((l) => { if (l === prev) alive = true; });
    if (alive && prev.parent) {
      leaf = ws.createLeafInParent(prev.parent, (prev.parent.children || []).length);
    } else {
      const base = ws.getMostRecentLeaf(ws.rootSplit);
      leaf = base ? ws.createLeafBySplit(base, 'vertical') : ws.getLeaf('split', 'vertical');
    }
  } catch (_) { leaf = ws.getLeaf('split', 'vertical'); }
  plugin._pgSplitLeaf = leaf;
  leaf.openFile(file, { active: true });
}

class GuidePanel {
  constructor(plugin, root, opts) {
    this.plugin = plugin; this.app = plugin.app; this.opts = opts || {}; this.range = null; this.openState = {};
    this.build(root);
  }
  build(root) {
    root.addClass('pg-panel');
    const head = root.createDiv({ cls: 'pg-head' });
    const row = head.createDiv({ cls: 'pg-input-row' });
    this.inputEl = row.createEl('input', { type: 'text', placeholder: '본문 (예: 마22:15-22, 시23편, 창 1장)' });
    const go = row.createEl('button', { text: '찾기', cls: 'mod-cta' });
    const fromNote = row.createEl('button', { text: '📄' }); fromNote.setAttr('title', '열린 노트의 본문(ref_start·본문·bible_refs·커서 줄)으로');
    const toolRow = head.createDiv({ cls: 'pg-tool-row' });
    const mk = (parent, text, tip, cls) => { const b = parent.createEl('button', { text, cls: 'pg-tool-btn' + (cls ? ' ' + cls : '') }); b.setAttr('title', tip); return b; };
    this.modeBtn = mk(toolRow, '', '연구 모드 ↔ 설교 작성 모드 (순서표의 sermon_first 주석을 앞으로)');
    this.followBtn = mk(toolRow, '', '노트를 바꾸면 그 노트의 본문으로 자동 전환');
    const memoBtn = mk(toolRow, '📝 메모', '이 본문에 고정된 메모 노트를 만들거나 연다 (설정의 메모 폴더)');
    const illBtn = mk(toolRow, '💡 예화 탐색', '예화 탐색기를 이 본문으로 연다');
    this.metaBtn = mk(toolRow, '', '숨김 폴더(설정) 노트를 가이드에 보일지');
    const reBtn = mk(toolRow, '↻', '색인 새로고침');
    this.titleEl = root.createEl('div', { cls: 'pg-title' });
    this.sumEl = root.createDiv({ cls: 'pg-summary' });
    this.bodyEl = root.createDiv({ cls: 'pg-body' });
    this.footEl = root.createEl('div', { cls: 'pg-foot' });

    const run = () => { const r = parseRef(this.inputEl.value); if (!r) { new Notice('본문을 알아볼 수 없습니다. 예: 마22:15-22'); return; } this.show(r); };
    go.addEventListener('click', run);
    this.inputEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') run(); });
    fromNote.addEventListener('click', () => { const r = this.plugin.rangeFromActive(true); if (r) this.show(r); else new Notice('열린 노트에서 본문을 찾지 못했습니다.'); });
    this.modeBtn.addEventListener('click', async () => { this.plugin.settings.sermonMode = !this.plugin.settings.sermonMode; await this.plugin.saveSettings(); this.refreshButtons(); if (this.range) this.show(this.range); });
    this.metaBtn.addEventListener('click', async () => { this.plugin.settings.hideMeta = !this.plugin.settings.hideMeta; await this.plugin.saveSettings(); this.refreshButtons(); if (this.range) this.show(this.range); });
    this.followBtn.addEventListener('click', async () => { this.plugin.settings.followActive = !this.plugin.settings.followActive; await this.plugin.saveSettings(); this.refreshButtons(); });
    memoBtn.addEventListener('click', () => this.range && this.plugin.openMemo(this.range));
    illBtn.addEventListener('click', () => this.plugin.openIllustration(this.range ? fmtRange(this.range[0], this.range[1], true) : ''));
    reBtn.addEventListener('click', () => { this.plugin.buildIndex(); new Notice(`색인 ${this.plugin.index.size}개 · 예화 ${this.plugin.illIndex.size}건`); if (this.range) this.show(this.range); });
    this.refreshButtons();
  }
  refreshButtons() {
    const s = this.plugin.settings;
    this.modeBtn.setText(s.sermonMode ? '✍️ 설교 모드' : '🔎 연구 모드');
    this.modeBtn.toggle(!!(s.legacyTiers || (this.plugin.sermonFirst && this.plugin.sermonFirst.length)));
    this.modeBtn.toggleClass('is-active', !!s.sermonMode);
    this.followBtn.setText(s.followActive ? '📌 따라감' : '📍 고정');
    this.followBtn.toggleClass('is-active', !!s.followActive);
    const hf = list(s.hiddenFolders); const hn = hf.length === 1 ? hf[0] : `숨김 폴더 ${hf.length}`;
    this.metaBtn.setText(s.hideMeta ? `🗂️ ${hn} 숨김` : `🗂️ ${hn} 보임`); this.metaBtn.toggle(hf.length > 0);
    this.metaBtn.toggleClass('is-active', !s.hideMeta);
  }
  setRange(r) { if (r) this.show(r); }

  async show(range) {
    this.range = range; const [QS, QE] = range;
    this.inputEl.value = fmtRange(QS, QE, true);
    const P = this.plugin;
    if (!P.indexReady) { this.bodyEl.empty(); this.bodyEl.createEl('p', { text: '색인을 만드는 중입니다… 잠시 후 다시 눌러 주세요.' }); return; }
    const all = P.collect(QS, QE);
    const hf = list(P.settings.hiddenFolders);
    const hits = P.settings.hideMeta && hf.length ? all.filter((h) => !inFolders(h.path, hf)) : all;
    const CATS = catsFor(P.settings);
    const groups = P.categorize(hits, QS);
    const sermon = P.sermonInfo(groups['설교'] || []); const ills = P.usageInfo(groups['예화'] || []);
    this.illPaths = new Set((groups['예화'] || []).map((h) => h.path));
    this.titleEl.setText(`📖 ${fmtRange(QS, QE)} 패시지 가이드 — 노트 ${hits.length}개`);
    this.bodyEl.empty(); this.sumEl.empty(); this.secEls = {};
    const token = (this.showToken = (this.showToken || 0) + 1);

    for (const [key, label] of CATS) {
      if (key === '본문') { this.renderTranslations(QS, QE, token); continue; }
      if (key === '관주') { this.renderCrossRefs(QS, QE, token); continue; }
      const items = groups[key] || [];
      if (!items.length) continue;
      if (key === '주석') this.renderCommentary(items, label);
      else if (key === '설교') this.renderList(key, `${label} — ${sermon.label}`, items);
      else this.renderList(key, label, items);
    }
    for (const [key] of CATS) {
      if (key === '본문') continue;
      if (key === '관주') { this.sumChip('관주', null); continue; } // 관주 수는 관주 JSON을 읽은 뒤 채움
      const n = (groups[key] || []).length; if (!n) continue;
      this.sumChip(key, key === '설교' ? `설교 ${n}${sermon.last ? ` (마지막 ${sermon.last})` : ''}` : key === '예화' ? `예화 ${n} (안 쓴 ${ills.unused})` : `${shortLabel(P.settings, key)} ${n}`);
    }
    const ill = (groups['예화'] || []).length; const hidden = all.length - hits.length;
    this.footEl.setText(`좁은 범위(본문에 가까운 자료)부터 · ref_*와 bible_refs를 함께 읽음 · 예화 ${ill}건${hidden ? ` · 숨김 폴더 ${hidden}개 숨김` : ''}${P.settings.sermonMode ? ' · 설교 작성 모드' : ''}`);
    if (!all.length) {
      const tip = this.bodyEl.createDiv({ cls: 'pg-hint pg-empty-tip' });
      tip.createEl('p', { text: '이 본문에 좌표가 찍힌 노트가 아직 없습니다.' });
      tip.createEl('p', { text: '노트 속성에 「본문: 마 22:15-22」처럼 적거나, 명령 「이 노트에 본문 좌표 넣기」를 쓰면 여기 모입니다. 처음이면 명령 「패시지 가이드 시작하기」로 예시 폴더와 노트를 만들어 보세요.' });
    }
  }

  // 맨 위 요약줄 한 칸: 누르면 그 칸을 펼치고 그리로 간다 (text가 null이면 자리만 잡아 두고 나중에 채움)
  sumChip(key, text) {
    let chip = this.sumEl.querySelector(`[data-key="${key}"]`);
    if (!chip) { chip = this.sumEl.createEl('a', { cls: 'pg-sum-chip' }); chip.setAttr('data-key', key); chip.addEventListener('click', (e) => { e.preventDefault(); const det = this.secEls[key]; if (det) { det.setAttr('open', ''); det.scrollIntoView({ block: 'start' }); } }); }
    if (text == null) { chip.hide(); return; }
    chip.setText(text); chip.show();
  }

  section(key, label, count, extraEl) {
    const det = this.bodyEl.createEl('details', { cls: 'pg-sec pg-sec-' + key }); this.secEls[key] = det;
    const open = key in this.openState ? this.openState[key] : OPEN_DEFAULT.has(key);
    if (open) det.setAttr('open', '');
    det.addEventListener('toggle', () => { this.openState[key] = det.open; });
    const sum = det.createEl('summary');
    sum.createSpan({ text: label, cls: 'pg-sec-label' });
    if (count != null) sum.createSpan({ text: String(count), cls: 'pg-count' });
    return det;
  }

  itemRow(parent, h, opts) {
    const row = parent.createDiv({ cls: 'pg-item' });
    const a = row.createEl('a', { text: h.title, cls: 'pg-link' });
    a.setAttr('title', h.path);
    a.addEventListener('click', (e) => { e.preventDefault(); openInSplit(this.plugin, h.file.path, e); });
    row.createSpan({ text: fmtRange(h.s, h.e), cls: 'pg-range' });
    if (h.date !== undefined) row.createSpan({ text: h.date || '날짜 미상', cls: 'pg-date' });
    if (h.usedBy && h.usedBy.length) { const u = row.createSpan({ text: `사용됨 ${h.usedBy.length}`, cls: 'pg-used' }); u.setAttr('title', h.usedBy.join('\n')); }
    const lay = row.createSpan({ text: h.primary ? '핵심' : '인용', cls: 'pg-layer ' + (h.primary ? 'pg-layer-core' : 'pg-layer-cite') });
    lay.setAttr('title', h.primary ? '이 노트의 핵심 본문(ref_start·ref_end)과 겹침' : '이 노트가 인용한 본문(bible_refs 등)과 겹침');
    if (h.core) { const c = row.createDiv({ text: h.core.length > 90 ? h.core.slice(0, 90) + '…' : h.core, cls: 'pg-core' }); c.setAttr('title', h.core); }
    const acts = row.createSpan({ cls: 'pg-acts' });
    const lk = acts.createEl('button', { text: '🔗', cls: 'pg-mini' }); lk.setAttr('title', '링크 삽입');
    lk.addEventListener('click', () => insertAtEditor(this.plugin, linkFor(this.plugin, h.file) + ' '));
    if (opts && opts.body) {
      const bd = acts.createEl('button', { text: '📄', cls: 'pg-mini' }); bd.setAttr('title', '본문 삽입 (프론트매터 제외)');
      bd.addEventListener('click', async () => { const raw = await this.app.vault.cachedRead(h.file); insertAtEditor(this.plugin, stripFrontmatter(raw).trim() + '\n'); });
    }
    return row;
  }

  renderList(key, label, items) {
    const det = this.section(key, label, items.length);
    const box = det.createDiv({ cls: 'pg-list' });
    const LIMIT = 30; let shown = 0;
    const more = () => {
      for (const h of items.slice(shown, shown + LIMIT)) this.itemRow(box, h, { body: key === '예화' || key === '생삶' || key === '주해' });
      shown = Math.min(items.length, shown + LIMIT);
      det.querySelectorAll('.pg-more').forEach((b) => b.remove());
      if (shown < items.length) { const b = det.createEl('button', { text: `더 보기 (${items.length - shown}개 남음)`, cls: 'pg-more' }); b.addEventListener('click', more); }
    };
    more();
    if (key === '예화') {
      const b = det.createEl('button', { text: '💡 주제·유형으로 더 찾기 →', cls: 'pg-more' });
      b.addEventListener('click', () => this.plugin.openIllustration(this.range ? fmtRange(this.range[0], this.range[1], true) : ''));
    }
    if (key === '주해' || key === '설교') {
      const b = det.createEl('button', { text: '📝 이 본문에 메모 추가', cls: 'pg-more' });
      b.addEventListener('click', () => this.plugin.openMemo(this.range));
    }
  }

  renderCommentary(items, label) {
    const P = this.plugin;
    const byA = new Map();
    for (const h of items) { if (!byA.has(h.author)) byA.set(h.author, []); byA.get(h.author).push(h); }
    const authors = Array.from(byA.keys()).sort((a, b) => P.rankOf(a) - P.rankOf(b) || Math.min(...byA.get(a).map((h) => h.w)) - Math.min(...byA.get(b).map((h) => h.w)) || a.localeCompare(b, 'ko'));
    const det = this.section('주석', `${label} — 저자 ${authors.length}, ${items.length}편`, null);
    det.createDiv({ text: '우선순위 서재 순 (설교 준비에서 먼저 펼칠 책부터). ⚠ = 걸러 읽을 저자', cls: 'pg-hint' });
    const list = det.createDiv({ cls: 'pg-authors' });
    for (const a of authors) {
      const xs = byA.get(a).sort(byFit);
      const row = list.createDiv({ cls: 'pg-author' + (P.noCite.includes(a) ? ' pg-nocite' : '') });
      const nm = row.createSpan({ text: a, cls: 'pg-author-name' });
      nm.setAttr('title', `우선순위 ${P.rankOf(a)}`);
      const chk = P.checkNoteOf(a);
      if (chk) { const w = row.createSpan({ text: '⚠', cls: 'pg-warn' }); w.setAttr('title', chk); }
      const links = row.createDiv({ cls: 'pg-author-links' });
      const n = Math.max(1, P.settings.perAuthor || 4);
      const renderLinks = (upto) => {
        links.empty();
        xs.slice(0, upto).forEach((h) => {
          const l = links.createEl('a', { text: fmtRange(h.s, h.e), cls: 'pg-alink' }); l.setAttr('title', h.title + '\n' + h.path + (h.primary ? '' : '\n(인용 본문으로 겹침)'));
          l.addEventListener('click', (e) => { e.preventDefault(); openInSplit(this.plugin, h.file.path, e); });
          if (!h.primary) links.createSpan({ text: '인용', cls: 'pg-layer pg-layer-cite' });
          const ins = links.createEl('button', { text: '🔗', cls: 'pg-mini pg-mini-inline' }); ins.setAttr('title', '링크 삽입: ' + h.title);
          ins.addEventListener('click', () => insertAtEditor(this.plugin, linkFor(this.plugin, h.file) + ' '));
        });
        if (xs.length > upto) { const m = links.createEl('a', { text: `외 ${xs.length - upto}`, cls: 'pg-alink pg-more-inline' }); m.addEventListener('click', (e) => { e.preventDefault(); renderLinks(xs.length); }); }
      };
      renderLinks(n);
    }
  }

  // 🔗 관주: 관주 JSON(책마다 처음 볼 때 한 번 읽음)에서 이 본문 절들의 교차참조. 누르면 역본대조, 마우스를 올리면 개역개정 본문
  async renderCrossRefs(QS, QE, token) {
    if (QS % 1e6 === 0) return; // 책 전체 본문에는 관주를 보이지 않는다
    const det = this.section('관주', '🔗 관주 (교차참조)', null);
    const box = det.createDiv({ cls: 'pg-list' }); box.createEl('p', { text: '불러오는 중…', cls: 'pg-hint' });
    const P = this.plugin; const b = Math.floor(QS / 1e6);
    const xt = P.settings.translations.find(isCrossref);
    const data = xt ? await P.bookJson(xt.folder, b) : null;
    if (token !== this.showToken) return;
    box.empty();
    const rows = [];
    const chapters = (data && data.chapters) || {};
    for (let c = Math.floor(QS / 1e3) % 1e3; c <= Math.floor(QE / 1e3) % 1e3; c++) {
      const ch = chapters[String(c)]; if (!ch) continue;
      for (const v of sortedChapterNumbers(ch)) { const at = C(b, c, v); if (at < QS || at > QE) continue; const refs = crossRefsOf(ch[String(v)], b); if (refs.length) rows.push([c, v, refs]); }
    }
    const n = rows.reduce((a, r) => a + r[2].length, 0);
    if (!n) { det.remove(); delete this.secEls['관주']; return; }
    det.querySelector('summary').createSpan({ text: String(n), cls: 'pg-count' });
    this.sumChip('관주', `관주 ${n}`);
    const LIMIT = 40; let shown = 0;
    const more = () => {
      for (const [c, v, refs] of rows.slice(shown, shown + LIMIT)) {
        const row = box.createDiv({ cls: 'pg-item pg-xref' });
        row.createSpan({ text: `${c}:${v}`, cls: 'pg-range' });
        refs.forEach((x) => {
          const a = row.createEl('a', { text: fmtRange(x.s, x.e), cls: 'pg-alink' });
          a.setAttr('title', x.text);
          a.addEventListener('mouseenter', async () => { const t = await P.verseText(x.s, x.e); if (t) a.setAttr('title', t); }, { once: true });
          a.addEventListener('click', (e) => { e.preventDefault(); P.openGuide([x.s, x.e]); });
        });
      }
      shown = Math.min(rows.length, shown + LIMIT);
      det.querySelectorAll('.pg-more').forEach((x) => x.remove());
      if (shown < rows.length) { const m = det.createEl('button', { text: `더 보기 (${rows.length - shown}절 남음)`, cls: 'pg-more' }); m.addEventListener('click', more); }
    };
    more();
  }

  async renderTranslations(QS, QE, token) {
    const det = this.section('본문', '📖 본문 (번역본 대조)', null);
    const holder = det.createDiv({ cls: 'pg-trans' });
    holder.createEl('p', { text: '불러오는 중…', cls: 'pg-hint' });
    const results = await lookupRange(this.app, this.plugin.settings, QS, QE, 400);
    if (token !== this.showToken) return;
    holder.empty();
    if (!results.length) { holder.createEl('p', { text: '설정에서 번역본을 하나 이상 켜 주세요.', cls: 'pg-hint' }); return; }
    const refLabel = fmtRange(QS, QE, true);
    const expand = new Set((this.plugin.settings.guideTranslations || []).map(nfc));
    for (const r of results) {
      const d = holder.createEl('details', { cls: 'pg-tr' });
      if (expand.has(nfc(r.label))) d.setAttr('open', '');
      const s = d.createEl('summary'); s.createSpan({ text: r.label, cls: 'pg-tr-label' });
      if (r.text) {
        const ins = s.createEl('button', { text: '📄 삽입', cls: 'pg-mini' }); ins.setAttr('title', '번역본 표기와 함께 노트에 삽입');
        ins.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); insertAtEditor(this.plugin, `**${r.label}** (${refLabel})\n${r.text}\n`); });
      }
      d.createEl('div', { text: r.text || '— 본문 없음 —', cls: 'pg-tr-body' });
      if (r.truncated) d.createEl('div', { text: '… (긴 범위라 앞부분만 보여줍니다)', cls: 'pg-hint' });
    }
  }
}

class GuideView extends ItemView {
  constructor(leaf, plugin) { super(leaf); this.plugin = plugin; }
  getViewType() { return GUIDE_VIEW; }
  getDisplayText() { return '패시지 가이드'; }
  getIcon() { return 'compass'; }
  async onOpen() {
    const c = this.contentEl; c.empty(); c.addClass('pg-view');
    this.panel = new GuidePanel(this.plugin, c, {});
    const r = this.plugin.pendingRange || this.plugin.rangeFromActive(false);
    this.plugin.pendingRange = null;
    if (r) this.panel.show(r);
  }
  async onClose() { this.contentEl.empty(); }
}

class GuideModal extends Modal {
  constructor(plugin, range) { super(plugin.app); this.plugin = plugin; this.range = range; }
  onOpen() {
    const { contentEl, modalEl } = this; contentEl.empty(); modalEl.addClass('pg-modal-shell'); contentEl.addClass('pg-modal');
    this.panel = new GuidePanel(this.plugin, contentEl, {});
    if (this.range) this.panel.show(this.range);
  }
  onClose() { this.contentEl.empty(); }
}

// ───────────────────────── 예화 탐색 모달 ─────────────────────────
class IllustrationModal extends Modal {
  constructor(plugin, initialQuery) { super(plugin.app); this.plugin = plugin; this.initialQuery = initialQuery || ''; this.shown = 40; this.results = []; }
  addSelect(parent, placeholder) { const sel = parent.createEl('select'); sel.createEl('option', { text: placeholder, value: '' }); return sel; }
  onOpen() {
    const { contentEl } = this; const P = this.plugin; contentEl.empty(); contentEl.addClass('sif-modal'); this.modalEl.addClass('sif-modal-wide');
    contentEl.createEl('h3', { text: '예화 탐색' });
    const row1 = contentEl.createDiv({ cls: 'sif-filter-row' });
    this.inputEl = row1.createEl('input', { type: 'text', placeholder: '검색어 (주제·키워드·핵심 문장·본문 예: 마 5, 로마서 8:28)' });
    this.inputEl.value = this.initialQuery;
    const fromNoteBtn = row1.createEl('button', { text: '지금 노트 본문으로' }); fromNoteBtn.setAttr('title', '열린 노트의 bible_refs·bible_book과 큰 주제로 찾습니다');
    const searchBtn = row1.createEl('button', { text: '찾기', cls: 'mod-cta' });

    const row2 = contentEl.createDiv({ cls: 'sif-filter-row sif-filter-wrap' });
    this.themeSelect = this.addSelect(row2, '큰 주제 전체');
    for (const th of Object.keys(THEMES)) this.themeSelect.createEl('option', { text: `${th} (${P.counts.theme.get(th) || 0})`, value: th });
    this.topicSelect = this.addSelect(row2, '주제 전체'); this.fillTopics('');
    this.typeSelect = this.addSelect(row2, '유형 전체');
    this.typeSelect.createEl('option', { text: '— 이야기만', value: '@이야기' }); this.typeSelect.createEl('option', { text: '— 자료만', value: '@자료' });
    const addTypeGroup = (label, list) => { const g = this.typeSelect.createEl('optgroup'); g.setAttr('label', label); for (const t of list) { const c = P.counts.type.get(t) || 0; if (c) g.createEl('option', { text: `${t} (${c})`, value: t }); } };
    addTypeGroup('이야기', STORY_TYPES); addTypeGroup('자료', MATERIAL_TYPES);
    const others = Array.from(P.counts.type.keys()).filter((t) => !STORY_TYPES.includes(t) && !MATERIAL_TYPES.includes(t)).sort();
    if (others.length) addTypeGroup('기타(표준 밖)', others);
    this.toneSelect = null;
    if (TONES.some((t) => P.counts.tone.get(t))) { this.toneSelect = this.addSelect(row2, '분위기 전체'); for (const t of TONES) { const c = P.counts.tone.get(t) || 0; if (c) this.toneSelect.createEl('option', { text: `${t} (${c})`, value: t }); } }

    const row3 = contentEl.createDiv({ cls: 'sif-filter-row sif-filter-wrap' });
    this.audienceSelect = this.addSelect(row3, '대상 전체');
    const audGroups = new Map();
    for (const [a, c] of P.counts.audience.entries()) { if (a === '전체') continue; const g = a.includes('/') ? a.split('/')[0] : '기타'; if (!audGroups.has(g)) audGroups.set(g, []); audGroups.get(g).push([a, c]); }
    for (const g of ['연령', '신앙', '상황', '자리', '기타']) {
      const list = (audGroups.get(g) || []).filter(([, c]) => c >= (g === '기타' ? 5 : 1)).sort((x, y) => y[1] - x[1]); if (!list.length) continue;
      const og = this.audienceSelect.createEl('optgroup'); og.setAttr('label', g);
      for (const [a, c] of list.slice(0, 25)) og.createEl('option', { text: `${a.replace(/^[^/]+\//, '')} (${c})`, value: a });
    }
    this.seasonSelect = this.addSelect(row3, '절기 전체');
    for (const s of SEASONS) { const c = P.counts.season.get(s) || 0; if (c) this.seasonSelect.createEl('option', { text: `${s} (${c})`, value: s }); }
    this.sourceSelect = this.addSelect(row3, '출처 전체');
    for (const [v, label] of [['예화자료', '예화자료 폴더'], ['책예화', '책 예화 (04)'], ['책인용', '책 인용문 (05)']]) this.sourceSelect.createEl('option', { text: `${label} (${P.counts.source.get(v) || 0})`, value: v });
    const cautionLabel = row3.createEl('label', { cls: 'sif-check' }); this.cautionCheck = cautionLabel.createEl('input', { type: 'checkbox' }); cautionLabel.appendText(' 주의 표시 빼기');

    this.countEl = contentEl.createEl('p', { cls: 'sif-count' }); this.resultsEl = contentEl.createDiv({ cls: 'sif-results' });
    const run = () => { this.shown = 40; this.runSearch(); };
    searchBtn.addEventListener('click', run); this.inputEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') run(); });
    this.themeSelect.addEventListener('change', () => { this.fillTopics(this.themeSelect.value); run(); });
    for (const s of [this.topicSelect, this.typeSelect, this.toneSelect, this.audienceSelect, this.seasonSelect, this.sourceSelect, this.cautionCheck]) if (s) s.addEventListener('change', run);
    fromNoteBtn.addEventListener('click', () => this.fillFromActiveNote());
    if (this.inputEl.value) run(); else this.inputEl.focus();
  }
  fillTopics(theme) {
    const P = this.plugin; const sel = this.topicSelect; const keep = sel.value;
    sel.querySelectorAll('optgroup').forEach((g) => g.remove());
    for (const th of theme ? [theme] : Object.keys(THEMES)) { const g = sel.createEl('optgroup'); g.setAttr('label', th); for (const tp of THEMES[th]) g.createEl('option', { text: `${tp} (${P.counts.topic.get(tp) || 0})`, value: tp }); }
    sel.value = keep && Array.from(sel.options).some((o) => o.value === keep) ? keep : '';
  }
  fillFromActiveNote() {
    const file = this.app.workspace.getActiveFile(); if (!file) { new Notice('열린 노트가 없습니다.'); return; }
    const fm = (this.app.metadataCache.getFileCache(file) || {}).frontmatter || {};
    const r = this.plugin.rangeFromFrontmatter(fm);
    let q = r ? fmtRange(r[0], r[1], true) : '';
    if (!q && fm.bible_book) { const n = bookNumFromText(fm.bible_book); if (n) q = FULL[n]; }
    const theme = arr(fm.theme).find((t) => THEMES[t]);
    if (!q && !theme) { new Notice('이 노트에는 본문(ref_start·bible_refs·bible_book)이나 큰 주제(theme)가 없습니다.'); return; }
    this.inputEl.value = q; this.themeSelect.value = theme || ''; this.fillTopics(this.themeSelect.value); this.shown = 40; this.runSearch();
  }
  runSearch() {
    const f = { theme: this.themeSelect.value, topic: this.topicSelect.value, type: this.typeSelect.value, tone: this.toneSelect ? this.toneSelect.value : '', audience: this.audienceSelect.value, season: this.seasonSelect.value, source: this.sourceSelect.value, noCaution: this.cautionCheck.checked };
    const results = this.plugin.searchIllustrations(this.inputEl.value, f);
    this.resultsEl.empty();
    if (results === null) { this.results = []; this.countEl.setText('검색어를 넣거나 거르기를 하나 이상 고르세요.'); return; }
    this.results = results; this.countEl.setText(results.length === 0 ? '검색 결과가 없습니다.' : `${results.length}건`); this.renderSome();
  }
  renderSome() {
    this.resultsEl.querySelectorAll('.sif-more').forEach((el) => el.remove());
    const from = this.resultsEl.querySelectorAll('.sif-card').length;
    for (const r of this.results.slice(from, this.shown)) this.renderCard(r);
    if (this.results.length > this.shown) { const more = this.resultsEl.createEl('button', { text: `더 보기 (${this.results.length - this.shown}건 남음)`, cls: 'sif-more' }); more.addEventListener('click', () => { this.shown += 40; this.renderSome(); }); }
  }
  renderCard(r) {
    const { entry } = r; const card = this.resultsEl.createDiv({ cls: 'sif-card' });
    const titleRow = card.createDiv({ cls: 'sif-title-row' });
    const titleEl = titleRow.createEl('span', { text: entry.title, cls: 'sif-title' }); titleEl.setAttr('title', '클릭하면 [[링크]]를 삽입합니다');
    if (r.usedBy.length) { const u = titleRow.createSpan({ text: `사용됨 ${r.usedBy.length}`, cls: 'pg-used' }); u.setAttr('title', r.usedBy.join('\n')); }
    titleEl.addEventListener('click', () => this.insertLink(entry));
    if (entry.core_message) card.createDiv({ text: entry.core_message, cls: 'sif-core' });
    const metaEl = card.createDiv({ cls: 'sif-meta' });
    if (entry.ref_labels.length) metaEl.createEl('span', { text: '📖 ' + entry.ref_labels.slice(0, 3).join(', '), cls: 'sif-chip' }); // 핵심 본문이 맨 앞
    if (entry.theme) metaEl.createEl('span', { text: entry.theme, cls: 'sif-chip sif-chip-theme' });
    if (entry.type) metaEl.createEl('span', { text: entry.type, cls: 'sif-chip' });
    for (const t of entry.tone) metaEl.createEl('span', { text: t, cls: 'sif-chip' });
    for (const s of entry.season) metaEl.createEl('span', { text: '📅 ' + s, cls: 'sif-chip' });
    for (const a of entry.audience.filter((x) => x !== '전체').slice(0, 3)) metaEl.createEl('span', { text: a.replace(/^[^/]+\//, ''), cls: 'sif-chip sif-chip-audience' });
    for (const c of entry.caution.slice(0, 2)) { const chip = metaEl.createEl('span', { text: '⚠ ' + (c.length > 14 ? c.slice(0, 14) + '…' : c), cls: 'sif-chip sif-chip-warn' }); chip.setAttr('title', c); }
    if (entry.book) metaEl.createEl('span', { text: '📚 ' + entry.book, cls: 'sif-chip' });
    if (entry.topics.length) card.createDiv({ text: '주제: ' + entry.topics.join(', '), cls: 'sif-topics' });
    const upTexts = r.upTexts && r.upTexts.length ? r.upTexts : usagePointTexts(entry.usage_points);
    for (const up of upTexts.slice(0, 3)) { const upRow = card.createDiv({ cls: 'sif-usage' }); upRow.createSpan({ text: '· ' + up }); const btn = upRow.createEl('button', { text: '삽입', cls: 'sif-mini-btn' }); btn.addEventListener('click', () => this.insertText(up)); }
    const actionRow = card.createDiv({ cls: 'sif-actions' });
    actionRow.createEl('button', { text: '링크 삽입' }).addEventListener('click', () => this.insertLink(entry));
    actionRow.createEl('button', { text: '본문 삽입' }).addEventListener('click', () => this.insertBody(entry));
    actionRow.createEl('button', { text: '열기' }).addEventListener('click', () => { openInSplit(this.plugin, entry.file.path, null); this.close(); });
  }
  insertLink(entry) { this.insertText(linkFor(this.plugin, entry.file)); }
  async insertBody(entry) { const raw = await this.app.vault.cachedRead(entry.file); this.insertText(stripFrontmatter(raw).trim()); }
  insertText(text) { insertAtEditor(this.plugin, text, () => this.close()); }
  onClose() { this.contentEl.empty(); }
}

// ───────────────────────── 설정 화면 ─────────────────────────
class PGSettingTab extends PluginSettingTab {
  constructor(app, plugin) { super(app, plugin); this.plugin = plugin; }
  display() {
    const { containerEl } = this; const P = this.plugin; const S = P.settings; containerEl.empty();
    containerEl.createEl('h2', { text: '패시지 가이드 설정' });
    const save = async (reindex) => { await P.saveSettings(); if (reindex) P.scheduleIndex(); };
    const txt = (name, desc, key, reindex, ph) => new Setting(containerEl).setName(name).setDesc(desc || '').addText((t) => { t.setValue(S[key] || ''); if (ph) t.setPlaceholder(ph); t.onChange(async (v) => { S[key] = v.trim(); await save(reindex); }); });
    const lst = (name, desc, key, reindex) => new Setting(containerEl).setName(name).setDesc((desc ? desc + ' ' : '') + '쉼표로 구분.').addText((t) => t.setValue(list(S[key]).join(', ')).onChange(async (v) => { S[key] = list(v); await save(reindex); }));

    const top = new Setting(containerEl).setName('처음 쓰시나요?').setDesc('명령 「패시지 가이드 시작하기」와 같습니다. 아래 폴더 설정대로 폴더·순서표·예시 노트 3개를 만들고(있는 파일은 건드리지 않음), 볼트 안의 번역본 JSON을 찾아 연결합니다.');
    top.addButton((b) => b.setButtonText('시작하기').setCta().onClick(async () => { await P.runSetup(); this.display(); }));
    containerEl.createEl('p', { text: `지금 상태: ${S.profile === 'legacy' ? 'pkm 볼트 설정(0.2.x 이어받음)' : '일반 볼트 설정'} · 색인 노트 ${P.index.size}개 · 예화 ${P.illIndex.size}건 · 순서표 주석 ${Object.keys(P.priority).filter((k) => !k.startsWith('_')).length}개`, cls: 'setting-item-description' });

    containerEl.createEl('h3', { text: '볼트 구조 — 어떤 폴더를 어느 칸에 모을지' });
    containerEl.createEl('p', { text: '노트는 본문 좌표(속성 ref_start·ref_end 또는 본문·bible_refs)가 있어야 가이드에 나옵니다. 폴더 이름 대신 노트 속성 type(설교·예화·주석·나의주석·도서·원어·큐티)으로도 칸이 정해집니다.', cls: 'setting-item-description' });
    lst('🎤 설교 폴더', '이 폴더 노트 또는 type: 설교.', 'sermonFolders', true);
    lst('📚 주석 표시 폴더 이름', "경로에 이 이름의 폴더가 있으면 그 바로 아래 폴더 이름을 주석 이름으로 봅니다. 예: 주석/WBC/마태복음/… → WBC. (속성 commentary 로도 지정 가능)", 'commentaryMarkers', true);
    lst('✍️ 나의 주석 폴더 이름', '경로 어디에든 이 이름의 폴더가 있으면 나의 주석 칸.', 'myNotesMarkers', true);
    lst('🔤 원어 연구 폴더 이름', '', 'origLangMarkers', true);
    txt('📘 도서(책) 폴더', '책마다 04 예화 · 05 인용문 폴더가 있으면 예화 탐색기에서도 찾습니다.', 'booksFolder', true);
    lst('📘 그 밖의 도서 폴더', '', 'extraBookFolders', true);
    lst('🧩 묵상 자료 폴더 이름', '', 'devotionalMarkers', true);
    txt('🧩 묵상 칸 이름', '', 'devotionalLabel', false);
    lst('🗂️ 성경연구 폴더', '', 'researchFolders', true);
    lst('숨김 폴더', '가이드의 🗂️ 단추로 숨기거나 보일 폴더(예: 인박스).', 'hiddenFolders', false);
    lst('색인하지 않을 폴더', '템플릿 폴더 등.', 'skipFolders', true);
    txt('📝 메모 폴더 (구약)', '{nn}=책 번호 두 자리, {book}=책 이름, {abbr}=약어. 예: 성경 메모/{nn} {book}', 'memoFolderOT', false);
    txt('📝 메모 폴더 (신약)', '', 'memoFolderNT', false);

    containerEl.createEl('h3', { text: '우선순위 서재 (주석 순서)' });
    new Setting(containerEl).setName('순서표 노트').setDesc('이 노트의 ```yaml 블록을 읽어 주석 순서·⚠ 점검·설교 모드 순서를 정합니다. 없으면 「시작하기」가 예시로 만들어 줍니다. 비워 두면 가나다순.')
      .addText((t) => t.setValue(S.priorityNote).onChange(async (v) => { S.priorityNote = v.trim(); await P.saveSettings(); P.loadPriority(); }));
    txt('먼저 볼 저자', '이 이름이 들어간 주석은 순서와 상관없이 맨 위 별도 칸에 둡니다(예: 자기 교단의 신학자). 비우면 칸이 없습니다.', 'pinnedAuthor', true);
    txt('그 칸 이름', '', 'pinnedLabel', false);
    lst('🔗 구약 인용 칸으로 보낼 주석', '예: 신약의구약사용', 'otUseAuthors', false);
    new Setting(containerEl).setName('설교 작성 모드').setDesc('순서표의 sermon_first 주석을 맨 앞으로 올립니다.')
      .addToggle((t) => t.setValue(S.sermonMode).onChange(async (v) => { S.sermonMode = v; await P.saveSettings(); }));
    new Setting(containerEl).setName('노트 따라가기').setDesc('열린 노트가 바뀌면 그 노트의 본문으로 가이드를 자동 전환합니다.')
      .addToggle((t) => t.setValue(S.followActive).onChange(async (v) => { S.followActive = v; await P.saveSettings(); }));
    new Setting(containerEl).setName('주석마다 먼저 보여줄 노트 수').addSlider((s) => s.setLimits(1, 10, 1).setValue(S.perAuthor).setDynamicTooltip().onChange(async (v) => { S.perAuthor = v; await P.saveSettings(); }));

    containerEl.createEl('h3', { text: '번역본 (본문 칸에 표시)' });
    containerEl.createEl('p', { text: '플러그인에는 성경 본문이 들어 있지 않습니다. <루트>/<번역본 폴더>/01창세기.json … 66요한계시록.json 꼴의 JSON({"chapters":{"1":{"1":"태초에…"}}})을 볼트에 넣으세요. 저작권이 끝난 번역본(개역한글·KJV 등)이나 정품으로 가진 자료만 쓰십시오.', cls: 'setting-item-description' });
    new Setting(containerEl).setName('번역본 JSON 루트 폴더').addText((t) => t.setValue(S.translationRoot).onChange(async (v) => { S.translationRoot = v.trim(); P.jsonCache = new Map(); await P.saveSettings(); }))
      .addButton((b) => b.setButtonText('볼트에서 자동 찾기').onClick(async () => { const f = P.detectTranslations(); if (!f) { new Notice('볼트에서 01창세기.json 꼴의 번역본 파일을 찾지 못했습니다.'); return; } await P.applyDetectedTranslations(f); new Notice(`${f.root} — 번역본 ${f.folders.length}개: ${f.folders.join(', ')}`); this.display(); }));
    new Setting(containerEl).setName('가이드에서 펼쳐 보여줄 번역본').setDesc('쉼표로 구분. 나머지 번역본은 접힌 채 표시됩니다.')
      .addText((t) => t.setValue((S.guideTranslations || []).join(', ')).onChange(async (v) => { S.guideTranslations = v.split(',').map((x) => x.trim()).filter(Boolean); await P.saveSettings(); }));
    txt('관주에 마우스를 올릴 때 보일 번역본', '비우면 켜 둔 첫 번역본.', 'verseTranslation', false);
    const trs = S.translations;
    trs.forEach((t, idx) => {
      const st = new Setting(containerEl).setName(t.label + (isCrossref(t) ? ' (관주)' : '')).setDesc(`폴더: ${t.folder}`);
      st.addExtraButton((b) => b.setIcon('arrow-up').setTooltip('위로').setDisabled(idx === 0).onClick(async () => { if (!idx) return; [trs[idx - 1], trs[idx]] = [trs[idx], trs[idx - 1]]; await P.saveSettings(); this.display(); }));
      st.addExtraButton((b) => b.setIcon('arrow-down').setTooltip('아래로').setDisabled(idx === trs.length - 1).onClick(async () => { if (idx === trs.length - 1) return; [trs[idx + 1], trs[idx]] = [trs[idx], trs[idx + 1]]; await P.saveSettings(); this.display(); }));
      st.addToggle((tg) => tg.setValue(t.enabled).onChange(async (v) => { t.enabled = v; await P.saveSettings(); }));
      st.addExtraButton((b) => b.setIcon('trash').setTooltip('목록에서 제거 (JSON 파일은 지우지 않음)').onClick(async () => { trs.splice(idx, 1); await P.saveSettings(); this.display(); }));
    });
    let nl = '', nf = '';
    new Setting(containerEl).setName('번역본 추가')
      .addText((t) => t.setPlaceholder('표시 이름 (예: KJV)').onChange((v) => { nl = v.trim(); }))
      .addText((t) => t.setPlaceholder('폴더 이름 (예: KJV)').onChange((v) => { nf = v.trim(); }))
      .addButton((b) => b.setButtonText('추가').setCta().onClick(async () => {
        if (!nl || !nf) { new Notice('표시 이름과 폴더 이름을 모두 입력하세요.'); return; }
        if (trs.some((t) => t.folder === nf)) { new Notice('이미 같은 폴더의 번역본이 있습니다.'); return; }
        trs.push({ key: 'custom_' + Date.now(), label: nl, folder: nf, enabled: true, crossref: nf === '관주' }); await P.saveSettings(); this.display();
      }));

    containerEl.createEl('h3', { text: '예화 탐색기' });
    txt('예화 폴더', '이 폴더 노트(또는 type: 예화)를 예화로 봅니다.', 'illustrationFolder', true);
    new Setting(containerEl).addButton((b) => b.setButtonText('색인 새로고침').onClick(() => { P.buildIndex(); new Notice(`노트 ${P.index.size}개 · 예화 ${P.illIndex.size}건 색인 완료`); this.display(); }));
    containerEl.createEl('p', { text: '단축키: 옵시디언 설정 → 단축키에서 "패시지 가이드", "예화 탐색", "좌표" 명령을 검색해 지정하세요.', cls: 'setting-item-description' });
  }
}

// ───────────────────────── 플러그인 본체 ─────────────────────────

module.exports = class PassageGuidePlugin extends Plugin {
  async onload() {
    await this.loadSettings();
    this.sermons = new Map(); this.sermonLinks = new Map(); this.usage = null; this.jsonCache = new Map(); // 설교 노트·설교가 링크한 노트(사용됨)·관주/개역개정 JSON
    this.index = new Map(); this.illIndex = new Map(); this.counts = this.emptyCounts(); this.indexReady = false; this.indexTimer = null; this.showTimer = null; // 색인: 경로(NFC) → 노트·예화
    this.resetPriority();
    this.pendingRange = null;
    this.lastMarkdownView = this.app.workspace.getActiveViewOfType(MarkdownView) || null;

    this.registerView(GUIDE_VIEW, (leaf) => new GuideView(leaf, this));

    this.app.workspace.onLayoutReady(() => { this.loadPriority(); this.buildIndex(); });

    // 바뀐 노트(또는 폴더 안 노트)만 색인을 고친다 — 폴더 이름 바꾸기·지우기도 그 안 노트 모두에 반영
    this.registerEvent(this.app.metadataCache.on('changed', (file) => this.onNoteEvent(file, null, false)));
    this.registerEvent(this.app.vault.on('delete', (file) => this.onNoteEvent(file, null, true)));
    this.registerEvent(this.app.vault.on('rename', (file, oldPath) => this.onNoteEvent(file, oldPath, false)));
    this.registerEvent(this.app.workspace.on('file-open', () => this.followActive())); // 같은 탭에서 링크로 다른 노트를 열 때
    this.registerEvent(this.app.metadataCache.on('resolve', (file) => this.onSermonResolved(file))); // 설교의 링크가 풀리면 '사용됨'을 고침
    this.registerEvent(this.app.workspace.on('active-leaf-change', (leaf) => {
      if (leaf && leaf.view instanceof MarkdownView) { this.lastMarkdownView = leaf.view; this.followActive(); }
    }));

    this.addCommand({ id: 'open-guide', name: '패시지 가이드 열기 (오른쪽 사이드바)', callback: () => this.openGuide(this.rangeFromActive(true)) });
    this.addCommand({ id: 'open-guide-modal', name: '패시지 가이드 창으로 열기', callback: () => { const r = this.rangeFromActive(true); new GuideModal(this, r).open(); } });
    this.addCommand({ id: 'open-illustration', name: '예화 탐색', callback: () => this.openIllustration('') });
    this.addCommand({ id: 'open-illustration-passage', name: '예화 탐색 — 지금 본문으로', callback: () => { const r = this.rangeFromActive(true); this.openIllustration(r ? fmtRange(r[0], r[1], true) : ''); } });
    this.addCommand({ id: 'memo', name: '이 본문에 메모 노트 만들기 / 열기', callback: () => { const r = this.rangeFromActive(true); if (r) this.openMemo(r); else new Notice('본문을 찾지 못했습니다.'); } });
    this.addCommand({ id: 'stamp-ref', name: '이 노트에 본문 좌표 넣기 (ref_start·ref_end)', callback: () => this.stampRef() });
    this.addCommand({ id: 'setup', name: '패시지 가이드 시작하기 (예시 폴더·노트 만들기)', callback: () => this.runSetup() });
    this.addCommand({ id: 'reindex', name: '패시지 가이드 색인 새로고침', callback: () => { this.buildIndex(); new Notice(`노트 ${this.index.size}개 · 예화 ${this.illIndex.size}건 색인 완료`); } });
    this.addRibbonIcon('compass', '패시지 가이드', () => this.openGuide(this.rangeFromActive(true)));
    this.addSettingTab(new PGSettingTab(this.app, this));
  }
  onunload() { if (this.indexTimer) window.clearTimeout(this.indexTimer); if (this.showTimer) window.clearTimeout(this.showTimer); }

  // ── 열기 ──
  async openGuide(range) {
    const ws = this.app.workspace; let leaf = ws.getLeavesOfType(GUIDE_VIEW)[0];
    if (!leaf) { leaf = ws.getRightLeaf(false); this.pendingRange = range || null; await leaf.setViewState({ type: GUIDE_VIEW, active: true }); ws.revealLeaf(leaf); return; }
    ws.revealLeaf(leaf);
    if (range && leaf.view && leaf.view.panel) leaf.view.panel.show(range);
  }
  openIllustration(query) { new IllustrationModal(this, query || '').open(); }
  followActive() {
    if (!this.settings.followActive) return;
    const leaf = this.app.workspace.getLeavesOfType(GUIDE_VIEW)[0]; if (!leaf || !leaf.view || !leaf.view.panel) return;
    const r = this.rangeFromActive(false); if (!r) return;
    const cur = leaf.view.panel.range; if (cur && cur[0] === r[0] && cur[1] === r[1]) return;
    leaf.view.panel.show(r);
  }

  // ── 본문 찾기 ──
  rangeFromFrontmatter(fm) {
    if (!fm) return null;
    if (fm.ref_start && fm.ref_end && !isNaN(+fm.ref_start) && !isNaN(+fm.ref_end)) return [+fm.ref_start, +fm.ref_end];
    for (const k of ['본문', 'bible_refs', 'passage', 'scripture', 'text', 'bible_reference', 'verse_range', 'verses', 'key_verse']) for (const v of arr(fm[k])) { const r = parseRef(v); if (r) return r; }
    return null;
  }
  rangeFromActive(useCursor) {
    const file = this.app.workspace.getActiveFile();
    const view = this.app.workspace.getActiveViewOfType(MarkdownView) || this.lastMarkdownView;
    if (useCursor && view && view.editor) {
      const sel = view.editor.getSelection(); if (sel && sel.trim()) { const r = parseRef(sel); if (r) return r; }
    }
    if (file) {
      const fm = (this.app.metadataCache.getFileCache(file) || {}).frontmatter;
      const r = this.rangeFromFrontmatter(fm); if (r) return r;
      const fr = parseRef(file.basename.replace(/_/g, ' ')); if (fr) return fr;
    }
    if (useCursor && view && view.editor) { const line = view.editor.getLine(view.editor.getCursor().line); const r = parseRef(line); if (r) return r; }
    return null;
  }
  detectCursorRef() {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView) || this.lastMarkdownView; if (!view || !view.editor) return '';
    const sel = view.editor.getSelection(); if (sel && sel.trim()) return sel.trim();
    const line = view.editor.getLine(view.editor.getCursor().line); const m = nfc(line).match(BRE);
    if (m && /\d/.test(m[2])) { const r = parseRef(m[0]); if (r) return fmtRange(r[0], r[1], true); }
    const r = this.rangeFromActive(false); return r ? fmtRange(r[0], r[1], true) : '';
  }
  getTargetEditor() {
    const active = this.app.workspace.getActiveViewOfType(MarkdownView); if (active) return active.editor;
    const v = this.lastMarkdownView; if (v && this.app.workspace.getLeavesOfType('markdown').some((l) => l.view === v)) return v.editor;
    return null;
  }
  getTargetFile() { const a = this.app.workspace.getActiveFile(); if (a) return a; return this.lastMarkdownView && this.lastMarkdownView.file ? this.lastMarkdownView.file : null; }

  // ── 구절에 고정된 메모 (로고스 Note Anchors) ──
  async openMemo(range) {
    const [QS, QE] = range; const b = Math.floor(QS / 1e6); const name = FULL[b]; if (!name) return;
    const tpl = (b >= 40 ? this.settings.memoFolderNT : this.settings.memoFolderOT) || '성경 메모/{nn} {book}';
    const dir = normalizePath(tpl.replace(/\{nn\}/g, String(b).padStart(2, '0')).replace(/\{book\}/g, name).replace(/\{abbr\}/g, AB[b]));
    const c1 = Math.floor(QS / 1e3) % 1e3, v1 = QS % 1e3, c2 = Math.floor(QE / 1e3) % 1e3, v2 = QE % 1e3;
    const whole = QS % 1e6 === 0, chap = v1 === 1 && v2 === 999;
    const vs = chap ? (c1 === c2 ? '' : `-${c2}`) : c1 === c2 ? `_${v1}${v2 !== v1 ? '-' + v2 : ''}` : `_${v1}-${c2}_${v2}`;
    const fname = whole ? `${AB[b]}_전체_메모.md` : `${AB[b]}${c1}${vs}_메모.md`; // 롬8_28_메모 · 롬8_메모 · 롬8-9_메모 · 롬_전체_메모
    const path = normalizePath(`${dir}/${fname}`);
    let file = this.app.vault.getAbstractFileByPath(path);
    if (!file) {
      if (!this.app.vault.getAbstractFileByPath(dir)) { try { await this.app.vault.createFolder(dir); } catch (_) {} }
      const scope = whole ? 'book' : chap ? 'chapter' : QS === QE ? 'verse' : 'passage'; // 볼트의 ref_scope 값과 같은 이름
      const today = new Date().toISOString().slice(0, 10);
      const body = `---\ntype: 나의주석\n본문: ${fmtRange(QS, QE, true)}\nref_start: ${QS}\nref_end: ${QE}\nref_scope: ${scope}\ncreated: ${today}\ntags:\n  - 나의주석\n---\n# ${fmtRange(QS, QE, true)} 메모\n\n`;
      file = await this.app.vault.create(path, body);
      new Notice('메모 노트를 만들었습니다: ' + fname);
    }
    openInSplit(this, file.path, null); // 메모는 우측 분할에 연다
  }

  // ── 우선순위 서재 읽기 (노트의 yaml 블록) ──
  // 순서표 노트의 ```yaml 블록:
  //   저자이름: 숫자            (작을수록 먼저, _default: 기본값)
  //   check: [저자, …]          (⚠ 걸러 읽을 저자)
  //   check_notes:              (⚠에 마우스를 올리면 보일 이유 — 들여 쓴 '저자: 이유' 줄)
  //   no_cite: [저자, …]        (취소선 — 인용하지 않을 저자)
  //   sermon_first: [저자, …]   (✍️ 설교 모드에서 맨 앞으로 올릴 저자, 적은 순서대로)
  //   book_folders: [폴더, …]   (주석 폴더 안에 있지만 단행본인 것 → 📘 도서 칸)
  resetPriority() {
    const L = this.settings.profile === 'legacy';
    this.priority = L ? Object.assign({}, LEGACY_PRIORITY) : { _default: 95 };
    this.checkList = L ? LEGACY_CHECK.slice() : []; this.checkNotes = L ? Object.assign({}, LEGACY_CHECK_NOTES) : {};
    this.noCite = L ? LEGACY_NO_CITE.slice() : []; this.bookFolders = L ? LEGACY_BOOK_FOLDERS.slice() : []; this.sermonFirst = [];
  }
  async loadPriority() {
    this.resetPriority();
    const f = this.app.vault.getAbstractFileByPath(normalizePath(this.settings.priorityNote || ''));
    if (!(f instanceof TFile)) return;
    try {
      const raw = await this.app.vault.cachedRead(f);
      const m = raw.match(/```ya?ml[^\n]*\n([\s\S]*?)(?:\n```|\n##\s)/);
      if (!m) return;
      const pr = {}; let block = null; const notes = {};
      const listOf = (v) => { const a = v.match(/^\[(.*)\]$/); return a ? a[1].split(',').map((x) => x.trim().replace(/^["']|["']$/g, '')).filter(Boolean) : null; };
      for (const line of m[1].split('\n')) {
        const t = line.trim(); if (!t || t.startsWith('#')) continue;
        const indented = /^\s/.test(line);
        const kv = t.match(/^([^:#]+?)\s*:\s*(.*)$/); if (!kv) continue;
        const k = kv[1].trim().replace(/^["']|["']$/g, ''), v = kv[2].trim();
        if (indented && block === 'check_notes') { if (v) notes[k] = v.replace(/^["']|["']$/g, ''); continue; }
        block = null;
        if (k === 'check_notes' && !v) { block = 'check_notes'; continue; }
        const L = listOf(v);
        if (k === 'check') { if (L) this.checkList = L; continue; }
        if (k === 'no_cite') { if (L) this.noCite = L; continue; }
        if (k === 'sermon_first') { if (L) this.sermonFirst = L; continue; }
        if (k === 'book_folders') { if (L) this.bookFolders = L; continue; }
        if (/^-?\d+(\.\d+)?$/.test(v)) pr[k] = parseFloat(v);
      }
      if (Object.keys(pr).length) this.priority = Object.assign({ _default: 95 }, pr);
      Object.assign(this.checkNotes, notes);
      // (legacy) 이름 맞추기 규칙 아래의 "도서" 폴더 목록(백틱으로 감싼 이름)
      const sec = raw.match(/주석이 아니라 단행본인 폴더[^\n]*\n?/);
      if (sec) { const names = [...sec[0].matchAll(/`([^`]+)`/g)].map((x) => x[1]); if (names.length) this.bookFolders = names; }
    } catch (e) { console.error('[passage-guide] 순서표 읽기 실패', e); }
  }
  matchName(author, keys) {
    const na = normKey(author); let best = null, bestLen = -1;
    for (const k of keys) { const nk = normKey(k); if (!nk) continue; if (na === nk || na.startsWith(nk) || na.includes(nk)) { if (nk.length > bestLen) { best = k; bestLen = nk.length; } } }
    return best;
  }
  isPinned(author) { const p = (this.settings.pinnedAuthor || '').trim(); return !!(author && p && normKey(author).includes(normKey(p))); }
  rankOf(author) {
    const dflt = this.priority._default != null ? this.priority._default : 95;
    if (!author) return dflt;
    if (this.isPinned(author)) return -1000; // 먼저 볼 저자 칸 — 항상 맨 위
    if (this.settings.sermonMode && this.sermonFirst.length) { const k = this.matchName(author, this.sermonFirst); if (k) return -500 + this.sermonFirst.indexOf(k); }
    const k = this.matchName(author, Object.keys(this.priority).filter((x) => !x.startsWith('_')));
    let p = k == null ? dflt : this.priority[k];
    if (this.settings.sermonMode && this.settings.legacyTiers && !this.sermonFirst.length) { if (p >= 30 && p < 40) p = p - 30; else if (p >= 40 && p < 50) p = 9.5; else if (p === 80) p = 9.8; }
    return p;
  }
  checkNoteOf(author) {
    const c = this.matchName(author, this.checkList); if (!c) return null;
    return this.checkNotes[c] || this.checkNotes[this.matchName(author, Object.keys(this.checkNotes)) || ''] || '신학 점검 필요';
  }
  isBookFolder(author) { const na = normKey(author); return this.bookFolders.some((b) => normKey(b) === na); }

  // ── 색인 ──
  emptyCounts() { return { theme: new Map(), topic: new Map(), type: new Map(), tone: new Map(), audience: new Map(), season: new Map(), source: new Map() }; }
  scheduleIndex() { if (this.indexTimer) window.clearTimeout(this.indexTimer); this.indexTimer = window.setTimeout(() => { this.indexTimer = null; this.buildIndex(); }, 3000); }
  illSourceOf(p, types) {
    if (this.settings.illustrationFolder && inFolders(p, [this.settings.illustrationFolder])) return '예화자료';
    if (types && types.some((t) => t === '예화' || t === '인용문')) return types.includes('인용문') ? '책인용' : '예화자료';
    if (!this.settings.booksFolder || !inFolders(p, [this.settings.booksFolder])) return null;
    const name = p.split('/').pop(); if (name.startsWith('📑') || /^\d\d_/.test(name)) return null;
    if (p.includes('/04 예화/')) return '책예화'; if (p.includes('/05 인용문/')) return '책인용'; return null;
  }
  buildIndex() {
    const t0 = Date.now(); this.index = new Map(); this.illIndex = new Map(); this.sermons = new Map(); this.sermonLinks = new Map(); this.usage = null; this.jsonCache = new Map();
    for (const f of this.app.vault.getMarkdownFiles()) this.indexFile(f);
    this.recount(); this.indexReady = true;
    const leaf = this.app.workspace.getLeavesOfType(GUIDE_VIEW)[0];
    if (leaf && leaf.view && leaf.view.panel && leaf.view.panel.range) leaf.view.panel.show(leaf.view.panel.range);
  }
  // 노트 하나를 색인에 넣는다 (넣을 것이 없으면 아무것도 안 함)
  indexFile(f, bodyRanges) {
    const path = nfc(f.path);
    if (/sync-conflict/.test(path) || inFolders(path, this.settings.skipFolders)) return;
    const cache = this.app.metadataCache.getFileCache(f); const fm = (cache && cache.frontmatter) || {};
    const types = arr(fm.type); const type = types[0] || '';
    if (type === '패시지가이드' || fm.status === '분할원본') return;
    if (inFolders(path, this.settings.sermonFolders) || isSermonType(types)) { this.sermons.set(path, f); this.readSermonLinks(path); }
    const ranges = [];
    const core = fm.ref_start != null && fm.ref_end != null && !isNaN(+fm.ref_start) && !isNaN(+fm.ref_end) ? [+fm.ref_start, +fm.ref_end] : null;
    if (core) ranges.push([core[0], core[1], true]);
    for (const k of ['bible_refs', '본문', 'passage', 'scripture', 'text']) for (const v of arr(fm[k])) { const r = parseRef(v); if (r) ranges.push([r[0], r[1], false]); }
    if (!ranges.length && this.settings.refFromFilename) {
      const r = parseRef(nfc(f.basename)); // 파일 이름의 본문 표기
      if (r && r[0] % 1e6 !== 0) ranges.push([r[0], r[1], false]);
      else if (fm.book && fm.chapter && !isNaN(+fm.chapter)) { const b = bookNumFromText(String(fm.book)); if (b) ranges.push([C(b, +fm.chapter, 1), C(b, +fm.chapter, 999), false]); }
      else if (r && inFolders(path, this.settings.researchFolders)) ranges.push([r[0], r[1], false]); // 책 전체 노트는 연구 폴더 안에서만
    }
    if (bodyRanges) for (const r of bodyRanges) ranges.push(r);
    if (!ranges.length && this.settings.refFromFilename && !bodyRanges) this.queueBodyScan(f); // 노트 안의 '관련 본문:' 줄은 따로 읽는다
    const author = this.authorOf(path, fm, types);
    if (ranges.length) {
      this.index.set(path, { file: f, path, title: f.basename, author, type, types, kind: fm.section_kind || '', core: fm.core_message ? String(fm.core_message) : '', ranges });
    }
    const source = this.illSourceOf(path, types);
    if (source && !NON_ILLUSTRATION_TYPES.has(type)) {
      const bibleRefs = arr(fm.bible_refs).length ? arr(fm.bible_refs) : arr(fm.bible_reference);
      // 핵심 본문(ref_start·ref_end)을 맨 앞에, 인용 본문은 [시작, 끝, false]
      const cites = bibleRefs.map((x) => [x, parseRef(x)]);
      const parsed = [...(core ? [[core[0], core[1], true]] : []), ...cites.filter((c) => c[1]).map(([, r]) => [r[0], r[1], false])];
      const refLabels = [...(core ? [fmtRange(core[0], core[1], true)] : []), ...cites.filter(([, r]) => !(core && r && r[0] === core[0] && r[1] === core[1])).map(([x]) => x)];
      const bookNum = bookNumFromText(fm.bible_book || '');
      const bm = path.match(/\/([^/]+)\/0[45] (?:예화|인용문)\//);
      const e = { file: f, source, book: source === '예화자료' ? '' : bm ? bm[1] : '', title: String(fm.title || f.basename), tags: arr(fm.tags), type, theme: arr(fm.theme)[0] || '', topics: arr(fm.topics), keywords: arr(fm.keywords), core_message: String(fm.core_message || ''), tone: arr(fm.tone), season: arr(fm.season), caution: arr(fm.caution), bible_refs: bibleRefs, ref_labels: refLabels, bible_norm: bibleRefs.map(normRefLabel), parsed_refs: parsed, bible_books: new Set([...parsed.map((r) => Math.floor(r[0] / 1e6)), ...(bookNum ? [bookNum] : [])]), audience: arr(fm.audience), usage_points: fm.usage_points || [], quote: String(fm.quote || ''), speaker: String(fm.speaker || fm.author || ''), used_in: arr(fm.used_in) };
      this.illIndex.set(path, e);
    }
  }
  // 주석 이름(저자): 경로의 '/<표시폴더>/<저자>/…' → 속성 commentary·주석명 → type: 주석 이면 author
  authorOf(path, fm, types) {
    const segs = path.split('/');
    for (const mk of list(this.settings.commentaryMarkers)) { const i = segs.indexOf(mk); if (i >= 0 && i < segs.length - 2) return segs[i + 1]; }
    const c = arr(fm.commentary)[0] || arr(fm['주석명'])[0] || arr(fm['주석'])[0];
    if (c) return String(c).replace(/^\[\[|\]\]$/g, '');
    if (types.includes('주석') && fm.author) return String(arr(fm.author)[0]).replace(/^\[\[|\]\]$/g, '');
    return null;
  }
  // 속성에 본문이 없는 노트: 노트 안의 「관련 본문: 마 6:22-23, 창 13:10」 같은 줄을 읽어(파일을 열어야 해서 나중에 차례로) 색인에 넣는다
  queueBodyScan(f) {
    (this.bodyQueue ??= new Map()).set(nfc(f.path), f);
    if (!this.bodyTimer) this.bodyTimer = window.setTimeout(() => this.runBodyScan(), 300);
  }
  async runBodyScan() {
    this.bodyTimer = null; const q = this.bodyQueue || new Map(); this.bodyQueue = new Map();
    let added = 0;
    for (const f of q.values()) {
      try {
        if (!f || !(f.stat && f.stat.size < 300000)) continue;
        const raw = await this.app.vault.cachedRead(f);
        const ranges = bodyRefsOf(stripFrontmatter(raw));
        if (ranges.length) { this.indexFile(f, ranges); added++; }
      } catch (_) {}
    }
    if (added) this.scheduleShow(800);
    if (this.bodyQueue.size && !this.bodyTimer) this.bodyTimer = window.setTimeout(() => this.runBodyScan(), 300);
  }
  recount() {
    const counts = this.emptyCounts(); const bump = (m, k) => m.set(k, (m.get(k) || 0) + 1);
    for (const e of this.illIndex.values()) {
      bump(counts.source, e.source); if (e.theme) bump(counts.theme, e.theme); if (e.type) bump(counts.type, e.type);
      for (const x of e.topics) bump(counts.topic, x); for (const x of e.tone) bump(counts.tone, x); for (const x of e.audience) bump(counts.audience, x); for (const x of e.season) bump(counts.season, x);
    }
    this.counts = counts;
  }
  // 경로(노트, folder면 그 아래 전부)의 색인 항목을 뺀다 → 빠진 노트 항목들, 예화가 빠졌는지
  dropPath(p, folder) {
    const out = { notes: [], ill: false }; const hit = (k) => k === p || (folder && k.startsWith(p + '/'));
    for (const k of folder ? [...this.index.keys()] : [p]) if (hit(k) && this.index.has(k)) { out.notes.push(this.index.get(k)); this.index.delete(k); }
    for (const k of folder ? [...this.illIndex.keys()] : [p]) if (hit(k) && this.illIndex.delete(k)) out.ill = true;
    for (const k of folder ? [...this.sermons.keys()] : [p]) if (hit(k) && this.sermons.delete(k)) { this.sermonLinks.delete(k); this.usage = null; }
    return out;
  }
  // 노트가 바뀜·지워짐·이름 바뀜(폴더 포함) → 그 노트들만 다시 색인. 가이드는 지금 본문과 겹치는 노트가 바뀐 때만 다시 그린다
  onNoteEvent(file, oldPath, deleted) {
    if (!this.indexReady || !file || !file.path) return;
    const folder = !(file instanceof TFile);
    if (!folder && !file.path.endsWith('.md') && !(oldPath && oldPath.endsWith('.md'))) return;
    const gone = oldPath != null ? this.dropPath(nfc(oldPath), folder) : { notes: [], ill: false };
    const here = this.dropPath(nfc(file.path), folder);
    const before = [...gone.notes, ...here.notes]; let ill = gone.ill || here.ill; const after = [];
    if (!deleted) {
      const prefix = nfc(file.path) + '/';
      const files = folder ? this.app.vault.getMarkdownFiles().filter((f) => nfc(f.path).startsWith(prefix)) : file.path.endsWith('.md') ? [file] : [];
      for (const f of files) { this.indexFile(f); const p = nfc(f.path); if (this.index.has(p)) after.push(this.index.get(p)); if (this.illIndex.has(p)) ill = true; }
    }
    if (ill) this.recount();
    const leaf = this.app.workspace.getLeavesOfType(GUIDE_VIEW)[0]; const panel = leaf && leaf.view && leaf.view.panel;
    if (!panel || !panel.range) return;
    const [QS, QE] = panel.range;
    if ([...before, ...after].some((n) => n.ranges.some(([s, e]) => s <= QE && e >= QS))) this.scheduleShow();
  }
  // ── 설교 날짜·횟수, 예화 '사용됨' ──
  // 설교 칸: 날짜를 붙이고 최근 설교부터, 날짜 미상은 맨 아래 → 칸 제목에 쓸 'N회 설교 · 마지막 YYYY-MM-DD'
  sermonInfo(items) {
    for (const h of items) { const fm = (this.app.metadataCache.getFileCache(h.file) || {}).frontmatter || {}; h.date = null; for (const k of SERMON_DATE_KEYS) { const d = parseDate(fm[k]); if (d) { h.date = d; break; } } }
    items.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    const last = items.length && items[0].date ? items[0].date : null;
    return { last, label: `${items.length}회 설교 · ${last ? '마지막 ' + last : '날짜 미상'}` };
  }
  // 예화 칸: 설교가 링크한 예화(+used_in)를 '사용됨', 안 쓴 예화를 위로
  usageInfo(items) {
    for (const h of items) h.usedBy = this.usedBy(h.path);
    items.sort((a, b) => (a.usedBy.length ? 1 : 0) - (b.usedBy.length ? 1 : 0));
    return { unused: items.filter((h) => !h.usedBy.length).length };
  }
  // 설교 노트가 링크한 노트들 (옵시디언이 풀어 둔 링크 resolvedLinks) → 바뀌었는지
  readSermonLinks(p) {
    const f = this.sermons.get(p); const links = (f && this.app.metadataCache.resolvedLinks[f.path]) || {};
    const next = Object.keys(links).map(nfc).filter((x) => x !== p).sort(); const prev = this.sermonLinks.get(p) || [];
    if (next.join('\n') === prev.join('\n')) return null;
    this.sermonLinks.set(p, next); this.usage = null;
    return [...prev, ...next];
  }
  onSermonResolved(file) {
    if (!this.indexReady || !file) return; const p = nfc(file.path); if (!this.sermons.has(p)) return;
    const changed = this.readSermonLinks(p); if (!changed) return;
    const leaf = this.app.workspace.getLeavesOfType(GUIDE_VIEW)[0]; const panel = leaf && leaf.view && leaf.view.panel;
    if (panel && panel.range && panel.illPaths && changed.some((x) => panel.illPaths.has(x))) this.scheduleShow();
  }
  // 노트(NFC 경로)를 쓴 설교 이름들 + 그 노트의 used_in 값
  usedBy(path) {
    path = nfc(path);
    if (!this.usage) { this.usage = new Map(); for (const [sp, dests] of this.sermonLinks) { const f = this.sermons.get(sp); const name = f ? f.basename : sp; for (const d of dests) { if (!this.usage.has(d)) this.usage.set(d, []); this.usage.get(d).push(name); } } }
    const out = [...(this.usage.get(path) || [])];
    const e = this.illIndex.get(path);
    if (e) for (const u of e.used_in) { const n = u.replace(/^\[\[|\]\]$/g, '').split('|')[0].split('/').pop(); if (n && !out.includes(n)) out.push(n); }
    return out;
  }
  // 번역본 JSON(관주·개역개정) 책 하나 — 처음 쓸 때 한 번 읽어 둔다
  bookJson(folderKey, b) {
    const t = this.settings.translations.find((x) => x.label === folderKey || x.folder === folderKey); const folder = t ? t.folder : folderKey;
    const p = normalizePath(`${this.settings.translationRoot}/${folder}/${String(b).padStart(2, '0')}${FULL[b]}.json`);
    if (!this.jsonCache.has(p)) this.jsonCache.set(p, readJson(this.app, p));
    return this.jsonCache.get(p);
  }
  async verseText(s, e) {
    const b = Math.floor(s / 1e6); const T = this.settings.translations;
    const t = T.find((x) => x.enabled && !isCrossref(x) && (x.label === this.settings.verseTranslation || x.folder === this.settings.verseTranslation)) || T.find((x) => x.enabled && !isCrossref(x));
    if (!t) return null;
    const data = await this.bookJson(t.folder, b); const chs = data && data.chapters; if (!chs) return null;
    const c1 = Math.floor(s / 1e3) % 1e3, c2 = Math.floor(e / 1e3) % 1e3; const lines = [];
    for (let c = c1; c <= c2 && lines.length < 6; c++) for (const [v, t] of extractVerses(chs[String(c)], c === c1 ? s % 1e3 : 1, c === c2 ? e % 1e3 : 999)) if (lines.length < 6) lines.push(`${v} ${t}`);
    return lines.length ? `${t.label} ${fmtRange(s, e)}\n` + lines.join('\n') : null;
  }
  scheduleShow(ms) {
    if (this.showTimer) window.clearTimeout(this.showTimer);
    this.showTimer = window.setTimeout(() => { this.showTimer = null; const leaf = this.app.workspace.getLeavesOfType(GUIDE_VIEW)[0]; if (leaf && leaf.view && leaf.view.panel && leaf.view.panel.range) leaf.view.panel.show(leaf.view.panel.range); }, ms || 3000);
  }
  // 범위가 겹치는 노트 모으기 — 노트마다 가장 좁은 범위 하나
  collect(QS, QE) {
    const qbook = Math.floor(QS / 1e6); const hits = [];
    for (const n of this.index.values()) {
      // 핵심 본문이 겹치고 책 전체보다 좁으면 그것을, 아니면 겹치는 범위 중 가장 좁은 것
      let best = null, bestCore = null;
      for (const [s, e, primary] of n.ranges) {
        if (Math.floor(s / 1e6) !== qbook || !(s <= QE && e >= QS)) continue;
        if (!best || e - s < best.w) best = { s, e, w: e - s, primary };
        if (primary && e - s < 998000 && (!bestCore || e - s < bestCore.w)) bestCore = { s, e, w: e - s, primary };
      }
      if (bestCore) best = bestCore;
      if (!best) continue;
      const other = n.ranges.some(([s]) => Math.floor(s / 1e6) !== qbook); // 다른 책 본문도 가진 노트(상호참조)
      hits.push({ file: n.file, path: n.path, title: n.title, author: n.author, type: n.type, types: n.types || [], kind: n.kind, core: n.core, s: best.s, e: best.e, w: best.w, primary: best.primary, crossBook: other && !best.primary });
    }
    hits.sort(byFit);
    return hits;
  }
  categorize(hits, QS) {
    const S = this.settings; const g = {}; const push = (k, h) => (g[k] ??= []).push(h);
    const qbook = Math.floor(QS / 1e6); const nn = String(qbook).padStart(2, '0'); const bname = FULL[qbook];
    const bookDir = '/b' + nn + ' ';
    // 책 폴더: '…/b40 마태복음/…' 또는 폴더 이름이 '마태복음'·'40 마태복음'·'40_마태복음'
    const inBookDir = (P) => P.includes(bookDir) || P.split('/').slice(0, -1).some((x) => x === bname || x === nn + ' ' + bname || x === nn + '_' + bname || x === nn + '.' + bname);
    const otUse = list(S.otUseAuthors);
    const bookRoots = [S.booksFolder, ...list(S.extraBookFolders)].filter(Boolean);
    for (const h of hits) {
      const P = h.path, a = h.author, T = h.types || [];
      if (h.w >= 998000) { if (inBookDir(P) || T.includes('개론')) push('책전체', h); continue; }
      if (a && this.isPinned(a)) { push('점검', h); continue; }
      if (a && otUse.some((x) => normKey(a) === normKey(x))) { push('구약인용', h); continue; }
      if (h.crossBook && qbook < 40 && Math.floor(h.s / 1e6) === qbook && a && !hasSeg(P, S.devotionalMarkers) && (P.includes('/b4') || P.includes('/b5') || P.includes('/b6'))) { push('구약인용', h); continue; }
      if (inFolders(P, S.sermonFolders) || isSermonType(T)) { push('설교', h); continue; }
      if ((S.illustrationFolder && inFolders(P, [S.illustrationFolder])) || h.kind === '예화' || h.kind === 'QT' || T.includes('예화') || (this.illSourceOf(P, T) && !NON_ILLUSTRATION_TYPES.has(h.type))) { push('예화', h); continue; } // 책의 04 예화·05 인용문도 예화(예화 탐색기와 같은 기준)
      if (hasSeg(P, S.myNotesMarkers) || T.some((t) => t === '나의주석' || t === '성경주해' || t === '주해' || t === '메모')) { push('주해', h); continue; }
      if (hasSeg(P, S.devotionalMarkers) || (a && list(S.devotionalMarkers).includes(a)) || T.some((t) => t === '큐티' || t === 'QT' || t === '묵상')) { push('생삶', h); continue; }
      if (inFolders(P, bookRoots) || (a && this.isBookFolder(a)) || T.some((t) => t === '도서' || t === '문헌노트' || t === '책')) { push('도서', h); continue; }
      if ((a && /원어|원문분해/.test(h.title)) || hasSeg(P, S.origLangMarkers) || T.includes('원어')) { push('원어', h); continue; }
      if (a) { if (h.kind === '금언') continue; push('주석', h); continue; }
      if (inFolders(P, S.researchFolders) || T.includes('성경연구')) { push('연구', h); continue; }
      push('기타', h);
    }
    return g;
  }

  // ── 예화 검색 ──
  passFilters(e, f) {
    if (f.source && e.source !== f.source) return false;
    if (f.topic) { if (!e.topics.includes(f.topic)) return false; } else if (f.theme && e.theme !== f.theme) return false;
    if (f.type) { if (f.type === '@이야기') { if (!STORY_TYPES.includes(e.type)) return false; } else if (f.type === '@자료') { if (!MATERIAL_TYPES.includes(e.type)) return false; } else if (e.type !== f.type) return false; }
    if (f.tone && !e.tone.includes(f.tone)) return false;
    if (f.audience && !e.audience.includes(f.audience)) return false;
    if (f.season && !e.season.includes(f.season)) return false;
    if (f.noCaution && e.caution.length) return false;
    return true;
  }
  searchIllustrations(query, f) {
    const anyFilter = !!(f.theme || f.topic || f.type || f.tone || f.audience || f.season || f.source);
    const { range, rest } = extractRefQuery(query || '');
    const terms = rest.split(/\s+/).filter(Boolean).map((t) => { const n = t.length >= 2 ? bookNumFromText(t + ' 1') : null; return n && !/\d/.test(t) ? FULL[n] : t; });
    if (!range && !terms.length && !anyFilter) return null;
    const qbook = range ? Math.floor(range[0] / 1e6) : null;
    const results = [];
    for (const e of this.illIndex.values()) {
      if (!this.passFilters(e, f)) continue;
      const upTexts = usagePointTexts(e.usage_points); let score = 0;
      if (range) {
        let hit = 0;
        for (const [s, en, core] of e.parsed_refs) {
          if (Math.floor(s / 1e6) !== qbook) continue;
          if (s <= range[1] && en >= range[0]) hit = Math.max(hit, core ? 12 : 10); // 절·장이 겹침 (핵심 본문 12 · 인용 본문 10)
          else if (Math.floor(s / 1e3) === Math.floor(range[0] / 1e3)) hit = Math.max(hit, 6); // 같은 장
          else hit = Math.max(hit, 3);                                                // 같은 책
        }
        if (!hit && e.bible_books.has(qbook)) hit = 2;
        if (!hit) continue;
        score += hit;
      }
      let all = true, ts = 0;
      for (const term of terms) {
        let s = 0;
        if (e.title.includes(term)) s += 5;
        if (e.bible_norm.some((x) => x.includes(term))) s += 4;
        if (e.core_message.includes(term)) s += 4;
        if (e.topics.some((x) => x.includes(term))) s += 3;
        if (e.keywords.some((x) => x.includes(term))) s += 3;
        if (e.theme.includes(term)) s += 2;
        if (upTexts.some((x) => x.includes(term))) s += 2;
        if (e.tags.some((x) => x.includes(term))) s += 1;
        if (e.speaker && e.speaker.includes(term)) s += 3;
        if (e.quote && e.quote.includes(term)) s += 2;
        if (e.book && e.book.includes(term)) s += 2;
        if (s === 0) all = false; ts += s;
      }
      if (terms.length && ts === 0) continue;
      if (terms.length > 1 && all) ts += 10;
      score += ts;
      results.push({ entry: e, score, upTexts, usedBy: this.usedBy(e.file.path) });
    }
    results.sort((a, b) => b.score - a.score || (a.usedBy.length ? 1 : 0) - (b.usedBy.length ? 1 : 0) || a.entry.title.localeCompare(b.entry.title, 'ko')); // 같은 점수면 안 쓴 예화 먼저
    return results;
  }

  async loadSettings() {
    const data = (await this.loadData()) || {};
    const legacy = Object.keys(data).length > 0 && !data.schema; // 0.2.x에서 쓰던 볼트(pkm) → 그 동작 그대로
    const base = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
    if (legacy) Object.assign(base, LEGACY_PROFILE, JSON.parse(JSON.stringify(LEGACY_TRANSLATIONS)));
    this.settings = Object.assign(base, data, { schema: DEFAULT_SETTINGS.schema });
    if (legacy && data.hideMeta === undefined) this.settings.hideMeta = true;
    // 옛 역본대조 플러그인 설정이 있으면 번역본 목록을 그대로 가져온다 (처음 한 번)
    if (!data.translations) {
      try { const old = await this.app.vault.adapter.read(normalizePath(this.app.vault.configDir + '/plugins/bible-translation-compare/data.json')); const o = JSON.parse(old); if (Array.isArray(o.translations) && o.translations.length) { this.settings.translations = o.translations; if (o.translationRoot) this.settings.translationRoot = o.translationRoot; } } catch (_) {}
    }
    if (legacy) await this.saveSettings();
  }
  // ── 번역본 폴더 자동 찾기: '…/<루트>/<번역본>/01창세기.json' 꼴의 파일을 찾아 루트·번역본 목록을 정한다 ──
  detectTranslations() {
    const re = new RegExp('^(\\d\\d)(' + BOOKS.map((x) => x[1]).join('|') + ')\\.json$');
    const roots = new Map(); // 루트 → Set(번역본 폴더)
    for (const f of this.app.vault.getFiles()) {
      if (f.extension !== 'json') continue; const name = nfc(f.name); if (!re.test(name)) continue;
      const parts = nfc(f.path).split('/'); if (parts.length < 3) continue;
      const tr = parts[parts.length - 2]; const root = parts.slice(0, -2).join('/');
      if (!roots.has(root)) roots.set(root, new Set()); roots.get(root).add(tr);
    }
    if (!roots.size) return null;
    const [root, set] = [...roots.entries()].sort((x, y) => y[1].size - x[1].size)[0];
    return { root, folders: [...set].sort((a, b) => a.localeCompare(b, 'ko')) };
  }
  async applyDetectedTranslations(found) {
    const S = this.settings; S.translationRoot = found.root;
    const have = new Set(S.translations.map((t) => t.folder));
    for (const fd of found.folders) if (!have.has(fd)) S.translations.push({ key: 'auto_' + fd, label: fd, folder: fd, enabled: true, crossref: fd === '관주' });
    for (const t of S.translations) t.enabled = found.folders.includes(t.folder);
    if (!(S.guideTranslations || []).some((g) => found.folders.includes(g))) { const first = S.translations.find((t) => t.enabled && !isCrossref(t)); S.guideTranslations = first ? [first.label] : []; }
    this.jsonCache = new Map(); await this.saveSettings();
  }
  // ── 이 노트에 본문 좌표 넣기 ──
  async stampRef() {
    const file = this.getTargetFile(); if (!file) { new Notice('열린 노트가 없습니다.'); return; }
    const view = this.app.workspace.getActiveViewOfType(MarkdownView) || this.lastMarkdownView;
    const fm = (this.app.metadataCache.getFileCache(file) || {}).frontmatter || {};
    let r = null, from = '';
    const sel = view && view.editor ? view.editor.getSelection() : '';
    if (sel && sel.trim()) { r = parseRef(sel); from = '선택한 글'; }
    if (!r) for (const k of ['본문', 'bible_refs', 'passage', 'scripture', 'bible_reference', 'verse_range', 'key_verse']) { for (const v of arr(fm[k])) { r = parseRef(v); if (r) { from = `속성 ${k}`; break; } } if (r) break; }
    if (!r) { r = parseRef(file.basename.replace(/_/g, ' ')); if (r) from = '파일 이름'; }
    if (!r && view && view.editor) { r = parseRef(view.editor.getLine(view.editor.getCursor().line)); if (r) from = '커서 줄'; }
    if (!r) { new Notice('본문을 찾지 못했습니다. 본문 표기(예: 마 22:15-22)를 선택하거나 속성 「본문」에 적어 주세요.'); return; }
    const [QS, QE] = r; const whole = QS % 1e6 === 0, chap = QS % 1e3 === 1 && QE % 1e3 === 999;
    await this.app.fileManager.processFrontMatter(file, (f) => {
      f.ref_start = QS; f.ref_end = QE; f.ref_scope = whole ? 'book' : chap ? 'chapter' : QS === QE ? 'verse' : 'passage';
      if (!f['본문']) f['본문'] = fmtRange(QS, QE, true);
    });
    new Notice(`좌표를 넣었습니다: ${fmtRange(QS, QE, true)} (${from}에서)`);
  }
  // ── 시작하기: 빈 볼트에 폴더·순서표·예시 노트를 만든다 (이미 있는 파일은 건드리지 않음) ──
  async runSetup() {
    const S = this.settings; const V = this.app.vault; const made = [];
    const ensureDir = async (d) => { d = normalizePath(d); if (!V.getAbstractFileByPath(d)) { try { await V.createFolder(d); made.push(d + '/'); } catch (_) {} } };
    const ensureFile = async (p, body) => { p = normalizePath(p); const dir = p.split('/').slice(0, -1).join('/'); if (dir) await ensureDir(dir); if (!V.getAbstractFileByPath(p)) { await V.create(p, body); made.push(p); } };
    const sermon = list(S.sermonFolders)[0] || '설교'; const ill = S.illustrationFolder || '예화'; const books = S.booksFolder || '도서';
    const cm = list(S.commentaryMarkers)[0] || '주석'; const research = list(S.researchFolders)[0] || '성경연구';
    const found = this.detectTranslations(); // 번역본: 볼트 안에서 먼저 찾아 보고, 없을 때만 빈 폴더를 만든다
    for (const d of [sermon, ill, books, cm, research, ...(found ? [] : [S.translationRoot || '성경번역본'])]) await ensureDir(d);
    await ensureFile(S.priorityNote || '패시지 가이드 순서표.md', [
      '# 패시지 가이드 순서표', '',
      '패시지 가이드의 📚 주석 칸은 아래 숫자가 **작은 주석부터** 보여 줍니다. 주석 폴더 이름(또는 노트 속성 `commentary`)과 같은 이름을 적으세요.',
      '이 노트를 고치면 다음에 가이드를 열 때 바로 반영됩니다.', '',
      '```yaml', '# priority-library',
      '예시주석: 10', 'WBC: 20', '매튜헨리: 60', '_default: 95', '',
      '# ⚠ 걸러 읽을 주석 (마우스를 올리면 이유가 보임)', 'check: [WBC]', 'check_notes:', '  WBC: 권마다 저자 입장이 다르고 비평적 견해가 섞여 있다', '',
      '# ✍️ 설교 모드에서 맨 앞으로 올릴 주석 (적은 순서대로)', 'sermon_first: [매튜헨리]', '',
      '# 취소선으로 보일(인용하지 않을) 저자', 'no_cite: []', '',
      '# 주석 폴더 안에 있지만 단행본인 것 → 📘 도서 칸', 'book_folders: []', '```', '',
    ].join('\n'));
    const today = new Date().toISOString().slice(0, 10);
    await ensureFile(`${cm}/예시주석/마태복음 22장 15-22절.md`, `---\ntype: 주석\n본문: 마 22:15-22\nref_start: 40022015\nref_end: 40022022\n---\n# 마 22:15-22 — 가이사의 것과 하나님의 것\n\n(예시 노트) 주석 폴더 아래 **주석 이름 폴더**(여기서는 \`예시주석\`)에 넣고, 속성 \`본문\`만 적으면 패시지 가이드 📚 주석 칸에 모입니다.\n`);
    await ensureFile(`${sermon}/마22_15-22 예시 설교.md`, `---\ntype: 설교\n본문: 마 22:15-22\n설교일: ${today}\n---\n# 누구의 얼굴이 새겨져 있습니까 (예시)\n\n설교 폴더에 두거나 \`type: 설교\`를 적으면 🎤 설교 칸에 날짜순으로 모입니다.\n\n[[예시 예화 — 동전의 초상]]\n`);
    await ensureFile(`${ill}/예시 예화 — 동전의 초상.md`, `---\ntype: 실화\ntheme: 제자도와 사명\ntopics: [헌신]\nbible_refs: [마 22:21]\ncore_message: 우리에게는 하나님의 형상이 새겨져 있다\n---\n# 동전의 초상 (예시 예화)\n\n예화 폴더에 두고 \`bible_refs\`에 본문을 적으면 💡 예화 칸과 예화 탐색기에 나옵니다. 설교 노트가 이 예화를 링크하면 「사용됨」이 붙습니다.\n`);
    if (found) await this.applyDetectedTranslations(found);
    this.buildIndex(); await this.loadPriority();
    new Notice(made.length ? `패시지 가이드 시작하기: ${made.length}개를 만들었습니다.${found ? ` 번역본 ${found.folders.length}개를 찾았습니다.` : ' 번역본 JSON은 아직 없습니다(설정 참고).'}` : '이미 모두 있습니다.', 8000);
    const ex = V.getAbstractFileByPath(normalizePath(`${sermon}/마22_15-22 예시 설교.md`));
    if (ex instanceof TFile) { await this.app.workspace.getLeaf(false).openFile(ex); this.openGuide([40022015, 40022022]); }
  }
  async saveSettings() { await this.saveData(this.settings); }
};

// 검사용(node): 파서만 내보냄
if (typeof process !== 'undefined' && process.env && process.env.PG_TEST) module.exports.__test = { parseRef, fmtRange, extractRefQuery, parseDate, crossRefsOf, bodyRefsOf };
