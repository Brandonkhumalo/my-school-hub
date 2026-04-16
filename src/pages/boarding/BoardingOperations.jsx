import React, { useEffect, useMemo, useState } from "react";
import Header from "../../components/Header";
import LoadingSpinner from "../../components/LoadingSpinner";
import apiService from "../../services/apiService";

const today = new Date().toISOString().split("T")[0];

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

export default function BoardingOperations({ title = "Boarding Operations" }) {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({ school: null, students: [] });

  const [mealMenus, setMealMenus] = useState([]);
  const [mealAttendance, setMealAttendance] = useState([]);
  const [dietary, setDietary] = useState(null);

  const [dormitories, setDormitories] = useState([]);
  const [dormAssignments, setDormAssignments] = useState([]);
  const [rollCalls, setRollCalls] = useState([]);
  const [lightsOut, setLightsOut] = useState([]);

  const [exeatRequests, setExeatRequests] = useState([]);
  const [exeatLogs, setExeatLogs] = useState([]);

  const [sickbayVisits, setSickbayVisits] = useState([]);
  const [medications, setMedications] = useState([]);

  const [wallets, setWallets] = useState([]);
  const [tuckTransactions, setTuckTransactions] = useState([]);
  const [lowBalanceWallets, setLowBalanceWallets] = useState([]);

  const [laundrySchedules, setLaundrySchedules] = useState([]);
  const [lostItems, setLostItems] = useState([]);

  const [prepAttendance, setPrepAttendance] = useState([]);
  const [dormInspections, setDormInspections] = useState([]);
  const [wellnessCheckins, setWellnessCheckins] = useState([]);

  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [selectedMenuId, setSelectedMenuId] = useState("");

  const [menuForm, setMenuForm] = useState({ date: today, meal_type: "breakfast", menu_text: "" });
  const [mealAttendanceForm, setMealAttendanceForm] = useState({ status: "ate" });
  const [dietaryForm, setDietaryForm] = useState({ allergies: "", special_diet: "", notes: "" });

  const [dormForm, setDormForm] = useState({ name: "", gender: "mixed", capacity: 0, is_active: true });
  const [assignmentForm, setAssignmentForm] = useState({ student: "", dormitory: "", room_name: "", bed_name: "", start_date: today, is_active: true });
  const [rollCallForm, setRollCallForm] = useState({ student: "", call_date: today, call_type: "evening", status: "present", remarks: "" });
  const [lightsOutForm, setLightsOutForm] = useState({ student: "", date: today, in_bed_time: "21:00", remarks: "" });

  const [exeatForm, setExeatForm] = useState({ student: "", date_from: today, date_to: today, reason: "", collecting_person: "" });
  const [exeatLogForm, setExeatLogForm] = useState({ exeat_request: "", student: "", action: "sign_out", action_time: new Date().toISOString().slice(0, 16), notes: "" });

  const [sickbayForm, setSickbayForm] = useState({ student: "", complaint: "", diagnosis: "", treatment: "", nurse_notes: "", follow_up_required: false });
  const [medicationForm, setMedicationForm] = useState({ student: "", medication_name: "", dosage: "", administration_time: "08:00", start_date: today, end_date: "", instructions: "", is_active: true });

  const [transactionForm, setTransactionForm] = useState({ wallet: "", transaction_type: "topup", amount: "", description: "" });

  const [laundryForm, setLaundryForm] = useState({ dormitory: "", day_of_week: "Monday", time_slot: "", notes: "" });
  const [lostItemForm, setLostItemForm] = useState({ student: "", item_description: "", status: "reported" });

  const [prepForm, setPrepForm] = useState({ student: "", date: today, status: "present", remarks: "" });
  const [inspectionForm, setInspectionForm] = useState({ dormitory: "", inspection_date: today, score: 0, max_score: 10, notes: "" });
  const [wellnessForm, setWellnessForm] = useState({ student: "", check_date: today, mood_score: 3, notes: "" });

  const students = safeArray(summary.students);

  const studentOptions = useMemo(() => students.map((s) => ({ label: `${s.full_name} (${s.student_number})`, value: String(s.id) })), [students]);

  const walletOptions = useMemo(() => wallets.map((w) => ({ label: `${w.student_name} (${w.student_number})`, value: String(w.id) })), [wallets]);

  const refreshAll = async () => {
    const summaryData = await apiService.getBoardingSummary();
    setSummary(summaryData || { school: null, students: [] });

    const [
      menus,
      assignments,
      dorms,
      rolls,
      lights,
      exeats,
      logs,
      visits,
      meds,
      tuckWallets,
      txs,
      lowBalances,
      laundry,
      items,
      prep,
      inspections,
      wellness,
    ] = await Promise.all([
      apiService.getBoardingMealMenus(),
      apiService.getDormAssignments(),
      apiService.getDormitories(),
      apiService.getDormRollCalls(),
      apiService.getLightsOutRecords(),
      apiService.getExeatRequests(),
      apiService.getExeatLogs(),
      apiService.getSickbayVisits(),
      apiService.getMedicationSchedules(),
      apiService.getTuckWallets({ ensure: 1 }),
      apiService.getTuckTransactions(),
      apiService.getTuckLowBalance({ threshold: 5 }),
      apiService.getLaundrySchedules(),
      apiService.getLostItems(),
      apiService.getPrepAttendance(),
      apiService.getDormInspections(),
      apiService.getWellnessCheckins(),
    ]);

    setMealMenus(safeArray(menus));
    setDormAssignments(safeArray(assignments));
    setDormitories(safeArray(dorms));
    setRollCalls(safeArray(rolls));
    setLightsOut(safeArray(lights));
    setExeatRequests(safeArray(exeats));
    setExeatLogs(safeArray(logs));
    setSickbayVisits(safeArray(visits));
    setMedications(safeArray(meds));
    setWallets(safeArray(tuckWallets));
    setTuckTransactions(safeArray(txs));
    setLowBalanceWallets(safeArray(lowBalances));
    setLaundrySchedules(safeArray(laundry));
    setLostItems(safeArray(items));
    setPrepAttendance(safeArray(prep));
    setDormInspections(safeArray(inspections));
    setWellnessCheckins(safeArray(wellness));
  };

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        await refreshAll();
      } catch (error) {
        alert(error.message || "Failed to load boarding module.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  useEffect(() => {
    if (!selectedMenuId) return;
    const loadMenuAttendance = async () => {
      try {
        const rows = await apiService.getBoardingMealAttendance({ meal_menu_id: selectedMenuId });
        setMealAttendance(safeArray(rows));
      } catch (error) {
        setMealAttendance([]);
      }
    };
    loadMenuAttendance();
  }, [selectedMenuId]);

  useEffect(() => {
    if (!selectedStudentId) {
      setDietary(null);
      setDietaryForm({ allergies: "", special_diet: "", notes: "" });
      return;
    }
    const loadDietary = async () => {
      try {
        const data = await apiService.getDietaryFlag(selectedStudentId);
        setDietary(data);
        setDietaryForm({
          allergies: data?.allergies || "",
          special_diet: data?.special_diet || "",
          notes: data?.notes || "",
        });
      } catch {
        setDietary(null);
        setDietaryForm({ allergies: "", special_diet: "", notes: "" });
      }
    };
    loadDietary();
  }, [selectedStudentId]);

  const submitAction = async (fn, payload, onSuccess) => {
    try {
      await fn(payload);
      if (onSuccess) onSuccess();
      await refreshAll();
    } catch (error) {
      alert(error.message || "Operation failed.");
    }
  };

  const submitMealAttendance = async () => {
    if (!selectedMenuId || !selectedStudentId) {
      alert("Select a meal menu and student first.");
      return;
    }
    await submitAction(apiService.saveBoardingMealAttendance, {
      meal_menu_id: Number(selectedMenuId),
      attendance: [{ student_id: Number(selectedStudentId), status: mealAttendanceForm.status }],
    });
    const rows = await apiService.getBoardingMealAttendance({ meal_menu_id: selectedMenuId });
    setMealAttendance(safeArray(rows));
  };

  const updateDietary = async () => {
    if (!selectedStudentId) {
      alert("Select a student first.");
      return;
    }
    try {
      const data = await apiService.updateDietaryFlag(selectedStudentId, dietaryForm);
      setDietary(data);
      await refreshAll();
    } catch (error) {
      alert(error.message || "Failed to update dietary profile.");
    }
  };

  const decideExeat = async (id, status) => {
    await submitAction((payload) => apiService.decideExeatRequest(id, payload), {
      status,
      decision_notes: status === "approved" ? "Approved by boarding office" : "Request denied",
    });
  };

  if (loading) {
    return (
      <div>
        <Header title={title} />
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div>
      <Header title={title} />
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-500">Boarding Students</p>
            <p className="text-2xl font-bold text-gray-800">{students.length}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-500">Dormitories</p>
            <p className="text-2xl font-bold text-gray-800">{dormitories.length}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-500">Pending Exeat</p>
            <p className="text-2xl font-bold text-gray-800">{exeatRequests.filter((x) => x.status === "pending").length}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-500">Low Tuck Wallets</p>
            <p className="text-2xl font-bold text-gray-800">{lowBalanceWallets.length}</p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 space-y-4">
          <h3 className="text-lg font-semibold text-gray-800">Tier 1: Meals & Dietary</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input type="date" className="border rounded px-3 py-2" value={menuForm.date} onChange={(e) => setMenuForm({ ...menuForm, date: e.target.value })} />
            <select className="border rounded px-3 py-2" value={menuForm.meal_type} onChange={(e) => setMenuForm({ ...menuForm, meal_type: e.target.value })}>
              <option value="breakfast">Breakfast</option>
              <option value="lunch">Lunch</option>
              <option value="supper">Supper</option>
            </select>
            <button className="bg-blue-600 text-white rounded px-3 py-2" onClick={() => submitAction(apiService.createBoardingMealMenu, menuForm, () => setMenuForm({ ...menuForm, menu_text: "" }))}>Post Menu</button>
          </div>
          <textarea className="w-full border rounded px-3 py-2" rows={2} placeholder="Menu details" value={menuForm.menu_text} onChange={(e) => setMenuForm({ ...menuForm, menu_text: e.target.value })} />

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <select className="border rounded px-3 py-2" value={selectedMenuId} onChange={(e) => setSelectedMenuId(e.target.value)}>
              <option value="">Select meal menu</option>
              {mealMenus.map((m) => (
                <option key={m.id} value={m.id}>{m.date} - {m.meal_type}</option>
              ))}
            </select>
            <select className="border rounded px-3 py-2" value={selectedStudentId} onChange={(e) => setSelectedStudentId(e.target.value)}>
              <option value="">Select student</option>
              {studentOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <select className="border rounded px-3 py-2" value={mealAttendanceForm.status} onChange={(e) => setMealAttendanceForm({ ...mealAttendanceForm, status: e.target.value })}>
              <option value="ate">Ate</option>
              <option value="absent">Absent</option>
              <option value="excused">Excused</option>
            </select>
            <button className="bg-green-600 text-white rounded px-3 py-2" onClick={submitMealAttendance}>Save Attendance</button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input className="border rounded px-3 py-2" placeholder="Allergies" value={dietaryForm.allergies} onChange={(e) => setDietaryForm({ ...dietaryForm, allergies: e.target.value })} />
            <input className="border rounded px-3 py-2" placeholder="Special diet" value={dietaryForm.special_diet} onChange={(e) => setDietaryForm({ ...dietaryForm, special_diet: e.target.value })} />
            <button className="bg-purple-600 text-white rounded px-3 py-2" onClick={updateDietary}>Save Dietary Flag</button>
          </div>
          <textarea className="w-full border rounded px-3 py-2" rows={2} placeholder="Diet notes" value={dietaryForm.notes} onChange={(e) => setDietaryForm({ ...dietaryForm, notes: e.target.value })} />

          <p className="text-sm text-gray-500">Menus: {mealMenus.length} | Attendance records for selected menu: {mealAttendance.length}</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6 space-y-4">
          <h3 className="text-lg font-semibold text-gray-800">Tier 1: Dormitory Management</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <input className="border rounded px-3 py-2" placeholder="Dormitory name" value={dormForm.name} onChange={(e) => setDormForm({ ...dormForm, name: e.target.value })} />
            <select className="border rounded px-3 py-2" value={dormForm.gender} onChange={(e) => setDormForm({ ...dormForm, gender: e.target.value })}>
              <option value="mixed">Mixed</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
            <input type="number" className="border rounded px-3 py-2" placeholder="Capacity" value={dormForm.capacity} onChange={(e) => setDormForm({ ...dormForm, capacity: Number(e.target.value) })} />
            <button className="bg-blue-600 text-white rounded px-3 py-2" onClick={() => submitAction(apiService.createDormitory, dormForm, () => setDormForm({ ...dormForm, name: "", capacity: 0 }))}>Add Dorm</button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
            <select className="border rounded px-3 py-2" value={assignmentForm.student} onChange={(e) => setAssignmentForm({ ...assignmentForm, student: e.target.value })}>
              <option value="">Student</option>
              {studentOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
            <select className="border rounded px-3 py-2" value={assignmentForm.dormitory} onChange={(e) => setAssignmentForm({ ...assignmentForm, dormitory: e.target.value })}>
              <option value="">Dormitory</option>
              {dormitories.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <input className="border rounded px-3 py-2" placeholder="Room" value={assignmentForm.room_name} onChange={(e) => setAssignmentForm({ ...assignmentForm, room_name: e.target.value })} />
            <input className="border rounded px-3 py-2" placeholder="Bed" value={assignmentForm.bed_name} onChange={(e) => setAssignmentForm({ ...assignmentForm, bed_name: e.target.value })} />
            <input type="date" className="border rounded px-3 py-2" value={assignmentForm.start_date} onChange={(e) => setAssignmentForm({ ...assignmentForm, start_date: e.target.value })} />
            <button className="bg-green-600 text-white rounded px-3 py-2" onClick={() => submitAction(apiService.createDormAssignment, { ...assignmentForm, student: Number(assignmentForm.student), dormitory: Number(assignmentForm.dormitory) })}>Assign Bed</button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
            <select className="border rounded px-3 py-2" value={rollCallForm.student} onChange={(e) => setRollCallForm({ ...rollCallForm, student: e.target.value })}>
              <option value="">Student</option>
              {studentOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
            <input type="date" className="border rounded px-3 py-2" value={rollCallForm.call_date} onChange={(e) => setRollCallForm({ ...rollCallForm, call_date: e.target.value })} />
            <select className="border rounded px-3 py-2" value={rollCallForm.call_type} onChange={(e) => setRollCallForm({ ...rollCallForm, call_type: e.target.value })}>
              <option value="morning">Morning</option>
              <option value="evening">Evening</option>
            </select>
            <select className="border rounded px-3 py-2" value={rollCallForm.status} onChange={(e) => setRollCallForm({ ...rollCallForm, status: e.target.value })}>
              <option value="present">Present</option>
              <option value="absent">Absent</option>
              <option value="excused">Excused</option>
            </select>
            <input className="border rounded px-3 py-2" placeholder="Remarks" value={rollCallForm.remarks} onChange={(e) => setRollCallForm({ ...rollCallForm, remarks: e.target.value })} />
            <button className="bg-indigo-600 text-white rounded px-3 py-2" onClick={() => submitAction(apiService.createDormRollCall, { ...rollCallForm, student: Number(rollCallForm.student) })}>Mark Roll</button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <select className="border rounded px-3 py-2" value={lightsOutForm.student} onChange={(e) => setLightsOutForm({ ...lightsOutForm, student: e.target.value })}>
              <option value="">Student</option>
              {studentOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
            <input type="date" className="border rounded px-3 py-2" value={lightsOutForm.date} onChange={(e) => setLightsOutForm({ ...lightsOutForm, date: e.target.value })} />
            <input type="time" className="border rounded px-3 py-2" value={lightsOutForm.in_bed_time} onChange={(e) => setLightsOutForm({ ...lightsOutForm, in_bed_time: e.target.value })} />
            <input className="border rounded px-3 py-2" placeholder="Remarks" value={lightsOutForm.remarks} onChange={(e) => setLightsOutForm({ ...lightsOutForm, remarks: e.target.value })} />
            <button className="bg-teal-600 text-white rounded px-3 py-2" onClick={() => submitAction(apiService.createLightsOutRecord, { ...lightsOutForm, student: Number(lightsOutForm.student) })}>Record Lights-Out</button>
          </div>

          <p className="text-sm text-gray-500">Assignments: {dormAssignments.length} | Roll Calls: {rollCalls.length} | Lights-Out: {lightsOut.length}</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6 space-y-4">
          <h3 className="text-lg font-semibold text-gray-800">Tier 1: Exeat & Movement</h3>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <select className="border rounded px-3 py-2" value={exeatForm.student} onChange={(e) => setExeatForm({ ...exeatForm, student: e.target.value })}>
              <option value="">Student</option>
              {studentOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
            <input type="date" className="border rounded px-3 py-2" value={exeatForm.date_from} onChange={(e) => setExeatForm({ ...exeatForm, date_from: e.target.value })} />
            <input type="date" className="border rounded px-3 py-2" value={exeatForm.date_to} onChange={(e) => setExeatForm({ ...exeatForm, date_to: e.target.value })} />
            <input className="border rounded px-3 py-2" placeholder="Collecting person" value={exeatForm.collecting_person} onChange={(e) => setExeatForm({ ...exeatForm, collecting_person: e.target.value })} />
            <button className="bg-blue-700 text-white rounded px-3 py-2" onClick={() => submitAction(apiService.createExeatRequest, { ...exeatForm, student: Number(exeatForm.student) })}>Create Request</button>
          </div>
          <textarea className="w-full border rounded px-3 py-2" rows={2} placeholder="Reason" value={exeatForm.reason} onChange={(e) => setExeatForm({ ...exeatForm, reason: e.target.value })} />

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500">
                  <th className="py-2">Student</th><th>Status</th><th>Dates</th><th>Action</th>
                </tr>
              </thead>
              <tbody>
                {exeatRequests.slice(0, 8).map((req) => (
                  <tr key={req.id} className="border-t">
                    <td className="py-2">{req.student_name}</td>
                    <td>{req.status}</td>
                    <td>{req.date_from} - {req.date_to}</td>
                    <td className="space-x-2">
                      {req.status === "pending" && (
                        <>
                          <button className="px-2 py-1 bg-green-100 text-green-700 rounded" onClick={() => decideExeat(req.id, "approved")}>Approve</button>
                          <button className="px-2 py-1 bg-red-100 text-red-700 rounded" onClick={() => decideExeat(req.id, "denied")}>Deny</button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <select className="border rounded px-3 py-2" value={exeatLogForm.exeat_request} onChange={(e) => setExeatLogForm({ ...exeatLogForm, exeat_request: e.target.value })}>
              <option value="">Approved Exeat</option>
              {exeatRequests.filter((r) => r.status === "approved").map((r) => <option key={r.id} value={r.id}>#{r.id} {r.student_name}</option>)}
            </select>
            <select className="border rounded px-3 py-2" value={exeatLogForm.student} onChange={(e) => setExeatLogForm({ ...exeatLogForm, student: e.target.value })}>
              <option value="">Student</option>
              {studentOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
            <select className="border rounded px-3 py-2" value={exeatLogForm.action} onChange={(e) => setExeatLogForm({ ...exeatLogForm, action: e.target.value })}>
              <option value="sign_out">Sign Out</option>
              <option value="sign_in">Sign In</option>
            </select>
            <input type="datetime-local" className="border rounded px-3 py-2" value={exeatLogForm.action_time} onChange={(e) => setExeatLogForm({ ...exeatLogForm, action_time: e.target.value })} />
            <button className="bg-amber-600 text-white rounded px-3 py-2" onClick={() => submitAction(apiService.createExeatLog, { ...exeatLogForm, exeat_request: Number(exeatLogForm.exeat_request), student: Number(exeatLogForm.student), action_time: new Date(exeatLogForm.action_time).toISOString() })}>Log Movement</button>
          </div>

          <p className="text-sm text-gray-500">Movement logs: {exeatLogs.length}</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6 space-y-4">
          <h3 className="text-lg font-semibold text-gray-800">Tier 2: Sick Bay & Medication</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <select className="border rounded px-3 py-2" value={sickbayForm.student} onChange={(e) => setSickbayForm({ ...sickbayForm, student: e.target.value })}>
              <option value="">Student</option>
              {studentOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
            <input className="border rounded px-3 py-2" placeholder="Complaint / symptoms" value={sickbayForm.complaint} onChange={(e) => setSickbayForm({ ...sickbayForm, complaint: e.target.value })} />
            <button className="bg-red-600 text-white rounded px-3 py-2" onClick={() => submitAction(apiService.createSickbayVisit, { ...sickbayForm, student: Number(sickbayForm.student) })}>Record Visit</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input className="border rounded px-3 py-2" placeholder="Diagnosis" value={sickbayForm.diagnosis} onChange={(e) => setSickbayForm({ ...sickbayForm, diagnosis: e.target.value })} />
            <input className="border rounded px-3 py-2" placeholder="Treatment" value={sickbayForm.treatment} onChange={(e) => setSickbayForm({ ...sickbayForm, treatment: e.target.value })} />
            <input className="border rounded px-3 py-2" placeholder="Nurse notes" value={sickbayForm.nurse_notes} onChange={(e) => setSickbayForm({ ...sickbayForm, nurse_notes: e.target.value })} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
            <select className="border rounded px-3 py-2" value={medicationForm.student} onChange={(e) => setMedicationForm({ ...medicationForm, student: e.target.value })}>
              <option value="">Student</option>
              {studentOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
            <input className="border rounded px-3 py-2" placeholder="Medication" value={medicationForm.medication_name} onChange={(e) => setMedicationForm({ ...medicationForm, medication_name: e.target.value })} />
            <input className="border rounded px-3 py-2" placeholder="Dosage" value={medicationForm.dosage} onChange={(e) => setMedicationForm({ ...medicationForm, dosage: e.target.value })} />
            <input type="time" className="border rounded px-3 py-2" value={medicationForm.administration_time} onChange={(e) => setMedicationForm({ ...medicationForm, administration_time: e.target.value })} />
            <input type="date" className="border rounded px-3 py-2" value={medicationForm.start_date} onChange={(e) => setMedicationForm({ ...medicationForm, start_date: e.target.value })} />
            <button className="bg-cyan-700 text-white rounded px-3 py-2" onClick={() => submitAction(apiService.createMedicationSchedule, { ...medicationForm, student: Number(medicationForm.student), end_date: medicationForm.end_date || null })}>Save Medication</button>
          </div>
          <p className="text-sm text-gray-500">Sick bay visits: {sickbayVisits.length} | Active meds: {medications.filter((m) => m.is_active).length}</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6 space-y-4">
          <h3 className="text-lg font-semibold text-gray-800">Tier 2: Tuck Wallet</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <select className="border rounded px-3 py-2" value={transactionForm.wallet} onChange={(e) => setTransactionForm({ ...transactionForm, wallet: e.target.value })}>
              <option value="">Wallet</option>
              {walletOptions.map((w) => <option key={w.value} value={w.value}>{w.label}</option>)}
            </select>
            <select className="border rounded px-3 py-2" value={transactionForm.transaction_type} onChange={(e) => setTransactionForm({ ...transactionForm, transaction_type: e.target.value })}>
              <option value="topup">Top Up</option>
              <option value="purchase">Purchase</option>
            </select>
            <input className="border rounded px-3 py-2" placeholder="Amount" value={transactionForm.amount} onChange={(e) => setTransactionForm({ ...transactionForm, amount: e.target.value })} />
            <button className="bg-emerald-700 text-white rounded px-3 py-2" onClick={() => submitAction(apiService.createTuckTransaction, { ...transactionForm, wallet: Number(transactionForm.wallet), amount: Number(transactionForm.amount) })}>Post Transaction</button>
          </div>
          <input className="w-full border rounded px-3 py-2" placeholder="Description" value={transactionForm.description} onChange={(e) => setTransactionForm({ ...transactionForm, description: e.target.value })} />
          <p className="text-sm text-gray-500">Wallets: {wallets.length} | Transactions: {tuckTransactions.length} | Low balance: {lowBalanceWallets.length}</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6 space-y-4">
          <h3 className="text-lg font-semibold text-gray-800">Tier 2: Laundry & Lost Items</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <select className="border rounded px-3 py-2" value={laundryForm.dormitory} onChange={(e) => setLaundryForm({ ...laundryForm, dormitory: e.target.value })}>
              <option value="">All dorms</option>
              {dormitories.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <input className="border rounded px-3 py-2" placeholder="Day of week" value={laundryForm.day_of_week} onChange={(e) => setLaundryForm({ ...laundryForm, day_of_week: e.target.value })} />
            <input className="border rounded px-3 py-2" placeholder="Time slot" value={laundryForm.time_slot} onChange={(e) => setLaundryForm({ ...laundryForm, time_slot: e.target.value })} />
            <button className="bg-slate-700 text-white rounded px-3 py-2" onClick={() => submitAction(apiService.createLaundrySchedule, { ...laundryForm, dormitory: laundryForm.dormitory ? Number(laundryForm.dormitory) : null })}>Add Laundry Slot</button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <select className="border rounded px-3 py-2" value={lostItemForm.student} onChange={(e) => setLostItemForm({ ...lostItemForm, student: e.target.value })}>
              <option value="">Student (optional)</option>
              {studentOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
            <input className="border rounded px-3 py-2" placeholder="Item description" value={lostItemForm.item_description} onChange={(e) => setLostItemForm({ ...lostItemForm, item_description: e.target.value })} />
            <select className="border rounded px-3 py-2" value={lostItemForm.status} onChange={(e) => setLostItemForm({ ...lostItemForm, status: e.target.value })}>
              <option value="reported">Reported</option>
              <option value="found">Found</option>
              <option value="resolved">Resolved</option>
            </select>
            <button className="bg-orange-700 text-white rounded px-3 py-2" onClick={() => submitAction(apiService.createLostItem, { ...lostItemForm, student: lostItemForm.student ? Number(lostItemForm.student) : null })}>Log Lost Item</button>
          </div>

          <p className="text-sm text-gray-500">Laundry slots: {laundrySchedules.length} | Lost items: {lostItems.length}</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6 space-y-4">
          <h3 className="text-lg font-semibold text-gray-800">Tier 3: Extra Boarding Ops</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <select className="border rounded px-3 py-2" value={prepForm.student} onChange={(e) => setPrepForm({ ...prepForm, student: e.target.value })}>
              <option value="">Student</option>
              {studentOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
            <input type="date" className="border rounded px-3 py-2" value={prepForm.date} onChange={(e) => setPrepForm({ ...prepForm, date: e.target.value })} />
            <select className="border rounded px-3 py-2" value={prepForm.status} onChange={(e) => setPrepForm({ ...prepForm, status: e.target.value })}>
              <option value="present">Present</option>
              <option value="absent">Absent</option>
              <option value="excused">Excused</option>
            </select>
            <button className="bg-violet-700 text-white rounded px-3 py-2" onClick={() => submitAction(apiService.createPrepAttendance, { ...prepForm, student: Number(prepForm.student) })}>Mark Prep</button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <select className="border rounded px-3 py-2" value={inspectionForm.dormitory} onChange={(e) => setInspectionForm({ ...inspectionForm, dormitory: e.target.value })}>
              <option value="">Dormitory</option>
              {dormitories.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <input type="date" className="border rounded px-3 py-2" value={inspectionForm.inspection_date} onChange={(e) => setInspectionForm({ ...inspectionForm, inspection_date: e.target.value })} />
            <input type="number" className="border rounded px-3 py-2" value={inspectionForm.score} onChange={(e) => setInspectionForm({ ...inspectionForm, score: Number(e.target.value) })} />
            <input type="number" className="border rounded px-3 py-2" value={inspectionForm.max_score} onChange={(e) => setInspectionForm({ ...inspectionForm, max_score: Number(e.target.value) })} />
            <button className="bg-fuchsia-700 text-white rounded px-3 py-2" onClick={() => submitAction(apiService.createDormInspection, { ...inspectionForm, dormitory: Number(inspectionForm.dormitory) })}>Save Inspection</button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <select className="border rounded px-3 py-2" value={wellnessForm.student} onChange={(e) => setWellnessForm({ ...wellnessForm, student: e.target.value })}>
              <option value="">Student</option>
              {studentOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
            <input type="date" className="border rounded px-3 py-2" value={wellnessForm.check_date} onChange={(e) => setWellnessForm({ ...wellnessForm, check_date: e.target.value })} />
            <select className="border rounded px-3 py-2" value={wellnessForm.mood_score} onChange={(e) => setWellnessForm({ ...wellnessForm, mood_score: Number(e.target.value) })}>
              <option value={1}>1 - Low</option>
              <option value={2}>2</option>
              <option value={3}>3 - Neutral</option>
              <option value={4}>4</option>
              <option value={5}>5 - Great</option>
            </select>
            <input className="border rounded px-3 py-2" placeholder="Notes" value={wellnessForm.notes} onChange={(e) => setWellnessForm({ ...wellnessForm, notes: e.target.value })} />
            <button className="bg-rose-700 text-white rounded px-3 py-2" onClick={() => submitAction(apiService.createWellnessCheckin, { ...wellnessForm, student: Number(wellnessForm.student) })}>Save Wellness</button>
          </div>

          <p className="text-sm text-gray-500">Prep: {prepAttendance.length} | Inspections: {dormInspections.length} | Wellness: {wellnessCheckins.length}</p>
        </div>
      </div>
    </div>
  );
}
