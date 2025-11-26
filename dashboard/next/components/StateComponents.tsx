'use client';

interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({ icon = '📭', title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="text-6xl mb-4">{icon}</div>
      <h3 className="text-xl font-semibold text-gray-300 mb-2">{title}</h3>
      {description && <p className="text-gray-500 text-center max-w-md mb-6">{description}</p>}
      {action && (
        <button
          onClick={action.onClick}
          className="px-6 py-2.5 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 font-medium transition-all"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

interface ErrorStateProps {
  error: string;
  onRetry?: () => void;
}

export function ErrorState({ error, onRetry }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="text-6xl mb-4">⚠️</div>
      <h3 className="text-xl font-semibold text-red-400 mb-2">Erro ao carregar dados</h3>
      <p className="text-gray-400 text-center max-w-md mb-6">{error}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-6 py-2.5 rounded-lg bg-gray-700 hover:bg-gray-600 border border-gray-600 transition-all flex items-center gap-2"
        >
          🔄 Tentar novamente
        </button>
      )}
    </div>
  );
}

interface LoadingStateProps {
  message?: string;
}

export function LoadingState({ message = 'Carregando...' }: LoadingStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="relative w-16 h-16 mb-4">
        <div className="absolute inset-0 rounded-full border-4 border-gray-700"></div>
        <div className="absolute inset-0 rounded-full border-4 border-purple-500 border-t-transparent animate-spin"></div>
      </div>
      <p className="text-gray-400">{message}</p>
    </div>
  );
}

interface ServiceUnavailableProps {
  serviceName: string;
  onBack?: () => void;
}

export function ServiceUnavailable({ serviceName, onBack }: ServiceUnavailableProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="text-6xl mb-4">🔧</div>
      <h3 className="text-xl font-semibold text-yellow-400 mb-2">Sistema Temporariamente Indisponível</h3>
      <p className="text-gray-400 text-center max-w-md mb-2">
        O sistema de <strong>{serviceName}</strong> está temporariamente indisponível.
      </p>
      <p className="text-gray-500 text-sm text-center max-w-md mb-6">
        Isso pode acontecer durante manutenção ou se o módulo ainda não foi configurado no bot.
      </p>
      {onBack && (
        <button
          onClick={onBack}
          className="px-6 py-2.5 rounded-lg bg-gray-700 hover:bg-gray-600 border border-gray-600 transition-all"
        >
          ← Voltar
        </button>
      )}
    </div>
  );
}
