import { Star } from 'lucide-react';

interface StarRatingProps {
    value: number;
    onChange?: (value: number) => void;
    readonly?: boolean;
    size?: 'sm' | 'md' | 'lg';
    showLabel?: boolean;
}

const labels = ['', 'Kurang', 'Cukup', 'Baik', 'Sangat Baik', 'Istimewa'];

export default function StarRating({ value, onChange, readonly = false, size = 'md', showLabel = true }: StarRatingProps) {
    const sizeClasses = {
        sm: 'w-4 h-4',
        md: 'w-6 h-6',
        lg: 'w-8 h-8',
    };

    return (
        <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
                <button
                    key={star}
                    type="button"
                    disabled={readonly}
                    onClick={() => onChange?.(star === value ? 0 : star)}
                    className={`transition-all duration-150 ${readonly ? 'cursor-default' : 'cursor-pointer hover:scale-110'
                        }`}
                    title={labels[star]}
                >
                    <Star
                        className={`${sizeClasses[size]} transition-colors ${star <= value
                            ? 'fill-amber-400 text-amber-400'
                            : 'fill-transparent text-gray-300 hover:text-amber-200'
                            }`}
                    />
                </button>
            ))}
            {showLabel && value > 0 && (
                <span className={`ml-2 font-medium ${value >= 4 ? 'text-green-600' : value >= 3 ? 'text-blue-600' : value >= 2 ? 'text-amber-600' : 'text-red-600'
                    } ${size === 'sm' ? 'text-xs' : 'text-sm'}`}>
                    {labels[value]}
                </span>
            )}
        </div>
    );
}
