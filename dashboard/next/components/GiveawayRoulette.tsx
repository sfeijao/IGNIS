"use client"

import { useState, useEffect, useRef } from 'react'

interface RouletteProps {
  participants: { user_id: string; username?: string }[]
  winnersCount: number
  onComplete?: (winners: string[]) => void
}

export default function GiveawayRoulette({ participants, winnersCount, onComplete }: RouletteProps) {
  const [isSpinning, setIsSpinning] = useState(false)
  const [currentDisplay, setCurrentDisplay] = useState<string>('')
  const [winners, setWinners] = useState<string[]>([])
  const [stage, setStage] = useState(0) // qual vencedor estamos escolhendo
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  const startSpin = () => {
    if (participants.length === 0 || winners.length >= winnersCount) return
    
    setIsSpinning(true)
    let count = 0
    const maxSpins = 30 + Math.floor(Math.random() * 20)
    
    intervalRef.current = setInterval(() => {
      // Escolhe participante aleatório para mostrar
      const randomIndex = Math.floor(Math.random() * participants.length)
      const participant = participants[randomIndex]
      setCurrentDisplay(participant.username || participant.user_id)
      
      count++
      if (count >= maxSpins) {
        stopSpin()
      }
    }, 50 + count * 2) // Acelera progressivamente
  }

  const stopSpin = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    
    // Seleciona vencedor final (excluindo já escolhidos)
    const availableParticipants = participants.filter(
      p => !winners.includes(p.user_id)
    )
    
    if (availableParticipants.length > 0) {
      const winnerIndex = Math.floor(Math.random() * availableParticipants.length)
      const winner = availableParticipants[winnerIndex]
      
      setCurrentDisplay(winner.username || winner.user_id)
      setWinners(prev => [...prev, winner.user_id])
      setStage(prev => prev + 1)
      
      setTimeout(() => {
        setIsSpinning(false)
      }, 1000)
    } else {
      setIsSpinning(false)
    }
  }

  useEffect(() => {
    if (winners.length === winnersCount && onComplete) {
      onComplete(winners)
    }
  }, [winners, winnersCount, onComplete])

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])

  const canSpin = !isSpinning && winners.length < winnersCount && participants.length > 0

  return (
    <div className="flex flex-col items-center gap-6 p-6">
      {/* Display da Roleta */}
      <div 
        className={`
          relative w-full max-w-md h-48 rounded-xl border-2
          flex items-center justify-center text-2xl font-bold
          transition-all duration-300
          ${isSpinning 
            ? 'border-yellow-500 bg-gradient-to-br from-yellow-900/30 to-orange-900/30 animate-pulse' 
            : 'border-neutral-700 bg-neutral-900/50'
          }
        `}
      >
        {currentDisplay ? (
          <div className={`transition-all ${isSpinning ? 'scale-110' : 'scale-100'}`}>
            {currentDisplay}
          </div>
        ) : (
          <div className="text-neutral-600">
            {participants.length === 0 ? 'Sem participantes' : 'Pronto para sortear'}
          </div>
        )}
        
        {isSpinning && (
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-2 left-2 w-3 h-3 bg-yellow-500 rounded-full animate-ping" />
            <div className="absolute top-2 right-2 w-3 h-3 bg-yellow-500 rounded-full animate-ping" style={{ animationDelay: '0.2s' }} />
            <div className="absolute bottom-2 left-2 w-3 h-3 bg-yellow-500 rounded-full animate-ping" style={{ animationDelay: '0.4s' }} />
            <div className="absolute bottom-2 right-2 w-3 h-3 bg-yellow-500 rounded-full animate-ping" style={{ animationDelay: '0.6s' }} />
          </div>
        )}
      </div>

      {/* Info sobre progresso */}
      <div className="text-center">
        <div className="text-sm opacity-70">
          Vencedor {winners.length + 1} de {winnersCount}
        </div>
        <div className="text-xs opacity-50 mt-1">
          {participants.length} participantes totais
        </div>
      </div>

      {/* Botão de Sortear */}
      <button
        onClick={startSpin}
        disabled={!canSpin}
        className={`
          px-8 py-3 rounded-lg font-semibold text-lg
          transition-all duration-300 transform
          ${canSpin
            ? 'bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-500 hover:to-orange-500 hover:scale-105 shadow-lg'
            : 'bg-neutral-800 text-neutral-600 cursor-not-allowed'
          }
        `}
      >
        {isSpinning ? (
          <span className="flex items-center gap-2">
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Sorteando...
          </span>
        ) : winners.length >= winnersCount ? (
          'Sorteio Completo'
        ) : (
          '🎰 Sortear Vencedor'
        )}
      </button>

      {/* Lista de Vencedores */}
      {winners.length > 0 && (
        <div className="w-full max-w-md">
          <div className="text-sm font-medium mb-2 opacity-70">🏆 Vencedores:</div>
          <div className="space-y-2">
            {winners.map((userId, idx) => {
              const participant = participants.find(p => p.user_id === userId)
              return (
                <div 
                  key={userId}
                  className="flex items-center gap-3 p-3 rounded-lg bg-gradient-to-r from-yellow-900/20 to-orange-900/20 border border-yellow-700/30"
                >
                  <span className="text-2xl">#{idx + 1}</span>
                  <span className="font-medium">{participant?.username || userId}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
