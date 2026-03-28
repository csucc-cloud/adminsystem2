import React, { useState, useEffect, useRef } from "react";
import { Html5QrcodeScanner } from "html5-qrcode";
import { 
  Scan, 
  UserCheck, 
  History, 
  Search, 
  Calendar, 
  BookOpen, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  X,
  Plus,
  Edit,
  Trash2,
  Archive,
  RefreshCw
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import ConfirmModal from "./ConfirmModal";
import Toast from "./Toast";

interface AttendanceLog {
  id: number;
  timestamp: string;
  student_id: string;
  name: string;
  course: string;
  event_name: string;
  time_in: string;
  time_out: string | null;
  status: string;
}

interface Event {
  id: number;
  name: string;
  date: string;
  status: string;
  created_at: string;
}

const AttendanceSystem = ({ user }: { user: any }) => {
  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [scanning, setScanning] = useState(false);
  const [activeTab, setActiveTab] = useState<"scanning" | "events">("scanning");
  const [lastScan, setLastScan] = useState<any>(null);
  const [eventName, setEventName] = useState("");
  const [isAddingEvent, setIsAddingEvent] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [eventFormData, setEventFormData] = useState({ name: "", date: "" });

  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {}
  });

  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error' | 'info';
  } | null>(null);
  
  const [scanGunInput, setScanGunInput] = useState("");
  const scanGunRef = useRef<HTMLInputElement>(null);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  useEffect(() => {
    fetchLogs();
    fetchEvents();
    const interval = setInterval(() => {
      fetchLogs();
      fetchEvents();
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Sync eventName with active events
  useEffect(() => {
    const activeEvents = events.filter(e => e.status === 'Active');
    if (activeEvents.length > 0) {
      const currentEventStillActive = activeEvents.find(e => e.name === eventName);
      if (!eventName || !currentEventStillActive) {
        setEventName(activeEvents[0].name);
      }
    } else if (eventName !== "") {
      setEventName("");
    }
  }, [events, eventName]);

  const fetchLogs = async () => {
    try {
      const res = await fetch("/api/attendance");
      if (!res.ok) throw new Error("Failed to fetch logs");
      const contentType = res.headers.get("content-type");
      if (!contentType?.includes("application/json")) throw new Error("Invalid response format");
      const data = await res.json();
      setLogs(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Fetch logs error:", err);
    }
  };

  const deleteLog = async (id: number) => {
    setConfirmModal({
      isOpen: true,
      title: "Delete Attendance Record",
      message: "Are you sure you want to delete this attendance record? This action cannot be undone.",
      onConfirm: async () => {
        try {
          console.log(`Attempting to delete log with id: ${id}`);
          const res = await fetch(`/api/attendance/${id}`, { method: "DELETE" });
          if (res.ok) {
            await fetchLogs();
            setToast({ message: "Attendance record deleted successfully.", type: "success" });
          } else {
            const errorData = await res.json().catch(() => ({}));
            throw new Error(errorData.message || "Failed to delete record");
          }
        } catch (err: any) {
          console.error("Delete log error:", err);
          setToast({ message: `Error: ${err.message}`, type: "error" });
        }
      }
    });
  };

  const fetchEvents = async () => {
    try {
      const res = await fetch("/api/events");
      if (!res.ok) throw new Error("Failed to fetch events");
      const contentType = res.headers.get("content-type");
      if (!contentType?.includes("application/json")) throw new Error("Invalid response format");
      const data = await res.json();
      setEvents(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Fetch events error:", err);
    }
  };

  const handleAddEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(eventFormData)
      });
      if (res.ok) {
        setIsAddingEvent(false);
        setEventFormData({ name: "", date: "" });
        fetchEvents();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEvent) return;
    try {
      const res = await fetch(`/api/events/${editingEvent.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...eventFormData, status: editingEvent.status })
      });
      if (res.ok) {
        setEditingEvent(null);
        setEventFormData({ name: "", date: "" });
        fetchEvents();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const toggleEventStatus = async (event: Event) => {
    const newStatus = event.status === 'Active' ? 'Archived' : 'Active';
    try {
      await fetch(`/api/events/${event.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: event.name, date: event.date, status: newStatus })
      });
      fetchEvents();
    } catch (err) {
      console.error(err);
    }
  };

  const deleteEvent = async (id: number) => {
    setConfirmModal({
      isOpen: true,
      title: "Delete Event",
      message: "Are you sure you want to delete this event? This will not delete attendance logs but the event will no longer be selectable.",
      onConfirm: async () => {
        try {
          console.log(`Attempting to delete event with id: ${id}`);
          const res = await fetch(`/api/events/${id}`, { method: "DELETE" });
          if (res.ok) {
            await fetchEvents();
            setToast({ message: "Event deleted successfully.", type: "success" });
          } else {
            const errorData = await res.json().catch(() => ({}));
            throw new Error(errorData.message || "Failed to delete event");
          }
        } catch (err: any) {
          console.error("Delete event error:", err);
          setToast({ message: `Error: ${err.message}`, type: "error" });
        }
      }
    });
  };

  const startScanner = () => {
    setScanning(true);
    setTimeout(() => {
      const scanner = new Html5QrcodeScanner(
        "reader",
        { fps: 10, qrbox: { width: 250, height: 250 } },
        /* verbose= */ false
      );
      scanner.render(onScanSuccess, onScanFailure);
      scannerRef.current = scanner;
    }, 100);
  };

  const stopScanner = () => {
    if (scannerRef.current) {
      scannerRef.current.clear().catch(err => console.error(err));
      scannerRef.current = null;
    }
    setScanning(false);
  };

  const onScanSuccess = async (decodedText: string) => {
    // Expected format: ID|Name|Course
    const parts = decodedText.split("|");
    const studentId = parts[0] || decodedText;
    const name = parts[1] || "Unknown Student";
    const course = parts[2] || "N/A";

    await processScan(studentId, name, course);
    if (!scanning) stopScanner();
  };

  const onScanFailure = (error: any) => {
    // console.warn(`Code scan error = ${error}`);
  };

  const processScan = async (studentId: string, name: string, course: string) => {
    if (!eventName) {
      alert("Please select an active event first.");
      return;
    }
    try {
      const res = await fetch("/api/attendance/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, name, course, eventName })
      });
      const data = await res.json();
      if (data.success) {
        setLastScan({ ...data, studentId: data.studentId, name: data.name });
        fetchLogs();
        setTimeout(() => setLastScan(null), 5000);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleScanGunSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (scanGunInput.trim()) {
      processScan(scanGunInput.trim(), "Manual Scan", "N/A");
      setScanGunInput("");
    }
  };

  // Keep focus on scan gun input
  useEffect(() => {
    const handleGlobalClick = () => {
      if (!scanning) scanGunRef.current?.focus();
    };
    window.addEventListener("click", handleGlobalClick);
    return () => window.removeEventListener("click", handleGlobalClick);
  }, [scanning]);

  return (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-hero-navy flex items-center gap-2">
            <UserCheck className="text-hero-gold" /> Attendance Management
          </h1>
          <p className="text-gray-500 text-sm">Real-time "One-Scan" Time-In/Out System</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <select 
              className="pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-bold text-hero-navy outline-none focus:ring-2 focus:ring-hero-navy min-w-[180px]"
              value={eventName}
              onChange={(e) => setEventName(e.target.value)}
            >
              <option value="" disabled>Select Event</option>
              {events.filter(e => e.status === 'Active').map(e => (
                <option key={e.id} value={e.name}>{e.name}</option>
              ))}
              {events.filter(e => e.status === 'Active').length === 0 && (
                <option disabled>No active events</option>
              )}
            </select>
          </div>

          <div className="flex bg-gray-100 p-1 rounded-lg mr-2">
            <button 
              onClick={() => setActiveTab("scanning")}
              className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${
                activeTab === "scanning" ? "bg-white text-hero-navy shadow-sm" : "text-gray-500 hover:text-hero-navy"
              }`}
            >
              Scanning
            </button>
            <button 
              onClick={() => setActiveTab("events")}
              className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${
                activeTab === "events" ? "bg-white text-hero-navy shadow-sm" : "text-gray-500 hover:text-hero-navy"
              }`}
            >
              Events
            </button>
          </div>

          {activeTab === "scanning" && (
            <button 
              onClick={scanning ? stopScanner : startScanner}
              className={`flex items-center gap-2 px-6 py-2 rounded-lg font-bold transition-all shadow-lg ${
                scanning ? "bg-red-500 text-white" : "hero-btn-primary"
              }`}
            >
              {scanning ? <X size={20} /> : <Scan size={20} />}
              {scanning ? "Stop Camera" : "Open Camera"}
            </button>
          )}

          {activeTab === "events" && (
            <button 
              onClick={() => setIsAddingEvent(true)}
              className="hero-btn-primary flex items-center gap-2 px-6 py-2 rounded-lg font-bold transition-all shadow-lg"
            >
              <Plus size={20} />
              New Event
            </button>
          )}
        </div>
      </header>

      {activeTab === "scanning" ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Scanner Area */}
        <div className="lg:col-span-1 space-y-6">
          <div className="hero-card p-6 relative min-h-[300px] flex flex-col items-center justify-center text-center">
            {scanning ? (
              <div id="reader" className="w-full"></div>
            ) : (
              <div className="space-y-4">
                <div className="w-20 h-20 bg-gray-100 rounded-full mx-auto flex items-center justify-center text-gray-400">
                  <Scan size={40} />
                </div>
                <div>
                  <h3 className="font-bold text-hero-navy">Ready to Scan</h3>
                  <p className="text-xs text-gray-500">Use physical scan gun or open camera</p>
                </div>
                
                {/* Hidden Scan Gun Input */}
                <form onSubmit={handleScanGunSubmit} className="opacity-0 absolute inset-0">
                  <input 
                    ref={scanGunRef}
                    autoFocus
                    value={scanGunInput}
                    onChange={(e) => setScanGunInput(e.target.value)}
                    className="w-full h-full cursor-default"
                  />
                </form>
              </div>
            )}

            <AnimatePresence>
              {lastScan && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className={`absolute inset-0 z-10 flex flex-col items-center justify-center p-6 text-white ${
                    lastScan.action === "Time-In" ? "bg-green-600" : "bg-blue-600"
                  }`}
                >
                  <CheckCircle2 size={64} className="mb-4" />
                  <h2 className="text-3xl font-black uppercase tracking-tighter">{lastScan.action} Successful</h2>
                  <p className="text-lg font-bold mt-2">{lastScan.name}</p>
                  <p className="text-sm opacity-80">{lastScan.studentId}</p>
                  <div className="mt-6 px-4 py-2 bg-white/20 rounded-full text-xs font-bold uppercase tracking-widest">
                    {new Date().toLocaleTimeString()}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="hero-card p-6">
            <h3 className="font-bold text-hero-navy mb-4 flex items-center gap-2">
              <AlertCircle size={18} className="text-hero-gold" /> Instructions
            </h3>
            <ul className="text-xs text-gray-600 space-y-3">
              <li className="flex gap-2">
                <span className="font-bold text-hero-navy">01.</span>
                <span>First scan creates a <span className="text-green-600 font-bold">Time-In</span> record.</span>
              </li>
              <li className="flex gap-2">
                <span className="font-bold text-hero-navy">02.</span>
                <span>Second scan updates the record with a <span className="text-blue-600 font-bold">Time-Out</span>.</span>
              </li>
              <li className="flex gap-2">
                <span className="font-bold text-hero-navy">03.</span>
                <span>Ensure the Student ID is clearly visible to the scanner.</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Logs Table */}
        <div className="lg:col-span-2">
          <div className="hero-card h-full flex flex-col">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <h3 className="font-bold text-hero-navy flex items-center gap-2">
                <History size={18} className="text-hero-gold" /> Recent Activity
              </h3>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                <input 
                  type="text" 
                  placeholder="Search logs..." 
                  className="pl-9 pr-4 py-1.5 bg-white border border-gray-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-hero-navy"
                />
              </div>
            </div>

            <div className="flex-1 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-gray-500 uppercase text-[10px] font-bold tracking-wider">
                  <tr>
                    <th className="px-6 py-3">Student</th>
                    <th className="px-6 py-3">Event</th>
                    <th className="px-6 py-3">Time In</th>
                    <th className="px-6 py-3">Time Out</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-bold text-hero-navy">{log.name}</div>
                        <div className="text-[10px] text-gray-400 font-mono">{log.student_id} • {log.course}</div>
                      </td>
                      <td className="px-6 py-4 text-xs font-medium text-gray-600">
                        {log.event_name}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5 text-xs text-green-600 font-bold">
                          <Clock size={12} />
                          {new Date(log.time_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {log.time_out ? (
                          <div className="flex items-center gap-1.5 text-xs text-blue-600 font-bold">
                            <Clock size={12} />
                            {new Date(log.time_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        ) : (
                          <span className="text-[10px] text-gray-300 italic">Pending...</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                          log.status === 'In' 
                            ? "bg-green-100 text-green-700" 
                            : "bg-blue-100 text-blue-700"
                        }`}>
                          {log.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button 
                          onClick={() => deleteLog(log.id)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete Log"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {logs.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-6 py-20 text-center text-gray-400">
                        <History size={48} className="mx-auto mb-4 opacity-20" />
                        <p className="font-medium">No attendance records found for today.</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    ) : (
        <div className="hero-card overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-gray-500 uppercase text-[10px] font-bold tracking-wider">
              <tr>
                <th className="px-6 py-3">Event Name</th>
                <th className="px-6 py-3">Scheduled Date</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Created</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {events.map((event) => (
                <tr key={event.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-bold text-hero-navy">{event.name}</div>
                  </td>
                  <td className="px-6 py-4 text-xs font-medium text-gray-600">
                    <div className="flex items-center gap-2">
                      <Calendar size={14} className="text-hero-gold" />
                      {new Date(event.date).toLocaleDateString(undefined, { dateStyle: 'long' })}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                      event.status === 'Active' 
                        ? "bg-green-100 text-green-700" 
                        : "bg-gray-100 text-gray-500"
                    }`}>
                      {event.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-xs text-gray-400">
                    {new Date(event.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button 
                        onClick={() => toggleEventStatus(event)}
                        className={`p-1.5 rounded-lg transition-colors ${
                          event.status === 'Active' ? "text-gray-400 hover:text-amber-600 hover:bg-amber-50" : "text-gray-400 hover:text-green-600 hover:bg-green-50"
                        }`}
                        title={event.status === 'Active' ? "Archive Event" : "Restore Event"}
                      >
                        <Archive size={16} />
                      </button>
                      <button 
                        onClick={() => {
                          setEditingEvent(event);
                          setEventFormData({ name: event.name, date: event.date.split('T')[0] });
                        }}
                        className="p-1.5 text-gray-400 hover:text-hero-navy hover:bg-gray-100 rounded-lg transition-colors"
                        title="Reschedule/Edit"
                      >
                        <RefreshCw size={16} />
                      </button>
                      <button 
                        onClick={() => deleteEvent(event.id)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete Event"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {events.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-20 text-center text-gray-400">
                    <Calendar size={48} className="mx-auto mb-4 opacity-20" />
                    <p className="font-medium">No events found. Create one to start tracking attendance.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Add/Edit Event Modal */}
      <AnimatePresence>
        {(isAddingEvent || editingEvent) && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-hero-navy/80 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="bg-hero-gold p-6 flex items-center justify-between">
                <h2 className="text-hero-navy font-bold text-xl flex items-center gap-2">
                  <Calendar size={24} /> {editingEvent ? "Edit Event" : "Create New Event"}
                </h2>
                <button 
                  onClick={() => {
                    setIsAddingEvent(false);
                    setEditingEvent(null);
                    setEventFormData({ name: "", date: "" });
                  }} 
                  className="text-hero-navy hover:bg-black/5 p-1 rounded-full transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={editingEvent ? handleUpdateEvent : handleAddEvent} className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Event Name</label>
                  <input 
                    type="text" 
                    className="hero-input" 
                    placeholder="e.g. Annual Sports Fest 2026"
                    required
                    value={eventFormData.name}
                    onChange={(e) => setEventFormData({ ...eventFormData, name: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Event Date</label>
                  <input 
                    type="date" 
                    className="hero-input" 
                    required
                    value={eventFormData.date}
                    onChange={(e) => setEventFormData({ ...eventFormData, date: e.target.value })}
                  />
                </div>

                <div className="pt-4 flex gap-4">
                  <button 
                    type="button" 
                    onClick={() => {
                      setIsAddingEvent(false);
                      setEditingEvent(null);
                      setEventFormData({ name: "", date: "" });
                    }} 
                    className="flex-1 py-3 border border-gray-200 rounded-xl font-bold text-gray-500 hover:bg-gray-50 transition-all"
                  >
                    Cancel
                  </button>
                  <button type="submit" className="flex-1 hero-btn-primary py-3">
                    {editingEvent ? "Save Changes" : "Create Event"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
      />

      <AnimatePresence>
        {toast && (
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => setToast(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default AttendanceSystem;
