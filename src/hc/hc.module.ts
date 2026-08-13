import { Module } from '@nestjs/common';
import { HcController } from './hc.controller';
import { HcService } from './hc.service';

@Module({
  controllers: [HcController],
  providers: [HcService],
})
export class HcModule {}
