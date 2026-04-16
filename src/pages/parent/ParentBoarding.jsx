import React, { useEffect, useState } from "react";
import Header from "../../components/Header";
import LoadingSpinner from "../../components/LoadingSpinner";
import apiService from "../../services/apiService";

const today = new Date().toISOString().split("T")[0];

export default function ParentBoarding() {
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);

  const [mealAttendance, setMealAttendance] = useState([]);
  const [dormAssignments, setDormAssignments] = useState([]);
  const [exeatRequests, setExeatRequests] = useState([]);
  const [exeatLogs, setExeatLogs] = useState([]);
  const [sickbayVisits, setSickbayVisits] = useState([]);
  const [medications, setMedications] = useState([]);
  const [wallets, setWallets] = useState([]);
  const [walletTxs, setWalletTxs] = useState([]);

  const [exeatForm, setExeatForm] = useState({ date_from: today, date_to: today, reason: "", collecting_person: "" });

  const loadForStudent = async (studentId) => {
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
      apiService.getBoardingMealAttendance({ student_id: studentId }),
      apiService.getDormAssignments({ student_id: studentId }),
      apiService.getExeatRequests({ student_id: studentId }),
      apiService.getExeatLogs({ student_id: studentId }),
      apiService.getSickbayVisits({ student_id: studentId }),
      apiService.getMedicationSchedules({ student_id: studentId }),
      apiService.getTuckWallets({ student_id: studentId }),
      apiService.getTuckTransactions({ student_id: studentId }),
    ]);

    setMealAttendance(Array.isArray(meals) ? meals : []);
    setDormAssignments(Array.isArray(assignments) ? assignments : []);
    setExeatRequests(Array.isArray(requests) ? requests : []);
    setExeatLogs(Array.isArray(logs) ? logs : []);
    setSickbayVisits(Array.isArray(visits) ? visits : []);
    setMedications(Array.isArray(meds) ? meds : []);
    setWallets(Array.isArray(tuckWallets) ? tuckWallets : []);
    setWalletTxs(Array.isArray(txs) ? txs : []);
  };

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const summary = await apiService.getBoardingSummary();
        const list = Array.isArray(summary?.students) ? summary.students : [];
        setStudents(list);
        if (list.length > 0) {
          setSelectedStudent(list[0]);
          await loadForStudent(list[0].id);
        }
      } catch (error) {
        alert(error.message || "Unable to load boarding data.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const changeStudent = async (id) => {
    const student = students.find((s) => String(s.id) === String(id));
    setSelectedStudent(student || null);
    if (student) {
      await loadForStudent(student.id);
    }
  };

  const submitExeatRequest = async () => {
    if (!selectedStudent) return;
    try {
      await apiService.createExeatRequest({
        student: selectedStudent.id,
        date_from: exeatForm.date_from,
        date_to: exeatForm.date_to,
        reason: exeatForm.reason,
        collecting_person: exeatForm.collecting_person,
      });
      setExeatForm({ date_from: today, date_to: today, reason: "", collecting_person: "" });
      await loadForStudent(selectedStudent.id);
    } catch (error) {
      alert(error.message || "Failed to submit exeat request.");
    }
  };

  if (loading) {
    return (
      <div>
        <Header title="Boarding" />
        <LoadingSpinner />
      </div>
    );
  }

  if (students.length === 0) {
    return (
      <div>
        <Header title="Boarding" />
        <div className="p-6">
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <h3 className="text-xl font-semibold text-gray-800">No Boarding Child Linked</h3>
            <p className="text-gray-600 mt-2">This section is only visible when you have a boarding student linked to your account.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Header title="Boarding" />
      <div className="p-6 space-y-6">
        <div className="bg-white rounded-lg shadow p-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-800">Boarding Child</h3>
          <select className="border rounded px-3 py-2" value={selectedStudent?.id || ""} onChange={(e) => changeStudent(e.target.value)}>
            {students.map((student) => (
              <option key={student.id} value={student.id}>{student.full_name} ({student.student_number})</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-500">Meal Records</p>
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
            <p className="text-sm text-gray-500">Tuck Balance</p>
            <p className="text-2xl font-bold text-gray-800">${wallets[0]?.balance || 0}</p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 space-y-4">
          <h3 className="text-lg font-semibold text-gray-800">Request Exeat</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <input type="date" className="border rounded px-3 py-2" value={exeatForm.date_from} onChange={(e) => setExeatForm({ ...exeatForm, date_from: e.target.value })} />
            <input type="date" className="border rounded px-3 py-2" value={exeatForm.date_to} onChange={(e) => setExeatForm({ ...exeatForm, date_to: e.target.value })} />
            <input className="border rounded px-3 py-2" placeholder="Collecting person" value={exeatForm.collecting_person} onChange={(e) => setExeatForm({ ...exeatForm, collecting_person: e.target.value })} />
            <button className="bg-blue-600 text-white rounded px-3 py-2" onClick={submitExeatRequest}>Submit</button>
          </div>
          <textarea className="w-full border rounded px-3 py-2" rows={2} placeholder="Reason" value={exeatForm.reason} onChange={(e) => setExeatForm({ ...exeatForm, reason: e.target.value })} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">Dorm Assignment</h3>
            {dormAssignments.filter((a) => a.is_active).length === 0 ? (
              <p className="text-gray-500">No active dorm assignment.</p>
            ) : (
              dormAssignments.filter((a) => a.is_active).map((a) => (
                <p key={a.id} className="text-sm text-gray-700">{a.dormitory_name} - Room {a.room_name}, Bed {a.bed_name}</p>
              ))
            )}
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">Medication Schedule</h3>
            {medications.length === 0 ? <p className="text-gray-500">No medications set.</p> : medications.slice(0, 5).map((m) => (
              <p key={m.id} className="text-sm text-gray-700">{m.medication_name} - {m.dosage} at {m.administration_time}</p>
            ))}
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">Meal History</h3>
            {mealAttendance.length === 0 ? <p className="text-gray-500">No meal records.</p> : mealAttendance.slice(0, 8).map((m) => (
              <p key={m.id} className="text-sm text-gray-700">{m.meal_date} {m.meal_type}: {m.status}</p>
            ))}
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">Sick Bay Visits</h3>
            {sickbayVisits.length === 0 ? <p className="text-gray-500">No sick bay visits.</p> : sickbayVisits.slice(0, 8).map((v) => (
              <p key={v.id} className="text-sm text-gray-700">{new Date(v.visit_date).toLocaleString()}: {v.complaint}</p>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-3">Exeat Activity</h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <p className="font-medium text-gray-700 mb-2">Requests</p>
              {exeatRequests.length === 0 ? <p className="text-gray-500">No requests yet.</p> : exeatRequests.map((r) => (
                <p key={r.id} className="text-sm text-gray-700">{r.date_from} - {r.date_to}: {r.status}</p>
              ))}
            </div>
            <div>
              <p className="font-medium text-gray-700 mb-2">Sign In/Out Logs</p>
              {exeatLogs.length === 0 ? <p className="text-gray-500">No movement logs yet.</p> : exeatLogs.map((l) => (
                <p key={l.id} className="text-sm text-gray-700">{new Date(l.action_time).toLocaleString()}: {l.action}</p>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-3">Tuck Wallet Transactions</h3>
          {walletTxs.length === 0 ? <p className="text-gray-500">No tuck transactions.</p> : walletTxs.slice(0, 10).map((tx) => (
            <p key={tx.id} className="text-sm text-gray-700">{new Date(tx.created_at).toLocaleString()}: {tx.transaction_type} ${tx.amount} ({tx.description || "-"})</p>
          ))}
        </div>
      </div>
    </div>
  );
}
