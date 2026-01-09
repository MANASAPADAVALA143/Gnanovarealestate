import LeadCaptureForm from '@/components/LeadCaptureForm'

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold mb-4">🏠 Gnanova Real Estate</h1>
          <p className="text-xl text-gray-600">AI-Powered Property Consultation</p>
        </div>
        
        <LeadCaptureForm />
      </div>
    </main>
  )
}

