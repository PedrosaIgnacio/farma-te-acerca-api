import { Module } from '@nestjs/common';
import { DtController } from './dt.controller';
import { DtService } from './dt.service';

@Module({
  controllers: [DtController],
  providers: [DtService],
})
export class DtModule {}
