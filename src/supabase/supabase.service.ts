import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from '@supabase/supabase-js';

type SupabaseClient = ReturnType<typeof createClient>;

@Injectable()
export class SupabaseService {
  // Service-role client: verifies arbitrary user JWTs and provisions/manages
  // auth.users — never exposed to the frontend.
  readonly admin: SupabaseClient;
  // Anon client: used for the operations Supabase expects the end-user
  // context to drive (sign-in, password recovery), same as the frontend
  // would use with the public anon key.
  readonly anon: SupabaseClient;

  constructor(configService: ConfigService) {
    const url = configService.getOrThrow<string>('SUPABASE_URL');
    const clientOptions = {
      auth: { autoRefreshToken: false, persistSession: false },
    };

    this.admin = createClient(
      url,
      configService.getOrThrow<string>('SUPABASE_SERVICE_ROLE_KEY'),
      clientOptions,
    );
    this.anon = createClient(
      url,
      configService.getOrThrow<string>('SUPABASE_ANON_KEY'),
      clientOptions,
    );
  }
}
