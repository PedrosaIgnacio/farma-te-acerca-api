import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { SupabaseModule } from './supabase/supabase.module';
import { AuthModule } from './auth/auth.module';
import { BranchesModule } from './branches/branches.module';
import { RequestsModule } from './requests/requests.module';
import { HcModule } from './hc/hc.module';
import { DtModule } from './dt/dt.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    SupabaseModule,
    AuthModule,
    BranchesModule,
    RequestsModule,
    HcModule,
    DtModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
