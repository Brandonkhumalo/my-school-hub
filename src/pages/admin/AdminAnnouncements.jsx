import React, { useEffect, useMemo, useState } from "react";
import apiService from "../../services/apiService";
import Header from "../../components/Header";
import LoadingSpinner from "../../components/LoadingSpinner";
import { formatDate } from "../../utils/dateFormat";

const AUDIENCE_OPTIONS = [
  { value: "all", label: "Everyone" },
  { value: "student", label: "Students" },
  { value: "parent", label: "Parents" },
  { value: "teacher", label: "Teachers" },
  { value: "hr", label: "HR" },
  { value: "accountant", label: "Accountants" },
  { value: "librarian", label: "Librarians" },
  { value: "security", label: "Security" },
  { value: "cleaner", label: "Cleaners" },
];

export default function AdminAnnouncements() {
  const [announcements, setAnnouncements] = useState([]);
  const [classes, setClasses] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [form, setForm] = useState({
    title: "",
    content: "",
    target_audience: "all",
    target_class: "",
  });

  const loadAnnouncements = async () => {
    try {
      const data = await apiService.fetchAnnouncements();
      setAnnouncements(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error fetching announcements:", error);
      setFeedback({ type: "error", text: error.message || "Failed to load announcements." });
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      setFeedback(null);
      try {
        await loadAnnouncements();
        try {
          const classData = await apiService.fetchClasses();
          setClasses(Array.isArray(classData) ? classData : []);
        } catch (classError) {
          console.error("Error loading classes for announcement targeting:", classError);
          setClasses([]);
        }
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []);

  const canSetClassTarget = useMemo(() => classes.length > 0, [classes.length]);

  const onChangeForm = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.content.trim()) {
      setFeedback({ type: "error", text: "Title and message are required." });
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);
    try {
      const payload = {
        title: form.title.trim(),
        content: form.content.trim(),
        target_audience: form.target_audience,
        target_class: form.target_class ? parseInt(form.target_class, 10) : null,
      };
      await apiService.createAnnouncement(payload);
      setForm({
        title: "",
        content: "",
        target_audience: "all",
        target_class: "",
      });
      setFeedback({ type: "success", text: "Announcement posted successfully." });
      await loadAnnouncements();
    } catch (error) {
      console.error("Error creating announcement:", error);
      setFeedback({ type: "error", text: error.message || "Failed to create announcement." });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) return <LoadingSpinner />;

  return (
    <div>
      <Header title="Announcements" />

      <div className="p-6 space-y-6">
        {feedback && (
          <div
            className={`rounded-lg px-4 py-3 text-sm ${
              feedback.type === "success" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
            }`}
          >
            {feedback.text}
          </div>
        )}

        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Post New Announcement</h3>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => onChangeForm("title", e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Announcement title"
                maxLength={200}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
              <textarea
                value={form.content}
                onChange={(e) => onChangeForm("content", e.target.value)}
                rows={4}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Write announcement details..."
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Audience</label>
                <select
                  value={form.target_audience}
                  onChange={(e) => onChangeForm("target_audience", e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {AUDIENCE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Class Target (Optional)</label>
                <select
                  value={form.target_class}
                  onChange={(e) => onChangeForm("target_class", e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={!canSetClassTarget}
                >
                  <option value="">All Classes</option>
                  {classes.map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isSubmitting ? "Posting..." : "Post Announcement"}
              </button>
            </div>
          </form>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Recent Announcements</h3>
          {announcements.length > 0 ? (
            <ul className="space-y-4">
              {announcements.map((announcement) => (
                <li key={announcement.id} className="border-b border-gray-100 pb-4 last:border-b-0">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <h4 className="font-semibold text-gray-900">{announcement.title}</h4>
                    <span className="text-xs px-2 py-1 rounded bg-blue-100 text-blue-800">
                      {announcement.target_audience}
                    </span>
                    {announcement.class_name && (
                      <span className="text-xs px-2 py-1 rounded bg-amber-100 text-amber-800">
                        {announcement.class_name}
                      </span>
                    )}
                  </div>
                  <p className="text-gray-700 whitespace-pre-line">{announcement.content}</p>
                  <p className="text-xs text-gray-500 mt-2">
                    Posted by {announcement.author_name || "System"} on {formatDate(announcement.date_posted)}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-500">No announcements available.</p>
          )}
        </div>
      </div>
    </div>
  );
}
