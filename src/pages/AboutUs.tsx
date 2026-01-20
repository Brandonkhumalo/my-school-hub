import { Link, useNavigate } from "react-router-dom";

const AboutUs = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="bg-blue-900 text-white sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-yellow-500 rounded-full flex items-center justify-center">
                <span className="text-blue-900 font-bold text-xl">W</span>
              </div>
              <div>
                <h1 className="text-xl font-bold">Willovale Secondary School</h1>
                <p className="text-xs text-blue-200">Excellence in Education Since 1985</p>
              </div>
            </div>
            <div className="hidden md:flex items-center space-x-6">
              <Link to="/" className="hover:text-yellow-400 transition">Home</Link>
              <Link to="/about" className="text-yellow-400">About Us</Link>
              <Link to="/contact" className="hover:text-yellow-400 transition">Contact</Link>
              <button 
                onClick={() => navigate('/login')}
                className="bg-yellow-500 text-blue-900 px-6 py-2 rounded-lg font-semibold hover:bg-yellow-400 transition"
              >
                Student Portal
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 py-20">
        <div className="container px-4 mx-auto max-w-6xl text-center text-white">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">About Willovale Secondary School</h1>
          <p className="text-xl text-blue-200">Building Future Leaders Since 1985</p>
        </div>
      </section>

      {/* History Section */}
      <section className="py-16 bg-white">
        <div className="container px-4 mx-auto max-w-6xl">
          <div className="grid gap-12 lg:grid-cols-2 items-center">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-6">Our History</h2>
              <p className="text-gray-600 mb-4">
                Willovale Secondary School was established in 1985 in the rural community of Willowvale, 
                Eastern Cape, South Africa. What began as a small school with just 150 students and 8 
                teachers has grown into one of the most respected educational institutions in the region.
              </p>
              <p className="text-gray-600 mb-4">
                Over the past 39 years, we have consistently produced exceptional matric results, with many 
                of our students going on to study at prestigious universities across South Africa and abroad.
              </p>
              <p className="text-gray-600">
                Our school has been recognized multiple times by the Department of Education for academic 
                excellence and community involvement. We take pride in our rich history of developing not 
                just scholars, but well-rounded individuals who contribute positively to society.
              </p>
            </div>
            <div className="bg-gray-100 rounded-2xl p-8">
              <h3 className="text-xl font-bold text-gray-900 mb-6">Key Milestones</h3>
              <div className="space-y-4">
                <div className="flex items-start">
                  <div className="w-16 h-8 bg-blue-900 text-white rounded flex items-center justify-center text-sm font-bold mr-4 flex-shrink-0">
                    1985
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">School Founded</div>
                    <div className="text-sm text-gray-600">Established with 150 students</div>
                  </div>
                </div>
                <div className="flex items-start">
                  <div className="w-16 h-8 bg-blue-900 text-white rounded flex items-center justify-center text-sm font-bold mr-4 flex-shrink-0">
                    1995
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">First 100% Pass Rate</div>
                    <div className="text-sm text-gray-600">Achieved first 100% matric pass rate</div>
                  </div>
                </div>
                <div className="flex items-start">
                  <div className="w-16 h-8 bg-blue-900 text-white rounded flex items-center justify-center text-sm font-bold mr-4 flex-shrink-0">
                    2005
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">New Science Block</div>
                    <div className="text-sm text-gray-600">Modern science laboratories opened</div>
                  </div>
                </div>
                <div className="flex items-start">
                  <div className="w-16 h-8 bg-blue-900 text-white rounded flex items-center justify-center text-sm font-bold mr-4 flex-shrink-0">
                    2015
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">Computer Lab Upgrade</div>
                    <div className="text-sm text-gray-600">State-of-the-art computer facilities</div>
                  </div>
                </div>
                <div className="flex items-start">
                  <div className="w-16 h-8 bg-yellow-500 text-blue-900 rounded flex items-center justify-center text-sm font-bold mr-4 flex-shrink-0">
                    2024
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">Digital Portal Launch</div>
                    <div className="text-sm text-gray-600">Online student management system</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Mission & Vision */}
      <section className="py-16 bg-gray-50">
        <div className="container px-4 mx-auto max-w-6xl">
          <div className="grid gap-8 md:grid-cols-2">
            <div className="bg-blue-900 text-white rounded-2xl p-8">
              <div className="w-16 h-16 bg-yellow-500 rounded-full flex items-center justify-center mb-6">
                <svg className="w-8 h-8 text-blue-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold mb-4">Our Mission</h3>
              <p className="text-blue-100">
                To provide quality education that develops the intellectual, physical, emotional, and 
                social potential of every learner. We strive to create a nurturing environment where 
                students can discover their talents, build character, and prepare for meaningful 
                contributions to society.
              </p>
            </div>
            <div className="bg-white border-2 border-blue-900 rounded-2xl p-8">
              <div className="w-16 h-16 bg-blue-900 rounded-full flex items-center justify-center mb-6">
                <svg className="w-8 h-8 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Our Vision</h3>
              <p className="text-gray-600">
                To be a center of educational excellence that produces well-rounded, responsible, and 
                capable citizens who will lead and serve their communities with integrity and 
                distinction. We envision a school where every student reaches their full potential.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Leadership Section */}
      <section className="py-16 bg-white">
        <div className="container px-4 mx-auto max-w-6xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">School Leadership</h2>
            <p className="text-gray-600">Meet our dedicated team of educational leaders</p>
          </div>

          <div className="grid gap-8 md:grid-cols-3">
            <div className="text-center">
              <div className="w-32 h-32 bg-blue-900 rounded-full mx-auto mb-4 flex items-center justify-center">
                <svg className="w-16 h-16 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900">Mr. Themba Ndlovu</h3>
              <p className="text-blue-600 font-semibold">Principal</p>
              <p className="text-gray-600 text-sm mt-2">
                M.Ed. in Educational Leadership. 25 years in education, 10 years as Principal.
              </p>
            </div>
            <div className="text-center">
              <div className="w-32 h-32 bg-blue-900 rounded-full mx-auto mb-4 flex items-center justify-center">
                <svg className="w-16 h-16 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900">Mrs. Nomvula Khumalo</h3>
              <p className="text-blue-600 font-semibold">Deputy Principal - Academics</p>
              <p className="text-gray-600 text-sm mt-2">
                B.Ed. Honors in Mathematics. 18 years of teaching experience.
              </p>
            </div>
            <div className="text-center">
              <div className="w-32 h-32 bg-blue-900 rounded-full mx-auto mb-4 flex items-center justify-center">
                <svg className="w-16 h-16 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900">Mr. Sipho Mthethwa</h3>
              <p className="text-blue-600 font-semibold">Deputy Principal - Administration</p>
              <p className="text-gray-600 text-sm mt-2">
                B.Com., PGCE. Extensive experience in school administration and finance.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Facilities Section */}
      <section className="py-16 bg-gray-50">
        <div className="container px-4 mx-auto max-w-6xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Our Facilities</h2>
            <p className="text-gray-600">Modern infrastructure to support quality education</p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <div className="bg-white rounded-lg p-6 shadow-sm text-center">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                </svg>
              </div>
              <h3 className="font-bold text-gray-900">Science Labs</h3>
              <p className="text-gray-600 text-sm mt-2">3 fully equipped laboratories</p>
            </div>
            <div className="bg-white rounded-lg p-6 shadow-sm text-center">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="font-bold text-gray-900">Computer Lab</h3>
              <p className="text-gray-600 text-sm mt-2">40 computers with internet</p>
            </div>
            <div className="bg-white rounded-lg p-6 shadow-sm text-center">
              <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <h3 className="font-bold text-gray-900">Library</h3>
              <p className="text-gray-600 text-sm mt-2">10,000+ books and resources</p>
            </div>
            <div className="bg-white rounded-lg p-6 shadow-sm text-center">
              <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="font-bold text-gray-900">Sports Fields</h3>
              <p className="text-gray-600 text-sm mt-2">Soccer, netball, and athletics</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-blue-900">
        <div className="container px-4 mx-auto text-center max-w-4xl">
          <h2 className="text-3xl font-bold text-white mb-4">Want to Learn More?</h2>
          <p className="text-blue-200 mb-8">
            Get in touch with us to learn more about enrollment, programs, or to schedule a school visit.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button 
              onClick={() => navigate('/contact')}
              className="px-8 py-3 bg-yellow-500 text-blue-900 font-semibold rounded-lg hover:bg-yellow-400 transition"
            >
              Contact Us
            </button>
            <button 
              onClick={() => navigate('/')}
              className="px-8 py-3 bg-transparent border-2 border-white text-white font-semibold rounded-lg hover:bg-white/10 transition"
            >
              Back to Home
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-8">
        <div className="container px-4 mx-auto max-w-6xl text-center">
          <p className="text-gray-400">&copy; 2025 Willovale Secondary School. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default AboutUs;
