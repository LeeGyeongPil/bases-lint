import type { MsgKey } from "./en.js";

/** Korean message catalog. Must define exactly the keys of the English catalog. */
export const ko: Record<MsgKey, string> = {
  "yaml-syntax.error": "YAML 문법 오류: {detail}",
  "yaml-syntax.root": "base 파일의 최상위는 키: 값 형태의 매핑이어야 합니다.",
  "yaml-syntax.hint": "YAML 구조를 고치세요. ':' 나 '#' 이 들어간 식은 따옴표로 감싸세요.",

  "top-level-key.msg": '알 수 없는 최상위 키 "{key}" 입니다.',
  "top-level-key.hint": "쓸 수 있는 키: filters, formulas, properties, summaries, views.",

  "view-shape.views-not-list": '"views" 는 뷰 목록이어야 합니다.',
  "view-shape.view-not-map": '각 뷰는 최소한 "type" 을 가진 매핑이어야 합니다.',
  "view-shape.type-missing": '뷰에 "type" 이 없습니다.',
  "view-shape.type-not-string": '"type" 은 table, cards 같은 텍스트여야 합니다.',
  "view-shape.limit": '"limit" 은 0 이상의 정수여야 합니다 (현재 값: {value}).',
  "view-shape.order": '"order" 는 속성 이름 목록이어야 합니다.',
  "view-shape.direction": '"direction" 은 ASC 또는 DESC 여야 합니다 (현재 값: {value}).',
  "view-shape.groupby": '"groupBy" 는 "property" 와 "direction" 을 가진 매핑이어야 합니다.',
  "view-shape.sort-entry": '"sort" 의 각 항목은 "property" 와 "direction" 을 가진 매핑이어야 합니다.',
  "view-shape.hint.views": '"views:" 아래에 "- type: table" 같은 목록을 쓰세요.',
  "view-shape.hint.view": '각 뷰를 "- type: table" 로 시작하고 나머지 키는 그 아래에 들여쓰세요.',
  "view-shape.hint.type": '"type: table" 같은 줄을 추가하세요.',
  "view-shape.hint.limit": '"limit: 10" 처럼 숫자를 쓰세요.',
  "view-shape.hint.order": '"order: [file.name, status]" 또는 "- 이름" 목록으로 쓰세요.',
  "view-shape.hint.direction": '"direction: ASC" 또는 "direction: DESC" 를 쓰세요.',
  "view-shape.hint.groupby": '"groupBy:" 아래에 "property: status" 와 "direction: ASC" 를 쓰세요.',
  "view-shape.hint.sort-entry": '항목마다 "- property: priority" 와 "  direction: DESC" 를 쓰세요.',

  "view-type-unknown.msg":
    '뷰 종류 "{type}" 는 기본 Bases 뷰(table, cards, list, map)가 아닙니다. 플러그인 뷰일 수 있습니다.',
  "view-type-unknown.hint": "플러그인을 설치했다면 무시하거나 --disable view-type-unknown 으로 규칙을 끄세요.",

  "filter-shape.key": '필터 키 "{key}" 는 and, or, not 이 아닙니다.',
  "filter-shape.multi": "필터 객체는 키가 정확히 하나(and, or, not)여야 하는데 {count}개입니다.",
  "filter-shape.not-list": '"{key}" 아래에는 필터 목록이 와야 합니다.',
  "filter-shape.item": "필터는 텍스트 식이거나 and/or/not 객체여야 합니다.",
  "filter-shape.hint.key": '소문자 "and", "or", "not" 을 쓰세요.',
  "filter-shape.hint.multi": "키마다 별도 목록 항목으로 나눠 객체당 키가 하나가 되게 하세요.",
  "filter-shape.hint.not-list": '"{key}:" 아래에 "- " 목록 항목으로 필터를 쓰세요.',
  "filter-shape.hint.item": "식을 따옴표로 감싸세요. 예: - 'status != \"done\"'",

  "expr-parse.unexpected-token": '예상하지 못한 토큰 "{token}" 입니다.',
  "expr-parse.unexpected-end": "식이 너무 일찍 끝났습니다.",
  "expr-parse.expected-token": '"{expected}" 가 와야 하는데 "{token}" 이(가) 있습니다.',
  "expr-parse.expected-token-end": '식 끝에 "{expected}" 가 필요합니다.',
  "expr-parse.unterminated-string": "문자열이 닫히지 않았습니다.",
  "expr-parse.unterminated-regex": "정규식이 닫히지 않았습니다.",
  "expr-parse.invalid-char": '예상하지 못한 문자 "{char}" 입니다.',
  "expr-parse.too-deep": "식의 중첩이 너무 깊습니다.",
  "expr-parse.empty": "식이 비어 있습니다.",
  "expr-parse.expected-name": '"." 뒤에 이름이 필요합니다.',
  "expr-parse.hint": "이 식의 괄호, 따옴표, 연산자를 확인하세요.",

  "unknown-function.msg": '알 수 없는 함수 "{name}()" 입니다.',
  "unknown-function.hint": "전역 함수: {list}.",

  "unknown-method.msg": '{types} 에 없는 메서드 또는 필드 "{name}" 입니다.',
  "unknown-method.msg-any": '알 수 없는 메서드 또는 필드 "{name}" 입니다.',
  "unknown-method.hint":
    "철자를 확인하세요. 플러그인이 추가한 메서드는 이 표에 없을 수 있습니다. --disable unknown-method 로 규칙을 끌 수 있습니다.",

  "wrong-arity.exact": '"{name}()" 은(는) 인자를 정확히 {min}개 받는데 {count}개를 넘겼습니다.',
  "wrong-arity.range": '"{name}()" 은(는) 인자를 {min}~{max}개 받는데 {count}개를 넘겼습니다.',
  "wrong-arity.min": '"{name}()" 은(는) 인자를 최소 {min}개 받는데 {count}개를 넘겼습니다.',
  "wrong-arity.hint": "서명: {sig}",

  "type-mismatch.access-error": '"{what}" 은(는) {types} 에서 쓸 수 없습니다. {owners} 에 있습니다.{notes}',
  "type-mismatch.access-warning":
    '값이 {types} 일 때 "{what}" 은(는) 쓸 수 없습니다. {owners} 에 있습니다.{notes}',
  "type-mismatch.op-error": '연산자 "{op}" 를 {types} 에 쓸 수 없습니다.{notes}',
  "type-mismatch.op-warning": '값이 {types} 일 때 연산자 "{op}" 가 실패합니다.{notes}',
  "type-mismatch.hint-access": "먼저 값을 변환하거나 {owners} 의 메서드를 쓰세요.",
  "type-mismatch.method-as-field": '"{name}" 은(는) 필드가 아니라 메서드라서 괄호가 필요합니다.{notes}',
  "type-mismatch.hint-call": '"{name}()" 처럼 호출하세요.',
  "type-mismatch.hint-op": "number(...) 로 변환하거나, 모든 노트에서 속성 형식을 같게 맞추세요.",

  "formula-undefined.msg": '"formulas" 에 "{name}" 수식이 정의되어 있지 않습니다.',
  "formula-undefined.hint": '"formulas:" 아래에 "{name}" 을(를) 추가하거나 이름을 고치세요.',

  "formula-cycle.msg": "수식이 서로를 참조해 순환합니다: {path}.",
  "formula-cycle.hint": "순환을 끊으세요. 수식은 직접이든 다른 수식을 거쳐서든 자기 자신에 의존할 수 없습니다.",

  "unknown-property.note": '속성 "{name}" 이(가) 볼트의 어느 노트에도 없습니다 (노트 {count}개 확인).',
  "unknown-property.file": '"file.{name}" 은(는) file 필드가 아닙니다.',
  "unknown-property.hint-note": "속성 이름을 확인하거나 노트 frontmatter 에 추가하세요. --no-vault 로 이 검사를 건너뛸 수 있습니다.",
  "unknown-property.hint-file": "file 필드: {list}.",

  "mixed-type.msg": '속성 "{name}" 의 형식이 노트마다 다릅니다: {types}.{notes}',
  "mixed-type.hint": "모든 노트에서 속성 형식을 하나로 맞추고 .obsidian/types.json 에 선언하세요.",

  "empty-list-item.msg": '목록 속성 "{name}" 에 빈 항목이 있는 노트가 있습니다.{notes}',
  "empty-list-item.hint": '해당 노트에서 비어 있는 "-" 줄을 지우세요. Obsidian 이 필터 평가에 실패할 수 있습니다.',

  "sort-string.msg": '"sort" 가 텍스트 값입니다. Obsidian 은 property/direction 쌍의 목록을 기대하며 이 형태는 무시합니다.',
  "sort-string.hint": '"sort:" 아래 줄에 "- property: priority" 와 "  direction: DESC" 를 쓰세요.',

  "sort-not-in-order.msg":
    '정렬 속성 "{name}" 이(가) 이 뷰의 "order" 에 없습니다. 조용히 무시될 수 있습니다 (보고됨, 미확정).',
  "sort-not-in-order.hint": '"order" 에 "{name}" 을(를) 추가하거나 --disable sort-not-in-order 로 규칙을 끄세요.',

  "summary-unknown.msg": '요약 "{name}" 은(는) 내장 요약도 아니고 "summaries" 에 정의되어 있지도 않습니다.',
  "summary-unknown.hint": "내장 요약: {list}.",

  "hint.suggest": '"{suggestion}" 을(를) 말씀하신 건가요?',
  "fragment.notes": " 예시 노트: {list}.",

  "report.vault": "볼트: {path}",
  "report.summary": "문제 {total}개 (오류 {errors}, 경고 {warnings}){infos} · 파일 {files}개",
  "report.infos": ", 정보 {infos}",
  "report.hint": "고치는 법: {hint}",
  "report.docs": "근거: {url}",
  "severity.error": "오류",
  "severity.warning": "경고",
  "severity.info": "정보",
  "unit.problem.one": "",
  "unit.problem.other": "",
  "unit.error.one": "",
  "unit.error.other": "",
  "unit.warning.one": "",
  "unit.warning.other": "",
  "unit.info.one": "",
  "unit.info.other": "",
  "unit.file.one": "",
  "unit.file.other": "",
  "report.notice": "참고: {detail}",
  "notice.types-json-unreadable": "{path} 를 읽을 수 없습니다: {detail}",
  "notice.folder-unreadable": "읽을 수 없는 폴더를 건너뛰었습니다: {path} ({detail})",
  "notice.no-sources": "다음 경로에서 .base 파일이나 base 블록을 찾지 못했습니다: {paths}. 경로를 확인하세요.",

  "cli.help": `bases-lint {version} - Obsidian Bases 파일을 열어 보기 전에 검사합니다

사용법:
  bases-lint [옵션] <경로...>
  cat draft.base | bases-lint - [옵션]

경로는 .base 파일, \`\`\`base 블록이 든 노트(.md), 폴더가 될 수 있습니다. 표준 입력은 - 를 쓰세요.

옵션:
  --format <text|json|sarif>  출력 형식 (기본 text)
  --lang <en|ko>              메시지 언어 (기본: BASES_LINT_LANG, 그다음 LANG)
  --vault <dir>               속성 검사에 쓸 볼트 폴더 (기본: .obsidian 이 있는 가장 가까운 폴더)
  --no-vault                  볼트가 필요한 검사를 건너뜀
  --disable <rule>            규칙 끄기 (여러 번 쓸 수 있음)
  --strict                    경고도 종료 코드 1 로 처리
  --exit-zero                 명령줄이 틀린 경우가 아니면 항상 0 으로 종료
  --stdin-filename <name>     표준 입력에 표시할 이름 (기본 <stdin>)
  --rules                     규칙 목록을 보여 주고 종료
  -h, --help                  이 도움말
  -v, --version               버전

종료 코드: 0 오류 없음, 1 오류 있음(--strict 면 경고 포함), 2 명령줄 오류 또는 읽을 수 없는 경로.

규칙: {rules}`,
  "cli.no-paths": "경로가 없습니다. 예: bases-lint . (또는 bases-lint --help)",
  "cli.unknown-option": "알 수 없는 옵션 {option} 입니다. 옵션은 bases-lint --help 로 확인하세요.",
  "cli.missing-value": "옵션 {option} 에 값이 필요합니다. 옵션은 bases-lint --help 로 확인하세요.",
  "cli.bad-option": "명령줄이 올바르지 않습니다. 옵션은 bases-lint --help 로 확인하세요.",
  "cli.bad-lang": '지원하지 않는 언어 "{value}" 입니다. en 또는 ko 를 쓰세요.',
  "cli.bad-format": '지원하지 않는 형식 "{value}" 입니다. text, json, sarif 중 하나를 쓰세요.',
  "cli.bad-rule": '알 수 없는 규칙 "{value}" 입니다. 규칙: {rules}.',
  "cli.path-missing": "경로를 찾을 수 없습니다: {path}",
  "cli.path-unreadable": "{path} 을(를) 읽을 수 없습니다: {detail}",
  "cli.vault-missing": "볼트 폴더를 찾을 수 없습니다: {path}. --vault 에 존재하는 폴더를 넘기세요.",
  "cli.vault-conflict": "--vault 와 --no-vault 는 함께 쓸 수 없습니다.",
  "cli.stdin-empty": "표준 입력으로 들어온 내용이 없습니다.",
  "cli.rules-title": "규칙 (기본 심각도):",
};
