🤖 AI Skill-Gap Analyzer (기술 격차 분석 시스템)

[ ➡️ 데모 영상 링크 (Demo Video) ] https://youtu.be/f2W5pf6iXbA

1. 💡 프로젝트 개요 (Motivation)

저는 현재 3학년으로, 예비 취준생의 입장에서 '지금 시장이 원하는 기술'과 '내가 가진 기술' 사이의 격차(Skill-Gap)를 파악하는 데 어려움을 겪었습니다.

이 프로젝트는 Firecrawl(실시간 스크래핑 MCP)과 Groq(초고속 LLM MCP)를 활용하여, 잡코리아의 채용 공고와 나의 이력서를 실시간으로 비교/분석하고 '부족한 기술'과 '맞춤형 프로젝트'를 AI가 제안해주는 시스템입니다.

2. 🏛️ 핵심 아키텍처 (3-Tier & Proxy)

이 프로젝트의 핵심은 CORS 오류를 해결하고 API 키 보안을 확보하기 위해 **직접 구축한 Node.js/Express 프록시 서버(server.js)**입니다.

- Client (React @ localhost:3000):
  - 사용자 입력(직무, 이력서)을 받아 server.js에 API 요청을 보냅니다.
- Proxy MCP (Node.js @ localhost:8080):

  - React 앱의 CORS 요청을 cors 미들웨어로 허용합니다.
  - .env 파일에 API 키를 안전하게 숨기고, React를 대신하여 외부 MCP들을 호출합니다.
  - Firecrawl과 Groq를 순차적으로 호출(Orchestration)하고, 최종 JSON만 React에 반환합니다.

- External MCPs (Cloud APIs):
  - MCP 1: Firecrawl (실시간 웹 스크래핑)
  - MCP 2: Groq (LLM 비교/분석)

3. 💡 주요 문제 해결 과정 (The Story)

단순한 '앱 제작'이 아닌, 현업에서 발생하는 실제 장애 상황을 진단하고 아키텍처를 변경하며 해결했습니다.

- [실패 1] npx @smithery/cli (초기 MCP):

  - 문제: 로컬 서버가 stdio 모드로만 실행되어, React(axios)의 HTTP 통신과 호환 불가.
  - 결론: npx 로컬 MCP 방식 포기.

- [실패 2] React에서 '클라우드 API' 직접 호출:

  - 문제: Tavily 및 Gemini API가 localhost:3000의 요청을 CORS (Network Error) 또는 404 (권한) 오류로 거부.
  - 결론: 클라이언트가 외부 API를 직접 호출하는 아키텍처는 불가능.

- [해결 3] Node.js/Express 프록시 서버 구축:

  - 해결: React와 외부 API 사이에 server.js(로컬 MCP)를 배치.
  - (React ➡️ server.js ➡️ Cloud API) 구조로 모든 CORS 및 API Key 보안 문제를 해결.

- [실패 4] API 키 및 모델 호환성:

  - 문제: OpenAI(429), Gemini(404) 등 API 키의 할당량 및 플랜 문제 발생.
  - 해결: 100% 무료이며 JSON Mode를 지원하는 Groq (llama-3.1-instant)를 최종 MCP 2로 선정.

- [최적화 5] 프롬프트 엔지니어링:
  - 문제: AI가 '직무명'이나 '깨진 텍스트'를 반환.
  - 해결: server.js의 프롬프트에 '기술 스택만 추출', '한국어로만 응답', temperature: 0 등 강력한 규칙을 추가하여 응답 안정성 확보.

4. 🛠️ 기술 스택

- Frontend: React, TypeScript, axios
- Backend (MCP): Node.js, Express, cors, dotenv
- External MCPs: Firecrawl (Scraping), Groq (LLM)
- Development Tool: Cursor (AI Pair Programmer)

5. 🚀 실행 방법

1. git clone 후 npm install을 실행합니다.
1. 루트 폴더에 .env 파일을 생성하고 .env.example 파일을 참고하여 API 키를 입력합니다.
1. (터미널 1) node server.js (백엔드 MCP 서버 실행)
1. (터미널 2) npm start (React 클라이언트 실행)
1. 브라우저에서 http://localhost:3000에 접속합니다.
