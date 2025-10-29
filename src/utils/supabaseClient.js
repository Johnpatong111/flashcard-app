// src/utils/supabaseClient.js

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let client = null;

if (supabaseUrl && supabaseAnonKey) {
  // Klucze są OK, możemy utworzyć klienta
  client = createClient(supabaseUrl, supabaseAnonKey);
} else {
  // Klucze są puste! Wypisujemy błąd, który jest pomijany
  console.error(
    "⚠️ BŁĄD SUPABASE: Zmienne środowiskowe NEXT_PUBLIC_SUPABASE_URL lub ANON_KEY są puste. Sprawdź plik .env.local i zrestartuj serwer!"
  );
  
  // Tworzymy atrapę klienta, aby uniknąć crasha (choć to i tak nie zadziała)
  // W tym przypadku lepiej, żeby client pozostał nullem/undefined i ujawnił błąd, 
  // co już się stało. Kluczowe jest naprawienie .env.local.
}

export const supabase = client;