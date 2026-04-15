import { useNavigate, Link } from "react-router-dom";
import { useState, useEffect } from "react";
import logo from "../assets/logo.png";

const NAV = ({ active = "/" }: { active?: string }) => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const links = [
    { to: "/", label: "Home" },
    { to: "/about", label: "Features" },
    { to: "/contact", label: "Contact" },
  ];
  return (
    <nav className="bg-blue-950 text-white sticky top-0 z-50 border-b border-blue-800/50 shadow-lg">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          <Link to="/" className="flex items-center space-x-3">
            <img src={logo} alt="MySchoolHub" className="h-10 w-auto" />
            <div>
              <p className="text-lg font-extrabold tracking-tight leading-none">MySchoolHub</p>
              <p className="text-[10px] text-blue-300 leading-none mt-0.5">by <a href="https://tishanyq.co.zw" target="_blank" rel="noopener noreferrer" className="hover:text-yellow-400 transition">Tishanyq Digital</a></p>
            </div>
          </Link>
          {/* Desktop links */}
          <div className="hidden md:flex items-center space-x-8">
            {links.map((l) => (
              <Link key={l.to} to={l.to} className={`text-sm transition ${active === l.to ? "text-yellow-400 font-semibold" : "text-blue-200 hover:text-yellow-400"}`}>{l.label}</Link>
            ))}
            <button onClick={() => navigate('/login')} className="bg-yellow-400 text-blue-950 px-5 py-2 rounded-lg text-sm font-bold hover:bg-yellow-300 transition shadow-md">
              Access Portal →
            </button>
          </div>
          {/* Mobile hamburger */}
          <button onClick={() => setOpen(!open)} className="md:hidden p-2 rounded-lg hover:bg-white/10 transition" aria-label="Menu">
            {open
              ? <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              : <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
            }
          </button>
        </div>
        {/* Mobile menu */}
        {open && (
          <div className="md:hidden pt-3 pb-4 border-t border-blue-800/50 mt-3 space-y-1">
            {links.map((l) => (
              <Link key={l.to} to={l.to} onClick={() => setOpen(false)} className={`block px-3 py-2.5 rounded-lg text-sm font-medium transition ${active === l.to ? "bg-yellow-400/15 text-yellow-400" : "text-blue-200 hover:bg-white/5"}`}>{l.label}</Link>
            ))}
            <button onClick={() => { setOpen(false); navigate('/login'); }} className="w-full mt-2 py-2.5 bg-yellow-400 text-blue-950 rounded-lg text-sm font-bold hover:bg-yellow-300 transition">
              Access Portal →
            </button>
          </div>
        )}
      </div>
    </nav>
  );
};

