import { useState, useMemo } from 'react'
import { ArrowRight, TrendingUp, DollarSign, Calendar, Target } from 'lucide-react'

interface ROICalculatorProps {
  onBookDemo: () => void
  gnanovaMonthlyCost?: number // Default to $1,500 (Solo Agent tier)
}

export default function ROICalculator({
  onBookDemo,
  gnanovaMonthlyCost = 1500,
}: ROICalculatorProps) {
  const [avgCommission, setAvgCommission] = useState(20000)
  const [dealsPerMonth, setDealsPerMonth] = useState(3)
  const [missedLeadsPercent, setMissedLeadsPercent] = useState(30)
  const [currentCloseRate, setCurrentCloseRate] = useState(15)

  // Calculations
  const calculations = useMemo(() => {
    // Total leads per month = deals / close rate
    const totalLeadsPerMonth = (dealsPerMonth / currentCloseRate) * 100

    // Missed leads per month
    const missedLeadsPerMonth = (totalLeadsPerMonth * missedLeadsPercent) / 100

    // Gnanova improvement: 40% of missed leads become deals
    const improvementRate = 0.4
    const extraDealsPerMonth = missedLeadsPerMonth * improvementRate

    // Monthly extra revenue
    const monthlyExtraRevenue = extraDealsPerMonth * avgCommission

    // Annual extra revenue
    const annualExtraRevenue = monthlyExtraRevenue * 12

    // Gnanova annual cost
    const gnanovaAnnualCost = gnanovaMonthlyCost * 12

    // ROI percentage
    const roiPercentage = gnanovaAnnualCost > 0 ? (annualExtraRevenue / gnanovaAnnualCost) * 100 : 0

    // Payback period (months)
    const paybackMonths =
      monthlyExtraRevenue > 0 ? gnanovaMonthlyCost / monthlyExtraRevenue : Infinity

    return {
      totalLeadsPerMonth,
      missedLeadsPerMonth,
      extraDealsPerMonth,
      monthlyExtraRevenue,
      annualExtraRevenue,
      roiPercentage,
      paybackMonths,
    }
  }, [avgCommission, dealsPerMonth, missedLeadsPercent, currentCloseRate, gnanovaMonthlyCost])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const formatNumber = (num: number, decimals = 1) => {
    return num.toFixed(decimals)
  }

  return (
    <section className="py-16 bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10">
          <div className="inline-flex items-center space-x-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-2 rounded-full mb-4">
            <TrendingUp size={18} />
            <span className="text-sm font-semibold">ROI Calculator</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-3">
            See How Much Extra Revenue You Could Generate
          </h2>
          <p className="text-slate-600 text-sm md:text-base max-w-2xl mx-auto">
            Adjust the sliders below to see how Gnanova&apos;s AI can help you capture missed
            opportunities and close more deals.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Input Panel */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-lg">
            <h3 className="text-lg font-semibold text-slate-900 mb-6">Your Current Metrics</h3>

            <div className="space-y-6">
              {/* Average Commission */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-slate-700">
                    Average Commission per Sale
                  </label>
                  <span className="text-lg font-bold text-blue-600">
                    {formatCurrency(avgCommission)}
                  </span>
                </div>
                <input
                  type="range"
                  min="5000"
                  max="100000"
                  step="1000"
                  value={avgCommission}
                  onChange={(e) => setAvgCommission(Number(e.target.value))}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
                <div className="flex justify-between text-xs text-slate-500 mt-1">
                  <span>$5K</span>
                  <span>$100K</span>
                </div>
              </div>

              {/* Deals per Month */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-slate-700">
                    Number of Deals per Month
                  </label>
                  <span className="text-lg font-bold text-blue-600">{dealsPerMonth}</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="20"
                  step="0.5"
                  value={dealsPerMonth}
                  onChange={(e) => setDealsPerMonth(Number(e.target.value))}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
                <div className="flex justify-between text-xs text-slate-500 mt-1">
                  <span>1</span>
                  <span>20</span>
                </div>
              </div>

              {/* Missed Leads % */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-slate-700">
                    % of Leads Missed (Slow Response)
                  </label>
                  <span className="text-lg font-bold text-red-600">{missedLeadsPercent}%</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="60"
                  step="5"
                  value={missedLeadsPercent}
                  onChange={(e) => setMissedLeadsPercent(Number(e.target.value))}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-red-600"
                />
                <div className="flex justify-between text-xs text-slate-500 mt-1">
                  <span>10%</span>
                  <span>60%</span>
                </div>
              </div>

              {/* Current Close Rate */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-slate-700">Current Close Rate</label>
                  <span className="text-lg font-bold text-emerald-600">{currentCloseRate}%</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="50"
                  step="1"
                  value={currentCloseRate}
                  onChange={(e) => setCurrentCloseRate(Number(e.target.value))}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                />
                <div className="flex justify-between text-xs text-slate-500 mt-1">
                  <span>5%</span>
                  <span>50%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Results Panel */}
          <div className="bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl border border-blue-500 p-6 shadow-xl text-white">
            <h3 className="text-lg font-semibold mb-6">Your Potential Results</h3>

            <div className="space-y-6">
              {/* Annual Extra Revenue - Main Highlight */}
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-5 border border-white/20">
                <div className="flex items-center gap-3 mb-2">
                  <DollarSign className="text-yellow-300" size={24} />
                  <p className="text-sm font-medium text-blue-100">Extra Annual Revenue</p>
                </div>
                <p className="text-4xl md:text-5xl font-bold text-white mb-1">
                  {formatCurrency(calculations.annualExtraRevenue)}
                </p>
                <p className="text-xs text-blue-100">
                  That&apos;s{' '}
                  <span className="font-semibold text-white">
                    {formatNumber(calculations.extraDealsPerMonth, 1)} extra deals per month
                  </span>
                </p>
              </div>

              {/* Monthly Breakdown */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20">
                  <p className="text-xs text-blue-100 mb-1">Extra Monthly Revenue</p>
                  <p className="text-2xl font-bold text-white">
                    {formatCurrency(calculations.monthlyExtraRevenue)}
                  </p>
                </div>
                <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20">
                  <p className="text-xs text-blue-100 mb-1">Extra Deals/Month</p>
                  <p className="text-2xl font-bold text-white">
                    {formatNumber(calculations.extraDealsPerMonth, 1)}
                  </p>
                </div>
              </div>

              {/* Payback Period */}
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-5 border border-white/20">
                <div className="flex items-center gap-3 mb-3">
                  <Calendar className="text-emerald-300" size={20} />
                  <p className="text-sm font-medium text-blue-100">Payback Period</p>
                </div>
                {isFinite(calculations.paybackMonths) ? (
                  <>
                    <p className="text-3xl font-bold text-white mb-1">
                      {calculations.paybackMonths < 1
                        ? '< 1 month'
                        : `${formatNumber(calculations.paybackMonths, 1)} months`}
                    </p>
                    <p className="text-xs text-blue-100">
                      Gnanova pays for itself in{' '}
                      {calculations.paybackMonths < 1
                        ? 'less than a month'
                        : `just ${formatNumber(calculations.paybackMonths, 1)} months`}
                    </p>
                  </>
                ) : (
                  <p className="text-lg text-blue-100">Adjust your metrics to see payback</p>
                )}
              </div>

              {/* ROI Percentage */}
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-5 border border-white/20">
                <div className="flex items-center gap-3 mb-3">
                  <Target className="text-yellow-300" size={20} />
                  <p className="text-sm font-medium text-blue-100">ROI</p>
                </div>
                <p className="text-3xl font-bold text-white mb-2">
                  {formatNumber(calculations.roiPercentage, 0)}%
                </p>
                <div className="w-full bg-white/20 rounded-full h-2.5 mb-2">
                  <div
                    className="bg-gradient-to-r from-yellow-400 to-emerald-400 h-2.5 rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(calculations.roiPercentage, 1000)}%`,
                      maxWidth: '100%',
                    }}
                  />
                </div>
                <p className="text-xs text-blue-100">
                  Return on investment over 12 months
                </p>
              </div>

              {/* CTA Button */}
              <button
                onClick={onBookDemo}
                className="w-full mt-4 bg-white text-blue-600 font-bold py-4 px-6 rounded-xl hover:bg-blue-50 transition-all transform hover:scale-105 shadow-lg flex items-center justify-center gap-2"
              >
                <span>Book Demo to Learn More</span>
                <ArrowRight size={20} />
              </button>
            </div>
          </div>
        </div>

        {/* Additional Info */}
        <div className="mt-8 text-center">
          <p className="text-xs text-slate-600 max-w-2xl mx-auto">
            * Calculations assume Gnanova captures 40% of missed leads and converts them at your
            current close rate. Actual results may vary based on market conditions and implementation.
          </p>
        </div>
      </div>
    </section>
  )
}
