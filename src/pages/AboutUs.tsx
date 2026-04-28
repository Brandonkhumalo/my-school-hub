import { Link, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import logo from "../assets/logo.png";

const Navbar = ({ active }: { active: string }) => {
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
          <div className="hidden md:flex items-center space-x-8">
            {links.map((l) => (
              <Link key={l.to} to={l.to} className={`text-sm transition ${active === l.to ? "text-yellow-400 font-semibold" : "text-blue-200 hover:text-yellow-400"}`}>{l.label}</Link>
            ))}
            <button onClick={() => navigate('/login')} className="bg-yellow-400 text-blue-950 px-5 py-2 rounded-lg text-sm font-bold hover:bg-yellow-300 transition shadow-md">
              Access Portal →
            </button>
          </div>
          <button onClick={() => setOpen(!open)} className="md:hidden p-2 rounded-lg hover:bg-white/10 transition" aria-label="Menu">
            {open
              ? <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              : <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
            }
          </button>
        </div>
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

const Check = () => (
  <svg className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
  </svg>
);

const AboutUs = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white font-sans">
      <Helmet>
        <title>Features — MySchoolHub Zimbabwe | School Management System</title>
        <meta name="description" content="Explore all features of MySchoolHub — Zimbabwe's school management system. Student results, attendance, fee management, timetables, WhatsApp alerts, and HR tools for ZIMSEC and Cambridge schools." />
        <link rel="canonical" href="https://myschoolhub.co.zw/about" />
        <meta property="og:url" content="https://myschoolhub.co.zw/about" />
        <meta property="og:title" content="Features — MySchoolHub Zimbabwe | School Management System" />
        <meta property="og:description" content="Explore all features of MySchoolHub — Zimbabwe's school management system for ZIMSEC and Cambridge schools." />
      </Helmet>
      <Navbar active="/about" />

      {/* ── HERO ──────────────────────────────────────────────── */}
      <section className="bg-gradient-to-br from-blue-950 via-blue-900 to-indigo-900 py-20 relative overflow-hidden">
        <div className="absolute inset-0 opacity-5">
          <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="dots" x="0" y="0" width="30" height="30" patternUnits="userSpaceOnUse">
                <circle cx="2" cy="2" r="1.5" fill="white" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#dots)" />
          </svg>
        </div>
        <div className="container px-4 mx-auto max-w-6xl text-center text-white relative z-10">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 text-sm font-semibold text-yellow-300 bg-yellow-400/15 rounded-full border border-yellow-400/30 mb-5">
            🔍 Full Platform Features
          </span>
          <h1 className="text-4xl md:text-5xl font-extrabold mb-5">
            Every Feature Your School Needs — In Detail
          </h1>
          <p className="text-xl text-blue-200 max-w-3xl mx-auto">
            From the first bell to the final report card, MySchoolHub handles every part of running a school.
            Here's exactly what each user gets.
          </p>
        </div>
      </section>

      {/* ── ADMIN FEATURES ────────────────────────────────────── */}
      <section className="py-20 bg-white">
        <div className="container px-4 mx-auto max-w-6xl">
          <div className="grid gap-14 lg:grid-cols-2 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-100 text-blue-800 rounded-full text-sm font-bold mb-5">
                🏫 For School Administrators
              </div>
              <h2 className="text-3xl font-extrabold text-gray-900 mb-4">Total Control of Your School's Operations</h2>
              <p className="text-gray-500 mb-6 leading-relaxed">
                The admin dashboard is your command centre. Every student, teacher, class, fee, and report is
                accessible from a single, clean interface — no more juggling spreadsheets.
              </p>
              <ul className="space-y-3">
                {[
                  "Register and manage students, teachers, and staff accounts",
                  "Create and configure classes, subjects, and academic years",
                  "Auto-generate or manually build class timetables",
                  "Issue invoices and track fee payments per student",
                  "Approve parent-child link requests for security",
                  "View school-wide results, attendance, and financial reports",
                  "Send school-wide announcements to all users",
                  "Suspend or unlock student and teacher accounts",
                  "PayNow Zimbabwe integration for online fee collection",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3 text-gray-700 text-sm">
                    <Check />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            {/* Dashboard mock */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-100 rounded-2xl p-6">
              <div className="bg-white rounded-xl shadow-lg p-6">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="font-bold text-gray-900 text-sm">Admin Overview</h3>
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">● Live</span>
                </div>
                <div className="grid grid-cols-2 gap-3 mb-5">
                  {[
                    { label: "Students", val: "843", color: "bg-blue-50 text-blue-800" },
                    { label: "Teachers", val: "56", color: "bg-green-50 text-green-800" },
                    { label: "Classes", val: "28", color: "bg-yellow-50 text-yellow-800" },
                    { label: "Fee Collection", val: "89%", color: "bg-purple-50 text-purple-800" },
                  ].map((s) => (
                    <div key={s.label} className={`${s.color} rounded-xl p-3 text-center`}>
                      <p className="text-xl font-extrabold">{s.val}</p>
                      <p className="text-xs mt-0.5 opacity-75">{s.label}</p>
                    </div>
                  ))}
                </div>
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-gray-700">Outstanding Fees — Top 3</p>
                  {[
                    { name: "Tinashe Moyo", amount: "$420", term: "Term 2" },
                    { name: "Rutendo Ncube", amount: "$350", term: "Term 2" },
                    { name: "Gift Dube", amount: "$280", term: "Term 1 + 2" },
                  ].map((s) => (
                    <div key={s.name} className="flex items-center justify-between bg-red-50 rounded-lg px-3 py-2">
                      <div>
                        <p className="text-xs font-semibold text-gray-800">{s.name}</p>
                        <p className="text-[10px] text-gray-500">{s.term}</p>
                      </div>
                      <span className="text-xs font-bold text-red-600">{s.amount}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── TEACHER FEATURES ──────────────────────────────────── */}
      <section className="py-20 bg-gray-50 border-t border-gray-100">
        <div className="container px-4 mx-auto max-w-6xl">
          <div className="grid gap-14 lg:grid-cols-2 items-center">
            {/* Performance mock */}
            <div className="order-2 lg:order-1 bg-gradient-to-br from-green-50 to-emerald-100 rounded-2xl p-6">
              <div className="bg-white rounded-xl shadow-lg p-6">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="font-bold text-gray-900 text-sm">Class Performance — Form 3A Maths</h3>
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Term 2</span>
                </div>
                <div className="space-y-3 mb-5">
                  {[
                    { label: "Class Average", pct: 71, color: "bg-green-500" },
                    { label: "Pass Rate (≥50%)", pct: 85, color: "bg-blue-500" },
                    { label: "Distinction Rate (≥75%)", pct: 28, color: "bg-purple-500" },
                  ].map((item) => (
                    <div key={item.label}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-600">{item.label}</span>
                        <span className="font-bold text-gray-900">{item.pct}%</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full ${item.color} rounded-full`} style={{ width: `${item.pct}%` }}></div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="border-t pt-4">
                  <p className="text-xs font-bold text-gray-700 mb-3">Top Performers</p>
                  {[
                    { name: "Ruvimbo Chigumba", score: "97%" },
                    { name: "Simba Mutasa", score: "93%" },
                    { name: "Leticia Banda", score: "88%" },
                  ].map((s, i) => (
                    <div key={s.name} className="flex justify-between text-xs py-1.5 border-b border-gray-50 last:border-0">
                      <span className="text-gray-600">{i + 1}. {s.name}</span>
                      <span className="font-bold text-green-600">{s.score}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="order-1 lg:order-2">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-green-100 text-green-800 rounded-full text-sm font-bold mb-5">
                👩‍🏫 For Teachers
              </div>
              <h2 className="text-3xl font-extrabold text-gray-900 mb-4">Spend Less Time on Admin, More Time Teaching</h2>
              <p className="text-gray-500 mb-6 leading-relaxed">
                Everything a teacher needs in one portal — from marking registers to analysing class
                performance and messaging parents — without leaving the platform.
              </p>
              <ul className="space-y-3">
                {[
                  "Enter and update student marks per subject, exam type, and term",
                  "Digital attendance register — Present, Absent, Late, Excused",
                  "View live class performance analytics and pass rates",
                  "Identify top performers and at-risk students instantly",
                  "Create homework with title, description, due date, and file attachments (PDF/Word up to 10MB)",
                  "Two-way messaging with parents — conversations organised by thread",
                  "View your personal timetable and teaching schedule",
                  "Write and publish school announcements",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3 text-gray-700 text-sm">
                    <Check />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── STUDENT FEATURES ──────────────────────────────────── */}
      <section className="py-20 bg-white border-t border-gray-100">
        <div className="container px-4 mx-auto max-w-6xl">
          <div className="grid gap-14 lg:grid-cols-2 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-yellow-100 text-yellow-800 rounded-full text-sm font-bold mb-5">
                🎒 For Students
              </div>
              <h2 className="text-3xl font-extrabold text-gray-900 mb-4">Everything a Student Needs — On Any Device</h2>
              <p className="text-gray-500 mb-6 leading-relaxed">
                Students access their academic life from any smartphone, tablet, or computer.
                Marks, homework, timetables, and announcements — always up to date.
              </p>
              <ul className="space-y-3">
                {[
                  "View results and marks for every subject and term",
                  "See overall average and individual subject scores",
                  "Download homework files (PDF, Word) uploaded by teachers",
                  "Track homework due dates — never miss an assignment",
                  "Check class timetable and daily schedule",
                  "View school calendar and upcoming exam dates",
                  "Read announcements and school notices",
                  "Access teacher contact information",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3 text-gray-700 text-sm">
                    <Check />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            {/* Student card mock */}
            <div className="bg-gradient-to-br from-yellow-50 to-amber-100 rounded-2xl p-6">
              <div className="bg-white rounded-xl shadow-lg p-6">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 bg-gradient-to-br from-yellow-400 to-amber-500 rounded-full flex items-center justify-center">
                    <span className="text-blue-950 font-extrabold text-sm">JM</span>
                  </div>
                  <div>
                    <p className="font-bold text-gray-900">John Moyo</p>
                    <p className="text-sm text-gray-500">Form 3A · Student ID: 2024-0412</p>
                  </div>
                </div>
                <div className="space-y-3 mb-5">
                  {[
                    { subject: "Mathematics", score: 82, grade: "A" },
                    { subject: "English Language", score: 74, grade: "B" },
                    { subject: "Physics", score: 68, grade: "B" },
                    { subject: "History", score: 91, grade: "A" },
                  ].map((s) => (
                    <div key={s.subject} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2.5">
                      <span className="text-sm text-gray-700">{s.subject}</span>
                      <div className="flex items-center gap-3">
                        <div className="h-1.5 w-20 bg-gray-200 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-500 rounded-full" style={{ width: `${s.score}%` }}></div>
                        </div>
                        <span className="text-sm font-bold text-gray-900 w-8 text-right">{s.score}%</span>
                        <span className="w-6 h-6 bg-green-100 text-green-700 rounded-full flex items-center justify-center text-xs font-bold">{s.grade}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between bg-blue-50 rounded-xl px-4 py-3">
                  <span className="text-sm font-semibold text-blue-800">Overall Average</span>
                  <span className="font-extrabold text-blue-900 text-lg">78.8%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── PARENT FEATURES ───────────────────────────────────── */}
      <section className="py-20 bg-gray-50 border-t border-gray-100">
        <div className="container px-4 mx-auto max-w-6xl">
          <div className="grid gap-14 lg:grid-cols-2 items-center">
            {/* Parent mock */}
            <div className="order-2 lg:order-1 bg-gradient-to-br from-purple-50 to-pink-100 rounded-2xl p-6">
              <div className="bg-white rounded-xl shadow-lg p-6">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="font-bold text-gray-900 text-sm">Parent Dashboard</h3>
                  <button className="text-xs bg-purple-100 text-purple-700 px-3 py-1 rounded-full font-medium">+ Link Child</button>
                </div>
                <div className="space-y-3 mb-5">
                  {[
                    { initials: "TM", name: "Tendai Moyo", class: "Form 3A", avg: "78%", fee: "$0 owed", status: "Confirmed", statusColor: "bg-green-100 text-green-700" },
                    { initials: "SM", name: "Sasha Moyo", class: "Grade 6B", avg: "82%", fee: "$120 owed", status: "Confirmed", statusColor: "bg-green-100 text-green-700" },
                  ].map((child) => (
                    <div key={child.name} className="bg-gray-50 rounded-xl p-4 border-l-4 border-purple-400">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-purple-200 rounded-full flex items-center justify-center text-purple-800 font-bold text-xs">{child.initials}</div>
                          <div>
                            <p className="font-semibold text-gray-900 text-sm">{child.name}</p>
                            <p className="text-xs text-gray-500">{child.class}</p>
                          </div>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${child.statusColor}`}>{child.status}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        <div className="bg-white rounded-lg p-2 text-center">
                          <p className="text-xs text-gray-500">Average</p>
                          <p className="font-bold text-gray-900 text-sm">{child.avg}</p>
                        </div>
                        <div className="bg-white rounded-lg p-2 text-center">
                          <p className="text-xs text-gray-500">Fees</p>
                          <p className={`font-bold text-sm ${child.fee === "$0 owed" ? "text-green-600" : "text-red-600"}`}>{child.fee}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3">
                  <p className="text-xs text-yellow-800 font-medium flex items-center gap-1.5">
                    📱 WhatsApp updates are sent every Monday morning
                  </p>
                </div>
              </div>
            </div>
            <div className="order-1 lg:order-2">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-purple-100 text-purple-800 rounded-full text-sm font-bold mb-5">
                👨‍👩‍👧 For Parents
              </div>
              <h2 className="text-3xl font-extrabold text-gray-900 mb-4">Stay Fully Involved in Your Child's Education</h2>
              <p className="text-gray-500 mb-6 leading-relaxed">
                Parents no longer need to wait until end-of-term reports or show up at school to find out
                how their child is doing. Everything is in the parent portal — in real time.
              </p>
              <ul className="space-y-3">
                {[
                  "Monitor children's academic performance term-by-term",
                  "View detailed marks and grades per subject",
                  "See attendance records — know when your child was absent",
                  "Access and download homework assignments",
                  "Track school fee balances and payment history",
                  "Receive automated WhatsApp weekly progress summaries",
                  "Chat directly with your child's teachers",
                  "Manage multiple children from one parent account",
                  "Securely link to children — each link requires admin approval",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3 text-gray-700 text-sm">
                    <Check />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── FINANCE & PAYNOW ──────────────────────────────────── */}
      <section className="py-20 bg-gradient-to-br from-blue-950 to-indigo-900 text-white">
        <div className="container px-4 mx-auto max-w-6xl">
          <div className="grid lg:grid-cols-2 gap-14 items-center">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 bg-yellow-400/15 border border-yellow-400/30 px-3 py-1.5 rounded-full text-sm font-semibold text-yellow-300">
                💰 Finance & PayNow Integration
              </div>
              <h2 className="text-3xl md:text-4xl font-extrabold leading-tight">
                Collect Fees Faster — Online, Via PayNow Zimbabwe
              </h2>
              <p className="text-blue-200 text-lg leading-relaxed">
                No more parents queuing at the school office to pay fees. MySchoolHub integrates with
                PayNow Zimbabwe so parents can pay from their phone — in seconds.
              </p>
              <ul className="space-y-3">
                {[
                  "Generate itemised invoices per student automatically",
                  "Track individual and school-wide outstanding balances",
                  "Accept EcoCash, OneMoney, and bank payments via PayNow",
                  "Payment reconciliation — reconcile received vs expected fees",
                  "Full financial reports by term, class, or school-wide",
                  "Accountant portal with dedicated financial dashboards",
                  "Print and download official fee receipts as PDF",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm text-blue-100">
                    <span className="w-5 h-5 bg-yellow-400/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <svg className="w-3 h-3 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            {/* Finance mock */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-white font-bold text-sm">Term 2 Fee Summary</p>
                <span className="text-xs px-2 py-0.5 bg-yellow-400/20 text-yellow-300 rounded-full border border-yellow-400/30">2025 · Term 2</span>
              </div>
              {[
                { label: "Total Expected", val: "$84,200", color: "text-white" },
                { label: "Collected to Date", val: "$71,450", color: "text-green-400" },
                { label: "Outstanding", val: "$12,750", color: "text-red-400" },
              ].map((item) => (
                <div key={item.label} className="flex justify-between bg-white/5 rounded-xl px-4 py-3">
                  <span className="text-blue-300 text-sm">{item.label}</span>
                  <span className={`font-bold ${item.color}`}>{item.val}</span>
                </div>
              ))}
              <div className="bg-white/5 rounded-xl px-4 py-3">
                <div className="flex justify-between mb-2">
                  <span className="text-blue-300 text-xs">Collection Rate</span>
                  <span className="text-white font-bold text-xs">84.9%</span>
                </div>
                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-yellow-400 to-green-400 rounded-full" style={{ width: "84.9%" }}></div>
                </div>
              </div>
              <div className="border-t border-white/10 pt-4">
                <p className="text-xs text-blue-400 mb-3 font-semibold">Recent Payments</p>
                {[
                  { name: "P. Chigumba", amount: "+$350", method: "EcoCash", time: "2 min ago" },
                  { name: "T. Mutasa", amount: "+$280", method: "PayNow", time: "14 min ago" },
                  { name: "N. Ndlovu", amount: "+$420", method: "Bank", time: "1 hr ago" },
                ].map((p) => (
                  <div key={p.name} className="flex items-center justify-between py-1.5">
                    <div>
                      <p className="text-white text-xs font-medium">{p.name}</p>
                      <p className="text-blue-400 text-[10px]">{p.method} · {p.time}</p>
                    </div>
                    <span className="text-green-400 font-bold text-sm">{p.amount}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── HR & STAFF ────────────────────────────────────────── */}
      <section className="py-20 bg-white border-t border-gray-100">
        <div className="container px-4 mx-auto max-w-6xl">
          <div className="text-center mb-12">
            <p className="text-blue-600 font-semibold uppercase tracking-widest text-xs mb-3">HR & Staff Management</p>
            <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-4">A Full HR Module, Built In</h2>
            <p className="text-gray-500 max-w-2xl mx-auto">
              MySchoolHub doesn't just manage students. The HR module gives you tools to manage your staff too.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: "👥", title: "Staff Profiles", desc: "Complete staff records — role, department, qualifications, contact info." },
              { icon: "📋", title: "Staff Attendance", desc: "Track when staff sign in and out. Absence records for every department." },
              { icon: "🏢", title: "Departments", desc: "Organise staff by department. Assign heads of department." },
              { icon: "📊", title: "HR Reports", desc: "Generate staff attendance and performance summaries any time." },
            ].map((item) => (
              <div key={item.title} className="bg-gray-50 border border-gray-100 rounded-2xl p-6 text-center hover:shadow-md transition">
                <span className="text-3xl mb-3 block">{item.icon}</span>
                <h3 className="font-bold text-gray-900 mb-2 text-sm">{item.title}</h3>
                <p className="text-gray-500 text-xs leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TECH STACK TRUST ──────────────────────────────────── */}
      <section className="py-16 bg-gray-50 border-t border-gray-100">
        <div className="container px-4 mx-auto max-w-5xl text-center">
          <p className="text-blue-600 font-semibold uppercase tracking-widest text-xs mb-3">Built on Reliable Technology</p>
          <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900 mb-10">Enterprise-Grade Technology, School-Friendly Simplicity</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { label: "Backend", tech: "Django 5.2 + DRF", icon: "🐍", desc: "Battle-tested Python framework powering thousands of production apps." },
              { label: "Authentication", tech: "JWT (HS256)", icon: "🔐", desc: "Secure, stateless auth with 30-day access and 60-day refresh tokens." },
              { label: "Frontend", tech: "React 19 + Vite", icon: "⚡", desc: "Blazing-fast, code-split UI that loads instantly on any connection." },
              { label: "Database", tech: "PostgreSQL", icon: "🗄️", desc: "Production-grade relational database with full multi-tenancy support." },
            ].map((item) => (
              <div key={item.label} className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                <span className="text-2xl mb-2 block">{item.icon}</span>
                <p className="text-[10px] text-blue-600 font-bold uppercase tracking-wide mb-1">{item.label}</p>
                <p className="font-bold text-gray-900 text-sm mb-2">{item.tech}</p>
                <p className="text-gray-500 text-xs leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────────────── */}
      <section className="py-20 bg-gradient-to-br from-blue-950 to-indigo-900 text-white">
        <div className="container px-4 mx-auto text-center max-w-3xl">
          <h2 className="text-3xl md:text-4xl font-extrabold mb-5">Ready to See It in Action?</h2>
          <p className="text-blue-200 text-lg mb-10 leading-relaxed">
            Book a free demo with the <a href="https://tishanyq.co.zw" target="_blank" rel="noopener noreferrer" className="text-yellow-400 hover:underline font-semibold">Tishanyq Digital</a> team and we'll show you exactly how MySchoolHub
            would work for your school — no sales pressure, just a real walkthrough.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => navigate('/contact')}
              className="px-10 py-4 font-bold text-blue-950 bg-yellow-400 rounded-xl hover:bg-yellow-300 transition shadow-xl text-base"
            >
              Book a Free Demo
            </button>
            <button
              onClick={() => navigate('/login')}
              className="px-10 py-4 font-semibold text-white border-2 border-white/30 rounded-xl hover:bg-white/10 transition text-base"
            >
              Access Portal
            </button>
          </div>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────── */}
      <footer className="bg-gray-950 text-white py-10">
        <div className="container px-4 mx-auto max-w-6xl">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-3">
              <img src={logo} alt="MySchoolHub" className="h-8 w-auto" />
              <span className="font-extrabold text-base">MySchoolHub</span>
            </div>
            <div className="flex gap-6 text-sm text-gray-400">
              <Link to="/" className="hover:text-white transition">Home</Link>
              <Link to="/about" className="hover:text-white transition">Features</Link>
              <Link to="/contact" className="hover:text-white transition">Contact</Link>
              <Link to="/login" className="hover:text-white transition">Portal</Link>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-6 flex flex-col md:flex-row justify-between items-center text-xs text-gray-500">
            <p>&copy; {new Date().getFullYear()} MySchoolHub · <a href="https://tishanyq.co.zw" target="_blank" rel="noopener noreferrer" className="hover:text-white transition">Tishanyq Digital</a>. All rights reserved.</p>
            <p className="mt-2 md:mt-0">
              Developed by{" "}
              <a href="https://tishanyq.co.zw" target="_blank" rel="noopener noreferrer" className="text-yellow-400 hover:underline font-semibold">
                Tishanyq Digital
              </a>{" "}
              · Harare, Zimbabwe
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default AboutUs;