const Index = () => {
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "MySchoolHub — School Management System Zimbabwe | ZIMSEC & Cambridge";
  }, []);

  return (
    <div className="min-h-screen bg-white font-sans">
      <NAV active="/" />

      {/* ── HERO ─────────────────────────────────────────────── */}
      <section className="relative bg-gradient-to-br from-blue-950 via-blue-900 to-indigo-900 pt-20 pb-28 overflow-hidden">
        {/* background rings */}
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full border border-white/5"></div>
        <div className="absolute -top-12 -right-12 w-72 h-72 rounded-full border border-white/5"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 rounded-full bg-blue-800/20 blur-3xl"></div>

        <div className="container px-4 mx-auto max-w-6xl relative z-10">
          <div className="grid gap-12 lg:grid-cols-2 items-center">
            <div className="space-y-7 text-white">
              <div className="inline-flex items-center space-x-2 px-3 py-1.5 bg-yellow-400/15 border border-yellow-400/30 rounded-full">
                <span className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></span>
                <span className="text-yellow-300 text-xs font-semibold tracking-wide">BUILT FOR ZIMBABWEAN SCHOOLS</span>
              </div>

              <h1 className="text-4xl md:text-5xl lg:text-[3.4rem] font-extrabold leading-tight">
                Run Your Whole School
                <span className="text-yellow-400"> From One </span>
                Dashboard
              </h1>

              <p className="text-blue-100 text-lg leading-relaxed max-w-xl">
                Ditch the paper registers, lost fee receipts, and unanswered parent calls.
                MySchoolHub gives administrators, teachers, students, and parents a single platform
                to manage everything — academics, fees, attendance, and communication.
              </p>

              <div className="flex flex-col sm:flex-row gap-4">
                <button
                  onClick={() => navigate('/login')}
                  className="px-8 py-3.5 font-bold text-blue-950 bg-yellow-400 rounded-xl hover:bg-yellow-300 transition shadow-lg text-base flex items-center justify-center gap-2"
                >
                  Access Your Portal
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
                <button
                  onClick={() => navigate('/contact')}
                  className="px-8 py-3.5 font-semibold text-white border-2 border-white/30 rounded-xl hover:bg-white/10 transition text-base"
                >
                  Book a Free Demo
                </button>
              </div>

              {/* Stats bar */}
              <div className="flex flex-wrap items-center gap-8 pt-2">
                <div>
                  <p className="text-3xl font-extrabold text-yellow-400">6</p>
                  <p className="text-blue-300 text-xs mt-0.5">User Roles</p>
                </div>
                <div className="w-px h-10 bg-white/15"></div>
                <div>
                  <p className="text-3xl font-extrabold text-yellow-400">30+</p>
                  <p className="text-blue-300 text-xs mt-0.5">Features</p>
                </div>
                <div className="w-px h-10 bg-white/15"></div>
                <div>
                  <p className="text-3xl font-extrabold text-yellow-400">100%</p>
                  <p className="text-blue-300 text-xs mt-0.5">Cloud-Based</p>
                </div>
                <div className="w-px h-10 bg-white/15"></div>
                <div>
                  <p className="text-3xl font-extrabold text-yellow-400">0</p>
                  <p className="text-blue-300 text-xs mt-0.5">Hardware Needed</p>
                </div>
              </div>
            </div>

            {/* Hero card mock */}
            <div className="hidden lg:block">
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-1 border border-white/15 shadow-2xl">
                <div className="bg-blue-900/60 rounded-xl p-6 space-y-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-white font-bold text-sm">Admin Dashboard</span>
                    <span className="text-xs px-2 py-0.5 bg-green-500/20 text-green-400 rounded-full border border-green-500/30">● Live</span>
                  </div>
                  {[
                    { icon: "👥", label: "Total Students", val: "843", color: "text-blue-300" },
                    { icon: "📚", label: "Active Teachers", val: "56", color: "text-green-300" },
                    { icon: "💰", label: "Fees Collected (Term)", val: "$12,450", color: "text-yellow-300" },
                    { icon: "📊", label: "Avg. Pass Rate", val: "79%", color: "text-purple-300" },
                    { icon: "📱", label: "WhatsApp Messages Sent", val: "1,204", color: "text-emerald-300" },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center justify-between bg-white/5 rounded-lg px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className="text-lg">{item.icon}</span>
                        <span className="text-blue-200 text-sm">{item.label}</span>
                      </div>
                      <span className={`font-bold ${item.color}`}>{item.val}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Wave divider */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 60" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M0 60L60 50C120 40 240 20 360 13.3C480 6.7 600 13.3 720 23.3C840 33.3 960 46.7 1080 50C1200 53.3 1320 46.7 1380 43.3L1440 40V60H1380C1320 60 1200 60 1080 60C960 60 840 60 720 60C600 60 480 60 360 60C240 60 120 60 60 60H0Z" fill="white"/>
          </svg>
        </div>
      </section>

      {/* ── PROBLEM STATEMENT ──────────────────────────────────── */}
      <section className="py-16 bg-white">
        <div className="container px-4 mx-auto max-w-5xl text-center">
          <p className="text-blue-600 font-semibold uppercase tracking-widest text-xs mb-3">The Problem</p>
          <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-4">
            Most Schools Still Rely on Paper, WhatsApp Groups, and Guesswork
          </h2>
          <p className="text-gray-500 text-lg max-w-3xl mx-auto mb-12">
            Registers get lost. Fee records are in a drawer somewhere. Parents don't know their child's marks until
            end-of-term reports. Teachers waste hours on admin instead of teaching. Sound familiar?
          </p>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { emoji: "😤", title: "Wasted Admin Hours", desc: "Administrators spend 30–40% of their week on paperwork that should take minutes." },
              { emoji: "💸", title: "Missed Fee Collections", desc: "No system to track who has paid, who hasn't, and what is owed — revenue leaks every term." },
              { emoji: "📵", title: "No Parent Visibility", desc: "Parents only find out about poor grades at end of term, when it's too late to intervene." },
            ].map((item) => (
              <div key={item.title} className="bg-red-50 border border-red-100 rounded-2xl p-6 text-left">
                <span className="text-3xl mb-3 block">{item.emoji}</span>
                <h3 className="font-bold text-gray-900 mb-2">{item.title}</h3>
                <p className="text-gray-600 text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SOLUTION / HOW IT WORKS ──────────────────────────── */}
      <section className="py-16 bg-gray-50 border-t border-gray-100">
        <div className="container px-4 mx-auto max-w-5xl">
          <div className="text-center mb-12">
            <p className="text-blue-600 font-semibold uppercase tracking-widest text-xs mb-3">The Solution</p>
            <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900">Get Your School Online in 3 Steps</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: "01",
                title: "Set Up Your School",
                desc: (<><a href="https://tishanyq.co.zw" target="_blank" rel="noopener noreferrer" className="text-blue-600 font-semibold hover:underline">Tishanyq Digital</a> onboards your school — creating classes, subjects, and importing student data. Zero IT expertise needed.</>),
                color: "bg-blue-600",
              },
              {
                step: "02",
                title: "Add Your Staff & Students",
                desc: "Teachers log in and start marking attendance, entering results, and uploading homework. Parents self-register and link to their children.",
                color: "bg-yellow-500",
              },
              {
                step: "03",
                title: "Run Your School Digitally",
                desc: "Fees tracked, reports generated, parents messaged via WhatsApp, and performance trends visible — all in real time.",
                color: "bg-green-600",
              },
            ].map((item) => (
              <div key={item.step} className="relative bg-white rounded-2xl p-7 shadow-sm border border-gray-100 hover:shadow-md transition">
                <div className={`${item.color} text-white text-sm font-black w-10 h-10 rounded-xl flex items-center justify-center mb-5`}>
                  {item.step}
                </div>
                <h3 className="font-bold text-gray-900 text-lg mb-2">{item.title}</h3>
                <p className="text-gray-600 text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CORE FEATURES GRID ────────────────────────────────── */}
      <section className="py-20 bg-white">
        <div className="container px-4 mx-auto max-w-6xl">
          <div className="text-center mb-14">
            <p className="text-blue-600 font-semibold uppercase tracking-widest text-xs mb-3">What's Included</p>
            <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-4">
              Everything a Modern School Needs
            </h2>
            <p className="text-gray-500 max-w-2xl mx-auto">
              One subscription. One platform. Every tool your school needs, built specifically for the Zimbabwean education system.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                ),
                color: "bg-blue-100 text-blue-600",
                title: "Academic Results & Grades",
                desc: "Enter marks by subject, term, and exam type. Generate report cards instantly. Track ZIMSEC and Cambridge results side-by-side.",
                badge: "ZIMSEC + Cambridge",
              },
              {
                icon: (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                ),
                color: "bg-green-100 text-green-600",
                title: "Digital Attendance Register",
                desc: "Teachers take attendance in seconds — Present, Absent, Late, or Excused. Daily reports available to admins instantly.",
                badge: null,
              },
              {
                icon: (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                ),
                color: "bg-yellow-100 text-yellow-600",
                title: "Fee & Invoice Management",
                desc: "Generate invoices, track payments, identify outstanding balances, and accept payments online via PayNow Zimbabwe.",
                badge: "PayNow Integrated",
              },
              {
                icon: (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                ),
                color: "bg-emerald-100 text-emerald-600",
                title: "WhatsApp Integration",
                desc: "Message parents directly on WhatsApp — the platform they already use. Automated weekly reports, fee reminders, and announcements.",
                badge: "🔥 Most Popular Feature",
              },
              {
                icon: (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                ),
                color: "bg-purple-100 text-purple-600",
                title: "AI Performance Predictions",
                desc: "Machine-learning models flag students at risk of failing before exams happen — giving teachers time to intervene.",
                badge: "AI-Powered",
              },
              {
                icon: (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                ),
                color: "bg-indigo-100 text-indigo-600",
                title: "Timetables & Homework",
                desc: "Auto-generate class timetables. Teachers upload homework with PDF/Word attachments. Students see due dates clearly.",
                badge: null,
              },
            ].map((feat) => (
              <div key={feat.title} className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm hover:shadow-md transition hover:-translate-y-0.5 duration-200">
                <div className={`w-12 h-12 ${feat.color} rounded-xl flex items-center justify-center mb-4`}>
                  {feat.icon}
                </div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="font-bold text-gray-900 text-base">{feat.title}</h3>
                </div>
                {feat.badge && (
                  <span className="inline-block text-[10px] font-bold px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-full mb-2">
                    {feat.badge}
                  </span>
                )}
                <p className="text-gray-500 text-sm leading-relaxed">{feat.desc}</p>
              </div>
            ))}
          </div>
          <div className="text-center mt-10">
            <Link to="/about" className="inline-flex items-center gap-2 text-blue-600 font-semibold hover:text-blue-800 transition">
              See all features →
            </Link>
          </div>
        </div>
      </section>

      {/* ── WHATSAPP SPOTLIGHT ─────────────────────────────────── */}
      <section className="py-20 bg-gradient-to-br from-emerald-600 to-green-700 text-white overflow-hidden relative">
        <div className="absolute right-0 top-0 w-80 h-80 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/4"></div>
        <div className="container px-4 mx-auto max-w-6xl relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 bg-white/15 border border-white/25 px-3 py-1.5 rounded-full text-sm font-semibold">
                📱 WhatsApp Business Integration
              </div>
              <h2 className="text-3xl md:text-4xl font-extrabold leading-tight">
                Reach Parents Where They Actually Are — WhatsApp
              </h2>
              <p className="text-emerald-100 text-lg leading-relaxed">
                Parents don't check school portals. But they do check WhatsApp — every single day.
                MySchoolHub connects directly to WhatsApp Business API so you can send automated
                weekly progress reports, fee reminders, and urgent announcements instantly.
              </p>
              <ul className="space-y-3">
                {[
                  "Automated weekly academic progress summaries",
                  "Fee payment reminders with outstanding balances",
                  "Instant school-wide announcements",
                  "Two-way parent-teacher messaging",
                  "Zero extra apps — parents use their existing WhatsApp",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <span className="w-5 h-5 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </span>
                    <span className="text-emerald-50 text-sm">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            {/* WhatsApp mock */}
            <div className="flex justify-center">
              <div className="bg-[#0a1628] rounded-3xl p-4 w-72 shadow-2xl border border-white/10">
                <div className="bg-emerald-600 rounded-2xl px-4 py-3 mb-3 flex items-center gap-3">
                  <div className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center text-sm font-bold">🏫</div>
                  <div>
                    <p className="text-white text-xs font-bold">Harare High School</p>
                    <p className="text-emerald-200 text-[10px]">Official School Account</p>
                  </div>
                </div>
                {[
                  { msg: "Dear Mrs Moyo, Tendai's Term 2 progress report: Maths 82%, English 74%, Science 68%. Overall average: 75%. View full report on the portal.", time: "08:30", sent: false },
                  { msg: "Also, please note that Term 3 fees of $350 are due by 31 July. Pay via PayNow to avoid late charges.", time: "08:30", sent: false },
                  { msg: "Thank you! Will check the portal now.", time: "08:45", sent: true },
                ].map((bubble, i) => (
                  <div key={i} className={`flex ${bubble.sent ? "justify-end" : "justify-start"} mb-2`}>
                    <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-[11px] leading-relaxed ${bubble.sent ? "bg-emerald-600 text-white" : "bg-white/10 text-gray-200"}`}>
                      {bubble.msg}
                      <p className={`text-[9px] mt-1 ${bubble.sent ? "text-emerald-200" : "text-gray-400"} text-right`}>{bubble.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── WHO IS IT FOR ─────────────────────────────────────── */}
      <section className="py-20 bg-white">
        <div className="container px-4 mx-auto max-w-6xl">
          <div className="text-center mb-14">
            <p className="text-blue-600 font-semibold uppercase tracking-widest text-xs mb-3">6 Portals in One System</p>
            <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900">A Dedicated Experience for Every User</h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                role: "School Administrator",
                color: "from-blue-500 to-blue-700",
                icon: "🏫",
                points: ["Full student & teacher management", "Fee collection & financial reports", "Class & subject configuration", "Parent-child link approvals", "Timetable generation"],
              },
              {
                role: "Teacher",
                color: "from-green-500 to-green-700",
                icon: "👩‍🏫",
                points: ["Enter marks & exam results", "Digital attendance register", "Upload homework with files", "Message parents directly", "View class performance analytics"],
              },
              {
                role: "Student",
                color: "from-yellow-500 to-amber-600",
                icon: "🎒",
                points: ["View marks across all subjects", "Download homework attachments", "Check class timetable", "See upcoming events & exams", "Read school announcements"],
              },
              {
                role: "Parent",
                color: "from-purple-500 to-purple-700",
                icon: "👨‍👩‍👧",
                points: ["Monitor children's progress in real time", "Track fee balances & payments", "Chat with teachers directly", "Receive WhatsApp updates", "Manage multiple children in one account"],
              },
              {
                role: "HR Manager",
                color: "from-rose-500 to-rose-700",
                icon: "📋",
                points: ["Staff records & departments", "Staff attendance tracking", "Leave management", "Payroll summaries", "Staff performance overview"],
              },
              {
                role: "Accountant",
                color: "from-teal-500 to-teal-700",
                icon: "💼",
                points: ["Full financial reporting suite", "Invoice & payment management", "Outstanding balance tracking", "PayNow transaction records", "Term & annual revenue summaries"],
              },
            ].map((role) => (
              <div key={role.role} className="rounded-2xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-md transition">
                <div className={`bg-gradient-to-r ${role.color} px-6 py-4 flex items-center gap-3`}>
                  <span className="text-2xl">{role.icon}</span>
                  <h3 className="text-white font-bold text-base">{role.role}</h3>
                </div>
                <div className="bg-white p-5">
                  <ul className="space-y-2">
                    {role.points.map((pt) => (
                      <li key={pt} className="flex items-start gap-2 text-sm text-gray-600">
                        <svg className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        {pt}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── AI PREDICTIONS SPOTLIGHT ──────────────────────────── */}
      <section className="py-20 bg-gradient-to-br from-slate-900 to-blue-950 text-white">
        <div className="container px-4 mx-auto max-w-6xl">
          <div className="grid lg:grid-cols-2 gap-14 items-center">
            {/* Prediction card mock */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-9 h-9 bg-purple-600 rounded-xl flex items-center justify-center text-lg">🤖</div>
                <div>
                  <p className="text-white font-bold text-sm">AI Risk Alerts</p>
                  <p className="text-gray-400 text-xs">Early intervention system</p>
                </div>
              </div>
              {[
                { name: "Chiedza Mlambo", subject: "Mathematics", risk: "High Risk", color: "bg-red-500/20 text-red-400 border-red-500/30", trend: "↓ 22% this term" },
                { name: "Farai Ncube", subject: "English", risk: "At Risk", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30", trend: "↓ 12% this term" },
                { name: "Blessing Dube", subject: "Science", risk: "Watch", color: "bg-orange-500/20 text-orange-400 border-orange-500/30", trend: "↓ 8% this term" },
              ].map((student) => (
                <div key={student.name} className="bg-white/5 rounded-xl px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-white text-sm font-semibold">{student.name}</p>
                    <p className="text-gray-400 text-xs">{student.subject} · {student.trend}</p>
                  </div>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${student.color}`}>{student.risk}</span>
                </div>
              ))}
              <p className="text-gray-500 text-xs text-center pt-2">Powered by machine learning trained on term-by-term results</p>
            </div>
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 bg-purple-600/20 border border-purple-500/30 px-3 py-1.5 rounded-full text-sm font-semibold text-purple-300">
                🤖 AI-Powered Academic Intelligence
              </div>
              <h2 className="text-3xl md:text-4xl font-extrabold leading-tight">
                Know Which Students Need Help — Before They Fail
              </h2>
              <p className="text-gray-300 text-lg leading-relaxed">
                MySchoolHub's built-in machine learning engine analyses each student's result history
                and flags those at risk of failing before end-of-term. Teachers get clear alerts so they
                can intervene early — not after it's too late.
              </p>
              <ul className="space-y-3">
                {[
                  "Predicts at-risk students using historical result trends",
                  "Colour-coded risk levels: High, Medium, Watch",
                  "Automatically notifies the teacher and administrator",
                  "Tracks intervention effectiveness over time",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3 text-gray-300 text-sm">
                    <span className="w-5 h-5 bg-purple-600/30 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <svg className="w-3 h-3 text-purple-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── SECURITY & TRUST ──────────────────────────────────── */}
      <section className="py-20 bg-white">
        <div className="container px-4 mx-auto max-w-6xl">
          <div className="grid lg:grid-cols-2 gap-14 items-center">
            <div>
              <p className="text-blue-600 font-semibold uppercase tracking-widest text-xs mb-3">Security & Trust</p>
              <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-5">
                Your Students' Data Is Safe With Us
              </h2>
              <p className="text-gray-500 text-base leading-relaxed mb-8">
                Schools trust us with their most sensitive data — student records, financial information,
                and family details. We take that responsibility seriously.
              </p>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { icon: "🔒", title: "Role-Based Access", desc: "Every user only sees what they're authorised to see. Nothing more." },
                  { icon: "✅", title: "Admin-Approved Parent Links", desc: "Parents must be verified by admins before accessing any student data." },
                  { icon: "🛡️", title: "JWT Authentication", desc: "Secure, expiring tokens — no session hijacking risks." },
                  { icon: "🏫", title: "School Isolation", desc: "Data from one school is completely invisible to all other schools." },
                  { icon: "🕐", title: "Always On — 24/7", desc: "The system never sleeps. Access your school data any time of day or night, every day of the year." },
                  { icon: "⚡", title: "99.999% Uptime", desc: "Five-nines availability. MySchoolHub is engineered to stay online so your school never misses a beat." },
                ].map((item) => (
                  <div key={item.title} className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                    <span className="text-2xl mb-2 block">{item.icon}</span>
                    <p className="font-bold text-gray-900 text-sm mb-1">{item.title}</p>
                    <p className="text-gray-500 text-xs leading-relaxed">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-gradient-to-br from-blue-900 to-indigo-900 rounded-2xl p-8 text-white">
              <h3 className="text-xl font-extrabold mb-6">Perfect For</h3>
              <div className="space-y-3">
                {[
                  "Primary Schools (ECD to Grade 7)",
                  "Secondary Schools (Form 1 – 4)",
                  "High Schools (Form 5 – 6 / A-Level)",
                  "Private & Government Schools",
                  "ZIMSEC & Cambridge Institutions",
                  "Day & Boarding Schools",
                ].map((item) => (
                  <div key={item} className="flex items-center gap-3 bg-white/10 rounded-lg px-4 py-3">
                    <span className="w-5 h-5 bg-yellow-400 rounded-full flex items-center justify-center flex-shrink-0">
                      <svg className="w-3 h-3 text-blue-900" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </span>
                    <span className="text-sm">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ─────────────────────────────────────────── */}
      <section className="py-24 bg-gradient-to-br from-blue-950 via-blue-900 to-indigo-900 text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wNCkiLz48L3N2Zz4=')] opacity-60"></div>
        <div className="container px-4 mx-auto max-w-3xl text-center relative z-10">
          <p className="text-yellow-400 font-semibold uppercase tracking-widest text-xs mb-4">Get Started Today</p>
          <h2 className="text-4xl md:text-5xl font-extrabold leading-tight mb-6">
            Transform How Your School Operates
          </h2>
          <p className="text-blue-200 text-lg mb-10 leading-relaxed">
            Join schools across Zimbabwe already using MySchoolHub to save time, collect fees faster,
            keep parents engaged, and drive better academic results.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => navigate('/login')}
              className="px-10 py-4 font-bold text-blue-950 bg-yellow-400 rounded-xl hover:bg-yellow-300 transition shadow-xl text-lg"
            >
              Access Your Portal
            </button>
            <button
              onClick={() => navigate('/contact')}
              className="px-10 py-4 font-semibold text-white border-2 border-white/30 rounded-xl hover:bg-white/10 transition text-lg"
            >
              Book a Free Demo
            </button>
          </div>
          <p className="text-blue-400 text-sm mt-8">
            Developed in Zimbabwe by{" "}
            <a href="https://tishanyq.co.zw" target="_blank" rel="noopener noreferrer" className="text-yellow-400 hover:underline font-semibold">
              Tishanyq Digital
            </a>{" "}
            · Harare, Zimbabwe
          </p>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────── */}
      <footer className="bg-gray-950 text-white py-12">
        <div className="container px-4 mx-auto max-w-6xl">
          <div className="grid md:grid-cols-4 gap-8 mb-10">
            <div className="md:col-span-2">
              <div className="flex items-center gap-3 mb-4">
                <img src={logo} alt="MySchoolHub" className="h-9 w-auto" />
                <div>
                  <p className="font-extrabold text-lg">MySchoolHub</p>
                  <p className="text-gray-500 text-xs">by <a href="https://tishanyq.co.zw" target="_blank" rel="noopener noreferrer" className="hover:text-gray-300 transition">Tishanyq Digital</a></p>
                </div>
              </div>
              <p className="text-gray-400 text-sm leading-relaxed max-w-sm">
                A complete, cloud-based school management system built for Zimbabwean schools.
                ZIMSEC & Cambridge support. WhatsApp integrated. PayNow ready.
              </p>
            </div>
            <div>
              <h4 className="font-bold text-sm mb-4 text-gray-300">Platform</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><Link to="/" className="hover:text-white transition">Home</Link></li>
                <li><Link to="/about" className="hover:text-white transition">Features</Link></li>
                <li><Link to="/contact" className="hover:text-white transition">Contact Us</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-sm mb-4 text-gray-300">Portals</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><Link to="/login" className="hover:text-white transition">Student / Teacher / Parent</Link></li>
                <li><Link to="/admin/login" className="hover:text-white transition">Administrator Login</Link></li>
                <li><Link to="/register/parent" className="hover:text-white transition">Parent Registration</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-8 flex flex-col md:flex-row justify-between items-center text-sm text-gray-500">
            <p>&copy; {new Date().getFullYear()} MySchoolHub · <a href="https://tishanyq.co.zw" target="_blank" rel="noopener noreferrer" className="hover:text-white transition">Tishanyq Digital</a>. All rights reserved.</p>
            <p className="mt-2 md:mt-0">
              7 Martin Drive, Msasa, Harare ·{" "}
              <a href="tel:+263781603382" className="hover:text-white transition">+263 78 160 3382</a>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
