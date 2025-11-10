/*
 * server.js
 * "My Skill-Gap Analyzer"의 최종 MCP 서버 (Node.js/Express)
 * [FIX]: AI가 깨진 텍스트(Garbled Text)를 반환하는 오류를 잡기 위해 'temperature: 0' 설정 추가
 */
require('dotenv').config(); // .env 파일 읽기
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const Groq = require('groq-sdk');

const app = express();
const PORT = 8080; // React(3000)와 겹치지 않는 포트

// 0. Middleware 설정
app.use(cors()); // React 앱(localhost:3000)의 요청을 허용 (CORS 해결)
app.use(express.json()); // React가 보낸 JSON body를 파싱

// .env 파일에서 키를 안전하게 불러옴
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY;

// Groq 클라이언트 초기화
const groq = new Groq({ apiKey: GROQ_API_KEY });

// API 엔드포인트
const FIRECRAWL_API_URL = process.env.FIRECRAWL_API_URL;

/**
 * 🚀 React 앱이 호출할 유일한 MCP 엔드포인트
 */
app.post('/api/analyze', async (req, res) => {
  // 0. React 앱으로부터 jobTitle, myResume 받기
  const { jobTitle, myResume } = req.body;

  if (!jobTitle || !myResume) {
    return res
      .status(400)
      .json({ error: 'jobTitle and myResume are required' });
  }

  let marketData;

  // --- 1단계: Firecrawl (MCP 1)로 시장 공고 스크래핑 ---
  console.log('1/2: Firecrawl 스크래핑 시작...');
  try {
    const jobSearchUrl = `https://www.jobkorea.co.kr/Search/?Stext=${encodeURIComponent(
      jobTitle
    )}`;

    const firecrawlResponse = await axios.post(
      FIRECRAWL_API_URL,
      {
        url: jobSearchUrl,
        pageOptions: { onlyMainContent: true },
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
        },
      }
    );
    marketData = firecrawlResponse.data.data.markdown;
    if (!marketData) {
      throw new Error('Firecrawl이 데이터를 수집하지 못했습니다.');
    }
    marketData = marketData.substring(0, 15000); // 최대 15000자
    console.log('1/2: Firecrawl 스크래핑 성공.');
  } catch (err) {
    console.error('Firecrawl (MCP 1) 실패:', err.response?.data);
    return res.status(500).json({
      error: `1단계 스크래핑 실패: ${err.message}. (JobKorea가 봇을 차단한 것 같습니다.)`,
    });
  }

  // --- 2단계: Groq (MCP 2)로 AI 비교 분석 ---
  console.log('2/2: Groq (Llama 3.1) AI 분석 시작...');

  const analysisPrompt = `
    [CONTEXT]: 당신은 최고의 HR 기술 분석 전문가입니다. 당신의 임무는 '기술 스택'만 정확히 추출하는 것입니다.
    [MY_RESUME]: ${myResume}
    [MARKET_DATA]: (스크래핑된 잡코리아 데이터: ${marketData})

    [TASK]:
    1. [MARKET_DATA]를 분석하여 '${jobTitle}' 직무에 요구되는 *오직* '기술 스택'(프로그래밍 언어, 프레임워크, DB, 클라우드 기술)만 추출하십시오.
    2. *절대* '웹에이전시', '네트워크엔지니어', '보안엔지니어', '백엔드개발자' 같은 '회사 종류'나 '직무명'은 추출하지 마십시오.
    3. (예시: 'AWS', 'Kubernetes', 'Docker', 'JPA', 'MySQL', 'Python', 'Node.js' 등 '기술/도구'만 추출해야 합니다.)
    4. [MY_RESUME]에 있는 기술 스택과 1번에서 추출한 '시장 요구 기술 스택'을 비교하십시오.
    5. 응답에 [MY_RESUME] 또는 [MARKET_DATA]라는 단어 대신 "나의 이력서"와 "시장 요구 스펙"이라는 *한글 단어*를 사용하십시오.
    6. 모든 응답(summary, project title, description)은 *반드시* 격식 있는 **'완벽한 한국어'**로 작성하십시오. *절대* 깨진 텍스트나 영어, 알 수 없는 기호를 반환하지 마십시오.

    [OUTPUT_FORMAT]: 응답은 *오직* 순수한 JSON 객체 형식이어야 합니다. (Markdown \`\`\`json 래퍼 사용 금지)
    이 JSON 객체는 4개의 키를 가져야 합니다:
    1. "mySkills": [MY_RESUME]과 [MARKET_DATA] 모두에서 공통으로 발견되는 *기술 스택* 배열 (string[]).
    2. "skillGaps": [MARKET_DATA]에서는 매우 빈번하게 등장하지만 [MY_RESUME]에는 누락된 *기술 스택* 배열 (string[]).
    3. "summary": [MY_RESUME]과 [MARKET_DATA]를 비교한 AI의 '총평' (string, **완벽한 한국어**).
    4. "projectSuggestions": 'skillGaps'를 보완할 수 있는 2개의 '추천 프로젝트' (ProjectSuggestion[], title과 description을 **완벽한 한국어**로 작성).
  `;

  try {
    // 1. Groq API에 보낼 요청
    const completion = await groq.chat.completions.create({
      model: process.env.GROQ_MODEL_NAME,
      messages: [
        {
          role: 'system',
          content:
            'You are a helpful HR analyst that only responds in strict JSON format.',
        },
        { role: 'user', content: analysisPrompt },
      ],
      response_format: { type: 'json_object' },
      // -------------------------------------------------------------------
      // ✅ [수정됨]: AI의 응답 안정성을 높여 깨진 텍스트 방지
      temperature: 0,
      // -------------------------------------------------------------------
    });

    const aiAnswer = completion.choices[0].message.content;
    if (!aiAnswer) {
      throw new Error('Groq AI가 답변을 생성하지 못했습니다.');
    }

    // 2. 성공! React 앱에 최종 JSON 결과 반환
    console.log('2/2: Groq AI 분석 성공.');
    res.status(200).json(JSON.parse(aiAnswer));
  } catch (err) {
    // 순수 JavaScript로 오류 처리
    console.error('Groq (MCP 2) 실패:', err.message);

    let errorMessage = err.message;
    if (err.response && err.response.data && err.response.data.error) {
      errorMessage = err.response.data.error.message;
    } else if (err.response) {
      errorMessage = `Request failed with status code ${err.response.status}`;
    }

    return res.status(500).json({ error: `AI 분석 실패: ${errorMessage}` });
  }
});

app.listen(PORT, () => {
  console.log(
    `✅ "My Skill-Gap Analyzer" MCP 서버(백END)가 http://localhost:${PORT} 에서 실행 중입니다.`
  );
});
