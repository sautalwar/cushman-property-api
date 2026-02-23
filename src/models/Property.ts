export interface Property {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  propertyType: 'office' | 'retail' | 'industrial' | 'multifamily';
  squareFeet: number;
  yearBuilt: number;
  occupancyRate: number;
  monthlyRent: number;
  ownerId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePropertyDto {
  name: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  propertyType: 'office' | 'retail' | 'industrial' | 'multifamily';
  squareFeet: number;
  yearBuilt: number;
  monthlyRent: number;
}
