import { ClassType } from './class-type';
import { InterfaceType } from './interface-type';
import { MappedType } from './mapped-type';
import { ObjectType } from './object-type';

export type StructuralType = InterfaceType | ClassType | ObjectType | MappedType;