import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Link, useNavigate, useLocation } from "react-router-dom";
import { 
  LayoutDashboard, 
  UserCheck, 
  Wallet, 
  LogOut, 
  Menu, 
  X, 
  ShieldCheck,
  ChevronRight,
  TrendingUp,
  Users,
  CreditCard
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import AttendanceSystem from "./components/AttendanceSystem";
import FinancialSystem from "./components/FinancialSystem";
import StudentManagement from "./components/StudentManagement";

// --- Auth Context Simulation ---
interface User {
  email: string;
  name: string;
  role: string;
}

const App = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedUser = localStorage.getItem("hero_user");
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
    setLoading(false);
  }, []);

  const login = async (email: string) => {
  // Check if it's a valid organization email
  if (email.endsWith("@csucc.edu.ph")) {
    const mockUser = {
      email: email,
      name: "Davie Sialongo", // You can pull this from the email string later
      role: "Admin"
    };

    // Save to state and localStorage so it stays logged in
    setUser(mockUser);
    localStorage.setItem("hero_user", JSON.stringify(mockUser));
    return true;
  }
  
  // If the email doesn't match our domain
  return false;
};

  const logout = () => {
    setUser(null);
    localStorage.removeItem("hero_user");
  };

  if (loading) return <div className="h-screen flex items-center justify-center bg-hero-navy text-hero-gold font-bold text-2xl">HERO...</div>;

  if (!user) return <LoginScreen onLogin={login} />;

  return (
    <Router>
      <div className="min-h-screen flex flex-col md:flex-row bg-gray-50">
        <Sidebar user={user} onLogout={logout} />
        <main className="flex-1 p-4 md:p-8 overflow-y-auto">
          <Routes>
            <Route path="/" element={<Dashboard user={user} />} />
            <Route path="/students" element={<StudentManagement user={user} />} />
            <Route path="/attendance" element={<AttendanceSystem user={user} />} />
            <Route path="/finance" element={<FinancialSystem user={user} />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
};

const LoginScreen = ({ onLogin }: { onLogin: (email: string) => Promise<boolean> }) => {
  const [email, setEmail] = useState("davie.sialongo@csucc.edu.ph");
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await onLogin(email);
    if (!success) setError("Unauthorized email address.");
  };

  return (
    <div className="h-screen flex items-center justify-center bg-hero-navy p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden"
      >
        <div className="bg-hero-gold p-8 text-center">
          <div className="w-20 h-20 bg-hero-navy rounded-full mx-auto flex items-center justify-center mb-4 shadow-lg">
            <ShieldCheck className="text-hero-gold w-10 h-10" />
          </div>
          <h1 className="text-hero-navy text-2xl font-bold uppercase tracking-widest">HERO Organization</h1>
          <p className="text-hero-navy opacity-80 text-sm font-medium">Integrated Web System</p>
        </div>
        
        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Staff Email</label>
            <input 
              type="email" 
              className="hero-input" 
              placeholder="name@csucc.edu.ph"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          
          {error && <p className="text-red-500 text-sm font-medium">{error}</p>}
          
          <button type="submit" className="w-full hero-btn-primary py-3 text-lg">
            Access System
          </button>
          
          <p className="text-center text-xs text-gray-400">
            Authorized Personnel Only. Access is logged.
          </p>
        </form>
      </motion.div>
    </div>
  );
};

