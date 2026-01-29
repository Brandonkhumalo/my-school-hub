import { Link, useNavigate } from "react-router-dom";

const ContactUs = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="bg-blue-900 text-white sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-gradient-to-br from-yellow-400 to-yellow-500 rounded-xl flex items-center justify-center shadow-lg">
                <svg className="w-7 h-7 text-blue-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold">MySchoolHub</h1>
                <p className="text-xs text-blue-200">Complete School Management</p>
              </div>
            </div>
            <div className="hidden md:flex items-center space-x-6">
              <Link to="/" className="hover:text-yellow-400 transition">Home</Link>
              <Link to="/about" className="hover:text-yellow-400 transition">Features</Link>
              <Link to="/contact" className="text-yellow-400">Contact</Link>
              <button 
                onClick={() => navigate('/login')}
                className="bg-yellow-500 text-blue-900 px-6 py-2 rounded-lg font-semibold hover:bg-yellow-400 transition"
              >
                Access Portal
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 py-20">
        <div className="container px-4 mx-auto max-w-6xl text-center text-white">
          <span className="inline-block px-4 py-1 text-sm font-semibold text-yellow-400 bg-yellow-400/20 rounded-full border border-yellow-400/30 mb-4">
            Get In Touch
          </span>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Contact Us</h1>
          <p className="text-xl text-blue-200 max-w-2xl mx-auto">
            Have questions about MySchoolHub? We'd love to hear from you. Reach out for demos, support, or partnership inquiries.
          </p>
        </div>
      </section>

      {/* Contact Section */}
      <section className="py-16 bg-white">
        <div className="container px-4 mx-auto max-w-6xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Let's Connect</h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Whether you need a demo, have technical questions, or want to discuss a partnership, our team is here to help your school succeed.
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-3 mb-12">
            {/* Email Card */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-8 text-center hover:shadow-lg transition">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-4">Email Us</h3>
              <div className="space-y-2">
                <a href="mailto:info@myschoolhub.co.zw" className="block text-blue-600 hover:text-blue-800 font-medium">
                  info@myschoolhub.co.zw
                </a>
                <a href="mailto:support@myschoolhub.co.zw" className="block text-blue-600 hover:text-blue-800 font-medium">
                  support@myschoolhub.co.zw
                </a>
              </div>
            </div>

            {/* Phone Card */}
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-8 text-center hover:shadow-lg transition">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-4">Call Us</h3>
              <div className="space-y-3">
                <div>
                  <a href="tel:+263781603382" className="block text-green-600 hover:text-green-800 font-medium">
                    +263 78 160 3382
                  </a>
                  <span className="text-sm text-gray-500">24 Hours Support</span>
                </div>
                <div>
                  <a href="tel:+263782216826" className="block text-green-600 hover:text-green-800 font-medium">
                    +263 78 221 6826
                  </a>
                  <span className="text-sm text-gray-500">24 Hours Support</span>
                </div>
                <div>
                  <a href="tel:0782216826" className="block text-green-600 hover:text-green-800 font-medium">
                    078 221 6826
                  </a>
                  <span className="text-sm text-gray-500">Mon - Fri: 08:30 AM - 04:30 PM</span>
                </div>
              </div>
            </div>

            {/* Location Card */}
            <div className="bg-gradient-to-br from-yellow-50 to-amber-50 rounded-2xl p-8 text-center hover:shadow-lg transition">
              <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-4">Visit Us</h3>
              <div>
                <p className="text-gray-700 font-medium">7 Martin Drive</p>
                <p className="text-gray-700 font-medium">Msasa, Harare</p>
                <p className="text-gray-700 font-medium mb-2">Zimbabwe</p>
                <span className="text-sm text-gray-500">Mon - Fri: 08:30 AM - 04:30 PM</span>
              </div>
            </div>
          </div>

          {/* Map Section */}
          <div className="bg-gray-100 rounded-2xl overflow-hidden shadow-lg">
            <div className="p-4 bg-blue-900 text-white">
              <h3 className="text-lg font-bold flex items-center">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
                Our Location - 7 Martin Drive, Msasa, Harare
              </h3>
            </div>
            <iframe
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3798.0969867697977!2d31.117611!3d-17.8316667!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x1931a5a3bda52b8f%3A0x84e8d8b5f1c8f432!2sMsasa%2C%20Harare%2C%20Zimbabwe!5e0!3m2!1sen!2s!4v1706000000000!5m2!1sen!2s"
              width="100%"
              height="400"
              style={{ border: 0 }}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title="MySchoolHub Office Location"
            ></iframe>
          </div>
        </div>
      </section>

      {/* Why Choose Us */}
      <section className="py-16 bg-gray-50">
        <div className="container px-4 mx-auto max-w-6xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Why Choose MySchoolHub?</h2>
            <p className="text-gray-600">Trusted by schools across Zimbabwe</p>
          </div>
          
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <div className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition">
              <div className="flex items-center space-x-3 mb-3">
                <svg className="w-6 h-6 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                <span className="text-gray-800 font-semibold">Built for African Schools</span>
              </div>
              <p className="text-gray-600 text-sm">Designed specifically for the unique needs of Zimbabwean and African educational institutions.</p>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition">
              <div className="flex items-center space-x-3 mb-3">
                <svg className="w-6 h-6 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                <span className="text-gray-800 font-semibold">ZIMSEC & Cambridge Support</span>
              </div>
              <p className="text-gray-600 text-sm">Full support for both ZIMSEC and Cambridge International curricula with appropriate grading systems.</p>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition">
              <div className="flex items-center space-x-3 mb-3">
                <svg className="w-6 h-6 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                <span className="text-gray-800 font-semibold">Cloud-Based Access</span>
              </div>
              <p className="text-gray-600 text-sm">Access your school data from anywhere, anytime. Works on any device with an internet connection.</p>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition">
              <div className="flex items-center space-x-3 mb-3">
                <svg className="w-6 h-6 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                <span className="text-gray-800 font-semibold">24/7 Local Support</span>
              </div>
              <p className="text-gray-600 text-sm">Dedicated support team available around the clock to help with any questions or issues.</p>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition">
              <div className="flex items-center space-x-3 mb-3">
                <svg className="w-6 h-6 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                <span className="text-gray-800 font-semibold">Affordable Pricing</span>
              </div>
              <p className="text-gray-600 text-sm">Flexible pricing plans designed to fit schools of all sizes, from small private schools to large institutions.</p>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition">
              <div className="flex items-center space-x-3 mb-3">
                <svg className="w-6 h-6 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                <span className="text-gray-800 font-semibold">Secure & Private</span>
              </div>
              <p className="text-gray-600 text-sm">Enterprise-grade security with role-based access control to protect student and school data.</p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-16 bg-white">
        <div className="container px-4 mx-auto max-w-4xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Frequently Asked Questions</h2>
            <p className="text-gray-600">Common questions about MySchoolHub</p>
          </div>

          <div className="space-y-4">
            <div className="bg-gray-50 rounded-xl p-6">
              <h3 className="font-bold text-gray-900 mb-2">What types of schools can use MySchoolHub?</h3>
              <p className="text-gray-600">
                MySchoolHub is designed for primary schools, secondary schools, and high schools. 
                It works for both public and private institutions, and supports ZIMSEC and Cambridge curricula.
              </p>
            </div>
            <div className="bg-gray-50 rounded-xl p-6">
              <h3 className="font-bold text-gray-900 mb-2">How do parents get access to the system?</h3>
              <p className="text-gray-600">
                Parents can register themselves through the portal. They then search for and request to link 
                with their children. For security, an administrator must approve each parent-child link before 
                the parent can view the student's information.
              </p>
            </div>
            <div className="bg-gray-50 rounded-xl p-6">
              <h3 className="font-bold text-gray-900 mb-2">Is student data secure?</h3>
              <p className="text-gray-600">
                Yes, security is a top priority. We use role-based access control, secure authentication, 
                and privacy-focused features like admin-approved parent linking to ensure student data 
                is protected and only accessible to authorized users.
              </p>
            </div>
            <div className="bg-gray-50 rounded-xl p-6">
              <h3 className="font-bold text-gray-900 mb-2">Can teachers upload homework files?</h3>
              <p className="text-gray-600">
                Yes, teachers can create homework assignments and attach PDF or Word documents (up to 10MB). 
                Students and parents can then view and download these files from their respective portals.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-gradient-to-br from-blue-900 to-indigo-900">
        <div className="container px-4 mx-auto text-center max-w-4xl">
          <h2 className="text-3xl font-bold text-white mb-4">Ready to Transform Your School?</h2>
          <p className="text-blue-200 mb-8">
            Join schools already using MySchoolHub to streamline their administration 
            and improve communication with parents and students.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button 
              onClick={() => navigate('/login')}
              className="px-8 py-3 bg-yellow-500 text-blue-900 font-semibold rounded-lg hover:bg-yellow-400 transition"
            >
              Access Portal
            </button>
            <button 
              onClick={() => navigate('/')}
              className="px-8 py-3 bg-transparent border-2 border-white text-white font-semibold rounded-lg hover:bg-white/10 transition"
            >
              Learn More
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-8">
        <div className="container px-4 mx-auto max-w-6xl">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center space-x-3 mb-4 md:mb-0">
              <div className="w-10 h-10 bg-gradient-to-br from-yellow-400 to-yellow-500 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <span className="text-xl font-bold">MySchoolHub</span>
            </div>
            <div className="flex space-x-6 mb-4 md:mb-0">
              <Link to="/" className="text-gray-400 hover:text-white transition">Home</Link>
              <Link to="/about" className="text-gray-400 hover:text-white transition">Features</Link>
              <Link to="/contact" className="text-gray-400 hover:text-white transition">Contact</Link>
              <Link to="/login" className="text-gray-400 hover:text-white transition">Portal</Link>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-6 pt-6 text-center text-sm text-gray-400">
            <p>&copy; 2025 MySchoolHub. All rights reserved.</p>
            <p className="mt-2">
              Developed by <a href="https://tishanyq.co.zw" target="_blank" rel="noopener noreferrer" className="text-yellow-400 hover:text-yellow-300 font-semibold">Tishanyq Digital</a>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default ContactUs;
