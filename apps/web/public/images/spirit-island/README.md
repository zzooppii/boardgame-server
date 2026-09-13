# 정령섬 이미지

`spirits.png`는 2026-09-13 내장 `image_gen.imagegen`으로 이 프로젝트를 위해 생성한 원본이다. 로비·정령 선택·개인 패널·카드 장식에 CSS crop으로 사용한다. 원작 보드게임의 카드나 정령 그림을 배포 파일로 복사하지 않았다. 지도·기물은 코드에서 SVG/CSS로 그린다. 효과음은 `features/spirit-island/sound.ts`의 Web Audio 합성이다.

최종 프롬프트:

> Use case: stylized-concept. Asset type: original panoramic illustration for a cooperative island-defense board-game web app, used in lobby and spirit-selection cards. Create a premium hand-painted fantasy board-game illustration, wide 3:2 landscape, no text, no letters, no logos, no UI, no card frames. Four clearly distinct elemental nature spirits arranged from left to right with their entire faces/upper bodies visible in separate quarters: a turquoise flowing river spirit formed from water and sunlit reeds, an amber lightning bird spirit with branching lightning wings, a massive moss-covered stone earth guardian, and a violet shadow flame spirit with glowing ember eyes. They rise around a lush tropical island, teal sea, waterfalls, layered green jungle, pale beaches and rocky ridges. Cohesive painterly brushwork, tactile gouache and ink textures, richly detailed atmospheric depth, luminous magic, dramatic but welcoming rather than horror. Keep important faces centered within each quarter so web cards can crop these four quarters individually. Original character designs; do not copy any existing Spirit Island artwork. Art only, absolutely no writing or watermark.

## 기본판 후속 이미지 (2026-09-13)

- `powers.png`: built-in imagegen으로 생성한 4×4 능력 테마 아틀라스(16종). 태양/강, 번개, 바위, 그림자, 바다, 녹음, 악몽, 천둥, 뿌리, 화산, 회복, 공포, 동물, 대지, 다한, 비의 독립 장면을 요청했다. 네 추가 정령과 카드별 효과 테마에 CSS로 배정한다.
- `island.png`: built-in imagegen으로 생성한 탑뷰 열대 섬. 연결된 육지, 북서 산맥, 밀림, 중앙 습지, 남동 모래와 청록 바다를 요청했다. 글자·기물·영역 경계 없는 수채/과슈 풍의 원본 배경이며, 실제 지역과 인접은 UI 표식이 나타낸다.
- 외부 보드게임의 원본 일러스트·패널·카드 이미지를 제품에 복사하지 않았다. 참조 패널과 규칙서 이미지는 `/tmp`의 개발 대조 자료다.

## 가지와 발톱 정령 이미지 (2026-09-13)

- `branch-claw.png`: built-in imagegen으로 새로 만든 1536×1024 원본. 왼쪽에는 잎사귀와 빛으로 이루어진 야수 정령, 오른쪽에는 고목과 뿌리로 이루어진 수호 정령을 배치했다. 두 정령의 선택 화면과 개인 패널에서 각각 절반을 crop한다.
- 그림 방향: 무성한 열대 숲, 과슈 풍의 붓질, 청록·금색 빛, 좌우 독립 구도, 문자·로고·카드 테두리 없음. 원작 일러스트를 복사하지 않는 독립 디자인.
- 두 정령의 효과음은 외부 음원이 아닌 Web Audio 합성 음계로 구분한다.
