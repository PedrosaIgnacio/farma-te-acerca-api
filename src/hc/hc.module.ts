import { Module } from '@nestjs/common';
import { RequestsModule } from '../requests/requests.module';
import { HcController } from './hc.controller';
import { HcService } from './hc.service';

@Module({
  imports: [RequestsModule],
  controllers: [HcController],
  providers: [HcService],
})
export class HcModule {}
