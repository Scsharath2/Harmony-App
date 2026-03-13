import React, { useState, useEffect } from 'react';
import { Heart, Users, ClipboardCheck, BarChart3, MessageSquare, Plus, ArrowRight, LogOut, ChevronRight, Loader2, AlertCircle, Sparkles, Share2, Copy, Check, ChevronLeft, Trash2, Edit2, CreditCard, History, Info, X, Key } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { io } from 'socket.io-client';
import { calculateScores, generateHarmonyReport } from './services/harmonyService';
import { GlassCard } from './components/GlassCard';
import { RadarChart } from './components/RadarChart';
import { WeddingReadiness } from './components/WeddingReadiness';
import { TalkCards, AICoach, PillarComparisonChart, PillarInsights } from './components/ReportComponents';

const socket = io();

const C = {
  bg: "#08070F", surface: "#10101C",
  gold: "#E8B86D", goldDim: "#9B7340", goldSoft: "rgba(232,184,109,0.13)",
  sage: "#5ECFA0", sageSoft: "rgba(94,207,160,0.11)",
  sky: "#60B4F0",  skySoft: "rgba(96,180,240,0.11)",
  rose: "#F08080", roseSoft: "rgba(240,128,128,0.11)",
  violet: "#A78BFA", violetSoft: "rgba(167,139,250,0.11)",
  text: "#F2EDE4", muted: "#5C5650", faint: "#1A1825",
  gradGold: "linear-gradient(135deg,#E8B86D,#C4893A)",
  gradSage: "linear-gradient(135deg,#5ECFA0,#2D9E72)",
  gradSky: "linear-gradient(135deg,#60B4F0,#3080C8)",
  gradViolet: "linear-gradient(135deg,#A78BFA,#7C5CBF)",
};

const PILLARS_CONFIG: Record<string, { icon: string, color: string, desc: string, id: string }> = {
  'Emotional': { id: 'emotional', icon: "💛", color: "#F0B429", desc: "How you give & receive support" },
  'Conflict': { id: 'conflict', icon: "🌊", color: "#60A5FA", desc: "How you navigate disagreement" },
  'Financial': { id: 'financial', icon: "🌿", color: "#34D399", desc: "Your relationship with money" },
  'Family': { id: 'family', icon: "🏡", color: "#A78BFA", desc: "Roles, boundaries & belonging" },
  'Life Vision': { id: 'lifevision', icon: "🌅", color: "#38BDF8", desc: "Where you're headed together" },
  'Parenting': { id: 'parenting', icon: "🌱", color: "#FB923C", desc: "How you imagine raising a family" },
  'Intimacy': { id: 'intimacy', icon: "🕯️", color: "#F472B6", desc: "Connection, closeness & care" },
  'Lifestyle': { id: 'lifestyle', icon: "☀️", color: "#A3E635", desc: "Daily rhythms & how you live" },
};

interface User {
  id: string;
  email: string;
  name: string;
}

interface Question {
  id: string;
  pillar: string;
  text: string;
  options: string[];
}

interface Assessment {
  id: string;
  name?: string;
  type: 'trial' | 'full';
  status: string;
  role: string;
  invite_status: string;
  invite_code: string;
  participants?: any[];
  participant_count?: number;
}

interface Transaction {
  id: string;
  assessment_id: string;
  assessment_name: string;
  amount: number;
  currency: string;
  status: string;
  created_at: string;
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState<'login' | 'dashboard' | 'assessment' | 'questionnaire' | 'report' | 'transactions'>('login');
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [currentAssessment, setCurrentAssessment] = useState<Assessment | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [allResponses, setAllResponses] = useState<any[]>([]);
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showJoinCodeModal, setShowJoinCodeModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState<string | null>(null);
  const [inviteCode, setInviteCode] = useState('');
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [showRenameModal, setShowRenameModal] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [copied, setCopied] = useState(false);
  const [currentPillar, setCurrentPillar] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  useEffect(() => {
    socket.on('partner:joined', (data) => {
      console.log("Real-time: Partner joined", data);
      if (currentAssessment && data.assessmentId === currentAssessment.id) {
        setCurrentAssessment(prev => prev ? { ...prev, participants: data.participants } : null);
      }
      if (user) fetchAssessments(user.id);
    });

    socket.on('assessment:updated', (data) => {
      console.log("Real-time: Assessment updated", data);
      if (currentAssessment && data.id === currentAssessment.id) {
        setCurrentAssessment(prev => prev ? { ...prev, name: data.name } : null);
      }
      if (user) fetchAssessments(user.id);
    });

    return () => {
      socket.off('partner:joined');
      socket.off('assessment:updated');
    };
  }, [currentAssessment, user]);

  useEffect(() => {
    if (currentAssessment) {
      socket.emit('join', currentAssessment.id);
    }
  }, [currentAssessment]);

  useEffect(() => {
    const savedUser = localStorage.getItem('harmony_user');
    if (savedUser) {
      const u = JSON.parse(savedUser);
      setUser(u);
      setView('dashboard');
      fetchAssessments(u.id);
    }
    fetchQuestions();

    // Check for join link
    const params = new URLSearchParams(window.location.search);
    const joinId = params.get('join');
    if (joinId) {
      // If user is logged in, join automatically
      if (savedUser) {
        handleJoinAssessment(joinId, JSON.parse(savedUser));
      } else {
        // If not logged in, we'll handle it after login
        localStorage.setItem('pending_join', joinId);
      }
    }
  }, []);

  useEffect(() => {
    if (user && view === 'dashboard') {
      fetchAssessments(user.id);
    }
  }, [user, view]);

  useEffect(() => {
    if (user && view === 'assessment' && currentAssessment) {
      const interval = setInterval(async () => {
        try {
          const res = await fetch(`/api/assessment/${currentAssessment.id}`);
          if (res.ok) {
            const data = await res.json();
            if (data.name !== currentAssessment.name) {
              setCurrentAssessment(data);
            }
          }
        } catch (e) {
          console.error("Polling error:", e);
        }
      }, 10000);
      return () => clearInterval(interval);
    }
  }, [user, view, currentAssessment?.id, currentAssessment?.name]);

