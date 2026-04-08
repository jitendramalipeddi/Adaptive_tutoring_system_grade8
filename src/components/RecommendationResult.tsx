import React from 'react';
import { motion } from 'motion/react';
import { CheckCircle2, ArrowRight, RotateCcw, TrendingUp, AlertTriangle } from 'lucide-react';
import { RecommendationResponse } from '../services/recommendation';

interface Props {
  result: RecommendationResponse;
  onHome: () => void;
}

export default function RecommendationResult({ result, onHome }: Props) {
  const isWeak = result.recommendation.type === 'prerequisite';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="max-w-2xl mx-auto space-y-6"
    >
      <div className="text-center space-y-3">
        <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto ${isWeak ? 'bg-amber-100 text-amber-600' : 'bg-green-100 text-green-600'}`}>
          {isWeak ? <AlertTriangle size={40} /> : <CheckCircle2 size={40} />}
        </div>
        <h2 className="text-3xl font-semibold">
          {isWeak ? 'Keep Practicing!' : 'Great Work!'}
        </h2>
        <p className="text-[#1A1A1A]/60 capitalize">
          Learning state: <span className="font-semibold text-[#1A1A1A]">{result.learning_state}</span>
        </p>
      </div>

      <div className="bg-white p-8 rounded-[32px] border border-[#1A1A1A]/10 space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-[#F5F5F0] rounded-2xl text-center">
            <p className="text-[10px] font-bold uppercase tracking-widest opacity-40 mb-1">Performance</p>
            <p className="text-2xl font-bold">{(result.performance_score * 100).toFixed(0)}%</p>
          </div>
          <div className="p-4 bg-[#F5F5F0] rounded-2xl text-center">
            <p className="text-[10px] font-bold uppercase tracking-widest opacity-40 mb-1">Confidence</p>
            <p className="text-2xl font-bold">{(result.confidence_score * 100).toFixed(0)}%</p>
          </div>
          <div className="p-4 bg-[#F5F5F0] rounded-2xl text-center">
            <p className="text-[10px] font-bold uppercase tracking-widest opacity-40 mb-1">Accuracy</p>
            <p className="text-2xl font-bold">{(result.diagnosis.accuracy * 100).toFixed(0)}%</p>
          </div>
          <div className="p-4 bg-[#F5F5F0] rounded-2xl text-center">
            <p className="text-[10px] font-bold uppercase tracking-widest opacity-40 mb-1">Hint Use</p>
            <p className="text-2xl font-bold capitalize">{result.diagnosis.hint_dependency}</p>
          </div>
        </div>

        <div className="border-t border-[#1A1A1A]/5 pt-4 space-y-3">
          <div className="flex items-center gap-2 text-[#5A5A40]">
            <TrendingUp size={18} />
            <h3 className="font-semibold">Recommendation</h3>
          </div>
          <p className="text-sm text-[#1A1A1A]/70">{result.recommendation.reason}</p>
          <ul className="space-y-2">
            {result.recommendation.next_steps.map((step, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <ArrowRight size={14} className="mt-0.5 text-[#5A5A40] flex-shrink-0" />
                {step}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="space-y-3">
        {isWeak && result.recommendation.prerequisite_url && (
          <a
            href={result.recommendation.prerequisite_url}
            className="w-full p-5 bg-amber-500 text-white rounded-[32px] font-semibold hover:opacity-90 transition-opacity shadow-lg flex items-center justify-center gap-2"
          >
            <RotateCcw size={18} /> Go to Prerequisite Chapter
          </a>
        )}
        <button
          onClick={onHome}
          className="w-full p-5 bg-[#5A5A40] text-white rounded-[32px] font-semibold hover:opacity-90 transition-opacity shadow-lg"
        >
          Back to Home
        </button>
      </div>
    </motion.div>
  );
}