const Sidebar = ({ user, onLogout }: { user: User, onLogout: () => void }) => {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();

  const navItems = [
    { name: "Dashboard", path: "/", icon: LayoutDashboard },
    { name: "Students", path: "/students", icon: Users },
    { name: "Attendance", path: "/attendance", icon: UserCheck },
    { name: "Finance", path: "/finance", icon: Wallet },
  ];

  return (
    <>
      {/* Mobile Header */}
      <div className="md:hidden bg-hero-navy p-4 flex items-center justify-between text-hero-gold">
        <h1 className="font-bold tracking-tighter text-xl">HERO</h1>
        <button onClick={() => setIsOpen(!isOpen)}>
          {isOpen ? <X /> : <Menu />}
        </button>
      </div>

      {/* Sidebar Content */}
      <AnimatePresence>
        {(isOpen || window.innerWidth >= 768) && (
          <motion.aside 
            initial={{ x: -300 }}
            animate={{ x: 0 }}
            exit={{ x: -300 }}
            className="fixed md:static inset-y-0 left-0 w-64 bg-hero-navy text-white z-50 flex flex-col shadow-2xl"
          >
            <div className="p-8 border-b border-white/10">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-hero-gold rounded-lg flex items-center justify-center">
                  <ShieldCheck className="text-hero-navy w-6 h-6" />
                </div>
                <div>
                  <h1 className="font-bold text-lg leading-tight">HERO</h1>
                  <p className="text-hero-gold text-[10px] uppercase tracking-widest font-bold">Integrated System</p>
                </div>
              </div>
              
              <div className="bg-white/5 rounded-xl p-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-hero-gold text-hero-navy flex items-center justify-center font-bold text-xs">
                  {user.name.charAt(0)}
                </div>
                <div className="overflow-hidden">
                  <p className="text-xs font-bold truncate">{user.name}</p>
                  <p className="text-[10px] text-hero-gold uppercase font-bold">{user.role}</p>
                </div>
              </div>
            </div>

            <nav className="flex-1 p-4 space-y-2 mt-4">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <Link 
                    key={item.name} 
                    to={item.path}
                    onClick={() => setIsOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                      isActive 
                        ? "bg-hero-gold text-hero-navy font-bold shadow-lg" 
                        : "hover:bg-white/5 text-gray-300"
                    }`}
                  >
                    <Icon size={20} />
                    <span>{item.name}</span>
                    {isActive && <ChevronRight size={16} className="ml-auto" />}
                  </Link>
                );
              })}
            </nav>

            <div className="p-4 border-t border-white/10">
              <button 
                onClick={onLogout}
                className="w-full flex items-center gap-3 px-4 py-3 text-red-400 hover:bg-red-500/10 rounded-xl transition-all"
              >
                <LogOut size={20} />
                <span className="font-medium">Logout</span>
              </button>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
};

const Dashboard = ({ user }: { user: User }) => {
  const [stats, setStats] = useState({ attendance: 0, finance: 0 });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [attRes, finRes] = await Promise.all([
          fetch("/api/attendance"),
          fetch("/api/finance")
        ]);

        if (!attRes.ok || !finRes.ok) {
          throw new Error("Failed to fetch statistics");
        }

        const attContentType = attRes.headers.get("content-type");
        const finContentType = finRes.headers.get("content-type");

        if (!attContentType?.includes("application/json") || !finContentType?.includes("application/json")) {
          throw new Error("Invalid response format from server");
        }

        const attData = await attRes.json();
        const finData = await finRes.json();
        
        setStats({
          attendance: Array.isArray(attData) ? attData.length : 0,
          finance: Array.isArray(finData) ? finData.reduce((acc: number, curr: any) => acc + (curr.amount || 0), 0) : 0
        });
      } catch (err) {
        console.error("Dashboard stats error:", err);
      }
    };
    fetchStats();
  }, []);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold text-hero-navy">Welcome back, {user.name.split(" ")[0]}!</h1>
        <p className="text-gray-500">Here's what's happening in the organization today.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard 
          title="Total Attendance" 
          value={stats.attendance.toString()} 
          icon={Users} 
          color="bg-blue-500" 
          trend="+12% from last event"
        />
        <StatCard 
          title="Total Collections" 
          value={`₱${stats.finance.toLocaleString()}`} 
          icon={CreditCard} 
          color="bg-green-500" 
          trend="+5% this month"
        />
        <StatCard 
          title="Active Events" 
          value="2" 
          icon={TrendingUp} 
          color="bg-purple-500" 
          trend="Next event in 3 days"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="hero-card p-6">
          <h2 className="text-xl font-bold text-hero-navy mb-4 flex items-center gap-2">
            <UserCheck className="text-hero-gold" /> Quick Actions
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <Link to="/attendance" className="p-4 bg-gray-50 rounded-xl hover:bg-hero-navy hover:text-white transition-all group">
              <p className="font-bold">Scan Attendance</p>
              <p className="text-xs text-gray-500 group-hover:text-hero-gold">Start time-in/out</p>
            </Link>
            <Link to="/finance" className="p-4 bg-gray-50 rounded-xl hover:bg-hero-navy hover:text-white transition-all group">
              <p className="font-bold">Record Payment</p>
              <p className="text-xs text-gray-500 group-hover:text-hero-gold">Issue new receipt</p>
            </Link>
          </div>
        </div>

        <div className="hero-card p-6">
          <h2 className="text-xl font-bold text-hero-navy mb-4 flex items-center gap-2">
            <ShieldCheck className="text-hero-gold" /> System Status
          </h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
              <span className="text-sm font-medium text-green-700">Database Connection</span>
              <span className="px-2 py-1 bg-green-200 text-green-800 text-[10px] font-bold rounded uppercase">Active</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
              <span className="text-sm font-medium text-blue-700">Scanner Module</span>
              <span className="px-2 py-1 bg-blue-200 text-blue-800 text-[10px] font-bold rounded uppercase">Ready</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ title, value, icon: Icon, color, trend }: any) => (
  <div className="hero-card p-6 flex items-start justify-between">
    <div>
      <p className="text-sm font-bold text-gray-500 uppercase tracking-wider">{title}</p>
      <h3 className="text-3xl font-bold text-hero-navy mt-1">{value}</h3>
      <p className="text-xs text-green-600 font-medium mt-2">{trend}</p>
    </div>
    <div className={`p-3 rounded-xl ${color} text-white shadow-lg`}>
      <Icon size={24} />
    </div>
  </div>
);

export default App;