  const handleJoinAssessment = async (assessmentId: string, u: User) => {
    setLoading(true);
    try {
      // First check if it's a full assessment that needs a code
      const checkRes = await fetch(`/api/assessment/${assessmentId}`);
      const assessment = await checkRes.json();
      
      if (assessment.type === 'full') {
        setShowJoinCodeModal(true);
        setLoading(false);
        return;
      }

      const res = await fetch(`/api/assessments/${assessmentId}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: u.email, name: u.name }),
      });
      if (res.ok) {
        fetchAssessments(u.id);
        localStorage.removeItem('pending_join');
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const handleJoinWithCode = async () => {
    if (!user || !joinCodeInput) return;
    
    if (joinCodeInput.length !== 6) {
      setError("Invite codes must be exactly 6 characters.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const sanitized = joinCodeInput.replace(/[^A-Z0-9]/gi, '').toUpperCase();
      const res = await fetch('/api/assessments/join-with-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, inviteCode: sanitized }),
      });
      const data = await res.json();
      console.log("Join response:", data);
      
      if (res.ok) {
        await fetchAssessments(user.id);
        setShowJoinCodeModal(false);
        setJoinCodeInput('');
        
        if (data.assessment) {
          startAssessment(data.assessment);
        } else if (data.assessmentId) {
          const assessmentRes = await fetch(`/api/assessment/${data.assessmentId}`);
          if (assessmentRes.ok) {
            const assessmentData = await assessmentRes.json();
            startAssessment(assessmentData);
          }
        }
      } else {
        setError(data.error || "Failed to join journey. Please check the code.");
      }
    } catch (e) {
      console.error("Join error:", e);
      setError("An error occurred while joining. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  const fetchQuestions = async () => {
    try {
      const res = await fetch('/api/questions');
      const data = await res.json();
      console.log('Fetched questions:', data);
      setQuestions(data);
    } catch (error) {
      console.error('Error fetching questions:', error);
    }
  };

  const regenerateInviteCode = async () => {
    if (!user || !currentAssessment) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/assessments/${currentAssessment.id}/regenerate-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      });
      const data = await res.json();
      if (res.ok) {
        setCurrentAssessment({ ...currentAssessment, invite_code: data.inviteCode });
        await fetchAssessments(user.id);
      } else {
        setError(data.error || "Failed to regenerate code");
      }
    } catch (e) {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const fetchAssessments = async (userId: string) => {
    const res = await fetch(`/api/assessments/${userId}`);
    const data = await res.json();
    console.log("Fetched assessments for", userId, ":", data);
    setAssessments(data);
  };

  const fetchTransactions = async (userId: string) => {
    const res = await fetch(`/api/transactions/${userId}`);
    const data = await res.json();
    setTransactions(data);
  };

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const name = formData.get('name') as string;

    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, name }),
    });
    const u = await res.json();
    setUser(u);
    localStorage.setItem('harmony_user', JSON.stringify(u));
    
    const pendingJoin = localStorage.getItem('pending_join');
    if (pendingJoin) {
      await handleJoinAssessment(pendingJoin, u);
    }

    setView('dashboard');
    fetchAssessments(u.id);
  };

  const createAssessment = async () => {
    if (!user) return;
    if (assessments.length >= 10) {
      setError("You've reached the maximum limit of 10 assessments.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/assessments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, type: 'trial' }),
      });
      
      const data = await res.json();
      
      if (res.ok) {
        await fetchAssessments(user.id);
        startAssessment(data);
      } else {
        setError(data.error || "Failed to create assessment");
      }
    } catch (e: any) {
      console.error(e);
      setError(e.message || "Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const deleteAssessment = async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/assessments/${id}`, { method: 'DELETE' });
      if (res.ok) {
        if (user) await fetchAssessments(user.id);
        if (currentAssessment?.id === id) {
          setView('dashboard');
          setCurrentAssessment(null);
        }
        setShowDeleteModal(null);
      } else {
        setError("Failed to delete assessment");
      }
    } catch (e) {
      console.error(e);
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const renameAssessment = async (id: string, name: string) => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/assessments/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, userId: user.id }),
      });
      if (res.ok) {
        await fetchAssessments(user.id);
        if (currentAssessment && currentAssessment.id === id) {
          setCurrentAssessment({ ...currentAssessment, name });
        }
        setShowRenameModal(null);
        setNewName('');
      } else {
        const data = await res.json();
        setError(data.error || "Failed to rename assessment");
      }
    } catch (e) {
      console.error(e);
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const startAssessment = async (assessment: Assessment) => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/assessment/${assessment.id}`);
      if (!res.ok) throw new Error("Failed to fetch assessment details");
      const data = await res.json();
      setCurrentAssessment(data);
      
      const respRes = await fetch(`/api/responses/${assessment.id}`);
      if (!respRes.ok) throw new Error("Failed to fetch responses");
      const respData = await respRes.json();
      setAllResponses(respData);
      
      const userResp = respData.filter((r: any) => r.user_id === user?.id);
      const respMap: Record<string, string> = {};
      userResp.forEach((r: any) => respMap[r.question_id] = r.value);
      setResponses(respMap);
      
      setView('assessment');
    } catch (err: any) {
      console.error("Start Assessment Error:", err);
      setError("Failed to open the journey. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const submitResponses = async () => {
    if (!user || !currentAssessment) return;
    setLoading(true);
    await fetch('/api/responses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        assessmentId: currentAssessment.id,
        userId: user.id,
        responses
      }),
    });
    
    // Refresh data
    const respRes = await fetch(`/api/responses/${currentAssessment.assessment_id || currentAssessment.id}`);
    const respData = await respRes.json();
    setAllResponses(respData);
    setLoading(false);
    setView('assessment');
    setCurrentPillar(null);
  };

  const generateReport = async () => {
    if (!currentAssessment) return;
    setLoading(true);
    setError(null);
    try {
      const scoring = calculateScores(questions, allResponses, currentAssessment.participants || []);
      const reportData = await generateHarmonyReport(scoring, currentAssessment.participants || []);
      setReport({ ...reportData, scoring });
      setView('report');
    } catch (err: any) {
      console.error("Report Generation Error:", err);
      setError("We encountered a cosmic ripple while generating your report. Please try again in a moment.");
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentAssessment) return;
    setLoading(true);
    const res = await fetch(`/api/assessments/${currentAssessment.id}/invite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: inviteEmail, name: inviteName }),
    });
    if (res.ok) {
      const updatedRes = await fetch(`/api/assessment/${currentAssessment.id}`);
      const updatedData = await updatedRes.json();
      setCurrentAssessment(updatedData);
      setShowInviteModal(false);
      setInviteEmail('');
      setInviteName('');
    }
    setLoading(false);
  };

  const handleUpgrade = async () => {
    if (!currentAssessment || !user) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/assessments/${currentAssessment.id}/upgrade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      });
      const data = await res.json();
      if (res.ok) {
        const updatedRes = await fetch(`/api/assessment/${currentAssessment.id}`);
        const updatedData = await updatedRes.json();
        setCurrentAssessment(updatedData);
        setInviteCode(data.inviteCode);
        // Don't close payment modal immediately, show the code
      }
    } catch (e) {
      setError("Upgrade failed. Please try again.");
    }
    setLoading(false);
  };

  const logout = () => {
    localStorage.removeItem('harmony_user');
    setUser(null);
    setView('login');
  };

  const copyInviteLink = () => {
    if (!currentAssessment) return;
    const link = `${window.location.origin}?join=${currentAssessment.id}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const pageVariants = {
    initial: { opacity: 0, y: 15, scale: 0.98 },
    animate: { opacity: 1, y: 0, scale: 1 },
    exit: { opacity: 0, y: -15, scale: 0.98 }
  };

  const pageTransition = {
    duration: 0.6,
    ease: [0.22, 1, 0.36, 1]
  };

  if (view === 'login') {
    return (
      <div className="min-h-screen bg-[#08070F] flex items-center justify-center p-4 font-sans">
        <motion.div 
          initial="initial"
          animate="animate"
          variants={pageVariants}
          transition={pageTransition}
          className="bg-[#10101C] p-10 rounded-[2.5rem] shadow-2xl max-w-md w-full border border-white/5 relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#E8B86D]/10 blur-[60px] -mr-16 -mt-16"></div>
          <div className="flex justify-center mb-8">
            <div className="bg-[#E8B86D]/10 p-5 rounded-full border border-[#E8B86D]/20">
              <Heart className="w-12 h-12 text-[#E8B86D] fill-[#E8B86D]" />
            </div>
          </div>
          <h1 className="text-4xl font-serif text-center mb-2 text-[#F2EDE4]">Harmony</h1>
          <p className="text-[#5C5650] text-center mb-10 italic font-serif text-lg">Professional Relationship Assessment & Alignment</p>
          
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-[10px] uppercase tracking-[0.2em] text-[#5C5650] font-bold mb-2 ml-1">Full Name</label>
              <input 
                name="name" 
                required 
                className="w-full px-5 py-4 rounded-2xl bg-white/5 border border-white/10 text-[#F2EDE4] focus:outline-none focus:ring-2 focus:ring-[#E8B86D]/30 transition-all placeholder:text-white/10"
                placeholder="Full Name"
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-[0.2em] text-[#5C5650] font-bold mb-2 ml-1">Email Address</label>
              <input 
                name="email" 
                type="email" 
                required 
                className="w-full px-5 py-4 rounded-2xl bg-white/5 border border-white/10 text-[#F2EDE4] focus:outline-none focus:ring-2 focus:ring-[#E8B86D]/30 transition-all placeholder:text-white/10"
                placeholder="Email Address"
              />
            </div>
            <div className="space-y-4 pt-2">
              <motion.button 
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                className="w-full bg-gradient-to-br from-[#E8B86D] to-[#C4893A] text-[#08070F] py-5 rounded-2xl font-bold hover:opacity-90 transition-all shadow-xl shadow-[#E8B86D]/20 flex items-center justify-center gap-3 uppercase tracking-widest text-xs"
              >
                Sign In
              </motion.button>
            </div>
          </form>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#08070F] text-[#F2EDE4] font-sans selection:bg-[#E8B86D]/30">
      {/* Header */}
      <header className="bg-[#08070F]/80 backdrop-blur-xl border-b border-white/5 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 h-24 flex items-center justify-between">
          <div className="flex items-center gap-4 cursor-pointer group" onClick={() => setView('dashboard')}>
            <div className="bg-[#E8B86D]/10 p-2.5 rounded-xl border border-[#E8B86D]/20 group-hover:scale-110 transition-transform">
              <Heart className="w-6 h-6 text-[#E8B86D] fill-[#E8B86D]" />
            </div>
            <span className="text-2xl font-serif font-medium tracking-tight">Harmony</span>
          </div>
          <div className="flex items-center gap-6">
            <button 
              onClick={() => {
                if (user) fetchTransactions(user.id);
                setView('transactions');
              }}
              className="p-3 text-[#5C5650] hover:text-[#E8B86D] transition-colors bg-white/5 rounded-xl border border-white/5"
              title="Transactions"
            >
              <History className="w-5 h-5" />
            </button>
            <div className="text-right hidden sm:block">
              <p className="text-sm font-semibold text-[#F2EDE4]">{user?.name}</p>
              <p className="text-[10px] text-[#5C5650] uppercase tracking-widest">{user?.email}</p>
            </div>
            <button onClick={logout} className="p-3 text-[#5C5650] hover:text-[#F08080] transition-colors bg-white/5 rounded-xl border border-white/5">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-16">
        <AnimatePresence mode="wait">
          {view === 'dashboard' && (
            <motion.div 
              key="dashboard"
              initial="initial"
              animate="animate"
              exit="exit"
              variants={pageVariants}
              transition={pageTransition}
            >
              <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6">
                <div>
                  <h2 className="text-4xl font-serif mb-3">Your Journeys</h2>
                  <p className="text-[#5C5650] text-lg">A sacred space for your relationship's evolution.</p>
                </div>
                <div className="flex items-center gap-4">
                  {error && (
                    <div className="flex items-center gap-3 text-[#F08080] text-[10px] font-bold uppercase tracking-widest bg-[#F08080]/10 px-4 py-2 rounded-xl border border-[#F08080]/20 group relative">
                      <AlertCircle className="w-3 h-3" /> 
                      <span>{error}</span>
                      <button 
                        onClick={() => setError(null)}
                        className="p-1 hover:bg-white/10 rounded-full transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                  <motion.button 
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => user && fetchAssessments(user.id)}
                    className="bg-white/5 border border-white/10 p-4 rounded-2xl hover:bg-white/10 transition-all text-[#5C5650]"
                    title="Refresh Journeys"
                  >
                    <History className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                  </motion.button>
                  <motion.button 
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setShowJoinCodeModal(true)}
                    className="bg-white/5 border border-white/10 px-6 py-4 rounded-2xl font-bold flex items-center gap-3 hover:bg-white/10 transition-all shadow-sm text-[10px] uppercase tracking-widest text-[#5C5650]"
                  >
                    <Key className="w-4 h-4" /> Join with Code
                  </motion.button>
                  <motion.button 
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={createAssessment}
                    className="bg-white/5 border border-white/10 px-8 py-4 rounded-2xl font-bold flex items-center gap-3 hover:bg-white/10 transition-all shadow-sm text-xs uppercase tracking-widest text-[#E8B86D]"
                  >
                    <Plus className="w-4 h-4" /> New Journey
                  </motion.button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {assessments.map((a, i) => (
                  <motion.div 
                    key={a.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1, duration: 0.5 }}
                    className="bg-[#10101C] p-8 rounded-[2rem] border border-white/5 hover:border-[#E8B86D]/30 hover:shadow-2xl hover:shadow-[#E8B86D]/5 transition-all cursor-pointer group relative overflow-hidden"
                  >
                    <div className="absolute top-0 right-0 w-24 h-24 bg-[#E8B86D]/5 blur-[40px] -mr-12 -mt-12"></div>
                    <div className="flex items-start justify-between mb-6">
                      <div onClick={() => startAssessment(a)} className="bg-white/5 p-4 rounded-2xl group-hover:bg-[#E8B86D]/10 transition-colors border border-white/5">
                        <ClipboardCheck className="w-7 h-7 text-[#5C5650] group-hover:text-[#E8B86D]" />
                      </div>
                      <div className="flex items-center gap-2">
                        {a.role === 'creator' && (a.participant_count || 0) < 2 && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); setCurrentAssessment(a); setShowInviteModal(true); }}
                            className="p-2 text-[#5C5650] hover:text-[#E8B86D] transition-colors"
                            title="Invite Partner"
                          >
                            <Share2 className="w-4 h-4" />
                          </button>
                        )}
                        {a.role === 'creator' && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); setShowRenameModal(a.id); setNewName(a.name || ''); }}
                            className="p-2 text-[#5C5650] hover:text-[#E8B86D] transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        )}
                        {a.role === 'creator' && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); setShowDeleteModal(a.id); }}
                            className="p-2 text-[#5C5650] hover:text-[#F08080] transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                        <span className={`text-[10px] uppercase tracking-[0.2em] font-black px-4 py-1.5 rounded-full border ${a.type === 'trial' ? 'bg-[#E8B86D]/10 text-[#E8B86D] border-[#E8B86D]/20' : 'bg-[#5ECFA0]/10 text-[#5ECFA0] border-[#5ECFA0]/20'}`}>
                          {a.type}
                        </span>
                      </div>
                    </div>
                    <div onClick={() => startAssessment(a)}>
                      <h3 className="text-2xl font-serif mb-2">{a.name || `Journey #${a.id}`}</h3>
                      <p className="text-[#5C5650] text-sm mb-8">Initiated on {new Date().toLocaleDateString()}</p>
                      <div className="flex items-center justify-between pt-6 border-t border-white/5">
                        <div className="flex items-center gap-3 text-[#5C5650] text-xs font-bold uppercase tracking-widest">
                          <Users className="w-4 h-4" />
                          {a.role === 'creator' ? 'Architect' : 'Partner'}
                        </div>
                        <div className="flex items-center gap-2 text-[#E8B86D] text-xs font-bold uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
                          Continue Exploration <ChevronRight className="w-4 h-4" />
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
                {assessments.length === 0 && (
                  <div className="col-span-full py-24 text-center bg-white/5 rounded-[2.5rem] border border-dashed border-white/10">
                    <ClipboardCheck className="w-16 h-16 text-white/10 mx-auto mb-6" />
                    <p className="text-[#5C5650] text-lg font-serif italic">No assessments yet. Start your first one above.</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {view === 'assessment' && currentAssessment && (
            <motion.div 
              key="assessment"
              initial="initial"
              animate="animate"
              exit="exit"
              variants={pageVariants}
              transition={pageTransition}
              className="max-w-3xl mx-auto"
            >
              <div className="flex justify-start mb-10">
                <div className="flex gap-4">
                  <button 
                    onClick={() => setView('dashboard')} 
                    className="group flex items-center gap-4 px-6 py-3 bg-white/5 border border-white/10 rounded-full hover:bg-[#E8B86D]/10 hover:border-[#E8B86D]/30 transition-all"
                  >
                    <div className="w-8 h-8 rounded-full bg-[#E8B86D]/10 flex items-center justify-center group-hover:-translate-x-1 transition-transform">
                      <ChevronLeft className="w-5 h-5 text-[#E8B86D]" />
                    </div>
                    <span className="text-[10px] uppercase tracking-[0.2em] font-black text-[#5C5650] group-hover:text-[#F2EDE4] transition-colors">Return to Sanctuary</span>
                  </button>
                  {currentAssessment.role === 'creator' && (
                    <button 
                      onClick={() => setShowInviteModal(true)}
                      className="group flex items-center gap-4 px-6 py-3 bg-white/5 border border-white/10 rounded-full hover:bg-[#E8B86D]/10 hover:border-[#E8B86D]/30 transition-all"
                    >
                      <div className="w-8 h-8 rounded-full bg-[#E8B86D]/10 flex items-center justify-center">
                        <Share2 className="w-4 h-4 text-[#E8B86D]" />
                      </div>
                      <span className="text-[10px] uppercase tracking-[0.2em] font-black text-[#5C5650] group-hover:text-[#F2EDE4] transition-colors">Invite Partner</span>
                    </button>
                  )}
                </div>
              </div>

              <GlassCard className="p-12 mb-10 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-48 h-48 bg-[#E8B86D]/5 blur-[60px] -mr-24 -mt-24"></div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-12 gap-6">
                  <div>
                    <div className="flex items-center gap-4 mb-3">
                      <h2 className="text-4xl font-serif">{currentAssessment.name || 'Journey Details'}</h2>
                      {currentAssessment.participants?.find(p => p.id === user?.id)?.role === 'creator' && (
                        <button 
                          onClick={() => { setShowRenameModal(currentAssessment.id); setNewName(currentAssessment.name || ''); }}
                          className="p-2 text-[#5C5650] hover:text-[#E8B86D] transition-colors"
                        >
                          <Edit2 className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                    <p className="text-[#5C5650] text-lg">Unveiling the layers of your shared connection.</p>
                  </div>
                  <div className="text-right flex flex-col items-end gap-3">
                    {error && (
                      <div className="flex items-center gap-3 text-[#F08080] text-[10px] font-bold uppercase tracking-widest bg-[#F08080]/10 px-4 py-2 rounded-xl border border-[#F08080]/20 mb-2 group">
                        <AlertCircle className="w-3 h-3" /> 
                        <span>{error}</span>
                        <button 
                          onClick={() => setError(null)}
                          className="p-1 hover:bg-white/10 rounded-full transition-colors"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                    <span className="text-[10px] uppercase tracking-[0.2em] font-black bg-[#E8B86D]/10 text-[#E8B86D] px-5 py-2 rounded-full border border-[#E8B86D]/20">
                      {currentAssessment.type === 'trial' ? 'Discovery' : 'Complete'} Mode
                    </span>
                    {(() => {
                      const userParticipant = currentAssessment.participants?.find((p: any) => p.id === user?.id);
                      const isCreator = userParticipant?.role === 'creator';
                      return isCreator && (
                        <button 
                          onClick={() => setShowDeleteModal(currentAssessment.id)}
                          className="flex items-center gap-2 text-[10px] uppercase tracking-widest font-bold text-[#F08080] hover:text-[#F2EDE4] transition-colors"
                        >
                          <Trash2 className="w-3 h-3" /> Delete Journey
                        </button>
                      );
                    })()}
                  </div>
                </div>

                <div className="space-y-12">
                  <section>
                    <h3 className="text-[10px] uppercase tracking-[0.2em] font-black text-[#5C5650] mb-6 flex items-center gap-3">
                      <Users className="w-4 h-4" /> Participants
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      {currentAssessment.participants?.map((p: any) => (
                        <div key={p.id} className="flex items-center gap-5 p-6 bg-white/5 rounded-2xl border border-white/5">
                          <div className="w-12 h-12 bg-[#10101C] rounded-xl flex items-center justify-center font-bold text-[#E8B86D] border border-white/10 text-lg">
                            {p.name[0]}
                          </div>
                          <div>
                            <p className="font-bold text-[#F2EDE4]">{p.name} {p.id === user?.id && '(You)'}</p>
                            <p className="text-[10px] text-[#5C5650] uppercase tracking-widest mt-0.5">{p.role}</p>
                          </div>
                        </div>
                      ))}
                      {currentAssessment.participants?.length === 1 && (
                        <motion.button 
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => setShowInviteModal(true)}
                          className="p-6 border border-dashed border-white/20 rounded-2xl flex items-center justify-center text-[#E8B86D] text-xs font-bold uppercase tracking-widest hover:bg-[#E8B86D]/5 transition-all gap-3"
                        >
                          <Plus className="w-4 h-4" /> Invite Partner
                        </motion.button>
                      )}
                    </div>
                  </section>

                  <section>
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-[10px] uppercase tracking-[0.2em] font-black text-[#5C5650] flex items-center gap-3">
                        <ClipboardCheck className="w-4 h-4" /> Modules
                      </h3>
                      {currentAssessment.type === 'trial' && (
                        <button 
                          onClick={() => setShowPaymentModal(true)}
                          className="text-[10px] font-black text-[#E8B86D] hover:text-[#F2EDE4] transition-colors uppercase tracking-widest"
                        >
                          Upgrade to Full
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {(currentAssessment.type === 'full' 
                        ? ['Emotional', 'Conflict', 'Financial', 'Family', 'Life Vision', 'Parenting', 'Intimacy', 'Lifestyle'] 
                        : ['Emotional', 'Conflict', 'Financial']).map((pillar) => {
                        const pillarQs = questions.filter(q => q.pillar === pillar);
                        const answeredCount = pillarQs.filter(q => responses[q.id]).length;
                        const totalCount = pillarQs.length;
                        const progress = totalCount > 0 ? (answeredCount / totalCount) * 100 : 0;
                        const config = PILLARS_CONFIG[pillar] || { icon: '✨', color: '#E8B86D' };

                        return (
                          <motion.div 
                            key={pillar} 
                            whileHover={{ scale: 1.02, y: -2 }}
                            onClick={() => setCurrentPillar(pillar)}
                            className="p-6 bg-white/5 border border-white/5 rounded-2xl hover:border-[#E8B86D]/20 transition-all group cursor-pointer"
                          >
                            <div className="flex items-center justify-between mb-4">
                              <div className="flex items-center gap-4">
                                <span className="text-2xl">{config.icon}</span>
                                <span className="font-bold text-[#F2EDE4]">{pillar}</span>
                              </div>
                              <span className="text-[10px] text-[#5C5650] font-bold uppercase tracking-widest">{answeredCount}/{totalCount}</span>
                            </div>
                            <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                              <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: `${progress}%` }}
                                className="h-full bg-gradient-to-r from-[#E8B86D] to-[#C4893A] transition-all duration-1000"
                              ></motion.div>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </section>

                  <div className="flex flex-col sm:flex-row gap-5 pt-6">
                    {(() => {
                      const relevantPillars = currentAssessment.type === 'full' 
                        ? ['Emotional', 'Conflict', 'Financial', 'Family', 'Life Vision', 'Parenting', 'Intimacy', 'Lifestyle'] 
                        : ['Emotional', 'Conflict', 'Financial'];
                      const relevantQs = questions.filter(q => relevantPillars.includes(q.pillar));
                      const isComplete = allResponses.length >= relevantQs.length * 2 && allResponses.length > 0;
                      
                      return isComplete ? (
                        <motion.button 
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={generateReport}
                          className="flex-1 bg-gradient-to-br from-[#E8B86D] to-[#C4893A] text-[#08070F] py-5 rounded-2xl font-bold hover:opacity-90 transition-all shadow-xl shadow-[#E8B86D]/20 flex items-center justify-center gap-3 uppercase tracking-widest text-xs"
                        >
                          <BarChart3 className="w-5 h-5" /> Reveal Harmony Report
                        </motion.button>
                      ) : (
                        <div className="flex-1 p-8 bg-[#E8B86D]/5 rounded-3xl border border-[#E8B86D]/20 text-center">
                          <div className="w-12 h-12 bg-[#E8B86D]/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-[#E8B86D]/20">
                            <Sparkles className="w-6 h-6 text-[#E8B86D]" />
                          </div>
                          <h4 className="text-xl font-serif mb-2 text-[#F2EDE4]">Awaiting Alignment</h4>
                          <p className="text-sm text-[#5C5650] max-w-sm mx-auto italic">
                            {allResponses.length < relevantQs.length * 2 
                              ? `The full Compatibility DNA and Harmony Report will be unveiled once both of you complete all ${relevantPillars.length} modules.` 
                              : 'Your shared journey insights are ready to be explored.'}
                          </p>
                          {currentAssessment.participants?.length === 1 && currentAssessment.role === 'creator' && (
                            <motion.button
                              whileHover={{ scale: 1.05 }}
                              onClick={() => setShowInviteModal(true)}
                              className="mt-6 text-[10px] uppercase tracking-widest font-black text-[#E8B86D] hover:text-[#F2EDE4] transition-colors"
                            >
                              Invite Partner to Begin →
                            </motion.button>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </GlassCard>
            </motion.div>
          )}

          {currentPillar && (
            <motion.div 
              key="questionnaire"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#08070F]/90 backdrop-blur-xl"
            >
              <div className="max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <GlassCard className="p-12 relative">
                  <div className="flex items-center justify-between mb-12">
                    <div className="flex items-center gap-4">
                      <button 
                        onClick={() => setCurrentPillar(null)} 
                        className="group flex items-center gap-4 px-6 py-3 bg-white/5 border border-white/10 rounded-full hover:bg-[#E8B86D]/10 hover:border-[#E8B86D]/30 transition-all"
                      >
                        <div className="w-8 h-8 rounded-full bg-[#E8B86D]/10 flex items-center justify-center group-hover:-translate-x-1 transition-transform">
                          <ChevronLeft className="w-5 h-5 text-[#E8B86D]" />
                        </div>
                        <span className="text-[10px] uppercase tracking-[0.2em] font-black text-[#5C5650] group-hover:text-[#F2EDE4] transition-colors">Back to Journey</span>
                      </button>
                      <h2 className="text-4xl font-serif">{currentPillar}</h2>
                    </div>
                    {(() => {
                      const pillarQs = questions.filter(q => q.pillar === currentPillar);
                      const answeredCount = pillarQs.filter(q => responses[q.id]).length;
                      const totalCount = pillarQs.length;
                      return (
                        <div className="text-right">
                          <span className="text-[10px] uppercase tracking-[0.2em] font-black text-[#E8B86D]">{answeredCount} of {totalCount}</span>
                          <p className="text-[10px] uppercase tracking-[0.2em] font-black text-[#5C5650]">Completed</p>
                        </div>
                      );
                    })()}
                  </div>

                  {(() => {
                    const pillarQs = questions.filter(q => q.pillar === currentPillar);
                    const answeredCount = pillarQs.filter(q => responses[q.id]).length;
                    const totalCount = pillarQs.length;
                    const progress = totalCount > 0 ? (answeredCount / totalCount) * 100 : 0;
                    return (
                      <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden mb-12">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${progress}%` }}
                          className="h-full bg-gradient-to-r from-[#E8B86D] to-[#C4893A] transition-all duration-500"
                        />
                      </div>
                    );
                  })()}

                  <div className="space-y-16">
                    {questions.filter(q => q.pillar === currentPillar).length === 0 && (
                      <div className="py-20 text-center bg-white/5 rounded-3xl border border-dashed border-white/10">
                        <AlertCircle className="w-12 h-12 text-[#5C5650] mx-auto mb-4" />
                        <p className="text-[#5C5650] font-serif italic">No questions found for this module yet.</p>
                      </div>
                    )}
                    {questions.filter(q => q.pillar === currentPillar).map((q, idx) => {
                      const config = PILLARS_CONFIG[q.pillar] || { icon: '✨', color: '#E8B86D' };
                      return (
                        <div key={q.id} className="space-y-6">
                          <div className="flex items-start gap-6">
                            <span className="text-white/10 font-serif text-4xl">0{idx + 1}</span>
                            <div>
                              <div className="flex items-center gap-3 mb-3">
                                <span className="text-lg">{config.icon}</span>
                                <span className="text-[10px] uppercase tracking-[0.2em] font-black text-[#E8B86D] bg-[#E8B86D]/10 px-3 py-1 rounded-full border border-[#E8B86D]/20">
                                  {q.pillar}
                                </span>
                              </div>
                              <h4 className="text-2xl font-serif leading-tight text-[#F2EDE4]">{q.text}</h4>
                            </div>
                          </div>
                          <div className="grid grid-cols-1 gap-3 pl-16">
                            {q.options.map((opt) => (
                              <button
                                key={opt}
                                onClick={() => setResponses({ ...responses, [q.id]: opt })}
                                className={`p-5 rounded-2xl text-sm font-bold transition-all text-left border ${
                                  responses[q.id] === opt 
                                    ? 'bg-[#E8B86D]/10 border-[#E8B86D] text-[#E8B86D] shadow-lg shadow-[#E8B86D]/10' 
                                    : 'bg-white/5 border-white/5 text-[#5C5650] hover:border-white/20 hover:text-[#F2EDE4]'
                                }`}
                              >
                                {opt}
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-20 pt-10 border-t border-white/5 flex justify-end">
                    <motion.button 
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={submitResponses}
                      disabled={loading}
                      className="bg-gradient-to-br from-[#E8B86D] to-[#C4893A] text-[#08070F] px-12 py-5 rounded-2xl font-bold hover:opacity-90 transition-all shadow-xl shadow-[#E8B86D]/20 flex items-center gap-3 uppercase tracking-widest text-xs disabled:opacity-50"
                    >
                      {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Save Pillar Progress'}
                    </motion.button>
                  </div>
                </GlassCard>
              </div>
            </motion.div>
          )}

          {view === 'transactions' && (
            <motion.div 
              key="transactions"
              initial="initial"
              animate="animate"
              exit="exit"
              variants={pageVariants}
              transition={pageTransition}
              className="max-w-3xl mx-auto"
            >
              <div className="flex justify-start mb-10">
                <button 
                  onClick={() => setView('dashboard')} 
                  className="group flex items-center gap-4 px-6 py-3 bg-white/5 border border-white/10 rounded-full hover:bg-[#E8B86D]/10 hover:border-[#E8B86D]/30 transition-all"
                >
                  <div className="w-8 h-8 rounded-full bg-[#E8B86D]/10 flex items-center justify-center group-hover:-translate-x-1 transition-transform">
                    <ChevronLeft className="w-5 h-5 text-[#E8B86D]" />
                  </div>
                  <span className="text-[10px] uppercase tracking-[0.2em] font-black text-[#5C5650] group-hover:text-[#F2EDE4] transition-colors">Back to Sanctuary</span>
                </button>
              </div>

              <h2 className="text-4xl font-serif mb-12">Transaction History</h2>
              
              <div className="space-y-6">
                {transactions.map((tx) => (
                  <GlassCard key={tx.id} className="p-8 flex items-center justify-between">
                    <div className="flex items-center gap-6">
                      <div className="w-12 h-12 bg-[#E8B86D]/10 rounded-2xl flex items-center justify-center border border-[#E8B86D]/20">
                        <CreditCard className="w-6 h-6 text-[#E8B86D]" />
                      </div>
                      <div>
                        <h4 className="font-bold text-[#F2EDE4]">{tx.assessment_name}</h4>
                        <p className="text-[10px] text-[#5C5650] uppercase tracking-widest mt-1">
                          {new Date(tx.created_at).toLocaleDateString()} • {tx.status}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-serif text-[#E8B86D]">${tx.amount.toFixed(2)}</div>
                      <div className="text-[9px] text-[#5C5650] uppercase tracking-[0.2em] mt-1">{tx.currency}</div>
                    </div>
                  </GlassCard>
                ))}
                {transactions.length === 0 && (
                  <div className="py-24 text-center bg-white/5 rounded-[2.5rem] border border-dashed border-white/10">
                    <History className="w-12 h-12 text-white/10 mx-auto mb-6" />
                    <p className="text-[#5C5650] text-lg font-serif italic">No transactions found yet.</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {view === 'report' && report && (
            <motion.div 
              key="report"
              initial="initial"
              animate="animate"
              exit="exit"
              variants={pageVariants}
              transition={pageTransition}
              className="max-w-4xl mx-auto"
            >
              <div className="flex items-center justify-between mb-10">
                <button 
                  onClick={() => setView('assessment')} 
                  className="group flex items-center gap-4 px-6 py-3 bg-white/5 border border-white/10 rounded-full hover:bg-[#E8B86D]/10 hover:border-[#E8B86D]/30 transition-all"
                >
                  <div className="w-8 h-8 rounded-full bg-[#E8B86D]/10 flex items-center justify-center group-hover:-translate-x-1 transition-transform">
                    <ChevronLeft className="w-5 h-5 text-[#E8B86D]" />
                  </div>
                  <span className="text-[10px] uppercase tracking-[0.2em] font-black text-[#5C5650] group-hover:text-[#F2EDE4] transition-colors">Back to Journey</span>
                </button>
                <div className="flex items-center gap-3 text-[#E8B86D] font-bold uppercase tracking-widest text-xs">
                  <Heart className="w-5 h-5 fill-[#E8B86D]" /> Harmony Report
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                <div className="lg:col-span-7 space-y-10">
                  <AICoach summary={report.summary} />
                  
                  <GlassCard className="p-10">
                    <h3 className="text-sm font-serif italic text-[#F2EDE4] mb-8">Compatibility DNA</h3>
                    <div className="flex justify-center">
                      <RadarChart scores={report.scoring.pillarScores} />
                    </div>
                  </GlassCard>

                  <PillarComparisonChart scores={report.scoring.pillarScores} />

                  {report.pillars && <PillarInsights pillars={report.pillars} />}

                  <TalkCards prompts={report.discussionPrompts} />
                </div>

                <div className="lg:col-span-5">
                  <WeddingReadiness 
                    scores={report.scoring.pillarScores} 
                    nameA={user?.name || "You"} 
                    nameB={currentAssessment?.participants?.find(p => p.id !== user?.id)?.name || "Partner"} 
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {loading && (
        <div className="fixed inset-0 bg-[#08070F]/60 backdrop-blur-md z-[100] flex items-center justify-center">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-[#10101C] p-12 rounded-[3rem] shadow-2xl flex flex-col items-center gap-6 border border-white/5"
          >
            <div className="relative">
              <Loader2 className="w-12 h-12 text-[#E8B86D] animate-spin" />
              <div className="absolute inset-0 bg-[#E8B86D]/20 blur-xl rounded-full animate-pulse"></div>
            </div>
            <p className="text-[#F2EDE4] font-serif italic text-xl">Analyzing relationship dynamics...</p>
          </motion.div>
        </div>
      )}

      {/* Rename Modal */}
      <AnimatePresence>
        {showRenameModal && (
          <div className="fixed inset-0 bg-[#08070F]/80 backdrop-blur-xl z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-[#10101C] p-10 rounded-[3rem] shadow-2xl max-w-md w-full border border-white/5 relative overflow-hidden"
            >
              <h3 className="text-3xl font-serif mb-3">Rename Assessment</h3>
              <p className="text-[#5C5650] mb-8 text-sm">Provide a descriptive name for this relationship assessment.</p>
              
              <div className="space-y-6">
                <div>
                  <label className="block text-[10px] uppercase tracking-[0.2em] text-[#5C5650] font-bold mb-2 ml-1">Assessment Name</label>
                  <input 
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    required 
                    className="w-full px-5 py-4 rounded-2xl bg-white/5 border border-white/10 text-[#F2EDE4] focus:outline-none focus:ring-2 focus:ring-[#E8B86D]/30 transition-all placeholder:text-white/10"
                    placeholder="Relationship Milestone"
                  />
                </div>
                
                <div className="flex gap-4 pt-2">
                  <button 
                    onClick={() => renameAssessment(showRenameModal, newName)}
                    className="flex-1 bg-gradient-to-br from-[#E8B86D] to-[#C4893A] text-[#08070F] py-4 rounded-2xl font-bold hover:opacity-90 transition-all shadow-xl shadow-[#E8B86D]/20 uppercase tracking-widest text-xs"
                  >
                    Save Name
                  </button>
                  <button 
                    onClick={() => setShowRenameModal(null)}
                    className="flex-1 text-[#5C5650] py-4 font-bold hover:text-[#F2EDE4] transition-colors text-xs uppercase tracking-widest"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showInviteModal && (
          <div className="fixed inset-0 bg-[#08070F]/80 backdrop-blur-xl z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-[#10101C] p-10 rounded-[3rem] shadow-2xl max-w-md w-full border border-white/5 relative overflow-hidden"
            >
              <button 
                onClick={() => setShowInviteModal(false)}
                className="absolute top-8 right-8 p-2 text-[#5C5650] hover:text-[#F2EDE4] transition-colors z-10"
              >
                <X className="w-6 h-6" />
              </button>
              <div className="absolute top-0 right-0 w-32 h-32 bg-[#E8B86D]/10 blur-[60px] -mr-16 -mt-16"></div>
              <h3 className="text-3xl font-serif mb-3">Invite Your Partner</h3>
              <p className="text-[#5C5650] mb-8 text-sm">Provide this unique code to your partner to begin the joint assessment.</p>
              
              <div className="mb-8">
                <div className="p-10 bg-white/5 border border-[#E8B86D]/30 rounded-[2.5rem] text-center relative group">
                  <div className="absolute inset-0 bg-[#E8B86D]/5 blur-2xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  <div className="relative z-10">
                    <div className="text-[10px] uppercase tracking-[0.2em] text-[#E8B86D] font-bold mb-4">Invite Code</div>
                    <div className="text-6xl font-serif tracking-[0.15em] text-[#F2EDE4] mb-8">{currentAssessment.invite_code}</div>
                    <div className="flex flex-col gap-3">
                      <button 
                        onClick={() => {
                          navigator.clipboard.writeText(currentAssessment.invite_code);
                          setCopied(true);
                          setTimeout(() => setCopied(false), 2000);
                        }}
                        className="flex items-center gap-3 mx-auto px-6 py-3 bg-[#E8B86D]/10 rounded-xl border border-[#E8B86D]/20 text-[10px] uppercase tracking-widest font-bold text-[#E8B86D] hover:bg-[#E8B86D]/20 transition-all"
                      >
                        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />} 
                        {copied ? 'Copied' : 'Copy Code'}
                      </button>
                      {currentAssessment.role === 'creator' && (
                        <button 
                          onClick={regenerateInviteCode}
                          className="text-[10px] uppercase tracking-widest font-bold text-[#5C5650] hover:text-[#E8B86D] transition-colors"
                        >
                          Regenerate Code
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-4">
                <button 
                  onClick={() => setShowInviteModal(false)}
                  className="w-full text-[#5C5650] py-4 font-bold hover:text-[#F2EDE4] transition-colors text-xs uppercase tracking-widest"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Payment Modal */}
      <AnimatePresence>
        {showPaymentModal && (
          <div className="fixed inset-0 bg-[#08070F]/80 backdrop-blur-xl z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-[#10101C] p-12 rounded-[3.5rem] shadow-2xl max-w-md w-full border border-white/5 text-center relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-48 h-48 bg-[#E8B86D]/10 blur-[80px] -mr-24 -mt-24"></div>
              <div className="w-20 h-20 bg-[#E8B86D]/10 rounded-3xl flex items-center justify-center mx-auto mb-8 border border-[#E8B86D]/20">
                <Heart className="w-10 h-10 text-[#E8B86D] fill-[#E8B86D]" />
              </div>
              <h3 className="text-4xl font-serif mb-3">{inviteCode ? 'Upgrade Successful!' : 'Unlock Full Access'}</h3>
              <p className="text-[#5C5650] mb-10 text-lg font-serif italic">
                {inviteCode 
                  ? 'Your journey is now complete. Share this code with your partner.' 
                  : 'Get deeper insights with 5 additional modules and a comprehensive AI report.'}
              </p>
              
              {inviteCode ? (
                <div className="bg-white/5 p-8 rounded-3xl mb-10 border border-[#E8B86D]/30 text-center relative group">
                  <div className="text-[10px] uppercase tracking-[0.2em] text-[#E8B86D] font-bold mb-4">Your Partner Invite Code</div>
                  <div className="text-5xl font-serif tracking-[0.2em] text-[#F2EDE4] mb-6">{inviteCode}</div>
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(inviteCode);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    className="flex items-center gap-2 mx-auto text-[10px] uppercase tracking-widest font-bold text-[#5C5650] hover:text-[#E8B86D] transition-colors"
                  >
                    {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />} Copy Code
                  </button>
                </div>
              ) : (
                <div className="bg-white/5 p-8 rounded-3xl mb-10 border border-white/5 text-left relative group">
                  <div className="flex items-center justify-between mb-6">
                    <span className="text-[#E8B86D] text-xs font-black uppercase tracking-widest">Premium Plan</span>
                    <span className="text-3xl font-serif text-[#F2EDE4]">$29.00</span>
                  </div>
                  <ul className="space-y-4">
                    {['5 Additional Modules', 'Detailed AI Compatibility', 'Guided Discussion Prompts', 'Lifetime Access'].map((item) => (
                      <li key={item} className="flex items-center gap-4 text-sm text-[#F2EDE4]/80 font-medium">
                        <div className="w-1.5 h-1.5 bg-[#E8B86D] rounded-full shadow-lg shadow-[#E8B86D]/50"></div>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="space-y-4">
                {inviteCode ? (
                  <button 
                    onClick={() => { setShowPaymentModal(false); setInviteCode(''); fetchTransactions(user!.id); }}
                    className="w-full bg-gradient-to-br from-[#E8B86D] to-[#C4893A] text-[#08070F] py-5 rounded-2xl font-bold hover:opacity-90 transition-all shadow-xl shadow-[#E8B86D]/20 flex items-center justify-center gap-3 uppercase tracking-widest text-xs"
                  >
                    Return to Dashboard
                  </button>
                ) : (
                  <>
                    <button 
                      onClick={handleUpgrade}
                      className="w-full bg-gradient-to-br from-[#E8B86D] to-[#C4893A] text-[#08070F] py-5 rounded-2xl font-bold hover:opacity-90 transition-all shadow-xl shadow-[#E8B86D]/20 flex items-center justify-center gap-3 uppercase tracking-widest text-xs"
                    >
                      Pay & Unlock Now
                    </button>
                    <button 
                      onClick={() => setShowPaymentModal(false)}
                      className="w-full text-[#5C5650] py-4 font-bold hover:text-[#F2EDE4] transition-colors text-xs uppercase tracking-widest"
                    >
                      Maybe Later
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteModal && (
          <div className="fixed inset-0 bg-[#08070F]/80 backdrop-blur-xl z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-[#10101C] p-10 rounded-[3rem] shadow-2xl max-w-md w-full border border-white/5 relative overflow-hidden text-center"
            >
              <div className="w-20 h-20 bg-slate-500/10 rounded-3xl flex items-center justify-center mx-auto mb-8 border border-slate-500/20">
                <Trash2 className="w-10 h-10 text-slate-400" />
              </div>
              <h3 className="text-3xl font-serif mb-3 text-slate-200">Delete Assessment?</h3>
              <p className="text-[#5C5650] mb-10 text-sm">This action is permanent. All responses and generated reports for this journey will be lost forever.</p>
              
              <div className="flex gap-4">
                <button 
                  onClick={() => deleteAssessment(showDeleteModal)}
                  className="flex-1 bg-slate-700 text-white py-4 rounded-2xl font-bold hover:bg-slate-600 transition-all uppercase tracking-widest text-xs"
                >
                  Delete Permanently
                </button>
                <button 
                  onClick={() => setShowDeleteModal(null)}
                  className="flex-1 bg-white/5 text-[#F2EDE4] py-4 rounded-2xl font-bold hover:bg-white/10 transition-all uppercase tracking-widest text-xs border border-white/10"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Join with Code Modal */}
      <AnimatePresence>
        {showJoinCodeModal && (
          <div className="fixed inset-0 bg-[#08070F]/80 backdrop-blur-xl z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-[#10101C] p-10 rounded-[3rem] shadow-2xl max-w-md w-full border border-white/5 relative overflow-hidden"
            >
              <button 
                onClick={() => setShowJoinCodeModal(false)}
                className="absolute top-8 right-8 p-2 text-[#5C5650] hover:text-[#F2EDE4] transition-colors z-10"
              >
                <X className="w-6 h-6" />
              </button>
              <div className="absolute top-0 right-0 w-32 h-32 bg-[#E8B86D]/10 blur-[60px] -mr-16 -mt-16"></div>
              <h3 className="text-3xl font-serif mb-3">Enter Invite Code</h3>
              <p className="text-[#5C5650] mb-8 text-sm">This journey requires a premium invite code from your partner. Spaces are ignored.</p>
              
              <div className="space-y-6">
                <div>
                  <label className="block text-[10px] uppercase tracking-[0.2em] text-[#5C5650] font-bold mb-2 ml-1">Invite Code</label>
                  <input 
                    value={joinCodeInput}
                    onChange={(e) => {
                      setError(null);
                      const val = e.target.value.replace(/[^A-Z0-9]/gi, '').toUpperCase();
                      setJoinCodeInput(val);
                    }}
                    required 
                    className="w-full px-5 py-4 rounded-2xl bg-white/5 border border-white/10 text-[#F2EDE4] focus:outline-none focus:ring-2 focus:ring-[#E8B86D]/30 transition-all placeholder:text-white/10 text-center text-2xl tracking-[0.5em] font-serif uppercase"
                    placeholder="ABCDEF"
                    maxLength={15}
                  />
                </div>
                
                {error && (
                  <div className="flex items-center justify-between gap-3 text-[#F08080] text-[10px] font-bold uppercase tracking-widest bg-[#F08080]/10 px-4 py-2 rounded-xl border border-[#F08080]/20">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-3 h-3" /> 
                      <span>{error}</span>
                    </div>
                    <button 
                      onClick={() => setError(null)}
                      className="p-1 hover:bg-white/10 rounded-full transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}

                <button 
                  onClick={handleJoinWithCode}
                  className="w-full bg-gradient-to-br from-[#E8B86D] to-[#C4893A] text-[#08070F] py-5 rounded-2xl font-bold hover:opacity-90 transition-all shadow-xl shadow-[#E8B86D]/20 flex items-center justify-center gap-3 uppercase tracking-widest text-xs"
                >
                  Join Journey
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
