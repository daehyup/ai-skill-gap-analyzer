/*
 * src/App.tsx
 * "My Skill-Gap Analyzer" (Node.js/Express 아키텍처)
 * [FIX]: server.js의 새로운 응답(summary, projectSuggestions)을 받도록 수정
 */

import React, { useState } from 'react';
import axios, { AxiosError } from 'axios';
import './index.css'; // index.css를 임포트합니다.

// -------------------------------------------------------------------
// ✅ [수정됨]: AI의 새로운 응답(summary, projectSuggestions)을 포함하도록 타입 정의 확장
interface ProjectSuggestion {
  title: string;
  description: string;
}

interface SkillAnalysisResult {
  mySkills: string[];
  skillGaps: string[];
  summary: string;
  projectSuggestions: ProjectSuggestion[];
}
// -------------------------------------------------------------------

const MCP_SERVER_URL = 'http://localhost:8080/api/analyze';
// -------------------------------------------------------------------

function App() {
  const [jobTitle, setJobTitle] = useState<string>('백엔드 개발자');
  const [myResume, setMyResume] = useState<string>(
    '보유 기술: Java, Spring Boot, MySQL, Git'
  );

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] =
    useState<SkillAnalysisResult | null>(null);

  /**
   * MCP 서버에 분석을 요청하는 메인 핸들러
   */
  const handleAnalysis = async () => {
    setLoading(true);
    setError(null);
    setAnalysisResult(null);

    // --- 1단계: 우리 고유 MCP(server.js) 호출 ---
    try {
      // 1. React 앱은 그저 jobTitle과 myResume만 MCP에 보냅니다.
      const response = await axios.post(
        MCP_SERVER_URL,
        {
          jobTitle: jobTitle,
          myResume: myResume,
        },
        {
          headers: { 'Content-Type': 'application/json' },
        }
      );

      // 2. 서버(server.js)가 반환한 최종 SkillGap JSON을 받습니다.
      const resultData: SkillAnalysisResult = response.data;

      // 3. 응답 구조 유효성 검사
      // ✅ [수정됨]: summary와 projectSuggestions 키가 있는지 함께 검사
      if (
        !resultData.mySkills ||
        !resultData.skillGaps ||
        !resultData.summary ||
        !resultData.projectSuggestions
      ) {
        console.error('받은 데이터:', resultData);
        throw new Error('서버가 올바른 SkillGap JSON을 반환하지 않았습니다.');
      }

      setAnalysisResult(resultData);
    } catch (err) {
      const axiosError = err as AxiosError;
      console.error('분석 실패:', axiosError.response?.data);
      // 서버(server.js)가 보낸 에러 메시지를 표시
      const serverError = axiosError.response?.data as { error?: string };
      setError(
        `분석에 실패했습니다: ${serverError?.error || axiosError.message}`
      );
    } finally {
      setLoading(false);
    }
  };

  // --- (return 문) ---
  return (
    <div className="App">
      <header className="App-header">
        <h1>My Skill-Gap Analyzer</h1>
        <p>AI가 '시장'과 '나'를 비교하여 부족한 기술을 분석합니다.</p>
      </header>

      <main className="App-main">
        <div className="input-section">
          <div className="input-group">
            <label htmlFor="jobTitle">1. 분석할 직무</label>
            <input
              id="jobTitle"
              type="text"
              value={jobTitle}
              onChange={e => setJobTitle(e.target.value)} // (오류 수정됨)
              placeholder="예: 프론트엔드 개발자"
            />
          </div>
          <div className="input-group">
            <label htmlFor="myResume">2. 나의 이력서 (핵심 기술)</label>
            <textarea
              id="myResume"
              value={myResume}
              onChange={e => setMyResume(e.target.value)}
              rows={10}
              placeholder="보유하신 기술, 프로젝트 경험, 학력 등을 자유롭게 붙여넣으세요..."
            />
          </div>
          <button onClick={handleAnalysis} disabled={loading}>
            {loading ? 'AI 분석 중...' : 'Skill-Gap 분석 시작'}
          </button>
        </div>

        {error && (
          <div className="error-panel">
            <h3>오류 발생</h3>
            <p>{error}</p>
          </div>
        )}

        {/* // -------------------------------------------------------------------
        // ✅ [수정됨]: AI 총평, 추천 프로젝트를 표시하도록 JSX 수정
        // -------------------------------------------------------------------
        */}
        {analysisResult && (
          <div className="result-section">
            <h2>분석 결과</h2>

            {/* AI 총평 섹션 */}
            <div className="result-card summary">
              <h3>AI 총평 🎙️</h3>
              <p>{analysisResult.summary}</p>
            </div>

            {/* 기술 스택 비교 섹션 */}
            <div className="result-columns">
              <div className="result-card common">
                <h3>보유 기술 (시장 공통) ✅</h3>
                <ul>
                  {analysisResult.mySkills.length > 0 ? (
                    analysisResult.mySkills.map((skill, index) => (
                      <li key={`common-${index}`}>{skill}</li>
                    ))
                  ) : (
                    <li>공통 기술을 찾을 수 없습니다.</li>
                  )}
                </ul>
              </div>
              <div className="result-card gap">
                <h3>부족한 기술 (Skill Gap) 🚩</h3>
                <ul>
                  {analysisResult.skillGaps.length > 0 ? (
                    analysisResult.skillGaps.map((skill, index) => (
                      <li key={`gap-${index}`}>{skill}</li>
                    ))
                  ) : (
                    <li>부족한 기술을 찾을 수 없습니다!</li>
                  )}
                </ul>
              </div>
            </div>

            {/* 추천 프로젝트 섹션 */}
            <div className="result-card projects">
              <h3>추천 프로젝트 (Skill-Gap 보완) 💡</h3>
              {analysisResult.projectSuggestions.length > 0 ? (
                analysisResult.projectSuggestions.map((project, index) => (
                  <div className="project-item" key={`project-${index}`}>
                    <h4>{project.title}</h4>
                    <p>{project.description}</p>
                  </div>
                ))
              ) : (
                <p>추천할 프로젝트를 생성하지 못했습니다.</p>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
