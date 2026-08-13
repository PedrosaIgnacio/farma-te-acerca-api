import { Role } from '../../generated/prisma';

export { Role };

export interface AuthenticatedUser {
  id: string;
  legajo: string;
  fullName: string;
  role: Role;
  email: string;
}
