import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import Header from "../../components/Header";
import LoadingSpinner from "../../components/LoadingSpinner";
import apiService from "../../services/apiService";

export default function ParentMessages() {
  const { user } = useAuth();
  const [teachers, setTeachers] = useState([]);
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [conversation, setConversation] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [messageText, setMessageText] = useState("");
  const [subject, setSubject] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    loadTeachers();
  }, []);

  const loadTeachers = async () => {
    try {
      setLoading(true);
      const data = await apiService.searchTeachers(searchQuery);
      setTeachers(data);
    } catch (error) {
      console.error("Error loading teachers:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadConversation = async (teacher) => {
    try {
      setSelectedTeacher(teacher);
      const data = await apiService.getConversation(teacher.user.id);
      setConversation(data);
    } catch (error) {
      console.error("Error loading conversation:", error);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    
    if (!messageText.trim()) {
      alert("Please enter a message");
      return;
    }

    try {
      setSending(true);
      await apiService.sendMessage({
        recipient_id: selectedTeacher.user.id,
        message: messageText,
        subject: subject
      });
      
      setMessageText("");
      setSubject("");
      await loadConversation(selectedTeacher);
    } catch (error) {
      console.error("Error sending message:", error);
      alert("Failed to send message: " + (error.message || "Unknown error"));
    } finally {
      setSending(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    loadTeachers();
  };

  if (loading && !selectedTeacher) {
    return (
      <div>
        <Header title="Messages" user={user} />
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div>
      <Header title="Messages" user={user} />
      
      <div className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Teacher List */}
          <div className="lg:col-span-1 bg-white rounded-lg shadow-lg p-4">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Teachers</h3>
            
            {/* Search */}
            <form onSubmit={handleSearch} className="mb-4">
              <input
                type="text"
                placeholder="Search teachers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </form>

            {/* Teacher List */}
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {teachers.map((teacher) => (
                <div
                  key={teacher.id}
                  onClick={() => loadConversation(teacher)}
                  className={`p-3 rounded-lg cursor-pointer transition ${
                    selectedTeacher?.id === teacher.id
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-50 hover:bg-gray-100'
                  }`}
                >
                  <div className="font-semibold">
                    {teacher.user.first_name} {teacher.user.last_name}
                  </div>
                  <div className={`text-sm ${
                    selectedTeacher?.id === teacher.id ? 'text-blue-100' : 'text-gray-500'
                  }`}>
                    {teacher.subjects && teacher.subjects.length > 0
                      ? teacher.subjects.map(s => s.name).join(', ')
                      : 'No subjects'}
                  </div>
                </div>
              ))}
              
              {teachers.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <i className="fas fa-search text-4xl mb-2"></i>
                  <p>No teachers found</p>
                </div>
              )}
            </div>
          </div>

          {/* Conversation */}
          <div className="lg:col-span-2 bg-white rounded-lg shadow-lg p-4 flex flex-col" style={{height: '600px'}}>
            {selectedTeacher ? (
              <>
                {/* Chat Header */}
                <div className="border-b pb-3 mb-4">
                  <h3 className="text-lg font-semibold text-gray-800">
                    {selectedTeacher.user.first_name} {selectedTeacher.user.last_name}
                  </h3>
                  <p className="text-sm text-gray-500">
                    {selectedTeacher.subjects && selectedTeacher.subjects.length > 0
                      ? selectedTeacher.subjects.map(s => s.name).join(', ')
                      : 'Teacher'}
                  </p>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto mb-4 space-y-3">
                  {conversation.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.sender === user.id ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-md px-4 py-2 rounded-lg ${
                          msg.sender === user.id
                            ? 'bg-blue-500 text-white'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {msg.subject && (
                          <div className="font-semibold mb-1">{msg.subject}</div>
                        )}
                        <div>{msg.message}</div>
                        <div className={`text-xs mt-1 ${
                          msg.sender === user.id ? 'text-blue-100' : 'text-gray-500'
                        }`}>
                          {new Date(msg.date_sent).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  ))}

                  {conversation.length === 0 && (
                    <div className="text-center py-12 text-gray-500">
                      <i className="fas fa-comment-dots text-6xl mb-4"></i>
                      <p>No messages yet. Start the conversation!</p>
                    </div>
                  )}
                </div>

                {/* Message Input */}
                <form onSubmit={handleSendMessage} className="border-t pt-4">
                  <input
                    type="text"
                    placeholder="Subject (optional)"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md mb-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <div className="flex gap-2">
                    <textarea
                      placeholder="Type your message..."
                      value={messageText}
                      onChange={(e) => setMessageText(e.target.value)}
                      rows="2"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    ></textarea>
                    <button
                      type="submit"
                      disabled={sending}
                      className="px-6 bg-blue-500 hover:bg-blue-600 text-white rounded-md transition disabled:bg-gray-400"
                    >
                      {sending ? (
                        <i className="fas fa-spinner fa-spin"></i>
                      ) : (
                        <i className="fas fa-paper-plane"></i>
                      )}
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-500">
                <div className="text-center">
                  <i className="fas fa-comments text-6xl mb-4"></i>
                  <p>Select a teacher to start messaging</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
