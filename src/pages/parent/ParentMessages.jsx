import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import Header from "../../components/Header";
import LoadingSpinner from "../../components/LoadingSpinner";
import apiService from "../../services/apiService";

export default function ParentMessages() {
  const { user } = useAuth();
  const [view, setView] = useState("conversations");
  const [conversations, setConversations] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [messages, setMessages] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [messageText, setMessageText] = useState("");
  const [subject, setSubject] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    loadConversations();
  }, []);

  const loadConversations = async () => {
    try {
      setLoading(true);
      const data = await apiService.getMessages();
      
      const conversationMap = {};
      data.forEach(msg => {
        const otherUserId = msg.sender === user.id ? msg.recipient : msg.sender;
        const otherUserName = msg.sender === user.id ? msg.recipient_name : msg.sender_name;
        const isUnread = msg.recipient === user.id && !msg.is_read;
        
        if (!conversationMap[otherUserId] || new Date(msg.date_sent) > new Date(conversationMap[otherUserId].lastMessageDate)) {
          conversationMap[otherUserId] = {
            userId: otherUserId,
            userName: otherUserName,
            lastMessage: msg.message,
            lastMessageDate: msg.date_sent,
            unread: conversationMap[otherUserId]?.unread || isUnread
          };
        } else if (isUnread) {
          conversationMap[otherUserId].unread = true;
        }
      });
      
      setConversations(Object.values(conversationMap).sort((a, b) => 
        new Date(b.lastMessageDate) - new Date(a.lastMessageDate)
      ));
    } catch (error) {
      console.error("Error loading conversations:", error);
    } finally {
      setLoading(false);
    }
  };

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

  const loadMessages = async (conv) => {
    try {
      setSelectedConversation(conv);
      setSelectedTeacher(null);
      const data = await apiService.getConversation(conv.userId);
      setMessages(data);
    } catch (error) {
      console.error("Error loading messages:", error);
    }
  };

  const loadTeacherConversation = async (teacher) => {
    try {
      setSelectedTeacher(teacher);
      setSelectedConversation(null);
      const data = await apiService.getConversation(teacher.user.id);
      setMessages(data);
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

    const recipientId = selectedConversation?.userId || selectedTeacher?.user.id;
    if (!recipientId) {
      alert("Please select a recipient");
      return;
    }

    try {
      setSending(true);
      await apiService.sendMessage({
        recipient_id: recipientId,
        message: messageText,
        subject: subject
      });
      
      setMessageText("");
      setSubject("");
      
      if (selectedConversation) {
        await loadMessages(selectedConversation);
      } else if (selectedTeacher) {
        await loadTeacherConversation(selectedTeacher);
      }
      
      await loadConversations();
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

  const switchToConversations = () => {
    setView("conversations");
    setSelectedTeacher(null);
    setMessages([]);
    loadConversations();
  };

  const switchToNewMessage = () => {
    setView("new");
    setSelectedConversation(null);
    setMessages([]);
    loadTeachers();
  };

  if (loading && conversations.length === 0 && teachers.length === 0) {
    return (
      <div>
        <Header title="Chat with Teachers" user={user} />
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div>
      <Header title="Chat with Teachers" user={user} />
      
      <div className="p-6">
        <div className="flex gap-4 mb-6">
          <button
            onClick={switchToConversations}
            className={`px-6 py-2 rounded-lg font-medium transition ${
              view === "conversations"
                ? "bg-blue-600 text-white"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
          >
            <i className="fas fa-inbox mr-2"></i>
            My Conversations
            {conversations.some(c => c.unread) && (
              <span className="ml-2 px-2 py-0.5 bg-red-500 text-white text-xs rounded-full">New</span>
            )}
          </button>
          <button
            onClick={switchToNewMessage}
            className={`px-6 py-2 rounded-lg font-medium transition ${
              view === "new"
                ? "bg-blue-600 text-white"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
          >
            <i className="fas fa-plus mr-2"></i>
            New Message
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Sidebar */}
          <div className="lg:col-span-1 bg-white rounded-lg shadow-lg p-4">
            {view === "conversations" ? (
              <>
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Conversations</h3>
                
                {conversations.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <i className="fas fa-comments text-4xl mb-2"></i>
                    <p>No conversations yet</p>
                    <button
                      onClick={switchToNewMessage}
                      className="mt-4 text-blue-600 hover:text-blue-800 font-medium"
                    >
                      Start a new conversation
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {conversations.map((conv) => (
                      <div
                        key={conv.userId}
                        onClick={() => loadMessages(conv)}
                        className={`p-3 rounded-lg cursor-pointer transition ${
                          selectedConversation?.userId === conv.userId
                            ? 'bg-blue-500 text-white'
                            : conv.unread
                              ? 'bg-blue-50 border-l-4 border-blue-500'
                              : 'bg-gray-50 hover:bg-gray-100'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="font-semibold">{conv.userName}</div>
                          {conv.unread && selectedConversation?.userId !== conv.userId && (
                            <span className="px-2 py-0.5 bg-blue-500 text-white text-xs rounded-full">New</span>
                          )}
                        </div>
                        <div className={`text-sm truncate ${
                          selectedConversation?.userId === conv.userId ? 'text-blue-100' : 'text-gray-500'
                        }`}>
                          {conv.lastMessage}
                        </div>
                        <div className={`text-xs ${
                          selectedConversation?.userId === conv.userId ? 'text-blue-200' : 'text-gray-400'
                        }`}>
                          {new Date(conv.lastMessageDate).toLocaleDateString()}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <>
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Find a Teacher</h3>
                
                <form onSubmit={handleSearch} className="mb-4">
                  <input
                    type="text"
                    placeholder="Search by name or subject..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="submit"
                    className="mt-2 w-full py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-md transition"
                  >
                    <i className="fas fa-search mr-2"></i>Search
                  </button>
                </form>

                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {teachers.map((teacher) => (
                    <div
                      key={teacher.id}
                      onClick={() => loadTeacherConversation(teacher)}
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
                          : 'Teacher'}
                      </div>
                    </div>
                  ))}
                  
                  {teachers.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      <i className="fas fa-search text-4xl mb-2"></i>
                      <p>Search for teachers</p>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Message Area */}
          <div className="lg:col-span-2 bg-white rounded-lg shadow-lg p-4 flex flex-col" style={{height: '600px'}}>
            {(selectedConversation || selectedTeacher) ? (
              <>
                <div className="border-b pb-3 mb-4">
                  <h3 className="text-lg font-semibold text-gray-800">
                    {selectedConversation?.userName || 
                     `${selectedTeacher?.user.first_name} ${selectedTeacher?.user.last_name}`}
                  </h3>
                  {selectedTeacher?.subjects && (
                    <p className="text-sm text-gray-500">
                      {selectedTeacher.subjects.map(s => s.name).join(', ')}
                    </p>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto mb-4 space-y-3">
                  {messages.map((msg) => (
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

                  {messages.length === 0 && (
                    <div className="text-center py-12 text-gray-500">
                      <i className="fas fa-comment-dots text-6xl mb-4"></i>
                      <p>No messages yet. Start the conversation!</p>
                    </div>
                  )}
                </div>

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
                  <p>
                    {view === "conversations" 
                      ? "Select a conversation to view messages" 
                      : "Search and select a teacher to start messaging"}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
