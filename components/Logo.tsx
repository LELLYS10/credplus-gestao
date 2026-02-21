
import React, { useState } from 'react';
import { DollarSign } from 'lucide-react';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const Logo: React.FC<LogoProps> = ({ className = '', size = 'md' }) => {
  const [error, setError] = useState(false);

  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-20 h-20',
    xl: 'w-28 h-28',
  };

  const iconSizes = {
    sm: 16,
    md: 24,
    lg: 40,
    xl: 56,
  };

  if (!error) {
    return (
      <img
        src="logo.png"
        alt="CREDPLUS"
        className={`${sizeClasses[size]} object-contain ${className}`}
        onError={() => setError(true)}
      />
    );
  }

  // Fallback elegante caso a imagem logo.png não exista no diretório
  return (
    <div className={`${sizeClasses[size]} rounded-full bg-emerald-600 border-2 border-amber-400 flex items-center justify-center shadow-inner ${className}`}>
      <div className="relative">
        <DollarSign size={iconSizes[size]} className="text-white drop-shadow-md" />
        <div className="absolute -top-1 -right-1 w-2 h-2 bg-amber-400 rounded-full animate-pulse"></div>
      </div>
    </div>
  );
};

export default Logo;
