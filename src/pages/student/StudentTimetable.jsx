import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import Header from "../../components/Header";
import LoadingSpinner from "../../components/LoadingSpinner";
import apiService from "../../services/apiService";

export default function StudentTimetable() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [timetable, setTimetable] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTimetable();
  }, []);

  const loadTimetable = async () => {
    try {
      setLoading(true);
      const data = await apiService.getStudentTimetable();
      setTimetable(data);
    } catch (error) {
      console.error("Error loading timetable:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

  const timeToMinutes = (timeStr) => {
    if (!timeStr) return 0;
    const cleanTime = timeStr.slice(0, 5);
    const [hours, mins] = cleanTime.split(':').map(Number);
    return hours * 60 + mins;
  };

  const minutesToTime = (mins) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  };

  const generateAllTimeSlots = (classConfig) => {
    if (!classConfig || !classConfig.first_period_start || !classConfig.last_period_end) return [];
    
    const slots = [];
    const firstStart = timeToMinutes(classConfig.first_period_start);
    const lastEnd = timeToMinutes(classConfig.last_period_end);
    const duration = classConfig.period_duration_minutes || 45;
    const transition = classConfig.include_transition_time ? 5 : 0;
    const effectiveDuration = duration - transition;
    
    const breakStart = classConfig.break_start ? timeToMinutes(classConfig.break_start) : null;
    const breakEnd = classConfig.break_end ? timeToMinutes(classConfig.break_end) : null;
    const lunchStart = classConfig.lunch_start ? timeToMinutes(classConfig.lunch_start) : null;
    const lunchEnd = classConfig.lunch_end ? timeToMinutes(classConfig.lunch_end) : null;
    
    let current = firstStart;
    let iterations = 0;
    
    while (current < lastEnd && iterations < 50) {
      iterations++;
      
      if (breakStart && breakEnd && current >= breakStart && current < breakEnd) {
        slots.push({ start: minutesToTime(breakStart), end: minutesToTime(breakEnd), isBreak: true });
        current = breakEnd;
        continue;
      }
      
      if (lunchStart && lunchEnd && current >= lunchStart && current < lunchEnd) {
        slots.push({ start: minutesToTime(lunchStart), end: minutesToTime(lunchEnd), isLunch: true });
        current = lunchEnd;
        continue;
      }
      
      let periodEnd = current + effectiveDuration;
      
      if (breakStart && current < breakStart && periodEnd > breakStart) {
        if (breakStart - current >= 10) {
          periodEnd = breakStart;
        } else {
          slots.push({ start: minutesToTime(breakStart), end: minutesToTime(breakEnd), isBreak: true });
          current = breakEnd;
          continue;
        }
      }
      
      if (lunchStart && current < lunchStart && periodEnd > lunchStart) {
        if (lunchStart - current >= 10) {
          periodEnd = lunchStart;
        } else {
          slots.push({ start: minutesToTime(lunchStart), end: minutesToTime(lunchEnd), isLunch: true });
          current = lunchEnd;
          continue;
        }
      }
      
      if (periodEnd > lastEnd) {
        if (lastEnd - current >= 10) {
          periodEnd = lastEnd;
        } else {
          break;
        }
      }
      
      slots.push({ start: minutesToTime(current), end: minutesToTime(periodEnd), isBreak: false, isLunch: false });
      current = periodEnd + transition;
    }
    
    return slots;
  };

  const organizeSchedule = () => {
    if (!timetable?.class_config) {
      const entries = Object.entries(timetable?.schedule || {}).sort((a, b) => {
        const timeA = timeToMinutes(a[0].split(' - ')[0]);
        const timeB = timeToMinutes(b[0].split(' - ')[0]);
        return timeA - timeB;
      });
      return entries.map(([timeSlot, classes]) => ({ timeSlot, classes, isBreak: false, isLunch: false }));
    }
    
    const allSlots = generateAllTimeSlots(timetable.class_config);
    const schedule = timetable.schedule || {};
    
    return allSlots.map(slot => {
      const key = `${slot.start} - ${slot.end}`;
      const classes = schedule[key] || {};
      return { timeSlot: key, classes, isBreak: slot.isBreak, isLunch: slot.isLunch };
    });
  };

  if (loading) {
    return (
      <div>
        <Header title="My Timetable" user={user} />
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div>
      <Header title="My Timetable" user={user} />
      
      <div className="p-6">
        <button
          onClick={() => navigate(-1)}
          className="mb-4 flex items-center text-blue-600 hover:text-blue-800 font-medium"
        >
          <i className="fas fa-arrow-left mr-2"></i>
          Back
        </button>
        
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-6">
            <h2 className="text-2xl font-bold">Weekly Timetable</h2>
            {timetable?.week_start_date && (
              <p className="text-blue-100 mt-2">
                Week of {formatDate(timetable.week_start_date)}
              </p>
            )}
          </div>

          {!timetable?.schedule || (Object.keys(timetable.schedule).length === 0 && !timetable?.class_config) ? (
            <div className="text-center py-12">
              <i className="fas fa-clock text-6xl text-gray-300 mb-4"></i>
              <p className="text-gray-500 text-lg">No timetable available</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Time</th>
                    {days.map((day) => (
                      <th key={day} className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                        {day}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {organizeSchedule().map(({ timeSlot, classes, isBreak, isLunch }) => (
                    <tr key={timeSlot} className={`${isBreak ? 'bg-yellow-50' : isLunch ? 'bg-orange-50' : 'hover:bg-gray-50'}`}>
                      <td className="px-4 py-3 font-semibold text-gray-700 whitespace-nowrap">
                        {timeSlot}
                      </td>
                      {days.map((day) => {
                        if (isBreak) {
                          return (
                            <td key={day} className="px-4 py-3 text-center">
                              <div className="bg-yellow-100 p-2 rounded border-l-4 border-yellow-500">
                                <p className="font-semibold text-yellow-800 text-sm">
                                  <i className="fas fa-coffee mr-1"></i>Break
                                </p>
                              </div>
                            </td>
                          );
                        }
                        if (isLunch) {
                          return (
                            <td key={day} className="px-4 py-3 text-center">
                              <div className="bg-orange-100 p-2 rounded border-l-4 border-orange-500">
                                <p className="font-semibold text-orange-800 text-sm">
                                  <i className="fas fa-utensils mr-1"></i>Lunch
                                </p>
                              </div>
                            </td>
                          );
                        }
                        const classInfo = classes[day];
                        return (
                          <td key={day} className="px-4 py-3">
                            {classInfo ? (
                              <div className="bg-blue-50 p-2 rounded border-l-4 border-blue-500">
                                <p className="font-semibold text-gray-800 text-sm">{classInfo.subject}</p>
                                {classInfo.teacher && (
                                  <p className="text-xs text-gray-600 mt-1">{classInfo.teacher}</p>
                                )}
                                {classInfo.room && (
                                  <p className="text-xs text-gray-500 mt-1">
                                    <i className="fas fa-door-open mr-1"></i>
                                    {classInfo.room}
                                  </p>
                                )}
                              </div>
                            ) : (
                              <div className="text-gray-400 text-sm">-</div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {timetable?.notes && (
          <div className="mt-6 bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded">
            <div className="flex">
              <i className="fas fa-info-circle text-yellow-600 text-xl mr-3"></i>
              <div>
                <h4 className="font-semibold text-yellow-800 mb-1">Notes</h4>
                <p className="text-yellow-700">{timetable.notes}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
