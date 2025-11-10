/*
 * api/analyze.ts
 * "My Skill-Gap Analyzer"의 핵심 MCP (Serverless Function)
 * React 앱의 CORS 문제를 해결하기 위한 '프록시' 역할을 함.
 */

// Vercel/Netlify 환경에서는 Request/Response 객체를 가져와야 함
// 여기서는 Node.js의 http 모듈을 예시로 사용 (환경에 따라 다름)
// 하지만 Cursor/Vercel 환경을 가정하고, Vercel API 라우트 형식으로 작성합니다.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import axios from 'axios';

// API 키 (mcp.json에서 가져옴)
// 🚨 실제 배포 시 이 키들은 Vercel/Netlify의 '환경 변수'로 옮겨야 합니다.
const FIRECRAWL_API_KEY = 'fc-c8dbf380bd4547269941996358858d68';
const TAVILY_API_KEY = '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';

// API 엔드포인트
const FIRECRAWL_API_URL = 'https://api.firecrawl.dev/v0/scrape';
const TAVILY_API_URL = 'https://api.tavily.com/research';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 0. React 앱으로부터 jobTitle, myResume 받기
  const { jobTitle, myResume } = req.body;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  if (!jobTitle || !myResume) {
    return res
      .status(400)
      .json({ error: 'jobTitle and myResume are required' });
  }

  let marketData: string;

  // --- 1단계: Firecrawl (MCP 1)로 시장 공고 스크래핑 ---
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
  } catch (err: any) {
    console.error('Firecrawl (MCP 1) 실패:', err.response?.data);
    return res
      .status(500)
      .json({ error: `1단계 스크래핑 실패: ${err.message}` });
  }

  // --- 2단계: Tavily (MCP 2)로 AI 비교 분석 ---
  const analysisPrompt = `
    [CONTEXT]: 당신은 최고의 HR 기술 분석 전문가입니다.
    [MY_RESUME]: ${myResume}
    [MARKET_DATA]: (스크래핑된 잡코리아 데이터: ${marketData})
    [TASK]: [MARKET_DATA]에서 '${jobTitle}' 직무의 요구 스펙을 파악한 뒤, [MY_RESUME] 데이터와 비교 분석하십시오.
    [OUTPUT_FORMAT]: 응답은 *오직* JSON 객체 형식이어야 합니다.
    이 JSON 객체는 두 개의 키를 가져야 합니다:
    1. "mySkills": [MY_RESUME]과 [MARKET_DATA] 모두에서 공통으로 발견되는 핵심 기술 키워드 배열 (string[]).
    2. "skillGaps": [MARKET_DATA]에서는 매우 빈번하게 등장하지만 [MY_RESUME]에는 누락된 핵심 기술 키워드 배열 (string[]).
    다른 설명 없이 JSON 객체만 반환하십시오.
  `;

  try {
    const tavilyResponse = await axios.post(
      TAVILY_API_URL,
      {
        api_key: TAVILY_API_KEY,
        query: analysisPrompt,
        search_depth: 'basic',
        include_answer: true,
        max_results: 1,
      },
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );

    const aiAnswer = tavilyResponse.data.answer;
    if (!aiAnswer) {
      throw new Error('Tavily AI가 답변을 생성하지 못했습니다.');
    }

    // AI 응답에서 JSON만 추출
    const jsonMatch = aiAnswer.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('Tavily AI Answer:', aiAnswer);
      throw new Error('AI 응답(answer)에서 유효한 JSON을 찾을 수 없습니다.');
    }

    // 7. 성공! React 앱에 최종 JSON 결과 반환
    res.status(200).json(JSON.parse(jsonMatch[0]));
  } catch (err: any) {
    console.error('Tavily (MCP 2) 실패:', err.response?.data);
    return res
      .status(500)
      .json({ error: `2단계 AI 분석 실패: ${err.message}` });
  }
}
