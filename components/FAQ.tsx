import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqs = [
    {
      question: 'Will this work with my existing CRM?',
      answer: 'Gnanova is your all-in-one CRM. It connects natively with Property Finder, Bayut, WhatsApp Business, and Meta Ads — no third-party CRM needed.'
    },
    {
      question: 'How long does setup take?',
      answer: 'Most agents are fully operational within 48 hours. Initial CRM connection takes about 15 minutes, customizing AI responses takes 30 minutes, and we spend 24 hours testing and optimizing before going live.'
    },
    {
      question: 'What if I need help?',
      answer: 'Professional and Enterprise plans include priority support via phone, email, and chat. Starter plan gets email support within 24 hours. All plans have access to our comprehensive knowledge base and video tutorials.'
    },
    {
      question: 'Is my data secure?',
      answer: 'Absolutely. We are SOC2 Type II compliant and use bank-level encryption. Your data is never shared with third parties. We also conduct regular security audits and penetration testing.'
    },
    {
      question: 'Can I cancel anytime?',
      answer: 'Yes, all plans are month-to-month with no long-term contracts. You can cancel anytime with 30 days notice. We also offer a 60-day money-back guarantee if you\'re not satisfied.'
    },
    {
      question: 'Do you offer a free trial?',
      answer: 'We offer a free demo and consultation instead of a trial. This allows us to customize the AI to your specific market and business needs before you commit. Book a demo to see Gnanova Real Estate in action with your actual data.'
    }
  ];

  return (
    <section id="faq" className="py-20 bg-gradient-to-br from-gray-50 to-blue-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Frequently Asked Questions
          </h2>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <div
              key={index}
              className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-200"
            >
              <button
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                className="w-full px-6 py-5 flex items-center justify-between text-left hover:bg-gray-50 transition"
              >
                <span className="text-lg font-semibold text-gray-900">{faq.question}</span>
                {openIndex === index ? (
                  <ChevronUp className="text-blue-600 flex-shrink-0" size={24} />
                ) : (
                  <ChevronDown className="text-gray-400 flex-shrink-0" size={24} />
                )}
              </button>
              {openIndex === index && (
                <div className="px-6 pb-5">
                  <p className="text-gray-700 leading-relaxed">{faq.answer}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
