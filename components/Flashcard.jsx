'use client';

import { useState, useEffect } from 'react';
import { Trash2, CalendarDays, Hourglass, Eye, Check } from 'lucide-react'; 

// Funkcja pomocnicza do formatowania daty
const formatDate = (dateString) => {
    if (!dateString) return 'Brak'; 
    try {
        const date = new Date(dateString);
        const today = new Date();
        // Sprawdzamy, czy data to dzisiaj
        if (date.toDateString() === today.toDateString()) {
            return 'Dzisiaj';
        }
        return date.toLocaleDateString('pl-PL', {
            month: 'short', 
            day: 'numeric',
        });
    } catch (e) {
        return 'Błąd daty';
    }
};

// Nowa lista propsów: dodano onReview i testMode
export default function Flashcard({ card, onDelete, onReview, testMode }) {
    const [isFlipped, setIsFlipped] = useState(false);
    // Stan: Czy odpowiedź została odkryta (kluczowe dla trybu 'typing')
    const [isAnswerRevealed, setIsAnswerRevealed] = useState(false); 
    // Stan: Input użytkownika w trybie 'typing'
    const [inputValue, setInputValue] = useState('');
    const [isCorrect, setIsCorrect] = useState(null); // null, true, false - status weryfikacji
    
    // UŻYJ TYLKO PRZY RE-RENDERZE KARTY LUB ZMIANIE TRYBU
    useEffect(() => {
        // Reset stanu przy zmianie karty lub trybu
        setIsFlipped(false);
        setIsAnswerRevealed(false); 
        setInputValue('');
        setIsCorrect(null);
    }, [card.id, testMode]); 

    // Przełączanie karty: działa tylko w trybie 'review'
    const handleFlip = () => {
        if (testMode === 'review') {
            setIsFlipped(prev => !prev);
            // Automatyczne odkrycie w trybie 'review'
            setIsAnswerRevealed(true); 
        }
    };

    const handleDelete = (e) => {
        e.stopPropagation(); 
        if (confirm('Czy na pewno chcesz usunąć tę fiszkę?')) {
            onDelete(card.id);
        }
    };
    
    // LOGIKA TRYBU PISANIA
    const handleCheckAnswer = () => {
        const correct = card.strona_b.trim().toLowerCase();
        const input = inputValue.trim().toLowerCase();

        // Ustawiamy stan odpowiedzi i odkrywamy kartę
        setIsCorrect(input === correct);
        setIsAnswerRevealed(true); 
    };

    const handleRevealAnswer = () => {
        setIsAnswerRevealed(true);
        setIsCorrect(false); // Ustawiamy na fałsz, bo użytkownik się poddał
    };
    
    // Po odkryciu w trybie 'typing', zwalniamy przyciski SRS w DeckManager
    useEffect(() => {
        if (isAnswerRevealed && testMode === 'typing') {
            // Po odkryciu odpowiedzi, przekazujemy fałszywy event do DeckManagera,
            // aby odsłonił przyciski SRS i użytkownik mógł ocenić kartę.
            // W tym przypadku DeckManager po prostu wyświetli przyciski.
        }
    }, [isAnswerRevealed, testMode]);
    
    if (!card) return null;

    const nextReviewDate = card.next_review_date;
    const formattedNextReviewDate = formatDate(nextReviewDate);
    const isOverdue = nextReviewDate && new Date(nextReviewDate) < new Date();
    
    // W trybie 'pisanie', karta jest odwracana TYLKO po odkryciu odpowiedzi
    // W trybie 'review', jest odwracana kliknięciem
    const isCardVisible = testMode === 'review' ? isFlipped : isAnswerRevealed;
    
    // Czy pokazać Przyciski Oceny SRS na samym dole w DeckManager?
    // W DeckManagerze są pokazane, gdy testMode === 'review' LUB gdy odpowiedź została odkryta.
    // W trybie pisania, po odkryciu, potrzebujemy przycisków
    const showReviewButtons = testMode === 'review' || isAnswerRevealed;


    return (
        <div 
            className={`relative w-full max-w-lg h-64 mx-auto cursor-pointer 
                        rounded-xl shadow-2xl transition-transform duration-500 
                        transform-style-preserve-3d ${isCardVisible ? '[transform:rotateY(180deg)]' : ''}`}
            // Klikanie działa tylko w trybie 'review'
            onClick={testMode === 'review' ? handleFlip : undefined}
        >
            
            {/* Front Karty (STRONA A) - Polski/Koncepcja */}
            <div className="absolute w-full h-full backface-hidden bg-white p-6 border-4 border-indigo-600 rounded-xl flex flex-col items-center justify-center">
                
                {/* 💡 TREŚĆ W TRYBIE PISANIA: POKAZUJEMY TYLKO STRONĘ A */}
                {testMode === 'typing' && !isAnswerRevealed ? (
                    <div className="flex-grow flex flex-col items-center justify-center text-center w-full">
                        <p className="text-sm font-light text-gray-500 mb-2">Wpisz tłumaczenie do:</p>
                        <p className="text-3xl font-bold text-gray-900 mb-6">{card.strona_a}</p>
                        
                        <input 
                            type="text"
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            className="w-full max-w-sm px-4 py-3 text-lg text-gray-900 rounded-lg border border-gray-300 focus:ring-indigo-500 focus:border-indigo-500"
                            placeholder="Wpisz odpowiedź..."
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleCheckAnswer();
                            }}
                        />
                        <div className="flex space-x-4 mt-4">
                            <button onClick={handleCheckAnswer} className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
                                <Check className="w-5 h-5 mr-1" /> Sprawdź
                            </button>
                            <button onClick={handleRevealAnswer} className="flex items-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700">
                                <Eye className="w-5 h-5 mr-1" /> Odkryj
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="flex-grow flex flex-col items-center justify-center text-center">
                        <p className="text-sm font-light text-gray-500 mb-2">Słowo/Fraza</p>
                        <p className="text-2xl font-bold text-gray-900">{card.strona_a || "Brak słowa polskiego"}</p>
                    </div>
                )}
                
                {/* Wskaźnik Daty Powtórki (na dole po lewej) */}
                <div className="absolute bottom-4 left-4 flex items-center text-xs font-medium">
                    <CalendarDays className="w-3 h-3 mr-1 text-indigo-500" />
                    <span className={isOverdue ? 'font-bold text-red-500' : 'text-gray-600'}>
                        {isOverdue ? 'Zaległe: ' : 'Następna: '} {formattedNextReviewDate}
                    </span>
                </div>

                {/* Przycisk Usuń (na górze po prawej) */}
                <button 
                    onClick={handleDelete}
                    className="absolute top-4 right-4 text-red-500 hover:text-red-700 transition"
                    aria-label="Usuń fiszkę"
                >
                    <Trash2 className="w-5 h-5" />
                </button>
            </div>
            
            {/* Tył Karty (STRONA B) - Tłumaczenie/Język obcy */}
            <div 
                className="absolute w-full h-full backface-hidden [transform:rotateY(180deg)] 
                            p-6 border-4 border-indigo-900 rounded-xl flex flex-col items-center justify-center"
                style={{ backgroundColor: '#1f2937', color: 'white' }} 
            >
                <div className="flex-grow flex flex-col items-center justify-center text-center w-full">
                    
                    {/* Wskaźnik poprawności w trybie pisania */}
                    {isAnswerRevealed && testMode === 'typing' && (
                        <div className="absolute top-4 w-full px-6">
                            <div className={`py-2 px-4 rounded-lg font-bold text-white ${isCorrect ? 'bg-green-600' : 'bg-red-600'}`}>
                                {isCorrect ? '✅ Poprawnie!' : '❌ Błąd. Poprawna odpowiedź to:'}
                            </div>
                        </div>
                    )}

                    <p className="text-sm font-light opacity-80 mb-2" style={{ color: 'white' }}>Tłumaczenie</p>
                    <p className="text-2xl font-bold" style={{ color: 'white' }}>{card.strona_b || "Brak tłumaczenia"}</p>
                    
                    {/* 💡 NOWY KOD: Warunkowe wyświetlanie Przykładu */}
                    {card.przyklad && (
                        <div className="mt-4 p-2 w-full max-w-sm text-center bg-gray-700/50 rounded-lg">
                            <p className="text-xs font-semibold opacity-90 mb-1">Przykład użycia:</p>
                            <p className="italic text-base">"{card.przyklad}"</p>
                        </div>
                    )}
                </div>
                
                {/* Wskaźnik Interwału (na dole po lewej) */}
                <div className="absolute bottom-4 left-4 flex items-center text-xs font-medium" style={{ color: 'white', opacity: 0.8 }}>
                    <Hourglass className="w-3 h-3 mr-1" style={{ color: 'white', opacity: 0.8 }} />
                    <span>
                        Interwał: **{card.repetition_interval || 0} dni**
                    </span>
                </div>
            </div>
        </div>
    );
}