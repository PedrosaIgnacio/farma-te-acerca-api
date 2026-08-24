import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';
import { CreateRequestDto } from '../../requests/dto/create-request.dto';

// Same shape as a collaborator's own POST /requests body, plus the
// colaborador it's being filed for — HC picks them explicitly instead of
// the id coming from the JWT.
export class CreateHcRequestDto extends CreateRequestDto {
  @ApiProperty({ description: 'Colaborador para el que se crea la solicitud.' })
  @IsUUID()
  colabId: string;
}
