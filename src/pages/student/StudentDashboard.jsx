import { useAuth } from "../../context/AuthContext";

export default function StudentDashboard() {
  const { user } = useAuth();

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Welcome, {user?.full_name}</h2>
      <p className="text-gray-600">
        This is your student dashboard. You can view your results, timetable, and fee summary from the sidebar.
      </p>
    </div>
  );
}
