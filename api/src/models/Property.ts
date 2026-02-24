export type PropertyType = 'commercial_office' | 'commercial_retail' | 'commercial_industrial' | 'residential';

export interface Property {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  propertyType: PropertyType;
  squareFeet: number;
  monthlyRent: number;
  ownerId: string;
  createdAt: Date;
}

export interface CreatePropertyDto {
  name: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  propertyType: PropertyType;
  squareFeet: number;
  monthlyRent: number;
}