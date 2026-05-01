import DemoBookingForm from '@/components/DemoBookingForm'

export default function DemoPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 py-12 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h1 className="text-5xl md:text-6xl font-bold mb-4 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Experience Gnanova AI
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Book a personalized demo and see how AI voice agents can 10x your lead generation
          </p>
        </div>

        {/* Demo Booking Form */}
        <DemoBookingForm />

        {/* Stats Section */}
        <div className="mt-16 grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          <div className="text-center p-6 bg-white rounded-lg shadow-md">
            <div className="text-4xl font-bold text-blue-600 mb-2">10x</div>
            <p className="text-gray-600">More Qualified Leads</p>
          </div>
          <div className="text-center p-6 bg-white rounded-lg shadow-md">
            <div className="text-4xl font-bold text-purple-600 mb-2">50%</div>
            <p className="text-gray-600">Less Time Qualifying</p>
          </div>
          <div className="text-center p-6 bg-white rounded-lg shadow-md">
            <div className="text-4xl font-bold text-green-600 mb-2">24/7</div>
            <p className="text-gray-600">Automated Follow-ups</p>
          </div>
        </div>

        {/* Testimonial */}
        <div className="mt-16 max-w-3xl mx-auto bg-white p-8 rounded-lg shadow-lg border-l-4 border-blue-600">
          <p className="text-lg text-gray-700 italic mb-4">
            "Gnanova AI has completely transformed how we handle leads. Our conversion rate increased by 300% in the first month. The AI assistant sounds so natural, our clients can't believe it's not a real person!"
          </p>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-xl">
              R
            </div>
            <div>
              <p className="font-semibold text-gray-900">Rajesh Kumar</p>
              <p className="text-sm text-gray-600">CEO, Premium Properties India</p>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}



