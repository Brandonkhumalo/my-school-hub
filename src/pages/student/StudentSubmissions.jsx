import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import Header from "../../components/Header";
import LoadingSpinner from "../../components/LoadingSpinner";
import apiService from "../../services/apiService";

export default function StudentSubmissions() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitModal, setSubmitModal] = useState(null); // assignment being submitted
  const [submitText, setSubmitText] = useState("");
  const [submitFile, setSubmitFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitMsg, setSubmitMsg] = useState("");

  useEffect(() => {
    loadSubmissions();
  }, []);

  const loadSubmissions = async () => {
    try {
      setLoading(true);
      const data = await apiService.getStudentSubmissions();
      setSubmissions(data);
    } catch (error) {
      console.error("Error loading submissions:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  const isOverdue = (deadline) => {
    return new Date(deadline) < new Date();
  };

  const daysUntil = (deadline) => {
    const diff = new Date(deadline) - new Date();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return days;
  };

  if (loading) {
    return (
      <div>
        <Header title="My Submissions" user={user} />
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div>
      <Header title="My Submissions" user={user} />
      
      <div className="p-6">
        <button
          onClick={() => navigate(-1)}
          className="mb-4 flex items-center text-blue-600 hover:text-blue-800 font-medium"
        >
          <i className="fas fa-arrow-left mr-2"></i>
          Back
        </button>
        
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">Upcoming Submission Deadlines</h2>
          
          {submissions.length === 0 ? (
            <div className="text-center py-12">
              <i className="fas fa-clipboard-check text-6xl text-gray-300 mb-4"></i>
              <p className="text-gray-500 text-lg">No upcoming submissions</p>
            </div>
          ) : (
            <div className="space-y-4">
              {submissions.map((submission) => {
                const days = daysUntil(submission.deadline);
                const overdue = isOverdue(submission.deadline);
                
                return (
                  <div
                    key={submission.id}
                    className={`p-4 rounded-lg border-l-4 ${
                      overdue
                        ? 'border-red-500 bg-red-50'
                        : days <= 3
                        ? 'border-orange-500 bg-orange-50'
                        : 'border-blue-500 bg-blue-50'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center mb-2">
                          <i className={`fas fa-book mr-3 text-xl ${
                            overdue ? 'text-red-600' : days <= 3 ? 'text-orange-600' : 'text-blue-600'
                          }`}></i>
                          <h3 className="text-lg font-semibold text-gray-800">{submission.subject_name}</h3>
                        </div>
                        <p className="text-gray-700 mb-2">{submission.title}</p>
                        <p className="text-sm text-gray-600">{submission.description}</p>
                      </div>
                      
                      <div className="ml-4 text-right">
                        <p className="text-sm text-gray-600 mb-1">Due Date</p>
                        <p className={`font-semibold ${
                          overdue ? 'text-red-600' : days <= 3 ? 'text-orange-600' : 'text-blue-600'
                        }`}>
                          {formatDate(submission.deadline)}
                        </p>
                        {overdue ? (
                          <span className="inline-block mt-2 px-3 py-1 bg-red-600 text-white text-xs rounded-full">
                            Overdue
                          </span>
                        ) : (
                          <span className={`inline-block mt-2 px-3 py-1 text-xs rounded-full ${
                            days <= 3 ? 'bg-orange-600 text-white' : 'bg-blue-600 text-white'
                          }`}>
                            {days} {days === 1 ? 'day' : 'days'} left
                          </span>
                        )}
                        <button
                          onClick={() => { setSubmitModal(submission); setSubmitText(""); setSubmitFile(null); setSubmitMsg(""); }}
                          className="block mt-2 w-full px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-xs rounded transition">
                          Submit
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Submit assignment modal */}
      {submitModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4 relative">
            <button onClick={() => setSubmitModal(null)}
              className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 text-xl">&times;</button>
            <h3 className="text-lg font-bold mb-1">Submit Assignment</h3>
            <p className="text-sm text-gray-500 mb-4">{submitModal.title} — {submitModal.subject_name}</p>
            {submitMsg && (
              <div className="bg-green-100 text-green-700 p-2 rounded text-sm mb-3">{submitMsg}</div>
            )}
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-600 mb-1 block">Text Answer</label>
                <textarea rows={4} className="border rounded w-full p-2 text-sm"
                  placeholder="Type your answer here..."
                  value={submitText} onChange={(e) => setSubmitText(e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-gray-600 mb-1 block">Or upload a file</label>
                <input type="file" className="text-sm"
                  onChange={(e) => setSubmitFile(e.target.files[0])} />
              </div>
              <button disabled={submitting || (!submitText && !submitFile)}
                onClick={async () => {
                  setSubmitting(true);
                  try {
                    const fd = new FormData();
                    if (submitText) fd.append("text_submission", submitText);
                    if (submitFile) fd.append("file", submitFile);
                    await apiService.submitAssignment(submitModal.id, fd);
                    setSubmitMsg("Submitted successfully!");
                    setTimeout(() => setSubmitModal(null), 1500);
                  } catch (e) {
                    setSubmitMsg("Error: " + (e.message || "Submission failed"));
                  } finally {
                    setSubmitting(false);
                  }
                }}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white py-2 rounded text-sm">
                {submitting ? "Submitting..." : "Submit Assignment"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
