'use client';

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';

const supabase = createClientComponentClient();

export default function LoginPage() {
  return (
    <div className="flex justify-center items-center py-10">
      <div className="w-full max-w-md p-8 space-y-3 rounded-xl bg-white shadow-xl">
        <h2 className="text-2xl font-bold text-center text-gray-800">Zaloguj się / Zarejestruj</h2>
        
        {/* Supabase Auth UI Widget */}
        <Auth
          supabaseClient={supabase}
          appearance={{ theme: ThemeSupa }}
          providers={['github', 'google']} // Upewnij się, że masz to skonfigurowane w Supabase
          redirectTo={`${window.location.origin}/auth/callback`}
          view="sign_in" 
          theme="default"
          localization={{
            variables: {
              sign_in: {
                email_label: 'Adres E-mail',
                password_label: 'Hasło',
                button_label: 'Zaloguj się',
                social_provider_text: 'Zaloguj się przez {{provider}}',
                link_text: 'Nie masz konta? Zarejestruj się',
                // 💡 DODANO: Link do resetowania hasła
                forgotten_password_label: 'Zapomniałeś hasła?', 
              },
              sign_up: {
                email_label: 'Adres E-mail',
                password_label: 'Hasło',
                button_label: 'Zarejestruj się',
                social_provider_text: 'Zarejestruj się przez {{provider}}',
                link_text: 'Masz już konto? Zaloguj się',
              },
              // 💡 DODANO: Lokalizacja dla widoku "Zapomniałem hasła"
              forgotten_password: {
                email_label: 'Adres E-mail',
                password_label: 'Nowe Hasło',
                button_label: 'Wyślij instrukcje resetowania',
                link_text: 'Pamiętasz hasło? Zaloguj się',
                loading_button_text: 'Wysyłanie...',
              },
              // 💡 DODANO: Lokalizacja dla widoku "Zaktualizuj hasło" (po kliknięciu w link z e-maila)
              update_password: {
                password_label: 'Nowe Hasło',
                password_input_placeholder: 'Twoje nowe hasło',
                button_label: 'Zmień hasło',
                loading_button_text: 'Zmieniam hasło...',
              },
              // Opcjonalne: Spolszczenie wiadomości magicznego linku
              magic_link: {
                email_label: 'Adres E-mail',
                button_label: 'Wyślij Magiczny Link',
                link_text: 'Zaloguj się za pomocą magicznego linku',
              },
            },
          }}
        />
      </div>
    </div>
  );
}