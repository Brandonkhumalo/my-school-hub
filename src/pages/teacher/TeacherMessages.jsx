import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import Header from "../../components/Header";
import LoadingSpinner from "../../components/LoadingSpinner";
import apiService from "../../services/apiService";

export default function TeacherMessages() {
  const { user } = useAuth();
  const [view, setView] = useState("conversations"); // "conversations" or "new"
  const [conversations, setConversations] = useState([]);
  const [parents, setParents] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [selectedParent, setSelectedParent] = useState(null);
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

  const loadParents = async () => {
    try {
      setLoading(true);
      const data = await apiService.searchParents(searchQuery);
      setParents(data);
    } catch (error) {
      console.error("Error loading parents:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (conv) => {
    try {
      setSelectedConversation(conv);
      setSelectedParent(null);
      const data = await apiService.getConversation(conv.userId);
      setMessages(data);
    } catch (error) {
      console.error("Error loading messages:", error);
    }
  };

  const loadParentConversation = async (parent) => {
    try {
      setSelectedParent(parent);
      setSelectedConversation(null);
      const data = await apiService.getConversation(parent.user.id);
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

    const recipientId = selectedConversation?.userId || selectedParent?.user.id;
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
      } else if (selectedParent) {
        await loadParentConversation(selectedParent);
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
    loadParents();
  };

  const switchToNewMessage = () => {
    setView("new");
    loadParents();
    setSelectedConversation(null);
    setMessages([]);
  };

  const switchToConversations = () => {
    setView("conversations");
    setSelectedParent(null);
    setMessages([]);
  };

  if (loading && view === "conversations" && !selectedConversation) {
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
        {/* View Toggle */}
        <div className="mb-4 flex gap-2">
          <button
            onClick={switchToConversations}
            className={`px-4 py-2 rounded-md transition ${
              view === "conversations"
                ? 'bg-green-500 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            <i className="fas fa-inbox mr-2"></i>
            Conversations
          </button>
          <button
            onClick={switchToNewMessage}
            className={`px-4 py-2 rounded-md transition ${
              view === "new"
                ? 'bg-green-500 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            <i className="fas fa-plus-circle mr-2"></i>
            New Message
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Panel - Conversations or Parents List */}
          <div className="lg:col-span-1 bg-white rounded-lg shadow-lg p-4">
            {view === "conversations" ? (
              <>
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Parent Messages</h3>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {conversations.map((conv) => (
                    <div
                      key={conv.userId}
                      onClick={() => loadMessages(conv)}
                      className={`p-3 rounded-lg cursor-pointer transition ${
                        selectedConversation?.userId === conv.userId
                          ? 'bg-green-500 text-white'
                          : conv.unread
                          ? 'bg-yellow-50 border border-yellow-300'
                          : 'bg-gray-50 hover:bg-gray-100'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="font-semibold">{conv.userName}</div>
                          <div className={`text-sm truncate ${
                            selectedConversation?.userId === conv.userId ? 'text-green-100' : 'text-gray-500'
                          }`}>
                            {conv.lastMessage.substring(0, 50)}...
                          </div>
                        </div>
                        {conv.unread && selectedConversation?.userId !== conv.userId && (
                          <span className="w-2 h-2 bg-yellow-500 rounded-full"></span>
                        )}
                      </div>
                      <div className={`text-xs mt-1 ${
                        selectedConversation?.userId === conv.userId ? 'text-green-100' : 'text-gray-400'
                      }`}>
                        {new Date(conv.lastMessageDate).toLocaleDateString()}
                      </div>
                    </div>
                  ))}
                  
                  {conversations.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      <i className="fas fa-inbox text-4xl mb-2"></i>
                      <p>No messages yet</p>
                      <button
                        onClick={switchToNewMessage}
                        className="mt-4 px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 transition"
                      >
                        Start a conversation
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Search Parents</h3>
                
                {/* Search */}
                <form onSubmit={handleSearch} className="mb-4">
                  <input
                    type="text"
                    placeholder="Search parents..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </form>

                {/* Parent List */}
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {parents.map((parent) => (
                    <div
                      key={parent.id}
                      onClick={() => loadParentConversation(parent)}
                      className={`p-3 rounded-lg cursor-pointer transition ${
                        selectedParent?.id === parent.id
                          ? 'bg-green-500 text-white'
                          : 'bg-gray-50 hover:bg-gray-100'
                      }`}
                    >
                      <div className="font-semibold">
                        {parent.user.first_name} {parent.user.last_name}
                      </div>
                      <div className={`text-sm ${
                        selectedParent?.id === parent.id ? 'text-green-100' : 'text-gray-500'
                      }`}>
                        {parent.user.email}
                      </div>
                    </div>
                  ))}
                  
                  {parents.length === 0 && !loading && (
                    <div className="text-center py-8 text-gray-500">
                      <i className="fas fa-search text-4xl mb-2"></i>
                      <p>No parents found</p>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Right Panel - Messages */}
          <div className="lg:col-span-2 bg-white rounded-lg shadow-lg p-4 flex flex-col" style={{height: '600px'}}>
            {(selectedConversation || selectedParent) ? (
              <>
                <div className="border-b pb-3 mb-4">
                  <h3 className="text-lg font-semibold text-gray-800">
                    {selectedConversation?.userName || `${selectedParent?.user.first_name} ${selectedParent?.user.last_name}`}
                  </h3>
                  <p className="text-sm text-gray-500">Parent</p>
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
                            ? 'bg-green-500 text-white'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {msg.subject && (
                          <div className="font-semibold mb-1">{msg.subject}</div>
                        )}
                        <div>{msg.message}</div>
                        <div className={`text-xs mt-1 ${
                          msg.sender === user.id ? 'text-green-100' : 'text-gray-500'
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-md mb-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                  <div className="flex gap-2">
                    <textarea
                      placeholder="Type your message..."
                      value={messageText}
                      onChange={(e) => setMessageText(e.target.value)}
                      rows="2"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    ></textarea>
                    <button
                      type="submit"
                      disabled={sending}
                      className="px-6 bg-green-500 hover:bg-green-600 text-white rounded-md transition disabled:bg-gray-400"
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
                      : "Search and select a parent to start messaging"}
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
