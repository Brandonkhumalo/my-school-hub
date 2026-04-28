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

const ContactUs = () => {
  const navigate = useNavigate();


  const [form, setForm] = useState({ name: "", email: "", phone: "", school: "", message: "", role: "" });
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setError("");
    try {
      const apiBase = "/api/v1";
      const res = await fetch(`${apiBase}/auth/contact/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setSubmitted(true);
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Something went wrong. Please try again.");
      }
    } catch {
      setError("Could not send your message. Please check your connection.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-white font-sans">
      <Helmet>
        <title>Contact Us — MySchoolHub Zimbabwe | Get a Free Demo</title>
        <meta name="description" content="Contact Tishanyq Digital to request a free demo of MySchoolHub, Zimbabwe's school management system. We serve primary and secondary schools across Harare, Bulawayo and all provinces." />
        <link rel="canonical" href="https://myschoolhub.co.zw/contact" />
        <meta property="og:url" content="https://myschoolhub.co.zw/contact" />
        <meta property="og:title" content="Contact Us — MySchoolHub Zimbabwe | Get a Free Demo" />
        <meta property="og:description" content="Request a free demo of MySchoolHub, Zimbabwe's school management system for ZIMSEC and Cambridge schools." />
      </Helmet>
      <Navbar active="/contact" />

      {/* ── HERO ─────────────────────────────────────────────── */}
      <section className="bg-gradient-to-br from-blue-950 via-blue-900 to-indigo-900 py-20 relative overflow-hidden">
        <div className="absolute inset-0 opacity-5">
          <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="dots2" x="0" y="0" width="30" height="30" patternUnits="userSpaceOnUse">
                <circle cx="2" cy="2" r="1.5" fill="white" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#dots2)" />
          </svg>
        </div>
        <div className="container px-4 mx-auto max-w-4xl text-center text-white relative z-10">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 text-sm font-semibold text-yellow-300 bg-yellow-400/15 rounded-full border border-yellow-400/30 mb-5">
            📞 Get In Touch
          </span>
          <h1 className="text-4xl md:text-5xl font-extrabold mb-5">Let's Talk About Your School</h1>
          <p className="text-xl text-blue-200 max-w-2xl mx-auto">
            Whether you're ready to get started or just want to see a demo, our team in Harare is ready to help.
            We respond to all enquiries within one business day.
          </p>
        </div>
      </section>

      {/* ── CONTACT INFO + FORM ───────────────────────────────── */}
      <section className="py-20 bg-white">
        <div className="container px-4 mx-auto max-w-6xl">
          <div className="grid lg:grid-cols-5 gap-12">
            {/* LEFT — contact info */}
            <div className="lg:col-span-2 space-y-8">
              <div>
                <h2 className="text-2xl font-extrabold text-gray-900 mb-2">Contact <a href="https://tishanyq.co.zw" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Tishanyq Digital</a></h2>
                <p className="text-gray-500 text-sm leading-relaxed">
                  We're a Harare-based team passionate about using technology to improve education in Zimbabwe.
                  Reach out — we'd love to hear from you.
                </p>
              </div>

              {/* Contact cards */}
              <div className="space-y-4">
                <div className="flex items-start gap-4 bg-blue-50 border border-blue-100 rounded-2xl p-5">
                  <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-bold text-gray-900 text-sm mb-1">Email Us</p>
                    <a href="mailto:info@tishanyq.co.zw" className="text-blue-600 hover:underline text-sm block">info@tishanyq.co.zw</a>
                    <a href="mailto:support@tishanyq.co.zw" className="text-blue-600 hover:underline text-sm block">support@tishanyq.co.zw</a>
                  </div>
                </div>

                <div className="flex items-start gap-4 bg-green-50 border border-green-100 rounded-2xl p-5">
                  <div className="w-10 h-10 bg-green-600 rounded-xl flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-bold text-gray-900 text-sm mb-1">Call or WhatsApp</p>
                    <a href="tel:+263781603382" className="text-green-600 hover:underline text-sm block font-medium">+263 78 160 3382</a>
                    <a href="tel:+263782216826" className="text-green-600 hover:underline text-sm block font-medium">+263 78 221 6826</a>
                    <p className="text-gray-400 text-xs mt-1">Mon – Fri: 08:30 – 17:00 · After-hours support available</p>
                  </div>
                </div>

                <div className="flex items-start gap-4 bg-yellow-50 border border-yellow-100 rounded-2xl p-5">
                  <div className="w-10 h-10 bg-yellow-500 rounded-xl flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-blue-950" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-bold text-gray-900 text-sm mb-1">Visit Our Office</p>
                    <p className="text-gray-700 text-sm">7 Martin Drive, Msasa</p>
                    <p className="text-gray-700 text-sm">Harare, Zimbabwe</p>
                    <p className="text-gray-400 text-xs mt-1">Mon – Fri: 08:30 – 16:30</p>
                  </div>
                </div>
              </div>

              {/* Response promise */}
              <div className="bg-gradient-to-br from-blue-900 to-indigo-900 rounded-2xl p-5 text-white">
                <p className="font-bold text-sm mb-3">What Happens After You Contact Us?</p>
                <ol className="space-y-2">
                  {[
                    "We respond within 1 business day",
                    "We schedule a free 30-minute demo call",
                    "We customise a setup plan for your school",
                    "You're live within 48–72 hours of sign-up",
                  ].map((step, i) => (
                    <li key={step} className="flex items-start gap-3 text-sm text-blue-100">
                      <span className="w-5 h-5 bg-yellow-400 text-blue-950 rounded-full flex items-center justify-center font-bold text-[10px] flex-shrink-0">{i + 1}</span>
                      {step}
                    </li>
                  ))}
                </ol>
              </div>
            </div>

            {/* RIGHT — contact form */}
            <div className="lg:col-span-3">
              <div className="bg-gray-50 border border-gray-100 rounded-2xl p-8 shadow-sm">
                {submitted ? (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <h3 className="text-xl font-extrabold text-gray-900 mb-2">Message Sent!</h3>
                    <p className="text-gray-500 mb-6">Your email client has opened with your message. We'll get back to you within one business day.</p>
                    <button onClick={() => setSubmitted(false)} className="text-blue-600 font-semibold hover:underline text-sm">Send another message</button>
                  </div>
                ) : (
                  <>
                    <h3 className="text-xl font-extrabold text-gray-900 mb-1">Send Us a Message</h3>
                    <p className="text-gray-500 text-sm mb-6">Fill in your details and we'll be in touch shortly.</p>
                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-gray-700 mb-1">Full Name *</label>
                          <input
                            type="text"
                            required
                            placeholder="John Moyo"
                            value={form.name}
                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-700 mb-1">Email Address *</label>
                          <input
                            type="email"
                            required
                            placeholder="you@school.co.zw"
                            value={form.email}
                            onChange={(e) => setForm({ ...form, email: e.target.value })}
                            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-gray-700 mb-1">Phone / WhatsApp</label>
                          <input
                            type="tel"
                            placeholder="+263 77 ..."
                            value={form.phone}
                            onChange={(e) => setForm({ ...form, phone: e.target.value })}
                            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-700 mb-1">Your Role</label>
                          <select
                            value={form.role}
                            onChange={(e) => setForm({ ...form, role: e.target.value })}
                            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-700"
                          >
                            <option value="">Select role...</option>
                            <option>School Headmaster / Principal</option>
                            <option>Administrator</option>
                            <option>Teacher</option>
                            <option>IT / Systems Officer</option>
                            <option>Parent</option>
                            <option>Other</option>
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">School Name</label>
                        <input
                          type="text"
                          placeholder="e.g. Harare High School"
                          value={form.school}
                          onChange={(e) => setForm({ ...form, school: e.target.value })}
                          className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">How Can We Help? *</label>
                        <textarea
                          required
                          rows={5}
                          placeholder="Tell us about your school and what you're looking for — number of students, specific features you need, any questions..."
                          value={form.message}
                          onChange={(e) => setForm({ ...form, message: e.target.value })}
                          className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white resize-none"
                        />
                      </div>
                      {error && (
                        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
                          {error}
                        </p>
                      )}
                      <button
                        type="submit"
                        disabled={sending}
                        className="w-full py-3.5 bg-blue-950 text-white font-bold rounded-xl hover:bg-blue-800 transition text-sm shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {sending ? "Sending…" : "Send Message →"}
                      </button>
                      <p className="text-[11px] text-gray-400 text-center">
                        By submitting this form you agree to be contacted by <a href="https://tishanyq.co.zw" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">Tishanyq Digital</a> regarding MySchoolHub.
                      </p>
                    </form>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── MAP ───────────────────────────────────────────────── */}
      <section className="bg-gray-100">
        <div className="container px-4 mx-auto max-w-6xl pb-0">
          <div className="bg-blue-950 text-white px-6 py-4 rounded-t-2xl">
            <h3 className="font-bold flex items-center gap-2">
              <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              </svg>
              Our Location — 7 Martin Drive, Msasa, Harare
            </h3>
          </div>
          <iframe
            src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3798.0969867697977!2d31.117611!3d-17.8316667!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x1931a5a3bda52b8f%3A0x84e8d8b5f1c8f432!2sMsasa%2C%20Harare%2C%20Zimbabwe!5e0!3m2!1sen!2s!4v1706000000000!5m2!1sen!2s"
            width="100%"
            height="380"
            style={{ border: 0, display: "block" }}
            allowFullScreen
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            title="Tishanyq Digital Office Location"
          ></iframe>
        </div>
      </section>

      {/* ── WHY CHOOSE US ─────────────────────────────────────── */}
      <section className="py-20 bg-white">
        <div className="container px-4 mx-auto max-w-6xl">
          <div className="text-center mb-12">
            <p className="text-blue-600 font-semibold uppercase tracking-widest text-xs mb-3">Why Schools Choose Us</p>
            <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-4">Built Specifically for Zimbabwean Schools</h2>
            <p className="text-gray-500 max-w-2xl mx-auto">
              We're not a foreign platform retrofitted for Africa. MySchoolHub was built in Zimbabwe, for Zimbabwe.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: "🇿🇼", title: "Made in Zimbabwe", desc: "Built by a local team that understands Zimbabwean schools, curricula, and the challenges administrators actually face." },
              { icon: "📚", title: "ZIMSEC & Cambridge Ready", desc: "Full support for both ZIMSEC and Cambridge grading systems — no workarounds needed." },
              { icon: "📱", title: "Works on Any Phone", desc: "No expensive computers needed. If teachers and parents have a smartphone, they can access the full platform." },
              { icon: "💰", title: "Transparent Pricing", desc: "Flat pricing based on school size. No surprise fees, no per-user charges that make large schools unaffordable." },
              { icon: "🛠️", title: "We Set You Up", desc: "Our team handles the full onboarding — importing student data, configuring classes, training your staff." },
              { icon: "📞", title: "Real Local Support", desc: "Support from a team based in Harare. Call us, WhatsApp us, or visit our office. Real people, not bots." },
            ].map((item) => (
              <div key={item.title} className="bg-gray-50 border border-gray-100 rounded-2xl p-6 hover:shadow-md transition">
                <span className="text-3xl mb-3 block">{item.icon}</span>
                <h3 className="font-bold text-gray-900 mb-2 text-sm">{item.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ───────────────────────────────────────────────── */}
      <section className="py-20 bg-gray-50 border-t border-gray-100">
        <div className="container px-4 mx-auto max-w-4xl">
          <div className="text-center mb-12">
            <p className="text-blue-600 font-semibold uppercase tracking-widest text-xs mb-3">FAQ</p>
            <h2 className="text-3xl font-extrabold text-gray-900 mb-4">Frequently Asked Questions</h2>
          </div>
          <div className="space-y-4">
            {[
              {
                q: "What types of schools can use MySchoolHub?",
                a: "MySchoolHub works for primary schools (ECD to Grade 7), secondary schools (Form 1–4), and high schools (Form 5–6). It supports both public and private institutions, and both ZIMSEC and Cambridge curricula.",
              },
              {
                q: "How quickly can we get our school set up?",
                a: "Most schools are fully live within 48–72 hours of signing up. Our team handles importing student data, configuring classes and subjects, and training your staff. You don't need any IT expertise.",
              },
              {
                q: "How do parents get access?",
                a: "Parents register themselves on the parent portal using their details. They then search for and link to their child. For security, an administrator must approve each parent-child link before the parent can view any student information.",
              },
              {
                q: "Do parents need to download an app?",
                a: "No. MySchoolHub is fully web-based. Parents, students, and teachers access it from any browser. For WhatsApp communication, parents simply receive messages on their existing WhatsApp — no extra setup.",
              },
              {
                q: "Is there a fee for WhatsApp messaging?",
                a: "WhatsApp integration uses the Meta Business API. There may be small per-message costs depending on the volume of messages sent. Our team will discuss your school's WhatsApp needs during setup.",
              },
              {
                q: "Can we accept online payments through the system?",
                a: "Yes. MySchoolHub integrates with PayNow Zimbabwe, allowing parents to pay school fees via EcoCash, OneMoney, or bank transfer directly through the portal. All payments are recorded automatically.",
              },
              {
                q: "Is student data secure?",
                a: "Absolutely. All data is isolated per school — no school can see another's data. Parent access requires admin approval. Users only access information relevant to their role. Passwords are hashed and authentication uses secure JWT tokens.",
              },
            ].map((item) => (
              <div key={item.q} className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                <h3 className="font-bold text-gray-900 mb-2 text-sm">{item.q}</h3>
                <p className="text-gray-600 text-sm leading-relaxed">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────────────── */}
      <section className="py-20 bg-gradient-to-br from-blue-950 to-indigo-900 text-white">
        <div className="container px-4 mx-auto text-center max-w-3xl">
          <h2 className="text-3xl md:text-4xl font-extrabold mb-5">Ready to Transform Your School?</h2>
          <p className="text-blue-200 text-lg mb-10 leading-relaxed">
            Join schools across Zimbabwe already using MySchoolHub. Contact us today for a free demo and we'll
            show you exactly how it works for your school.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="tel:+263781603382"
              className="px-10 py-4 font-bold text-blue-950 bg-yellow-400 rounded-xl hover:bg-yellow-300 transition shadow-xl text-base flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              Call +263 78 160 3382
            </a>
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
              · 7 Martin Drive, Msasa, Harare
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default ContactUs;
