import React, { useEffect, useState } from "react";
import Header from "../../components/Header";
import LoadingSpinner from "../../components/LoadingSpinner";
import apiService from "../../services/apiService";
import { formatDateTime } from "../../utils/dateFormat";

export default function StudentBoarding() {
  const [loading, setLoading] = useState(true);
  const [student, setStudent] = useState(null);
  const [mealAttendance, setMealAttendance] = useState([]);
  const [dormAssignments, setDormAssignments] = useState([]);
  const [exeatRequests, setExeatRequests] = useState([]);
  const [exeatLogs, setExeatLogs] = useState([]);
  const [sickbayVisits, setSickbayVisits] = useState([]);
  const [medications, setMedications] = useState([]);
  const [wallets, setWallets] = useState([]);
  const [walletTxs, setWalletTxs] = useState([]);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const summary = await apiService.getBoardingSummary();
        const currentStudent = Array.isArray(summary?.students) ? summary.students[0] : null;
        setStudent(currentStudent);

        const [
          meals,
          assignments,
          requests,
          logs,
          visits,
          meds,
          tuckWallets,
          txs,
        ] = await Promise.all([
          apiService.getBoardingMealAttendance(),
          apiService.getDormAssignments({ active_only: 1 }),
          apiService.getExeatRequests(),
          apiService.getExeatLogs(),
          apiService.getSickbayVisits(),
          apiService.getMedicationSchedules(),
          apiService.getTuckWallets(),
          apiService.getTuckTransactions(),
        ]);

        setMealAttendance(Array.isArray(meals) ? meals : []);
        setDormAssignments(Array.isArray(assignments) ? assignments : []);
        setExeatRequests(Array.isArray(requests) ? requests : []);
        setExeatLogs(Array.isArray(logs) ? logs : []);
        setSickbayVisits(Array.isArray(visits) ? visits : []);
        setMedications(Array.isArray(meds) ? meds : []);
        setWallets(Array.isArray(tuckWallets) ? tuckWallets : []);
        setWalletTxs(Array.isArray(txs) ? txs : []);
      } catch (error) {
        alert(error.message || "Unable to load boarding page.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return (
      <div>
        <Header title="Boarding Life" />
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div>
      <Header title="Boarding Life" />
      <div className="p-6 space-y-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-xl font-semibold text-gray-800">Boarding Profile</h3>
          <p className="text-gray-600 mt-2">{student ? `${student.full_name} (${student.student_number})` : "Boarding profile loaded"}</p>
          <p className="text-gray-600">Class: {student?.class_name || "-"}</p>
          <p className="text-gray-600">Current tuck wallet balance: ${wallets[0]?.balance || 0}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-500">Meals Tracked</p>
            <p className="text-2xl font-bold text-gray-800">{mealAttendance.length}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-500">Exeat Requests</p>
            <p className="text-2xl font-bold text-gray-800">{exeatRequests.length}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-500">Sick Bay Visits</p>
            <p className="text-2xl font-bold text-gray-800">{sickbayVisits.length}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-500">Medication Plans</p>
            <p className="text-2xl font-bold text-gray-800">{medications.length}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">Dorm Assignment</h3>
            {dormAssignments.length === 0 ? <p className="text-gray-500">No active dorm assignment.</p> : dormAssignments.map((a) => (
              <p key={a.id} className="text-sm text-gray-700">{a.dormitory_name} - Room {a.room_name}, Bed {a.bed_name}</p>
            ))}
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">Meal History</h3>
            {mealAttendance.length === 0 ? <p className="text-gray-500">No meal records yet.</p> : mealAttendance.slice(0, 10).map((m) => (
              <p key={m.id} className="text-sm text-gray-700">{m.meal_date} {m.meal_type}: {m.status}</p>
            ))}
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">Exeat Status</h3>
            {exeatRequests.length === 0 ? <p className="text-gray-500">No exeat requests.</p> : exeatRequests.map((r) => (
              <p key={r.id} className="text-sm text-gray-700">{r.date_from} - {r.date_to}: {r.status}</p>
            ))}
            <div className="mt-4">
              <p className="font-medium text-gray-700">Sign In/Out Logs</p>
              {exeatLogs.length === 0 ? <p className="text-gray-500 text-sm">No movement logs yet.</p> : exeatLogs.map((l) => (
                <p key={l.id} className="text-sm text-gray-700">{formatDateTime(l.action_time)}: {l.action}</p>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">Health & Tuck</h3>
            <p className="font-medium text-gray-700">Sick Bay</p>
            {sickbayVisits.length === 0 ? <p className="text-gray-500 text-sm">No sick bay records.</p> : sickbayVisits.slice(0, 5).map((v) => (
              <p key={v.id} className="text-sm text-gray-700">{formatDateTime(v.visit_date)}: {v.complaint}</p>
            ))}
            <p className="font-medium text-gray-700 mt-4">Tuck Transactions</p>
            {walletTxs.length === 0 ? <p className="text-gray-500 text-sm">No tuck activity.</p> : walletTxs.slice(0, 6).map((tx) => (
              <p key={tx.id} className="text-sm text-gray-700">{formatDateTime(tx.created_at)}: {tx.transaction_type} ${tx.amount}</p>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
