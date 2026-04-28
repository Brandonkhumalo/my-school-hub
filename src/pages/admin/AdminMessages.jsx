import React, { useEffect, useState } from "react";
import Header from "../../components/Header";
import LoadingSpinner from "../../components/LoadingSpinner";
import apiService from "../../services/apiService";
import { formatDateTime } from "../../utils/dateFormat";

export default function AdminMessages() {
  const [threads, setThreads] = useState([]);
  const [selected, setSelected] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [loadingThread, setLoadingThread] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    (async () => {
      try {
        setLoadingThreads(true);
        const data = await apiService.adminListConversations();
        setThreads(data || []);
      } catch (err) {
        console.error("Error loading conversations:", err);
      } finally {
        setLoadingThreads(false);
      }
    })();
  }, []);

  const openThread = async (thread) => {
    setSelected(thread);
    try {
      setLoadingThread(true);
      const data = await apiService.adminGetConversation(thread.teacher_id, thread.parent_id);
      setMessages(data || []);
    } catch (err) {
      console.error("Error loading thread:", err);
      setMessages([]);
    } finally {
      setLoadingThread(false);
    }
  };

  const filtered = threads.filter((t) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      t.teacher_name.toLowerCase().includes(q) ||
      t.parent_name.toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex-1 overflow-auto">
      <Header title="Parent–Teacher Conversations" />
      <div className="p-6">
        <div className="bg-white rounded-lg shadow-md p-4 mb-4">
          <p className="text-sm text-gray-600">
            Read-only view of all messages between parents and teachers in your school.
            Phone numbers and email addresses are automatically blocked from being sent.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Threads list */}
          <div className="bg-white rounded-lg shadow-md p-4 lg:col-span-1">
            <input
              type="text"
              placeholder="Search by teacher or parent name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-3 py-2 mb-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {loadingThreads ? (
              <LoadingSpinner />
            ) : (
              <div className="space-y-2 max-h-[70vh] overflow-y-auto">
                {filtered.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <i className="fas fa-inbox text-3xl mb-2"></i>
                    <p>No conversations found</p>
                  </div>
                )}
                {filtered.map((t) => {
                  const key = `${t.teacher_id}-${t.parent_id}`;
                  const active =
                    selected &&
                    selected.teacher_id === t.teacher_id &&
                    selected.parent_id === t.parent_id;
                  return (
                    <div
                      key={key}
                      onClick={() => openThread(t)}
                      className={`p-3 rounded-lg cursor-pointer transition ${
                        active ? "bg-blue-500 text-white" : "bg-gray-50 hover:bg-gray-100"
                      }`}
                    >
                      <div className="font-semibold">
                        <i className="fas fa-chalkboard-teacher mr-1"></i> {t.teacher_name}
                      </div>
                      <div className={`text-sm ${active ? "text-blue-100" : "text-gray-600"}`}>
                        <i className="fas fa-user mr-1"></i> {t.parent_name}
                      </div>
                      <div
                        className={`text-xs mt-1 truncate ${
                          active ? "text-blue-100" : "text-gray-500"
                        }`}
                      >
                        {t.last_message}
                      </div>
                      <div
                        className={`text-xs mt-1 flex justify-between ${
                          active ? "text-blue-100" : "text-gray-400"
                        }`}
                      >
                        <span>{t.message_count} messages</span>
                        <span>{t.last_message_date ? formatDateTime(t.last_message_date) : ""}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Thread viewer */}
          <div className="bg-white rounded-lg shadow-md p-4 lg:col-span-2">
            {!selected ? (
              <div className="text-center py-16 text-gray-500">
                <i className="fas fa-comments text-5xl mb-3"></i>
                <p>Select a conversation to review</p>
              </div>
            ) : loadingThread ? (
              <LoadingSpinner />
            ) : (
              <>
                <div className="border-b pb-3 mb-3">
                  <h3 className="text-lg font-semibold text-gray-800">
                    {selected.teacher_name} ↔ {selected.parent_name}
                  </h3>
                  <p className="text-sm text-gray-500">{messages.length} messages</p>
                </div>
                <div className="space-y-3 max-h-[70vh] overflow-y-auto">
                  {messages.map((msg) => {
                    const fromTeacher = msg.sender === selected.teacher_id;
                    return (
                      <div
                        key={msg.id}
                        className={`p-3 rounded-lg ${
                          fromTeacher
                            ? "bg-green-50 border-l-4 border-green-400"
                            : "bg-blue-50 border-l-4 border-blue-400"
                        }`}
                      >
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-sm font-semibold text-gray-700">
                            {fromTeacher ? selected.teacher_name : selected.parent_name}
                            <span className="ml-2 text-xs text-gray-500">
                              ({fromTeacher ? "Teacher" : "Parent"})
                            </span>
                          </span>
                          <span className="text-xs text-gray-500">
                            {formatDateTime(msg.date_sent)}
                          </span>
                        </div>
                        {msg.subject && (
                          <div className="text-sm font-medium text-gray-800 mb-1">
                            {msg.subject}
                          </div>
                        )}
                        <div className="text-sm text-gray-700 whitespace-pre-wrap">
                          {msg.message}
                        </div>
                      </div>
                    );
                  })}
                  {messages.length === 0 && (
                    <div className="text-center py-8 text-gray-500">No messages in this thread</div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
