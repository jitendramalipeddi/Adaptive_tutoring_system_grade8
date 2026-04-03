$lines = Get-Content 'src\App.tsx'
$before = $lines[0..1659]
$after  = $lines[1811..($lines.Length - 1)]

$newBlock = @'
                  {isWrong && !explanationShown ? (
                    <div className="max-w-4xl mx-auto space-y-3">
                      <p className="text-sm text-[#1A1A1A]/50 text-center italic">Don't worry, everyone gets stuck sometimes! What would you like to do?</p>
                      <div className="flex gap-3">
                        <button
                          onClick={retryQuestion}
                          className="flex-1 p-4 bg-white border border-[#1A1A1A]/10 rounded-2xl font-semibold hover:bg-[#F5F5F0] transition-colors flex items-center justify-center gap-2"
                        >
                          Try Again
                        </button>
                        <button
                          onClick={showExplanation}
                          className="flex-1 p-4 bg-[#5A5A40] text-white rounded-2xl font-semibold hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                        >
                          Walk Me Through It
                        </button>
                      </div>
                    </div>
                  ) : explanationShown && showPolyaIntro ? (
                    <div className="max-w-4xl mx-auto">
                      <div className="bg-[#5A5A40]/5 border border-[#5A5A40]/20 rounded-2xl p-5 space-y-3">
                        <p className="font-semibold text-[#5A5A40] text-base">Let's solve this together using Polya's Method!</p>
                        <p className="text-sm text-[#1A1A1A]/70 leading-relaxed">
                          George Polya was a brilliant mathematician who came up with a friendly 4-step approach to crack any problem. We'll go through each step one at a time, and at each step you'll answer a quick question to make sure it clicks. Ready?
                        </p>
                        <div className="grid grid-cols-4 gap-2 pt-1">
                          {[
                            { label: 'Understand' },
                            { label: 'Plan' },
                            { label: 'Solve' },
                            { label: 'Review' },
                          ].map((s, i) => (
                            <div key={i} className="flex flex-col items-center gap-1 p-2 bg-white rounded-xl border border-[#5A5A40]/10 text-center">
                              <span className="text-[10px] font-bold uppercase tracking-widest text-[#5A5A40]">{s.label}</span>
                            </div>
                          ))}
                        </div>
                        <button
                          onClick={beginPolyaSteps}
                          className="w-full p-4 bg-[#5A5A40] text-white rounded-2xl font-semibold hover:opacity-90 transition-opacity"
                        >
                          Let's Go! Start Step 1
                        </button>
                      </div>
                    </div>
                  ) : explanationShown && currentExplanationStep > 0 && polyaStepMCQ && !polyaStepMCQAnswered ? (
                    <div className="max-w-4xl mx-auto space-y-3">
                      <p className="text-xs font-bold uppercase tracking-widest text-[#5A5A40]">Step {currentExplanationStep} of 4 - Quick Check</p>
                      <p className="text-sm font-medium text-[#1A1A1A]">{polyaStepMCQ.question}</p>
                      <div className="grid grid-cols-1 gap-2">
                        {polyaStepMCQ.options.map((opt, i) => (
                          <button
                            key={i}
                            onClick={() => {
                              setPolyaStepMCQSelected(i);
                              const correct = i === polyaStepMCQ.correct_index;
                              setPolyaStepMCQCorrect(correct);
                              setPolyaStepMCQAnswered(true);
                            }}
                            className={cn(
                              'p-3 rounded-xl text-sm text-left border transition-colors',
                              polyaStepMCQSelected === i
                                ? i === polyaStepMCQ.correct_index
                                  ? 'bg-green-100 border-green-400 text-green-800'
                                  : 'bg-red-100 border-red-400 text-red-800'
                                : 'bg-white border-[#1A1A1A]/10 hover:bg-[#F5F5F0]'
                            )}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : explanationShown && currentExplanationStep > 0 && polyaStepMCQAnswered ? (
                    <div className="max-w-4xl mx-auto space-y-3">
                      <div className={cn('p-3 rounded-xl text-sm font-medium', polyaStepMCQCorrect ? 'bg-green-100 text-green-800' : 'bg-amber-50 text-amber-800 border border-amber-200')}>
                        {polyaStepMCQCorrect
                          ? 'Spot on! You have got this step down.'
                          : `Not quite - the key idea here was: "${polyaStepMCQ?.options[polyaStepMCQ.correct_index]}". That is okay, keep going!`
                        }
                      </div>
                      {currentExplanationStep < 4 ? (
                        <button
                          onClick={nextExplanationStep}
                          className="w-full p-4 bg-[#5A5A40] text-white rounded-2xl font-semibold hover:opacity-90 transition-opacity"
                        >
                          {currentExplanationStep === 1 ? 'Next: Devise a Plan' : currentExplanationStep === 2 ? 'Next: Carry Out the Plan' : 'Next: Look Back and Review'}
                        </button>
                      ) : (
                        <button
                          onClick={completeExplanationAndPromptSimilar}
                          className="w-full p-4 bg-[#5A5A40] text-white rounded-2xl font-semibold hover:opacity-90 transition-opacity"
                        >
                          Now try a similar problem yourself!
                        </button>
                      )}
                    </div>
                  ) : similarProblemMode ? (
                    <div className="max-w-4xl mx-auto space-y-3">
                      <p className="text-sm font-semibold text-[#5A5A40]">You have seen how it is done - now give this one a go on your own!</p>
                      <div className="relative">
                        <input
                          type="text"
                          value={similarProblemInput}
                          onChange={(e) => setSimilarProblemInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !similarProblemSubmitted) {
                              const correct = similarProblemInput.trim().toLowerCase().replace(/[^0-9a-z.%]/g, '') === state.currentProblem!.correct_answer.toLowerCase().replace(/[^0-9a-z.%]/g, '');
                              setSimilarProblemCorrect(correct);
                              setSimilarProblemSubmitted(true);
                              if (correct) { setCurrentQuestionCorrect(true); setShowQuestionCheer(true); setTimeout(() => setShowQuestionCheer(false), 1400); setMasteredConceptMessage('You have mastered this concept!'); setTimeout(() => setMasteredConceptMessage(''), 2400); }
                            }
                          }}
                          disabled={similarProblemSubmitted}
                          placeholder="Type your answer and press Enter..."
                          className="w-full p-4 pr-24 bg-white rounded-2xl border border-[#1A1A1A]/10 focus:outline-none focus:border-[#5A5A40] transition-all text-sm"
                        />
                        {!similarProblemSubmitted && (
                          <button
                            onClick={() => {
                              const correct = similarProblemInput.trim().toLowerCase().replace(/[^0-9a-z.%]/g, '') === state.currentProblem!.correct_answer.toLowerCase().replace(/[^0-9a-z.%]/g, '');
                              setSimilarProblemCorrect(correct);
                              setSimilarProblemSubmitted(true);
                              if (correct) { setCurrentQuestionCorrect(true); setShowQuestionCheer(true); setTimeout(() => setShowQuestionCheer(false), 1400); setMasteredConceptMessage('You have mastered this concept!'); setTimeout(() => setMasteredConceptMessage(''), 2400); }
                            }}
                            className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-2 bg-[#5A5A40] text-white rounded-xl text-sm font-semibold hover:opacity-90"
                          >
                            Submit
                          </button>
                        )}
                      </div>
                      {similarProblemSubmitted && (
                        <div className={cn('p-3 rounded-xl text-sm font-medium', similarProblemCorrect ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800')}>
                          {similarProblemCorrect ? 'Brilliant! You solved it all by yourself!' : `Not quite. The correct answer was: ${state.currentProblem?.correct_answer}. Keep going, you are getting there!`}
                        </div>
                      )}
                      {similarProblemSubmitted && (
                        <button
                          onClick={() => { setSimilarProblemMode(false); setIsSimilarQuestion(false); }}
                          className="w-full p-4 bg-white border border-[#1A1A1A]/10 rounded-2xl font-semibold hover:bg-[#F5F5F0] transition-colors text-sm"
                        >
                          Continue to Next Question
                        </button>
                      )}
                    </div>
'@

$combined = $before + $newBlock.Split("`n") + $after
[System.IO.File]::WriteAllLines('src\App.tsx', $combined, [System.Text.Encoding]::UTF8)
Write-Host "Done. Lines: $($combined.Length)"
