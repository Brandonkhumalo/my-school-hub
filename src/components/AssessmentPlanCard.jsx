import React, { useMemo, useState } from "react";

function normalizePlanRows(plans) {
  const rows = [];
  (plans || []).forEach((plan) => {
    const subjects = Array.isArray(plan.subjects_detail) ? plan.subjects_detail : [];
    subjects.forEach((subject) => {
      rows.push({
        plan_id: plan.id,
        subject_id: subject.id,
        subject_name: subject.name,
        year: plan.academic_year,
        term: plan.academic_term,
        effective_papers: Array.isArray(plan.effective_papers) ? plan.effective_papers : [],
        num_tests: Number(plan.num_tests || 0),
        num_assignments: Number(plan.num_assignments || 0),
      });
    });
  });
  return rows;
}

function makeResultKey(subjectId, kind, index) {
  return `${subjectId}::${kind || ""}::${index == null ? "" : index}`;
}

export default function AssessmentPlanCard({ plans = [], existingResults = [], isLoading = false, year, term }) {
  const [expandedSubjects, setExpandedSubjects] = useState({});

  const planRows = useMemo(() => normalizePlanRows(plans), [plans]);

  const resultKeyMap = useMemo(() => {
    const map = new Set();
    (existingResults || []).forEach((result) => {
      const subjectId = result.subject_id ?? result.subject;
      if (!subjectId) return;
      map.add(makeResultKey(subjectId, result.component_kind, result.component_index));
    });
    return map;
  }, [existingResults]);

  if (isLoading) {
    return (
      <div className="bg-blue-50 border-l-4 border-blue-400 p-6 rounded-lg mb-6">
        <div className="flex items-center">
          <svg className="animate-spin h-5 w-5 text-blue-500 mr-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span className="text-sm text-blue-700">Loading assessment plans...</span>
        </div>
      </div>
    );
  }

  if (!planRows.length) {
    return (
      <div className="bg-gray-50 border-l-4 border-gray-300 p-6 rounded-lg mb-6">
        <div className="flex items-start">
          <i className="fas fa-info-circle text-gray-500 mr-3 mt-0.5"></i>
          <p className="text-sm text-gray-700">No assessment plans available for {term} {year}.</p>
        </div>
      </div>
    );
  }

  const toggleSubject = (subjectId) => {
    setExpandedSubjects((prev) => ({ ...prev, [subjectId]: !prev[subjectId] }));
  };

  const ComponentBadge = ({ component, componentKind, componentIndex, subjectId }) => {
    const hasResult = resultKeyMap.has(makeResultKey(subjectId, componentKind, componentIndex));
    return (
      <span
        className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium mr-2 mb-2 ${
          hasResult ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-700"
        }`}
      >
        {component}
        {hasResult && <i className="fas fa-check ml-1"></i>}
      </span>
    );
  };

  return (
    <div className="bg-blue-50 border-l-4 border-blue-400 p-6 rounded-lg mb-6">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-blue-900">
          <i className="fas fa-clipboard-list mr-2"></i>
          Assessment Components — {term} {year}
        </h3>
        <p className="text-xs text-blue-700 mt-1">
          Planned components for each subject.{" "}
          <span className="inline-block px-2 py-0.5 bg-green-100 text-green-800 rounded text-xs mt-1">
            Components with <i className="fas fa-check"></i> have marks entered.
          </span>
        </p>
      </div>

      <div className="space-y-2">
        {planRows.map((plan) => (
          <div key={`${plan.plan_id}-${plan.subject_id}`} className="bg-white rounded-lg border border-blue-200 overflow-hidden">
            <button
              onClick={() => toggleSubject(plan.subject_id)}
              className="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors flex items-center justify-between"
            >
              <div className="flex items-center space-x-2">
                <i className={`fas fa-chevron-${expandedSubjects[plan.subject_id] ? "down" : "right"} text-blue-600`}></i>
                <span className="font-medium text-gray-900">{plan.subject_name}</span>
              </div>
              <div className="flex items-center space-x-3 text-xs text-gray-500">
                {plan.effective_papers.length > 0 && (
                  <span>
                    <i className="fas fa-file-pdf text-red-500 mr-1"></i>
                    {plan.effective_papers.length}P
                  </span>
                )}
                {plan.num_tests > 0 && (
                  <span>
                    <i className="fas fa-pencil-alt text-blue-500 mr-1"></i>
                    {plan.num_tests}T
                  </span>
                )}
                {plan.num_assignments > 0 && (
                  <span>
                    <i className="fas fa-tasks text-green-500 mr-1"></i>
                    {plan.num_assignments}A
                  </span>
                )}
              </div>
            </button>

            {expandedSubjects[plan.subject_id] && (
              <div className="px-4 py-3 bg-gray-50 border-t border-blue-200">
                {plan.effective_papers.length > 0 && (
                  <div className="mb-3">
                    <p className="text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                      <i className="fas fa-file-pdf text-red-500 mr-1"></i>Exam Papers
                    </p>
                    <div>
                      {plan.effective_papers.map((paperNumber) => (
                        <ComponentBadge
                          key={`paper_${paperNumber}`}
                          component={`Paper ${paperNumber}`}
                          componentKind="paper"
                          componentIndex={paperNumber}
                          subjectId={plan.subject_id}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {plan.num_tests > 0 && (
                  <div className="mb-3">
                    <p className="text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                      <i className="fas fa-pencil-alt text-blue-500 mr-1"></i>Tests
                    </p>
                    <div>
                      {Array.from({ length: plan.num_tests }).map((_, idx) => {
                        const testNumber = idx + 1;
                        return (
                          <ComponentBadge
                            key={`test_${testNumber}`}
                            component={`Test ${testNumber}`}
                            componentKind="test"
                            componentIndex={testNumber}
                            subjectId={plan.subject_id}
                          />
                        );
                      })}
                    </div>
                  </div>
                )}

                {plan.num_assignments > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                      <i className="fas fa-tasks text-green-500 mr-1"></i>Assignments
                    </p>
                    <div>
                      {Array.from({ length: plan.num_assignments }).map((_, idx) => {
                        const assignmentNumber = idx + 1;
                        return (
                          <ComponentBadge
                            key={`assignment_${assignmentNumber}`}
                            component={`Assignment ${assignmentNumber}`}
                            componentKind="assignment"
                            componentIndex={assignmentNumber}
                            subjectId={plan.subject_id}
                          />
                        );
                      })}
                    </div>
                  </div>
                )}

                {plan.effective_papers.length === 0 && plan.num_tests === 0 && plan.num_assignments === 0 && (
                  <p className="text-xs text-gray-500 italic">No assessment components planned for this subject.</p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
